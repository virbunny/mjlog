const CACHE_NAME='mengjianlu-pwa-v037';
const PRECACHE=[
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './飲食匯入格式範例.json',
  './chatgpt-paste.css',
  './chatgpt-paste.js',
  './猛健錄_ChatGPT飲食紀錄輸出格式規格_V1.md'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(PRECACHE)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('mengjianlu-')&&key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;

  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req)
        .then(resp=>{
          const copy=resp.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));
          return resp;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(resp=>{
      if(resp.ok){
        const copy=resp.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));
      }
      return resp;
    }))
  );
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
      for(const c of list){if('focus'in c)return c.focus()}
      return clients.openWindow('./index.html');
    })
  );
});
