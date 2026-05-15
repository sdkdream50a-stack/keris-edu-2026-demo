// 교실 골든타임 30초 — PWA Service Worker
// 전략: Stale-While-Revalidate (캐시 우선 응답 + 백그라운드 갱신)
// 표준: W3C Service Worker · NIST SP 800-124 (Mobile Device Security)
// 본 SW는 오프라인 캐시만 제공하며, 외부 서버로 사용자 데이터를 전송하지 않습니다.

const CACHE_VERSION = 'v16-2026-05-16-mobile-ux';
const CACHE_NAME = `keris-edu-2026-${CACHE_VERSION}`;

// 사전 캐시 대상 — 첫 방문 시 install 단계에서 캐시
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './icon-maskable-512.svg'
];

// install — 자원 사전 캐시 후 skipWaiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] precache failed:', err))
  );
});

// activate — 옛 캐시 정리 + 클라이언트 즉시 제어
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// fetch — Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 외부 도메인 (CDN) — Cache-First 후 네트워크 갱신
  const url = new URL(req.url);
  const isExternalCdn = url.hostname.includes('jsdelivr.net') ||
                         url.hostname.includes('qrserver.com');

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((networkResp) => {
        // 정상 응답만 캐시 (opaque/error 제외)
        if (networkResp && networkResp.status === 200 && networkResp.type !== 'error') {
          const respClone = networkResp.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, respClone).catch(() => {});
          });
        }
        return networkResp;
      }).catch(() => cached);

      // 캐시 있으면 즉시 응답 + 백그라운드 갱신
      return cached || networkFetch;
    })
  );
});

// message — 클라이언트가 'SKIP_WAITING' 신호 보낼 때 즉시 활성화
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
