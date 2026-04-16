"""
DB_manage/storage_router.py
클라우드 저장소 FastAPI 라우터.

연동 방법 (Won-young):
    # main.py에 추가
    from DB_manage.storage_router import router as storage_router
    app.include_router(storage_router)
"""

import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

# 기존 프로젝트 의존성 (itdasy-beauty-app-main)
from database import get_db
from utils.security import get_current_user

from DB_manage.cloud_storage import get_storage_manager, GCSStorageManager, QuotaExceededError, StorageError
from DB_manage.backup import BackupManager

router = APIRouter(prefix="/storage", tags=["클라우드 저장소"])

ALLOWED_FILE_TYPES = {"portfolio", "background", "output"}
MAX_FILE_SIZE_MB = 50  # 단건 업로드 최대 크기


# ─────────────────────────────── Dependency ───────────────────────────────

def get_storage() -> GCSStorageManager:
    """GCS 매니저 Dependency. 미설정 시 503."""
    manager = get_storage_manager()
    if manager is None:
        raise HTTPException(
            status_code=503,
            detail="클라우드 저장소가 설정되지 않았습니다. "
                   "CLOUD_STORAGE_ENABLED=true 및 GCS_BUCKET_NAME을 확인하세요."
        )
    return manager


def _ensure_quota_record(user_id: int, db: Session) -> None:
    """사용자 quota 레코드가 없으면 생성."""
    exists = db.execute(
        text("SELECT id FROM user_storage_quotas WHERE user_id=:uid"),
        {"uid": user_id}
    ).fetchone()
    if not exists:
        db.execute(
            text("INSERT INTO user_storage_quotas (user_id, used_bytes, max_bytes, file_count) "
                 "VALUES (:uid, 0, 1073741824, 0)"),
            {"uid": user_id}
        )
        db.commit()


# ─────────────────────────────── 응답 모델 ───────────────────────────────

class QuotaResponse(BaseModel):
    used_bytes: int
    max_bytes: int
    used_mb: float
    max_mb: float
    used_percent: float
    file_count: int
    available_bytes: int


class UploadResponse(BaseModel):
    object_name: str
    gcs_url: str
    size_bytes: int
    file_type: str


class FileRecord(BaseModel):
    id: int
    object_name: str
    file_type: str
    original_filename: Optional[str]
    size_bytes: int
    gcs_url: Optional[str]
    created_at: str


class DownloadResponse(BaseModel):
    signed_url: str
    expires_in: int


# ─────────────────────────────── 엔드포인트 ───────────────────────────────

