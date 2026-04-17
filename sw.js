// ─────────────────────────────────────────────
//  잇데이 Service Worker
//  CACHE_VERSION = 날짜(YYYYMMDD) + 빌드번호
//  배포할 때마다 이 값만 올리면 구 캐시 자동 삭제
// ─────────────────────────────────────────────
const CACHE_VERSION = '20260417-v2';
const CACHE_NAME    = `itdasy-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/itdasy-studio/index.html',
  '/itdasy-studio/style.css',
  '/itdasy-studio/app-core.js',
  '/itdasy-studio/app-instagram.js',
  '/itdasy-studio/app-caption.js',
  '/itdasy-studio/app-portfolio.js',
  '/itdasy-studio/app-ai.js',
  '/itdasy-studio/app-gallery.js',
  '/itdasy-studio/manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Noto+Sans+KR:wght@300;400;500&display=swap',
];

// ── install: 새 버전 캐시 준비 ──
self.addEventListener('install', event => {
  self.skipWaiting(); // 대기 없이 즉시 활성화
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ── activate: 구 버전 캐시 전부 삭제 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('itdasy-') && key !== CACHE_NAME)
          .map(key => {
            console.log(`[SW] 구 캐시 삭제: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // 열려있는 탭에 즉시 적용
  );
});

// ── fetch: Network-First 전략 ──
//   API 호출 → 항상 네트워크
//   정적 파일 → 네트워크 우선, 실패 시 캐시 폴백
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API / 외부 서버 요청은 캐시 안 함
  if (
    url.hostname.includes('ngrok') ||
    url.hostname.includes('catbox') ||
    url.hostname.includes('instagram') ||
    url.hostname.includes('facebook') ||
    url.hostname.includes('googleapis.com') && url.pathname.includes('/generate')
  ) {
    return; // 브라우저 기본 fetch 동작
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 정상 응답이면 캐시에도 저장
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request)) // 오프라인 폴백
  );
});
