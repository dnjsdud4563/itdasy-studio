# Security Runbook — 키 로테이션 · 사고 대응

## API 키 로테이션 절차

### Supabase Keys
1. Supabase 대시보드 → Settings → API → "Regenerate" (anon/service_role 각각)
2. 서버 `.env` 업데이트 → 배포
3. SDK 측 `EXPO_PUBLIC_PLATFORM_ANON_KEY` 업데이트 → 앱 재빌드
4. 기존 키는 즉시 무효화됨 — 앱 업데이트 전 구 버전 사용자 로그아웃 발생 가능

### Cloudflare R2 Keys
1. Cloudflare 대시보드 → R2 → Manage API Tokens → 기존 토큰 삭제 + 신규 생성
2. 서버 `.env`의 `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` 교체 → 배포

### HuggingFace Token
1. huggingface.co → Settings → Access Tokens → 기존 revoke + 신규 생성
2. 서버 `.env`의 `HF_ACCESS_TOKEN` 교체 → 배포

### Meta App Secret
1. developers.facebook.com → App Settings → Basic → "Reset" App Secret
2. 서버 `.env`의 `META_APP_SECRET` 교체 → 배포
3. 기존 Instagram 연동 유저의 토큰은 유효 (App Secret과 독립)

### PII Encryption Key (AES-256 GCM)
- **교체 불가** — 기존 암호화된 데이터 복호화 불가능해짐
- 교체 필요 시: 마이그레이션 스크립트로 기존 데이터를 구 키로 복호 → 신 키로 재암호화 → 키 교체

---

## 사고 대응 절차

### 키 유출 발견 시
1. **즉시**: 유출된 키 revoke/regenerate (위 절차)
2. **1시간 내**: access_logs에서 비정상 접근 패턴 확인
3. **24시간 내**: 영향 범위 파악 → 유저 알림 (데이터 유출 시)
4. **사후**: 유출 경로 분석 → gitleaks + 시크릿 스캔 강화

### DB 침해 발견 시
1. Supabase service_role 키 즉시 regenerate
2. 모든 유저 세션 invalidate (`auth.signOut` 전체)
3. PII 암호화 상태 확인 — AES-256 GCM이므로 암호문만 유출 시 안전
4. PIPA 규정에 따라 72시간 내 개인정보보호위원회 + 이용자 통지

### 서버 다운 시
1. UptimeRobot 알림 확인
2. Render/Fly.io 대시보드에서 로그 확인
3. 수동 재시작 또는 최신 정상 버전으로 롤백
4. /healthz 응답 `db: up` 확인 후 모니터링 유지
