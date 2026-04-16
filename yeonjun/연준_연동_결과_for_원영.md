# 연준 → 원영 연동 결과 + 클로드한테 시킬 것

## 연동 완료된 것 (앱 UI/기능 변경 0)

### 1. DB_manage (클라우드 스토리지 + 백업)
- `/storage/*` API 7개 추가 — 사용자별 1GB 할당, GCS 업로드/다운로드
- `itdasy.db` 전체 백업 기능 포함
- **GCS 세팅 안 해도 앱 정상 동작** (CLOUD_STORAGE_ENABLED=false 시 비활성)

### 2. Beauty Platform 브릿지
- `/platform/*` API 7개 추가 — AI 이미지 생성, 누끼, 결제, Instagram 연동
- beauty-platform 서버(:3001)를 itdasy 앱(:8000)에서 프록시로 호출
- **beauty-platform 서버 안 켜도 앱 정상 동작** (503 반환 후 무시)

### 3. itdasy-promo 랜딩
- `/promo/` 경로로 프로모 페이지 정적 서빙

### 4. 피드백 5개 수정
- #4: 시나리오 미선택 시 팝업으로 유도 (욕설 캡션 방지)
- #5: 글쓰기 탭 극심플화 (사진+만들기+결과)
- #1: 서명블록 textarea + 앞/뒤 동시 선택
- #2: special_context 자연스럽게 녹이기 (mock + 백엔드 프롬프트)
- #3: 완료 시 토스트 ("말투 학습 완료!" / "수정사항 저장 완료!")

---

## 변경된 파일 (최소 변경)

```
수정:
  backend/main.py              — 부가 모듈 라우터 3줄 추가 (try/except)
  backend/models.py            — DB_manage 모델 1줄 추가 (try/except)
  backend/requirements.txt     — google-cloud-storage 1줄 추가
  backend/routers/caption.py   — 프롬프트에 특이사항 녹이기 지시 1줄
  frontend/index.html          — 시술정보 카드 제거 (글쓰기 탭 심플화)
  frontend/app-caption.js      — 시나리오 팝업 + 생성 방어 로직
  frontend/components/persona-popup.js — 서명 textarea + 위치 + 토스트

신규:
  backend/routers/platform_bridge.py   — beauty-platform 프록시
  backend/DB_manage → ../../DB_manage  — 심볼릭 링크
  itdasy-promo → ../itdasy-promo       — 심볼릭 링크
```

---

## 원영님 .env에 추가할 것

```bash
# 기존 것은 그대로 두고 아래만 추가

# Beauty Platform (연준 서버 — 나중에 실제 URL로 교체)
BEAUTY_PLATFORM_URL=http://localhost:3001

# Google Cloud Storage (선택 — 안 넣으면 로컬 모드)
CLOUD_STORAGE_ENABLED=false
# GCS_BUCKET_NAME=itdasy-beta
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

---

## 원영이가 클로드한테 시킬 내용 (선택지 3개 중 택 1)

### 선택지 A: SQLite 그대로 + GCS 백업만 (가장 안전)
**변경 사항**: 앱 코드 변경 없음. GCS에 itdasy.db를 매일 백업.
**클로드한테 시킬 것**:
```
1. GCP 서비스 계정 만들어서 키 발급받아
2. .env에 GCS_BUCKET_NAME, GOOGLE_APPLICATION_CREDENTIALS, CLOUD_STORAGE_ENABLED=true 추가
3. python DB_manage/migration.py --dry-run 으로 확인
4. 서버 재시작하면 /storage/* API 자동 활성화
```

### 선택지 B: SQLite → Supabase Postgres 이전 (대규모 변경)
**변경 사항**: database.py, models.py, 전 라우터의 DB 세션 변경
**클로드한테 시킬 것**:
```
1. database.py의 SQLite 엔진을 Supabase Postgres URL로 교체
   - SUPABASE_DB_URL=postgresql://postgres:[비번]@db.wlwauinqvmegnqdtbrtg.supabase.co:5432/postgres
2. models.py 그대로 사용 (SQLAlchemy라 엔진만 바꾸면 됨)
3. alembic init으로 마이그레이션 설정
4. alembic revision --autogenerate -m "initial" → alembic upgrade head
5. 기존 itdasy.db 데이터를 Supabase로 이관하는 스크립트 작성
6. .env에 SUPABASE_DB_URL 추가
```
**장점**: 클라우드 DB, 어디서든 접근, RLS 적용 가능, beauty-platform과 DB 통합
**단점**: 마이그레이션 리스크, 테스트 필요

### 선택지 C: 이벤트 미러링 (하이브리드)
**변경 사항**: 기존 SQLite 유지 + 핵심 이벤트만 Supabase에 동기화
**클로드한테 시킬 것**:
```
1. backend/middleware/sync_events.py 신규 생성
   - 로그인, 캡션 생성, 이미지 업로드 이벤트 발생 시
   - beauty-platform의 Supabase에 POST /v1/events 로 전송
2. 실패해도 앱 동작에 영향 없음 (fire-and-forget)
3. .env에 BEAUTY_PLATFORM_URL만 있으면 됨 (이미 추가됨)
```
**장점**: 기존 앱 안정성 유지 + 클라우드에 데이터 축적
**단점**: 양쪽 DB 동기화 문제 (나중에 어디가 진실인지)

---

## 연준 추천

**지금은 선택지 A** (GCS 백업만) → **베타 끝나면 선택지 B** (Supabase 이전)

이유:
- A는 리스크 0. 앱 코드 안 건드림.
- 베타 중에 DB 바꾸면 테스터 데이터 날아갈 위험.
- 베타 끝나고 정식 런칭 전에 B로 전환하면 깔끔.

---

## 테스트 방법

```bash
# 1. 서버 시작
cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000

# 2. 기존 기능 정상 확인
curl http://localhost:8000/health

# 3. 스토리지 용량 확인 (DB_manage)
curl -H "Authorization: Bearer <토큰>" http://localhost:8000/storage/quota

# 4. 프로모 페이지
open http://localhost:8000/promo/

# 5. Beauty Platform (별도 터미널에서)
cd app_support/beauty-platform/server && npx tsx src/index.ts
curl http://localhost:8000/platform/health  # → {"ok":true,"db":"up"}
```
