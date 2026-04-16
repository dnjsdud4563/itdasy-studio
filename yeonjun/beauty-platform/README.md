# Beauty Platform

원영님의 뷰티앱(React Native/Expo)과 합체되는 **부가 플랫폼**.
인증 · 결제 · AI 이미지 · 스토리지 · Instagram 연동 · 보안 · 컴플라이언스를 담당.

---

## 디렉토리 구조

```
beauty-platform/
│
├─ contracts/                        # 원영님 앱과의 API 계약서
│   ├─ openapi.yaml                  #   OpenAPI 3.1 스펙 (전체 엔드포인트)
│   └─ auth-jwt.md                   #   JWT payload 포맷 · 에러코드 표준
│
├─ docs/                             # 문서 · 법률 · 앱마켓
│   ├─ integration-guide-for-wonyoung.md  #   원영님 앱 연동 가이드 (SDK 사용법)
│   ├─ privacy-policy-ko.md          #   개인정보처리방침 (한국어)
│   ├─ privacy-policy-en.md          #   Privacy Policy (English, CCPA 포함)
│   ├─ terms-of-service-ko.md        #   이용약관 (한국어)
│   ├─ terms-of-service-en.md        #   Terms of Service (English)
│   └─ appstore-submission-checklist.md  #   Apple + Google 심사 체크리스트 · ASO 키워드
│
├─ server/                           # Fastify API 서버
│   ├─ src/
│   │   ├─ config.ts                 #   환경변수 스키마 (Zod 검증, 누락 시 부팅 실패)
│   │   ├─ index.ts                  #   앱 진입점 (CORS · Rate limit · Error handler · Graceful shutdown)
│   │   │
│   │   ├─ middleware/
│   │   │   └─ auth.ts               #   JWT 인증 미들웨어 (Supabase Auth 검증)
│   │   │
│   │   ├─ lib/
│   │   │   ├─ supabase.ts           #   Supabase Admin + User 클라이언트
│   │   │   ├─ crypto.ts             #   AES-256 GCM 암호화/복호화 (PII 보호)
│   │   │   ├─ storage.ts            #   Supabase Storage 래퍼 (업로드 · 삭제 · Presigned URL)
│   │   │   ├─ ai-image.ts           #   AI 이미지 생성 (Pollinations, 나중에 Ideogram 전환)
│   │   │   └─ meta-api.ts           #   Instagram Graph API 클라이언트 (OAuth · 피드 · 프로필)
│   │   │
│   │   └─ routes/
│   │       ├─ profile.ts            #   GET/PATCH /v1/profile — 프로필 조회·수정 (PII 암호화)
│   │       ├─ ai.ts                 #   POST /v1/ai/generate-image — AI 이미지 생성 (크레딧 원자차감)
│   │       ├─ gallery.ts            #   GET/DELETE /v1/gallery — 생성 이미지 목록·삭제 (DB+Storage 원자적)
│   │       ├─ storage.ts            #   POST /v1/storage/presign — 클라이언트 직접 업로드용 URL 발급
│   │       ├─ billing.ts            #   GET /v1/billing/entitlements + 웹훅 (RevenueCat · PortOne 서명검증)
│   │       ├─ account.ts            #   POST /v1/account/export · DELETE /v1/account · POST /v1/push/register
│   │       └─ meta.ts              #   Instagram OAuth · 피드·프로필 조회 · 연동해제 · Meta Data Deletion Callback
│   │
│   ├─ .env.example                  #   환경변수 템플릿
│   ├─ package.json
│   └─ tsconfig.json
│
├─ packages/
│   └─ platform-sdk/                 # @beauty/platform-sdk (React Native/Expo)
│       └─ src/
│           ├─ index.ts              #   진입점: BeautyPlatform.{auth, profile, ai, ...}
│           ├─ types.ts              #   공유 타입 (Plan, Profile, Entitlements, ...)
│           ├─ client.ts             #   HTTP 클라이언트 (토큰 자동 첨부)
│           ├─ auth.ts               #   Apple / Google / Kakao 소셜 로그인
│           ├─ profile.ts            #   프로필 조회·수정
│           ├─ ai.ts                 #   AI 이미지 생성 호출
│           ├─ gallery.ts            #   갤러리 목록·삭제
│           ├─ storage.ts            #   Presigned URL 업로드
│           ├─ billing.ts            #   RevenueCat IAP + Paywall 제어
│           ├─ account.ts            #   데이터 내보내기 · 계정 삭제 · 푸시 등록
│           ├─ rating.ts             #   인앱 리뷰 프롬프트 (월1회, 긍정이벤트 2회 후)
│           ├─ meta.ts               #   Instagram 연동 (connect · disconnect · feed · profile)
│           └─ instagram-share.ts    #   IG 앱 딥링크 공유 (스토리 · 피드 → 필터 선택 화면)
│
├─ supabase/
│   ├─ migrations/
│   │   ├─ 20260416000100_init.sql   #   테이블 7개 + 트리거 (profiles, entitlements, generated_images, ...)
│   │   ├─ 20260416000200_rls.sql    #   Row Level Security 전면 적용 (본인 row만 접근)
│   │   ├─ 20260416000300_pg_cron.sql #  90일 로그 자동파기 + 30일 탈퇴 유예 후 purge
│   │   ├─ 20260416000400_rpc.sql    #   원자적 크레딧 차감 RPC (decrement_credit)
│   │   └─ 20260416000500_meta.sql   #   meta_connections 테이블 + RLS
│   │
│   └─ functions/
│       ├─ export-user-data/index.ts #   사용자 데이터 내보내기 (PIPA 의무, 24시간 URL)
│       ├─ reconcile-r2/index.ts     #   고아 객체 정리 크론 (DB ↔ Storage diff)
│       └─ serve-legal/index.ts      #   약관·처방침 HTML 서빙 (한/영, Apple·Google·Meta 등록용)
│
├─ scripts/
│   ├─ gen-pii-key.mjs               #   AES-256 GCM 암호화 키 생성 (32 bytes base64)
│   ├─ rls-audit.mjs                 #   모든 public 테이블 RLS 활성 여부 검사
│   ├─ test-purge-cron.sql           #   pg_cron 파기 로직 검증 (mock 데이터 주입 → 확인)
│   ├─ load-test.mjs                 #   autocannon 부하 테스트 (100 concurrent)
│   └─ smoke-test.sh                 #   E2E smoke test (healthz · auth 차단 · 웹훅 차단)
│
├─ .github/workflows/
│   └─ security.yml                  #   CI: gitleaks + XSS 패턴 금지 + typecheck
│
├─ Makefile                          #   install · dev · build · typecheck · migrate · smoke · rls-audit
└─ .gitignore                        #   node_modules · .env · dist · .DS_Store
```