@router.get("/quota", response_model=QuotaResponse, summary="저장 용량 조회")
def get_quota(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """현재 사용자의 GCS 사용량 및 잔여 용량 조회."""
    _ensure_quota_record(user_id, db)
    row = db.execute(
        text("SELECT used_bytes, max_bytes, file_count FROM user_storage_quotas WHERE user_id=:uid"),
        {"uid": user_id}
    ).fetchone()

    used, max_b, cnt = row
    return QuotaResponse(
        used_bytes=used,
        max_bytes=max_b,
        used_mb=round(used / 1024**2, 2),
        max_mb=round(max_b / 1024**2, 2),
        used_percent=round(used / max_b * 100, 2) if max_b else 0,
        file_count=cnt,
        available_bytes=max(0, max_b - used),
    )


@router.post("/upload/{file_type}", response_model=UploadResponse, summary="GCS 파일 업로드")
async def upload_file(
    file_type: str,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: GCSStorageManager = Depends(get_storage),
):
    """
    파일을 GCS에 업로드하고 quota를 차감합니다.
    file_type: portfolio | background | output
    """
    if file_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"file_type은 {ALLOWED_FILE_TYPES} 중 하나여야 합니다.")

    # 파일 읽기
    data = await file.read()
    size_bytes = len(data)

    if size_bytes > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"파일 크기 초과: 최대 {MAX_FILE_SIZE_MB}MB")

    # Quota 체크
    _ensure_quota_record(user_id, db)
    row = db.execute(
        text("SELECT used_bytes, max_bytes FROM user_storage_quotas WHERE user_id=:uid"),
        {"uid": user_id}
    ).fetchone()
    used, max_b = row
    if used + size_bytes > max_b:
        raise HTTPException(
            status_code=413,
            detail=f"저장 용량 초과: 사용 {used/1024**2:.1f}MB / {max_b/1024**2:.0f}MB, "
                   f"필요 {size_bytes/1024**2:.1f}MB"
        )

    # 오브젝트명 생성
    unique_filename = storage.make_unique_filename(file.filename or "upload.bin")
    name_fn = {
        "portfolio": storage.get_portfolio_name,
        "background": storage.get_background_name,
        "output": storage.get_output_name,
    }[file_type]
    object_name = name_fn(user_id, unique_filename)

    # GCS 업로드
    try:
        gcs_url = storage.upload_bytes(
            data=data,
            object_name=object_name,
            content_type=file.content_type or "application/octet-stream",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCS 업로드 실패: {e}")

    # DB 기록
    db.execute(text("""
        INSERT INTO cloud_file_records
            (user_id, object_name, file_type, original_filename, size_bytes, mime_type, gcs_url, is_synced)
        VALUES (:uid, :obj, :ft, :fn, :sz, :mt, :url, 1)
    """), {
        "uid": user_id, "obj": object_name, "ft": file_type,
        "fn": file.filename, "sz": size_bytes,
        "mt": file.content_type, "url": gcs_url,
    })

    # Quota 업데이트
    db.execute(text("""
        UPDATE user_storage_quotas
        SET used_bytes = used_bytes + :sz, file_count = file_count + 1
        WHERE user_id = :uid
    """), {"sz": size_bytes, "uid": user_id})
    db.commit()

    return UploadResponse(
        object_name=object_name,
        gcs_url=gcs_url,
        size_bytes=size_bytes,
        file_type=file_type,
    )


@router.get("/files", summary="파일 목록 조회")
def list_files(
    file_type: Optional[str] = Query(None, description="portfolio | background | output"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """사용자의 GCS 파일 목록 조회 (soft delete 제외)."""
    base_q = """
        SELECT id, object_name, file_type, original_filename,
               size_bytes, gcs_url, created_at
        FROM cloud_file_records
        WHERE user_id=:uid AND deleted_at IS NULL
    """
    params = {"uid": user_id}

    if file_type:
        base_q += " AND file_type=:ft"
        params["ft"] = file_type

    base_q += " ORDER BY created_at DESC LIMIT :lim OFFSET :off"
    params["lim"] = limit
    params["off"] = offset

    rows = db.execute(text(base_q), params).fetchall()
    return [
        {
            "id": r[0], "object_name": r[1], "file_type": r[2],
            "original_filename": r[3], "size_bytes": r[4],
            "gcs_url": r[5], "created_at": str(r[6]),
        }
        for r in rows
    ]


@router.get("/download/{record_id}", response_model=DownloadResponse, summary="임시 다운로드 URL 발급")
def get_download_url(
    record_id: int,
    expires_in: int = Query(3600, description="유효 시간(초), 최대 7일"),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: GCSStorageManager = Depends(get_storage),
):
    """GCS signed URL 발급 (1시간 기본)."""
    row = db.execute(
        text("SELECT object_name FROM cloud_file_records WHERE id=:id AND user_id=:uid AND deleted_at IS NULL"),
        {"id": record_id, "uid": user_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    try:
        signed_url = storage.generate_signed_url(row[0], expiration=min(expires_in, 604800))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL 발급 실패: {e}")

    return DownloadResponse(signed_url=signed_url, expires_in=expires_in)


@router.delete("/files/{record_id}", summary="파일 삭제")
def delete_file(
    record_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: GCSStorageManager = Depends(get_storage),
):
    """GCS 파일 삭제 + soft delete + quota 감소."""
    row = db.execute(
        text("SELECT object_name, size_bytes FROM cloud_file_records "
             "WHERE id=:id AND user_id=:uid AND deleted_at IS NULL"),
        {"id": record_id, "uid": user_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    object_name, size_bytes = row

    # GCS 삭제
    try:
        storage.delete_file(object_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCS 삭제 실패: {e}")

    # soft delete + quota 감소
    db.execute(
        text("UPDATE cloud_file_records SET deleted_at=CURRENT_TIMESTAMP WHERE id=:id"),
        {"id": record_id}
    )
    db.execute(
        text("UPDATE user_storage_quotas "
             "SET used_bytes=MAX(0, used_bytes - :sz), file_count=MAX(0, file_count - 1) "
             "WHERE user_id=:uid"),
        {"sz": size_bytes, "uid": user_id}
    )
    db.commit()
    return {"detail": "삭제 완료", "object_name": object_name}


@router.post("/sync-quota", summary="GCS 실제 사용량 재계산")
def sync_quota(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: GCSStorageManager = Depends(get_storage),
):
    """GCS에서 실제 사용량을 다시 계산해 DB를 업데이트합니다."""
    usage = storage.get_user_usage(user_id)
    _ensure_quota_record(user_id, db)
    db.execute(
        text("UPDATE user_storage_quotas "
             "SET used_bytes=:ub, file_count=:fc, last_synced_at=CURRENT_TIMESTAMP "
             "WHERE user_id=:uid"),
        {"ub": usage["used_bytes"], "fc": usage["file_count"], "uid": user_id}
    )
    db.commit()
    return {
        "used_bytes": usage["used_bytes"],
        "file_count": usage["file_count"],
        "synced": True,
    }


@router.post("/backup", summary="전체 백업 실행")
def run_backup(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: GCSStorageManager = Depends(get_storage),
):
    """
    DB + 현재 사용자 파일 전체 백업.
    어드민 전용으로 사용하려면 user_id==1 체크를 추가하세요.
    """
    db_path = os.getenv("DB_PATH", "./itdasy.db")
    users_root = os.getenv("USERS_ROOT", "./users")
    bm = BackupManager(storage=storage, db_path=db_path, users_root=users_root)

    try:
        db_result = bm.backup_database(db)
        file_result = bm.backup_user_files(user_id, db)
        return {"db_backup": db_result, "file_backup": file_result}
    except StorageError as e:
        raise HTTPException(status_code=500, detail=str(e))
