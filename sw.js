// PWA 介面檔案離線快取；公會題目與答案只在 GAS 後端，私人照片與 API 回覆不快取。
const CACHE='writers-v320-learning-guild-20261106';
const ASSETS=['./','./index.html','./styles.css','./app.js','./cloud.js','./seed.js','./modules.js','./guild.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
