# 잇데이 스튜디오 (Itdasy Studio)

뷰티샵 전용 AI 인스타그램 마케팅 PWA

## 구조

```
index.html         - 메인 HTML (탭 구조, UI)
style.css          - 전체 스타일
sw.js              - Service Worker (캐시, 오프라인)
manifest.json      - PWA 설정
app-core.js        - 공통 (인증, 탭 전환, 유틸)
app-instagram.js   - 인스타그램 연동 / 발행
app-caption.js     - 피드 글 작성 / AI 캡션
app-portfolio.js   - 포트폴리오 관리
app-ai.js          - AI 추천
oauth_bridge.html  - 인스타 OAuth 콜백 브릿지
privacy.html       - 개인정보처리방침
```

## 배포

GitHub Pages: `https://dnjsdud4563.github.io/itdasy-studio/`

## 변경 이력

### 2026-04-17
- 서명 중복 제거: Step 5 캡션에서 서명 수동 추가 코드 삭제 (AI가 이미 처리)
- 팝업 크기 확대: persona-popup 88vh → 92vh, 글씨 전체 1~2px 키움
- 직접 작성 옵션: scenario-selector에 상황/손님/사진 각 축 "직접 작성" 추가
- 커스텀 combo_id: 직접 작성 시 `custom_...` 형태로 동적 생성

### 2026-04-13
- 모놀리식 `app.js` → 모듈 분리 (`app-core.js` 외 4개)
- `analyzeResultPopup` div 중첩 버그 수정 → 피드글작성 / AI추천 / 포트폴리오 탭 미표시 해결
- `copyToast` 엘리먼트 누락 추가 → 토스트 알림 TypeError 해결
- `getToken()` JWT 만료 자동 감지 → 만료 시 로그인 화면 표시
