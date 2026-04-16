# Auth JWT 스펙

Beauty Platform은 Supabase Auth가 발급한 JWT를 그대로 사용합니다.

## Access Token Payload

```json
{
  "iss": "https://<project>.supabase.co/auth/v1",
  "sub": "uuid (= profiles.id)",
  "aud": "authenticated",
  "exp": 1700000000,
  "iat": 1699996400,
  "role": "authenticated",
  "email": "user@example.com",
  "app_metadata": {
    "provider": "apple|google|kakao",
    "plan": "free|premium_monthly|premium_yearly"
  },
  "user_metadata": {
    "nickname": "원영팬"
  }
}
```

## 규칙
- **Access token 수명**: 1시간. `app_metadata.plan`은 구독 상태 변경 시 invalidate.
- **Refresh token**: SecureStore(iOS Keychain / Android Keystore)에만 저장. AsyncStorage 금지.
- **서버 검증**: 모든 `/v1/*` 라우트는 Supabase JWKS로 JWT 서명 검증 후 RLS에 위임.
- **웹훅 경로**: `/v1/billing/webhooks/*`는 JWT 대신 **공급자 서명 검증**만 수행. JWT 검사 bypass.
- **권한 상승**: `app_metadata`는 서버만 쓰기 가능(service_role). 클라이언트가 조작 불가.

## 타임존 / 시각 표기
- 서버 저장: **UTC**
- 클라이언트 표출: **KST (Asia/Seoul)**
- 토큰 내 `exp`, `iat`: **epoch seconds (UTC)**

## 에러 코드 표준
| code | HTTP | 의미 |
|---|---|---|
| AUTH_REQUIRED | 401 | 토큰 없음/만료 |
| FORBIDDEN | 403 | RLS 위반 |
| INSUFFICIENT_CREDITS | 402 | 크레딧 부족 |
| RATE_LIMITED | 429 | 속도 제한 |
| WEBHOOK_SIGNATURE_INVALID | 401 | 웹훅 서명 불일치 |
| VALIDATION_FAILED | 422 | 입력 검증 실패 |
