"""
DB_manage/cloud_storage.py
Google Cloud Storage 연동 매니저.

인증 방법:
  1. 서비스 계정 JSON 키: GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
  2. ADC (로컬 개발): gcloud auth application-default login

환경변수:
  GCS_BUCKET_NAME=itdasy-beta
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json  (선택)
  CLOUD_STORAGE_ENABLED=true  (false면 None 반환)
"""

import os
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Optional, List, Union
from dotenv import load_dotenv

load_dotenv()


# ─────────────────────────────── 예외 ───────────────────────────────

class StorageError(Exception):
    """GCS 관련 기본 예외."""

class QuotaExceededError(StorageError):
    """1GB 용량 초과 시."""
    def __init__(self, used: int, max_bytes: int, needed: int):
        self.used = used
        self.max_bytes = max_bytes
        self.needed = needed
        super().__init__(
            f"저장 용량 초과: 사용 {used/1024**2:.1f}MB / {max_bytes/1024**2:.0f}MB, "
            f"필요 {needed/1024**2:.1f}MB"
        )

class FileNotFoundInCloudError(StorageError):
    """GCS에 파일이 없을 때."""


# ─────────────────────────────── 매니저 ───────────────────────────────

class GCSStorageManager:
    """
    Google Cloud Storage 파일 관리 클래스.
    utils/storage.py의 로컬 함수와 대응되는 메서드 제공.
    """

    def __init__(self, bucket_name: str):
        try:
            from google.cloud import storage as gcs
        except ImportError:
            raise StorageError(
                "google-cloud-storage 패키지가 없습니다. "
                "pip install google-cloud-storage>=2.0.0"
            )
        self._client = gcs.Client()
        self._bucket = self._client.bucket(bucket_name)
        self.bucket_name = bucket_name

    # ──────────────── 오브젝트명 생성 (utils/storage.py 대응) ────────────────

    @staticmethod
    def get_portfolio_name(user_id: int, filename: str) -> str:
        return f"users/{user_id}/portfolio/{filename}"

    @staticmethod
    def get_background_name(user_id: int, filename: str) -> str:
        return f"users/{user_id}/backgrounds/{filename}"

    @staticmethod
    def get_output_name(user_id: int, filename: str) -> str:
        return f"users/{user_id}/outputs/{filename}"

    @staticmethod
    def get_backup_name(backup_type: str, timestamp: str) -> str:
        return f"backups/{backup_type}/{timestamp}.gz"

    @staticmethod
    def make_unique_filename(original: str) -> str:
        """UUID 기반 고유 파일명 생성. 확장자 유지."""
        ext = Path(original).suffix or ".bin"
        return f"{uuid.uuid4().hex}{ext}"

    # ──────────────── 업로드 ────────────────

    def upload_file(
        self,
        local_path: "Union[str, Path]",
        object_name: str,
        content_type: str = None,
    ) -> str:
        """
        로컬 파일 → GCS 업로드.
        반환: GCS public URL (버킷이 공개 접근 허용 시) 또는 gs:// URI
        """
        blob = self._bucket.blob(object_name)
        blob.upload_from_filename(str(local_path), content_type=content_type)
        return self._public_url(object_name)

    def upload_bytes(
        self,
        data: bytes,
        object_name: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """
        메모리 데이터 → GCS 업로드 (DB 백업, 압축 파일 등).
        반환: GCS public URL
        """
        blob = self._bucket.blob(object_name)
        blob.upload_from_string(data, content_type=content_type)
        return self._public_url(object_name)

    # ──────────────── 다운로드 ────────────────

    def download_file(self, object_name: str, local_path: "Union[str, Path]") -> None:
        """GCS → 로컬 파일 다운로드."""
        blob = self._bucket.blob(object_name)
        if not blob.exists():
            raise FileNotFoundInCloudError(f"GCS에 파일 없음: {object_name}")
        blob.download_to_filename(str(local_path))

    def download_bytes(self, object_name: str) -> bytes:
        """GCS → 메모리로 다운로드."""
        blob = self._bucket.blob(object_name)
        if not blob.exists():
            raise FileNotFoundInCloudError(f"GCS에 파일 없음: {object_name}")
        return blob.download_as_bytes()

    # ──────────────── Signed URL (임시 접근) ────────────────

    def generate_signed_url(
        self,
        object_name: str,
        expiration: int = 3600,
    ) -> str:
        """
        임시 다운로드 URL 발급.
        expiration: 유효 시간(초), 기본 1시간.
        서비스 계정 키 없이 ADC 사용 시 IAM signBlob 권한 필요.
        """
        blob = self._bucket.blob(object_name)
        return blob.generate_signed_url(
            expiration=timedelta(seconds=expiration),
            method="GET",
            version="v4",
        )

    # ──────────────── 삭제 ────────────────

    def delete_file(self, object_name: str) -> None:
        """GCS 파일 삭제. 없어도 에러 없음."""
        blob = self._bucket.blob(object_name)
        if blob.exists():
            blob.delete()

    # ──────────────── 목록 조회 ────────────────

    def list_files(self, prefix: str) -> List[dict]:
        """
        prefix 아래 파일 목록 반환.
        반환: [{"name": str, "size": int, "updated": datetime}, ...]
        """
        blobs = self._client.list_blobs(self.bucket_name, prefix=prefix)
        return [
            {
                "name": b.name,
                "size": b.size,
                "updated": b.updated,
            }
            for b in blobs
        ]

    # ──────────────── 사용량 ────────────────

    def get_user_usage(self, user_id: int) -> dict:
        """
        GCS에서 실제 사용량 계산.
        반환: {"used_bytes": int, "file_count": int}
        """
        blobs = list(self._client.list_blobs(
            self.bucket_name,
            prefix=f"users/{user_id}/"
        ))
        used_bytes = sum(b.size for b in blobs if b.size)
        return {"used_bytes": used_bytes, "file_count": len(blobs)}

    def check_quota(
        self,
        user_id: int,
        db,
        new_file_size: int,
    ) -> bool:
        """
        새 파일 업로드 전 quota 체크.
        초과 시 QuotaExceededError 발생.
        db: SQLAlchemy Session
        """
        from DB_manage.storage_models import attach_models  # 순환 import 방지

        # UserStorageQuota 조회
        quota = db.execute(
            db.query().__class__  # 실제 쿼리는 storage_router.py에서 수행
        )
        # 직접 SQL로 조회 (모델 클래스 없이도 동작하도록)
        from sqlalchemy import text
        result = db.execute(
            text("SELECT used_bytes, max_bytes FROM user_storage_quotas WHERE user_id = :uid"),
            {"uid": user_id}
        ).fetchone()

        if result is None:
            # 레코드 없으면 신규 사용자 → 기본 1GB 허용
            if new_file_size > 1_073_741_824:
                raise QuotaExceededError(0, 1_073_741_824, new_file_size)
            return True

        used, max_b = result
        if used + new_file_size > max_b:
            raise QuotaExceededError(used, max_b, new_file_size)
        return True

    # ──────────────── 내부 유틸 ────────────────

    def _public_url(self, object_name: str) -> str:
        """버킷 공개 접근 설정 시의 URL. 비공개 버킷은 signed URL 사용."""
        return f"https://storage.googleapis.com/{self.bucket_name}/{object_name}"


# ─────────────────────────────── 싱글톤 팩토리 ───────────────────────────────

_manager: Optional[GCSStorageManager] = None


def get_storage_manager() -> Optional[GCSStorageManager]:
    """
    환경변수 기반 싱글톤 반환.
    CLOUD_STORAGE_ENABLED=false 또는 GCS_BUCKET_NAME 미설정 시 None.
    라우터에서 None 체크 후 503 반환 권장.
    """
    global _manager
    if _manager is not None:
        return _manager

    enabled = os.getenv("CLOUD_STORAGE_ENABLED", "false").lower()
    if enabled != "true":
        return None

    bucket_name = os.getenv("GCS_BUCKET_NAME", "").strip()
    if not bucket_name:
        return None

    _manager = GCSStorageManager(bucket_name=bucket_name)
    return _manager
