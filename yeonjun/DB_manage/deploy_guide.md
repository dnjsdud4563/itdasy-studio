# itdasy 24/7 배포 가이드

## 현재 구조의 문제

```
사용자 → ngrok URL → Mac Mini (FastAPI + SQLite + 파일) → ❌ 꺼지면 다운
```

Mac이 꺼지거나 재시작되면 앱 전면 다운. ngrok URL도 재시작 시 변경됨.

---

## 베타 추천: Railway + GCS

**장점**: SQLite 그대로 사용 (DB 마이그레이션 없음), 배포 간단, 월 $5  
**단점**: GCP 생태계 완전 분리

### Step 1: Dockerfile 생성

`itdasy-beauty-app-main/Dockerfile` 파일 생성:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# GCS 서비스 계정 키 (Railway 환경변수로 주입)
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/gcs-key.json

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 2: Railway 환경변수 설정

Railway 대시보드 → Variables 탭에서 추가:

```
SECRET_KEY=<강력한 랜덤 문자열>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
GEMINI_API_KEY=<Gemini API 키>
GCS_BUCKET_NAME=itdasy-beta
CLOUD_STORAGE_ENABLED=true
GOOGLE_APPLICATION_CREDENTIALS_JSON=<서비스 계정 JSON을 한 줄로 인코딩>
```

> **GCS 키 주입 방법**: 서비스 계정 JSON 파일 내용을 base64로 인코딩해서  
> `GOOGLE_APPLICATION_CREDENTIALS_JSON`에 넣고, `start.sh`에서 디코딩:
> ```bash
> echo $GOOGLE_APPLICATION_CREDENTIALS_JSON | base64 -d > /app/gcs-key.json
> uvicorn main:app --host 0.0.0.0 --port 8000
> ```

### Step 3: Railway 배포

```bash
# Railway CLI 설치 후
railway login
railway init
railway up
```

또는 GitHub 레포 연동 → 자동 배포 (push할 때마다 자동 재배포)

### Step 4: frontend URL 교체

Railway 배포 완료 후 고정 URL 확인 (예: `itdasy-backend.up.railway.app`)  
`frontend/index.html`과 `frontend/app.html`에서 ngrok URL 교체:

```javascript
// 변경 전
'nopo-lab.github.io': 'https://subdued-crummiest-unmanaged.ngrok-free.dev'

// 변경 후  
'nopo-lab.github.io': 'https://itdasy-backend.up.railway.app'
```

---

## 출시 추천: GCP Cloud Run + Cloud SQL + GCS

**장점**: GCP 일원화, 자동 스케일링, 안정적, Gemini와 동일 계정  
**단점**: SQLite → PostgreSQL DB 마이그레이션 필요, 월 $7-15

### Step 1: SQLite → PostgreSQL 전환

`database.py` 변경:
```python
# 기존
DATABASE_URL = "sqlite:///./itdasy.db"

# 변경 후 (Cloud SQL PostgreSQL)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@/itdasy?host=/cloudsql/PROJECT:REGION:INSTANCE"
)
engine = create_engine(DATABASE_URL)  # connect_args 제거
```

`requirements.txt`에 추가:
```
psycopg2-binary>=2.9.0
```

### Step 2: GCP 설정

```bash
# GCP 프로젝트 설정 (itdasy-beta 프로젝트 사용)
gcloud config set project itdasy-beta

# Cloud SQL 인스턴스 생성 (최소 사양, 월 ~$7)
gcloud sql instances create itdasy-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-northeast3  # 서울

# DB 생성
gcloud sql databases create itdasy --instance=itdasy-db

# Artifact Registry (Docker 이미지 저장)
gcloud artifacts repositories create itdasy \
  --repository-format=docker \
  --location=asia-northeast3
```

### Step 3: Cloud Run 배포

```bash
# Docker 빌드 & 푸시
gcloud builds submit --tag asia-northeast3-docker.pkg.dev/itdasy-beta/itdasy/backend:latest

# Cloud Run 배포
gcloud run deploy itdasy-backend \
  --image asia-northeast3-docker.pkg.dev/itdasy-beta/itdasy/backend:latest \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars "GCS_BUCKET_NAME=itdasy-beta,CLOUD_STORAGE_ENABLED=true" \
  --set-secrets "SECRET_KEY=itdasy-secret-key:latest,GEMINI_API_KEY=gemini-key:latest" \
  --add-cloudsql-instances itdasy-beta:asia-northeast3:itdasy-db
```

### Step 4: 커스텀 도메인 (선택)

Cloud Run → 도메인 매핑 → `api.itdasy.co.kr` 등록

---

## ⚠️ 개인 GCP 계정 사용 주의사항

| 항목 | 내용 |
|------|------|
| **베타** | 개인 계정 OK |
| **프로젝트 격리** | 반드시 `itdasy-beta` 프로젝트 별도 생성 |
| **서비스 계정 키** | 개인 구글 계정 로그인 정보 대신 서비스 계정 JSON 키 사용 |
| **출시 전** | 사업자 등록 후 GCP 조직 계정으로 버킷 이전 |
| **PIPA** | 사용자 개인정보(사진, 업체명)를 개인 명의 계정에 저장 → 개인정보처리자 = 연준 개인이 됨 |

### GCP 프로젝트 분리 방법

```
GCP 콘솔 → 새 프로젝트 → 이름: "itdasy-beta" → 생성
→ 이후 모든 작업은 itdasy-beta 프로젝트에서만
```

이렇게 하면 나중에 조직 계정으로 이전 시 프로젝트 전체를 이동하거나  
GCS 버킷만 `gsutil cp -r gs://itdasy-beta gs://itdasy-prod`로 복사 가능.

---

## 마이그레이션 후 ngrok 제거

배포 완료 후 `start.sh`에서 ngrok 관련 설명 제거하고  
`frontend/index.html`, `frontend/app.html`의 ngrok URL을 고정 URL로 교체.

```bash
# Railway URL로 일괄 교체 (예시)
sed -i 's|subdued-crummiest-unmanaged.ngrok-free.dev|itdasy-backend.up.railway.app|g' frontend/*.html
```