---

## 기능 상세

### 🔐 인증 (Auth)
| 기능 | 구현 | 파일 |
|---|---|---|
| Apple / Google / Kakao 소셜 로그인 | ✅ | `server/middleware/auth.ts` · `sdk/auth.ts` |
| JWT 검증 (Supabase Auth 위임) | ✅ | `server/middleware/auth.ts` |
| 기기별 세션 관리 | ✅ | Supabase Auth |
| 신규 가입 시 프로필·구독 자동 생성 | ✅ | `migrations/0001 (handle_new_user 트리거)` |

### 🎨 AI 이미지 생성
| 기능 | 구현 | 파일 |
|---|---|---|
| 프롬프트 → AI 이미지 생성 | ✅ | `server/routes/ai.ts` · `server/lib/ai-image.ts` |
| 스타일 4종 (natural/glam/vintage/kbeauty) | ✅ | `server/lib/ai-image.ts` |
| 크레딧 원자적 차감 (RPC) | ✅ | `migrations/0004 (decrement_credit)` |
| 생성 실패 시 크레딧 환급 | ✅ | `server/routes/ai.ts` |
| 프리미엄 구독자 무제한 | ✅ | `decrement_credit RPC` |

### 📸 Instagram 연동
| 기능 | 구현 | 파일 |
|---|---|---|
| Instagram OAuth 로그인 | ✅ | `server/routes/meta.ts` · `server/lib/meta-api.ts` |
| 앱 내 IG 피드 표시 | ✅ | `server/routes/meta.ts` (`GET /v1/meta/feed`) |
| IG 프로필 조회 | ✅ | `server/routes/meta.ts` (`GET /v1/meta/profile`) |
| 토큰 자동 갱신 (60일 → 만료 7일 전) | ✅ | `server/routes/meta.ts (getValidToken)` |
| 스토리 공유 (딥링크 → IG 앱 필터 화면) | ✅ | `sdk/instagram-share.ts` |
| 피드 게시 공유 (카메라롤 저장 → IG 앱) | ✅ | `sdk/instagram-share.ts` |
| IG 앱 미설치 시 웹 폴백 | ✅ | `sdk/instagram-share.ts` |
| 연동 해제 | ✅ | `server/routes/meta.ts` (`DELETE /v1/meta/disconnect`) |
| Meta Data Deletion Callback (심사 필수) | ✅ | `server/routes/meta.ts` (`POST /v1/meta/data-deletion`) |

### 💳 결제 · 구독
| 기능 | 구현 | 파일 |
|---|---|---|
| RevenueCat IAP (iOS/Android) | ✅ | `server/routes/billing.ts` · `sdk/billing.ts` |
| PortOne 웹 결제 (국내) | ✅ | `server/routes/billing.ts` |
| 웹훅 서명 검증 (HMAC + timing-safe) | ✅ | `server/routes/billing.ts` |
| Idempotency (중복 지급 방지) | ✅ | `webhook_events 테이블` |
| 구독 상태 단일 진실원 (entitlements) | ✅ | `migrations/0001` |
| 요금제: ₩4,900/월 · ₩39,000/년 · 7일 트라이얼 | ✅ 설계 | RevenueCat 대시보드에서 생성 |

