"""
DB_manage/migration.py
로컬 파일 → GCS 마이그레이션 스크립트.

사용 방법:
    # 먼저 dry-run으로 확인
    python DB_manage/migration.py --dry-run

    # 특정 사용자만
    python DB_manage/migration.py --user-id 1 --execute

    # 전체 사용자
    python DB_manage/migration.py --execute

⚠️  --execute 없이 실행하면 항상 dry-run (안전 기본값)
⚠️  기존 로컬 파일은 삭제하지 않음 (검증 후 수동 정리)
"""

import argparse
import os
import sys
from pathlib import Path

# itdasy-beauty-app-main 프로젝트 루트를 sys.path에 추가
PROJECT_ROOT = Path(__file__).resolve().parent.parent / "itdasy-beauty-app-main"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from DB_manage.cloud_storage import get_storage_manager, GCSStorageManager


DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{PROJECT_ROOT}/itdasy.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


class LocalToGCSMigrator:

    def __init__(self, storage: GCSStorageManager, project_root: Path):
        self.storage = storage
        self.root = project_root

    # ──────────────── 로컬 파일 스캔 ────────────────

    def scan_local_files(self, user_id: int, db) -> list[dict]:
        """
        사용자 소유의 로컬 파일 전체 스캔.
        반환: [{"local_path", "object_name", "file_type", "size_bytes"}, ...]
        """
        results = []

        # 1) users/{user_id}/outputs/
        outputs_dir = self.root / "users" / str(user_id) / "outputs"
        if outputs_dir.exists():
            for f in outputs_dir.iterdir():
                if f.is_file():
                    results.append({
                        "local_path": f,
                        "object_name": self.storage.get_output_name(user_id, f.name),
                        "file_type": "output",
                        "size_bytes": f.stat().st_size,
                    })

        # 2) users/{user_id}/backgrounds/
        bg_dir = self.root / "users" / str(user_id) / "backgrounds"
        if bg_dir.exists():
            for f in bg_dir.iterdir():
                if f.is_file():
                    results.append({
                        "local_path": f,
                        "object_name": self.storage.get_background_name(user_id, f.name),
                        "file_type": "background",
                        "size_bytes": f.stat().st_size,
                    })

        # 3) static/uploads/portfolio/ (DB에서 user_id 소유 파일 조회)
        portfolio_rows = db.execute(
            text("SELECT image_url FROM portfolio WHERE user_id=:uid"),
            {"uid": user_id}
        ).fetchall()
        for (url,) in portfolio_rows:
            # url 예: /static/uploads/portfolio/abc123.jpg
            rel = url.lstrip("/")
            local_path = self.root / rel
            if local_path.exists():
                results.append({
                    "local_path": local_path,
                    "object_name": self.storage.get_portfolio_name(user_id, local_path.name),
                    "file_type": "portfolio",
                    "size_bytes": local_path.stat().st_size,
                })

        # 4) static/uploads/backgrounds/ (DB에서 user_id 소유 파일 조회)
        bg_rows = db.execute(
            text("SELECT image_url FROM background_assets WHERE user_id=:uid"),
            {"uid": user_id}
        ).fetchall()
        for (url,) in bg_rows:
            rel = url.lstrip("/")
            local_path = self.root / rel
            if local_path.exists():
                results.append({
                    "local_path": local_path,
                    "object_name": self.storage.get_background_name(user_id, local_path.name),
                    "file_type": "background",
                    "size_bytes": local_path.stat().st_size,
                })

        return results

    # ──────────────── 단일 사용자 마이그레이션 ────────────────

    def migrate_user(self, user_id: int, dry_run: bool = True) -> dict:
        """
        사용자 파일 로컬 → GCS. 이미 synced된 파일은 스킵 (멱등).
        dry_run=True: 업로드 없이 계획만 출력.
        """
        db = SessionLocal()
        try:
            files = self.scan_local_files(user_id, db)
            total = len(files)
            success = skipped = failed = 0
            total_bytes = 0

            # 이미 마이그레이션된 object_name 목록
            synced_rows = db.execute(
                text("SELECT object_name FROM cloud_file_records WHERE user_id=:uid AND is_synced=1"),
                {"uid": user_id}
            ).fetchall()
            synced_set = {r[0] for r in synced_rows}

            for item in files:
                obj = item["object_name"]

                if obj in synced_set:
                    print(f"  [SKIP] {obj}")
                    skipped += 1
                    continue

                print(f"  [{'DRY' if dry_run else 'UP '}] {item['local_path'].name} → {obj} ({item['size_bytes']//1024}KB)")

                if not dry_run:
                    try:
                        gcs_url = self.storage.upload_file(
                            local_path=item["local_path"],
                            object_name=obj,
                            content_type=self._guess_mime(item["local_path"]),
                        )
                        # cloud_file_records 기록
                        db.execute(text("""
                            INSERT OR IGNORE INTO cloud_file_records
                                (user_id, object_name, file_type, original_filename,
                                 size_bytes, gcs_url, local_path, is_synced)
                            VALUES (:uid, :obj, :ft, :fn, :sz, :url, :lp, 1)
                        """), {
                            "uid": user_id, "obj": obj, "ft": item["file_type"],
                            "fn": item["local_path"].name, "sz": item["size_bytes"],
                            "url": gcs_url, "lp": str(item["local_path"]),
                        })
                        db.commit()
                        success += 1
                        total_bytes += item["size_bytes"]
                    except Exception as e:
                        print(f"  [FAIL] {obj}: {e}")
                        failed += 1
                else:
                    success += 1
                    total_bytes += item["size_bytes"]

            result = {
                "user_id": user_id, "total": total,
                "success": success, "skipped": skipped, "failed": failed,
                "total_bytes": total_bytes,
                "dry_run": dry_run,
            }
            print(f"\n  결과 (user={user_id}): 총 {total}개, 성공 {success}, 스킵 {skipped}, 실패 {failed}, {total_bytes//1024}KB\n")
            return result
        finally:
            db.close()

    # ──────────────── 전체 마이그레이션 ────────────────

    def migrate_all(self, dry_run: bool = True) -> dict:
        """모든 사용자 마이그레이션."""
        db = SessionLocal()
        try:
            user_ids = [r[0] for r in db.execute(text("SELECT id FROM users")).fetchall()]
        finally:
            db.close()

        results = []
        for uid in user_ids:
            print(f"\n[사용자 {uid}]")
            results.append(self.migrate_user(uid, dry_run=dry_run))
        return {"users": results, "dry_run": dry_run}

    # ──────────────── DB URL 업데이트 (선택) ────────────────

    def update_db_urls(self, dry_run: bool = True) -> dict:
        """
        Portfolio.image_url, BackgroundAsset.image_url을
        로컬 경로(/static/...) → GCS URL로 교체.

        ⚠️  실행 전 반드시 DB 백업!
        """
        db = SessionLocal()
        try:
            changed = 0

            # Portfolio
            rows = db.execute(
                text("SELECT id, user_id, image_url FROM portfolio WHERE image_url LIKE '/static/%'")
            ).fetchall()
            for (pid, uid, url) in rows:
                local_name = Path(url).name
                new_url = self.storage._public_url(self.storage.get_portfolio_name(uid, local_name))
                print(f"  [Portfolio {pid}] {url} → {new_url}")
                if not dry_run:
                    db.execute(
                        text("UPDATE portfolio SET image_url=:url WHERE id=:id"),
                        {"url": new_url, "id": pid}
                    )
                changed += 1

            # BackgroundAsset
            rows = db.execute(
                text("SELECT id, user_id, image_url FROM background_assets WHERE image_url LIKE '/static/%'")
            ).fetchall()
            for (bid, uid, url) in rows:
                local_name = Path(url).name
                new_url = self.storage._public_url(self.storage.get_background_name(uid, local_name))
                print(f"  [Background {bid}] {url} → {new_url}")
                if not dry_run:
                    db.execute(
                        text("UPDATE background_assets SET image_url=:url WHERE id=:id"),
                        {"url": new_url, "id": bid}
                    )
                changed += 1

            if not dry_run:
                db.commit()

            return {"changed": changed, "dry_run": dry_run}
        finally:
            db.close()

    @staticmethod
    def _guess_mime(path: Path) -> str:
        ext = path.suffix.lower()
        return {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".webp": "image/webp",
            ".gif": "image/gif", ".mp4": "video/mp4",
        }.get(ext, "application/octet-stream")


