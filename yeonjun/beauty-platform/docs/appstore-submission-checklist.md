# 앱마켓 제출 체크리스트

## Apple App Store
- [ ] Apple 로그인 제공 (타 소셜 로그인 있을 때 의무, Guideline 4.8)
- [ ] 디지털 상품은 **반드시 IAP** (Guideline 3.1.1) — PortOne/외부 결제 링크 금지
- [ ] 네이티브 기능 1개 이상 (Guideline 4.2 Minimum Functionality): **푸시 알림 + 딥링크 + 오프라인 갤러리 캐시** 중 2개 권장
- [ ] 개인정보처리방침 URL을 앱 내와 App Store Connect에 동일하게 등재
- [ ] 계정 삭제 경로가 앱 내 2회 이내 탭으로 도달 (Guideline 5.1.1(v))
- [ ] Privacy Nutrition Label: 수집 항목 정확히 체크 (프롬프트=이용자콘텐츠, 푸시토큰=식별자)
- [ ] `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSUserTrackingUsageDescription` 작성
- [ ] TestFlight 외부 테스트 최소 1주 (리젝 리스크 조기 발견)

## Google Play
- [ ] Data Safety 양식 기재 (위 Privacy Label과 동기)
- [ ] 14세 이상 타겟 (AI 생성 콘텐츠 특성)
- [ ] 구독은 **Play Billing Library** 경유 (RevenueCat이 래핑)
- [ ] 환불/해지 안내 앱 내 노출
- [ ] Pre-launch report 크래시 0건

## 공통 ASO 키워드 (국내)
- 1순위: `AI 뷰티`, `메이크업 시뮬`, `AI 메이크업`
- 2순위: `셀카 보정`, `뷰티 카메라`, `K뷰티`
- 3순위: `화장 추천`, `뷰티 AI 앱`

### 타이틀 / 서브타이틀 예시
- 타이틀: `뷰티AI - AI 메이크업 스튜디오`
- 서브타이틀: `내 얼굴에 어울리는 K뷰티 메이크업을 AI로`

## 스크린샷 구성 (5매)
1. 히어로: AI 생성 결과 before/after
2. 스타일 프리셋 4종 비교
3. 셀카 업로드 → 결과
4. 갤러리
5. 구독 혜택

## 인앱 리뷰 프롬프트 타이밍
- AI 생성 **성공 직후** + 사용자가 결과를 2초 이상 응시한 경우
- 월 1회 이하 호출
- SDK 제공: `BeautyPlatform.rating.promptIfAppropriate()` (W4 말 추가 예정)
