"""
DB_manage/backup.py
SQLite DB + 사용자 파일 → GCS 백업/복원 매니저.

사용 예:
    from DB_manage.backup import BackupManager
    from DB_manage.cloud_storage import get_storage_manager

    bm = BackupManager(
        storage=get_storage_manager(),
        db_path="./itdasy.db",
        users_root="./users",
    )
    bm.backup_database(db_session)
    bm.backup_user_files(user_id=3, db=db_session)
"""

import gzip
import io
import sqlite3
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

from sqlalchemy import text
from sqlalchemy.orm import Session

from DB_manage.cloud_storage import GCSStorageManager, StorageError


class BackupManager:

    BACKUP_RETAIN_COUNT = 30  # 백업 보존 개수 (오래된 것부터 삭제)

    def __init__(
        self,
        storage: GCSStorageManager,
        db_path: str = "./itdasy.db",
        users_root: str = "./users",
    ):
        self.storage = storage
        self.db_path = Path(db_path)
        self.users_root = Path(users_root)

    # ──────────────── DB 백업 ────────────────

    def backup_database(self, db: Session) -> dict:
        """
        SQLite DB → SQL 덤프 → gzip → GCS 업로드.
        최신 BACKUP_RETAIN_COUNT개 유지, 오래된 것 자동 삭제.
        반환: {"object_name": str, "size_bytes": int, "status": "success"}
        """
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        object_name = self.storage.get_backup_name("db", f"itdasy_{ts}")

        # BackupLog 기록 (running)
        db.execute(text("""
            INSERT INTO backup_logs (backup_type, status, started_at)
            VALUES ('db', 'running', CURRENT_TIMESTAMP)
        """))
        db.commit()
        log_id = db.execute(text("SELECT last_insert_rowid()")).scalar()

        try:
            # SQLite 덤프 → gzip 압축
            dump_data = self._dump_sqlite()
            compressed = gzip.compress(dump_data, compresslevel=6)
            size_bytes = len(compressed)

            # GCS 업로드
            self.storage.upload_bytes(
                data=compressed,
                object_name=object_name,
                content_type="application/gzip",
            )

            # 오래된 백업 정리
            self._prune_old_backups("db")

            # BackupLog 성공 업데이트
            db.execute(text("""
                UPDATE backup_logs
                SET status='success', object_name=:obj, size_bytes=:size,
                    finished_at=CURRENT_TIMESTAMP
                WHERE id=:lid
            """), {"obj": object_name, "size": size_bytes, "lid": log_id})
            db.commit()

            return {"object_name": object_name, "size_bytes": size_bytes, "status": "success"}

        except Exception as e:
            db.execute(text("""
                UPDATE backup_logs
                SET status='failed', error_msg=:err, finished_at=CURRENT_TIMESTAMP
                WHERE id=:lid
            """), {"err": str(e), "lid": log_id})
            db.commit()
            raise StorageError(f"DB 백업 실패: {e}") from e

    # ──────────────── 사용자 파일 백업 ────────────────

    def backup_user_files(self, user_id: int, db: Session) -> dict:
        """
        users/{user_id}/ 전체 → tar.gz → GCS 업로드.
        반환: {"object_name": str, "size_bytes": int, "status": "success"}
        """
        user_dir = self.users_root / str(user_id)
        if not user_dir.exists():
            return {"object_name": None, "size_bytes": 0, "status": "skipped",
                    "reason": f"users/{user_id}/ 디렉토리 없음"}

        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        object_name = self.storage.get_backup_name(f"users/{user_id}", f"files_{ts}")

        db.execute(text("""
            INSERT INTO backup_logs (backup_type, status, started_at)
            VALUES ('user_files', 'running', CURRENT_TIMESTAMP)
        """))
        db.commit()
        log_id = db.execute(text("SELECT last_insert_rowid()")).scalar()

        try:
            tarball = self._make_tarball(user_dir)
            size_bytes = len(tarball)

            self.storage.upload_bytes(
                data=tarball,
                object_name=object_name,
                content_type="application/gzip",
            )

            self._prune_old_backups(f"users/{user_id}")

            db.execute(text("""
                UPDATE backup_logs
                SET status='success', object_name=:obj, size_bytes=:size,
                    finished_at=CURRENT_TIMESTAMP
                WHERE id=:lid
            """), {"obj": object_name, "size": size_bytes, "lid": log_id})
            db.commit()

            return {"object_name": object_name, "size_bytes": size_bytes, "status": "success"}

        except Exception as e:
            db.execute(text("""
                UPDATE backup_logs
                SET status='failed', error_msg=:err, finished_at=CURRENT_TIMESTAMP
                WHERE id=:lid
            """), {"err": str(e), "lid": log_id})
            db.commit()
            raise StorageError(f"파일 백업 실패 (user={user_id}): {e}") from e

    # ──────────────── 전체 백업 ────────────────

    def backup_full(self, db: Session) -> dict:
        """
        DB + 전체 사용자 파일 백업.
        반환: {"db": dict, "users": [dict], "failed": [str]}
        """
        results = {"db": None, "users": [], "failed": []}

        # DB 백업
        try:
            results["db"] = self.backup_database(db)
        except StorageError as e:
            results["failed"].append(f"db: {e}")

        # 전체 사용자 파일 백업
        if self.users_root.exists():
            for user_dir in sorted(self.users_root.iterdir()):
                if user_dir.is_dir() and user_dir.name.isdigit():
                    user_id = int(user_dir.name)
                    try:
                        result = self.backup_user_files(user_id, db)
                        results["users"].append(result)
                    except StorageError as e:
                        results["failed"].append(f"user_{user_id}: {e}")

        return results

    # ──────────────── 백업 목록 ────────────────

    def list_backups(self, backup_type: str = "db") -> List[dict]:
        """
        GCS에서 백업 목록 조회.
        backup_type: "db" | "users/{user_id}" | "users" (전체)
        """
        prefix = f"backups/{backup_type}/"
        files = self.storage.list_files(prefix)
        return sorted(files, key=lambda x: x["updated"], reverse=True)

    # ──────────────── 복원 (주의: 운영 중 실행 금지) ────────────────

    def restore_database(
        self,
        object_name: str,
        db: Session,
        confirm: bool = False,
    ) -> None:
        """
        GCS의 DB 백업 → 현재 SQLite 복원.
        ⚠️  복원 후 서버 재시작 필요.
        ⚠️  운영 중 실행 시 데이터 손실 위험.
        confirm=True 없이 호출하면 에러.
        """
        if not confirm:
            raise StorageError(
                "복원은 위험한 작업입니다. confirm=True를 명시적으로 전달하세요. "
                "실행 전 서버를 중단하고 기존 DB를 수동 백업하세요."
            )

        # GCS에서 다운로드
        compressed = self.storage.download_bytes(object_name)
        sql_dump = gzip.decompress(compressed).decode("utf-8")

        # 현재 DB에 실행
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.executescript(sql_dump)
            conn.commit()
        finally:
            conn.close()

    # ──────────────── 내부 유틸 ────────────────

    def _dump_sqlite(self) -> bytes:
        """SQLite DB를 SQL 텍스트로 덤프 후 bytes 반환."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            dump = "\n".join(conn.iterdump())
            return dump.encode("utf-8")
        finally:
            conn.close()

    def _make_tarball(self, directory: Path) -> bytes:
        """디렉토리 → .tar.gz bytes."""
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            tar.add(str(directory), arcname=directory.name)
        return buf.getvalue()

    def _prune_old_backups(self, backup_type: str) -> None:
        """오래된 백업을 삭제해 BACKUP_RETAIN_COUNT개만 유지."""
        prefix = f"backups/{backup_type}/"
        files = sorted(
            self.storage.list_files(prefix),
            key=lambda x: x["updated"],
            reverse=True,
        )
        for old in files[self.BACKUP_RETAIN_COUNT:]:
            try:
                self.storage.delete_file(old["name"])
            except Exception:
                pass  # 삭제 실패는 무시 (다음 백업 때 재시도됨)