# ─────────────────────────────── CLI ───────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="로컬 파일 → GCS 마이그레이션 (기본값: dry-run)"
    )
    parser.add_argument("--user-id", type=int, default=None, help="특정 사용자만 마이그레이션")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="업로드 없이 계획만 출력 (기본값)")
    parser.add_argument("--execute", action="store_true",
                        help="실제 업로드 실행 (이 옵션 없으면 dry-run)")
    parser.add_argument("--update-urls", action="store_true",
                        help="DB의 로컬 URL → GCS URL 교체")
    args = parser.parse_args()

    dry_run = not args.execute
    if dry_run:
        print("=" * 60)
        print("  DRY-RUN 모드: 실제 업로드 없음")
        print("  실제 실행하려면 --execute 옵션 추가")
        print("=" * 60)

    storage = get_storage_manager()
    if storage is None:
        print("[ERROR] GCS 연결 실패: CLOUD_STORAGE_ENABLED=true 및 GCS_BUCKET_NAME 확인")
        sys.exit(1)

    migrator = LocalToGCSMigrator(storage=storage, project_root=PROJECT_ROOT)

    if args.update_urls:
        print("\n[DB URL 업데이트]")
        result = migrator.update_db_urls(dry_run=dry_run)
        print(f"변경 대상: {result['changed']}개 {'(실제 미적용)' if dry_run else '(적용 완료)'}")
        return

    if args.user_id:
        migrator.migrate_user(args.user_id, dry_run=dry_run)
    else:
        migrator.migrate_all(dry_run=dry_run)


if __name__ == "__main__":
    main()
