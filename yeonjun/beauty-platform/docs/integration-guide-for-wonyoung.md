# 원영님 앱 ↔ Beauty Platform 연동 가이드

> 본 문서는 **원영님이 만드는 뷰티앱(React Native/Expo)**에서 **연준이 구축한 Beauty Platform**을 호출하기 위한 통합 가이드입니다.
> 원영님은 UI/UX에만 집중하시고, 아래 SDK 함수만 호출하시면 인증/결제/이미지/AI생성이 전부 동작합니다.

---

## 0. 3줄 요약
1. `@beauty/platform-sdk`를 설치 → `BeautyPlatform.init({ baseUrl, anonKey })` 한 번 호출
2. 로그인은 `BeautyPlatform.auth.signInWithApple()` / `signInWithGoogle()` / `signInWithKakao()`
3. AI 이미지 생성은 `BeautyPlatform.ai.generateImage({ prompt })` — 결과 URL이 자동으로 갤러리에 저장

---

## 1. 설치

```bash
npm install @beauty/platform-sdk
# Expo
npx expo install expo-auth-session expo-secure-store expo-image-picker
```

## 2. 초기화 (App.tsx)

```typescript
import { BeautyPlatform } from '@beauty/platform-sdk';

BeautyPlatform.init({
  baseUrl: process.env.EXPO_PUBLIC_PLATFORM_URL!, // 연준이 배포한 게이트웨이
  anonKey: process.env.EXPO_PUBLIC_PLATFORM_ANON_KEY!,
});
```

## 3. 로그인 트리거 위치 (기본값 확정)

**기본 정책 (v1)**: *둘러보기는 비로그인 OK, 핵심 기능 사용 시점에 로그인 요구*.
- 비로그인 허용: 갤러리 탐색, 스타일 프리셋 둘러보기, 온보딩 튜토리얼
- 로그인 필수: AI 생성, 셀카 업로드, 결제, 마이페이지
- 추후 원영님이 "앱 최초 실행 시 강제 로그인"으로 바꾸고 싶으면 `BeautyPlatform.auth.requireAtStartup = true` 옵션만 켜면 됨.

```typescript
// 예시: AI 생성 버튼 누를 때 로그인 유도
async function onGeneratePress() {
  if (!BeautyPlatform.auth.isSignedIn()) {
    await BeautyPlatform.auth.signInWithApple(); // iOS 심사 필수
  }
  const { imageUrl } = await BeautyPlatform.ai.generateImage({
    prompt: '청순한 내추럴 메이크업 K-뷰티 스타일',
    style: 'natural',
  });
}
```

## 4. 결제 유도 화면 (기본값 확정)

**기본 정책 (v1)**:
- **Paywall 진입**: 무료 크레딧(3회) 소진 시 자동 + 설정 화면 "구독" 버튼 수동
- **요금제**: `premium_monthly`(₩4,900/월, 무제한), `premium_yearly`(₩39,000/년, 무제한) — 2종 시작
- **체험판**: 7일 무료 트라이얼 (RevenueCat introductoryOffer)
- **Paywall UI**: **RevenueCat Paywall 기본 템플릿 v4** 사용 (원영님이 v1.1에서 커스텀 가능)
- 크레딧 단건 구매는 v1.1 이월

```typescript
// 예시: 무료 사용량 초과 시 paywall
if (!(await BeautyPlatform.billing.canUseFeature('ai_generation'))) {
  await BeautyPlatform.billing.presentPaywall({
    offering: 'premium_monthly',
  });
}
```

## 5. AI 이미지 생성

```typescript
const result = await BeautyPlatform.ai.generateImage({
  prompt: string,              // 한국어 프롬프트 가능 (서버에서 번역/보강)
  style?: 'natural' | 'glam' | 'vintage' | 'kbeauty',
  referenceImageUrl?: string,  // 선택: 사용자 셀피 URL
});
// → { imageUrl, thumbnailUrl, generationId, creditsRemaining }
```

- 크레딧 차감은 서버에서 원자적으로 처리됨
- 생성 결과는 자동으로 Cloudflare R2 저장 + DB 메타데이터 기록
- 갤러리 조회: `BeautyPlatform.gallery.list({ limit: 20 })`

## 6. 이미지 업로드 (사용자 셀피)

```typescript
const { url } = await BeautyPlatform.storage.upload({
  fileUri: localUri,      // expo-image-picker에서 받은 uri
  purpose: 'selfie',
});
```
내부적으로 Presigned URL을 발급받아 R2로 직접 업로드 → DB 메타데이터 자동 기록.

## 7. 푸시 알림 등록

```typescript
// 앱 시작 후 1회
await BeautyPlatform.push.register();
```

## 8. 계정 삭제 / 데이터 내보내기 (PIPA 필수)

```typescript
await BeautyPlatform.account.exportData();   // JSON 다운로드 URL 반환
await BeautyPlatform.account.deleteAccount(); // 30일 유예 후 완전 파기
```

---

## 9. 환경 변수 (원영님 앱의 `.env`)

```
EXPO_PUBLIC_PLATFORM_URL=https://api.beauty-platform.example.com
EXPO_PUBLIC_PLATFORM_ANON_KEY=eyJ... (Supabase anon key)
EXPO_PUBLIC_REVENUECAT_KEY_IOS=appl_...
EXPO_PUBLIC_REVENUECAT_KEY_ANDROID=goog_...
```

민감한 서버 키(service_role, 포트원 API secret, Ideogram 키)는 **절대 원영님 앱에 포함 금지**. 전부 서버에만 존재.

---

## 10. 앱스토어 심사 필수 체크리스트 (원영님 앱 쪽 책임 영역)

- [x] Apple 로그인 구현 (소셜 로그인 제공 시 의무)
- [ ] 개인정보처리방침 URL 앱 내 노출: `https://beauty-platform.example.com/privacy`
- [ ] 이용약관 URL 앱 내 노출: `https://beauty-platform.example.com/terms`
- [ ] 계정 삭제 기능 앱 내 접근 경로 1개 이상
- [ ] 구독 상품은 **반드시 IAP(RevenueCat)**, 외부 웹결제 버튼 금지
- [ ] 푸시/사진/카메라 권한 요청 사유 문구(`Info.plist` / `AndroidManifest`) 작성
- [ ] 네이티브 기능 1개 이상 포함 (푸시 + 딥링크 + 오프라인 캐시 중 택일) — 껍데기 앱 판정 방지

---

## 11. v1 고정 결정사항

| # | 주제 | v1 확정 |
|---|---|---|
| 1 | 로그인 진입 | 기능 사용 시점 (갤러리/튜토리얼은 비로그인) |
| 2 | Paywall UI | RevenueCat Paywall v4 템플릿 |
| 3 | AI 스타일 | natural / glam / vintage / kbeauty 4종 |
| 4 | BM | 월 ₩4,900 / 연 ₩39,000 + 7일 트라이얼 |
| 5 | 무료 크레딧 | 신규 가입 3회 |
| 6 | 테마 | 원영님 UI 결정 (SDK 영향 없음) |

---

## 12. 연락 / 이슈

- API 변경사항: `contracts/openapi.yaml` 커밋 알림 구독
- 장애/문의: Discord #beauty-platform 채널
