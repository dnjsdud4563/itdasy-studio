"""
DB_manage/storage_models.py
클라우드 저장소 관련 SQLAlchemy 모델.

연동 방법 (Won-young):
    # main.py 상단에 추가
    from DB_manage.storage_models import attach_models
    attach_models(Base)  # models.py의 Base와 동일한 객체 전달
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text,
    BigInteger, ForeignKey, Index, func
)


def attach_models(Base):
    """
    기존 models.py의 Base에 클라우드 저장소 테이블을 붙인다.
    main.py에서 Base를 import한 뒤 1회 호출하면 끝.

    사용 예:
        from database import Base
        from DB_manage.storage_models import attach_models
        attach_models(Base)
        Base.metadata.create_all(bind=engine)  # 기존 호출에 새 테이블도 포함됨
    """

    class UserStorageQuota(Base):
        """사용자별 GCS 저장 용량 할당 및 사용량 추적."""
        __tablename__ = "user_storage_quotas"

        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
        used_bytes = Column(BigInteger, default=0, nullable=False)
        max_bytes = Column(BigInteger, default=1_073_741_824, nullable=False)  # 1GB
        file_count = Column(Integer, default=0, nullable=False)
        last_synced_at = Column(DateTime, nullable=True)
        created_at = Column(DateTime, server_default=func.now(), nullable=False)
        updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

        def used_percent(self) -> float:
            if self.max_bytes == 0:
                return 0.0
            return round(self.used_bytes / self.max_bytes * 100, 2)

        def available_bytes(self) -> int:
            return max(0, self.max_bytes - self.used_bytes)

    class CloudFileRecord(Base):
        """GCS에 업로드된 파일 레코드. soft delete 방식."""
        __tablename__ = "cloud_file_records"

        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

        # GCS 오브젝트명 (버킷 내 경로)
        # 예: "users/3/portfolio/abc123.jpg"
        object_name = Column(String, nullable=False, unique=True)

        # "portfolio" | "background" | "output" | "db_backup"
        file_type = Column(String(32), nullable=False)

        original_filename = Column(String, nullable=True)
        size_bytes = Column(BigInteger, nullable=False)
        mime_type = Column(String(128), nullable=True)

        # GCS 공개 URL 또는 signed URL (캐시용, 만료 시 재발급)
        gcs_url = Column(String, nullable=True)

        # 로컬→GCS 마이그레이션 추적용
        local_path = Column(String, nullable=True)
        is_synced = Column(Boolean, default=True, nullable=False)

        # soft delete: 삭제 시 deleted_at 설정, GCS 파일도 삭제됨
        deleted_at = Column(DateTime, nullable=True)

        created_at = Column(DateTime, server_default=func.now(), nullable=False)

        __table_args__ = (
            Index("ix_cloud_file_records_user_type_deleted",
                  "user_id", "file_type", "deleted_at"),
        )

    class BackupLog(Base):
        """GCS 백업 실행 이력."""
        __tablename__ = "backup_logs"

        id = Column(Integer, primary_key=True, index=True)

        # "db" | "user_files" | "full"
        backup_type = Column(String(32), nullable=False)

        # "running" | "success" | "failed"
        status = Column(String(16), nullable=False, default="running")

        # GCS 오브젝트명 (성공 시)
        object_name = Column(String, nullable=True)
        size_bytes = Column(BigInteger, nullable=True)

        error_msg = Column(Text, nullable=True)

        started_at = Column(DateTime, server_default=func.now(), nullable=False)
        finished_at = Column(DateTime, nullable=True)

    # 반환값으로 접근 가능하게 (선택적 사용)
    return {
        "UserStorageQuota": UserStorageQuota,
        "CloudFileRecord": CloudFileRecord,
        "BackupLog": BackupLog,
    }
