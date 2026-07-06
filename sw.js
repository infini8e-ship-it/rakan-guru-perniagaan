const CACHE='rgp-v1';
const ASET=['./','index.html','style.css','app.js','manifest.json','ikon.svg','data/kb.json','data/sp.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASET)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin.includes('supabase')||url.origin.includes('googleapis.com/v1beta')||url.hostname==='generativelanguage.googleapis.com')return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(e.request.method==='GET'&&res.ok){const cl=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cl))}
    return res;
  }).catch(()=>caches.match('index.html'))));
});
