const CACHE_NAME = 'bakdong-log-v2';
const ASSETS = ['./index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  if(event.request.method!=='GET') return;

  const url = new URL(event.request.url);
  // 다른 출처(구글 로그인 등)로 가는 요청은 서비스워커가 관여하지 않고 그대로 통과시킴
  if(url.origin !== self.location.origin) return;

  // 페이지 탐색(주소 입력/새로고침/딥링크) 요청: 네트워크 우선
  // -> 온라인이면 항상 최신 버전을 받아오고, 받아온 페이지는 캐시에도 갱신해둠
  // -> 오프라인일 때만 캐시된 버전으로 대체
  if(event.request.mode === 'navigate'){
    event.respondWith(
      fetch(event.request).then(function(res){
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, resClone); });
        return res;
      }).catch(function(){
        return caches.match(event.request).then(function(cached){ return cached || caches.match('./index.html'); });
      })
    );
    return;
  }

  // 그 외 정적 자산(아이콘, 매니페스트 등)은 기존처럼 캐시 우선 + 네트워크 폴백
  event.respondWith(
    caches.match(event.request).then(function(cached){
      return cached || fetch(event.request).catch(function(){ return caches.match('./index.html'); });
    })
  );
});