### 🗃️ 스토리지
| 기능 | 구현 | 파일 |
|---|---|---|
| Supabase Storage (현재) | ✅ | `server/lib/storage.ts` |
| Presigned URL 업로드 | ✅ | `server/routes/storage.ts` |
| 이미지 삭제 (DB + Storage 원자적) | ✅ | `server/routes/gallery.ts` |
| 고아 객체 정리 크론 | ✅ | `supabase/functions/reconcile-r2/` |
| ⬜ Cloudflare R2 전환 (카드 등록 후) | 대기 | `memory/project_r2_migration.md` |

### 🔒 보안
| 기능 | 구현 | 파일 |
|---|---|---|
| AES-256 GCM PII 암호화 (실명·전화·IG토큰) | ✅ | `server/lib/crypto.ts` |
| RLS 전면 적용 (8개 테이블) | ✅ | `migrations/0002 · 0005` |
| Rate limit (60req/min) | ✅ | `server/index.ts` |
| CORS 화이트리스트 | ✅ | `server/index.ts (ALLOWED_ORIGINS)` |
| Global error handler (구조화 JSON) | ✅ | `server/index.ts` |
| Graceful shutdown (SIGTERM/SIGINT) | ✅ | `server/index.ts` |
| Deep healthcheck (DB ping) | ✅ | `server/index.ts (/healthz)` |
| CI: gitleaks + XSS 스캔 + typecheck | ✅ | `.github/workflows/security.yml` |
| RLS 감사 스크립트 | ✅ | `scripts/rls-audit.mjs` |
| 부하 테스트 | ✅ | `scripts/load-test.mjs` |

### 📜 컴플라이언스 (법령 대응)
| 기능 | 구현 | 파일 |
|---|---|---|
| 개인정보처리방침 (한/영) | ✅ | `docs/privacy-policy-{ko,en}.md` |
| 이용약관 (한/영) | ✅ | `docs/terms-of-service-{ko,en}.md` |
| 약관 HTML 서빙 (Apple·Google·Meta 등록용) | ✅ | `supabase/functions/serve-legal/` |
| 접속 로그 90일 자동 파기 (통신비밀보호법) | ✅ | `migrations/0003 (pg_cron)` |
| 계정 삭제 30일 유예 후 완전 파기 | ✅ | `migrations/0003 (pg_cron)` |
| 데이터 내보내기 API (PIPA) | ✅ | `supabase/functions/export-user-data/` |
| Meta Data Deletion Callback | ✅ | `server/routes/meta.ts` |

### 📱 앱마켓 출시 지원
| 기능 | 구현 | 파일 |
|---|---|---|
| Apple + Google 심사 체크리스트 | ✅ | `docs/appstore-submission-checklist.md` |
| ASO 키워드 · 타이틀 · 스크린샷 구성 | ✅ | `docs/appstore-submission-checklist.md` |
| 인앱 리뷰 프롬프트 (월1회, 긍정이벤트 후) | ✅ | `sdk/rating.ts` |
| Info.plist / AndroidManifest 권한 문구 | ✅ 명세 | `docs/appstore-submission-checklist.md` |

### 📦 SDK (`@beauty/platform-sdk`)
원영님 앱에서 3줄로 연동:
```typescript
BeautyPlatform.init({ baseUrl, anonKey, revenueCatKeyIos, revenueCatKeyAndroid });
await BeautyPlatform.auth.signInWithApple(idToken);
const { imageUrl } = await BeautyPlatform.ai.generateImage({ prompt: '...' });
```

모듈: `auth · profile · ai · gallery · storage · billing · account · push · rating · meta · instagramShare`

---

## Quick Start

```bash
make key          # AES-256 암호화 키 생성
make install      # npm install (server + sdk)
make migrate      # Supabase DB push
make dev          # 서버 시작 (localhost:3001)
make smoke        # E2E smoke test
make typecheck    # 서버 + SDK 타입 검사
make rls-audit    # RLS 정책 감사
```

## 검증 현황

| 항목 | 결과 |
|---|---|
| 서버 typecheck | ✅ PASS |
| SDK typecheck | ✅ PASS |
| 서버 부팅 + Deep healthcheck | ✅ `{"ok":true,"db":"up"}` |
| 인증 없이 API 호출 → 401 | ✅ PASS (전 라우트) |
| 웹훅 서명 없이 → 401 | ✅ PASS |
| AES-256 GCM 암호화/복호화 | ✅ PASS |
| AES-256 GCM 위변조 감지 | ✅ PASS |
| DB 마이그레이션 5/5 적용 | ✅ PASS (실제 Supabase) |
