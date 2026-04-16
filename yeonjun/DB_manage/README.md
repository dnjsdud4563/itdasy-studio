# DB_manage — 클라우드 저장/백업 모듈

itdasy-beauty-app-main의 클라우드 확장 모듈.  
Google Cloud Storage 연동, 사용자별 1GB 할당, DB 백업, 24/7 배포 가이드 포함.

## 파일 구조

```
DB_manage/
├── storage_models.py   # SQLAlchemy 모델 (quota, file_record, backup_log)
├── cloud_storage.py    # GCSStorageManager 클래스
├── backup.py           # BackupManager (DB + 파일 백업)
├── storage_router.py   # FastAPI 라우터 (/storage/*)
├── migration.py        # 로컬→GCS 마이그레이션 스크립트
├── deploy_guide.md     # 24/7 배포 가이드 (Railway / Cloud Run)
└── README.md           # 이 파일
```

## 전제조건

```bash
pip install google-cloud-storage>=2.0.0
```

`itdasy-beauty-app-main/requirements.txt`에도 추가:
```
google-cloud-storage>=2.0.0
```

---

## Won-young 연동 체크리스트

### 1. GCP 서비스 계정 키 발급

```
GCP 콘솔 → IAM → 서비스 계정 → 새 서비스 계정 생성
이름: itdasy-gcs-writer
역할: Storage Object Admin
키 생성 → JSON 다운로드 → 안전한 곳에 보관 (절대 git에 올리지 말 것!)
```

### 2. .env 추가

```bash
# Google Cloud Storage
GCS_BUCKET_NAME=itdasy-beta
GOOGLE_APPLICATION_CREDENTIALS=/절대경로/service-account-key.json

# 클라우드 모드 활성화
CLOUD_STORAGE_ENABLED=true

# 백업 보존 개수 (기본 30)
BACKUP_RETAIN_COUNT=30
```

### 3. GCS 버킷 생성 (최초 1회)

```bash
gcloud storage buckets create gs://itdasy-beta \
  --location=asia-northeast3 \
  --uniform-bucket-level-access
```

### 4. models.py 수정 (1줄 추가)

`itdasy-beauty-app-main/models.py` 맨 아래에 추가:

```python
# Cloud storage tables
from DB_manage.storage_models import attach_models
attach_models(Base)
```

### 5. main.py 수정 (1줄 추가)

기존 `app.include_router(...)` 목록 아래에 추가:

```python
from DB_manage.storage_router import router as storage_router
app.include_router(storage_router)
```

### 6. 마이그레이션 실행

```bash
# 먼저 dry-run으로 확인
cd /path/to/깃허브with원영
python DB_manage/migration.py --dry-run

# 이상 없으면 실제 실행
python DB_manage/migration.py --execute
```

### 7. 서버 재시작 및 테스트

```bash
# 서버 재시작
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 용량 확인
curl -H "Authorization: Bearer <token>" http://localhost:8000/storage/quota
```

---

## API 엔드포인트 요약

| Method | Path | 설명 |
|--------|------|------|
| GET | /storage/quota | 사용량 조회 |
| POST | /storage/upload/{file_type} | 파일 업로드 (portfolio/background/output) |
| GET | /storage/files | 파일 목록 |
| GET | /storage/download/{id} | 임시 다운로드 URL (1시간) |
| DELETE | /storage/files/{id} | 파일 삭제 |
| POST | /storage/sync-quota | GCS 실제 사용량 재계산 |
| POST | /storage/backup | DB + 파일 전체 백업 |

---

## 24/7 배포

`deploy_guide.md` 참고.  
**베타 추천**: Railway + GCS (월 $5, SQLite 그대로)  
**출시 추천**: Cloud Run + Cloud SQL + GCS (월 $7-15, GCP 일원화)
