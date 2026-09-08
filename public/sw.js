const CACHE='finnexus-shell-v3';
const SHELL=['/offline.html','/icons/icon-192x192.png'];
self.addEventListener('install',event=> { event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate',event=>event.waitUntil((async()=>{ for(const name of await caches.keys()) if(name.startsWith('finnexus-')&&name!==CACHE) await caches.delete(name); await self.clients.claim(); })()));
// Financial responses, authenticated APIs and page HTML are never cached.
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||event.request.mode!=='navigate') return;
 event.respondWith(fetch(event.request).catch(async()=>await caches.match('/offline.html')||new Response('Sem conexão',{status:503})));
});
function safeUrl(value){ try { const url=new URL(value||'/',self.location.origin); return url.origin===self.location.origin?url.href:self.location.origin+'/'; } catch { return self.location.origin+'/'; } }
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let payload={};
 try { payload=event.data?.json()||{}; } catch { payload={body:event.data?.text()}; }
 const title=typeof payload.title==='string'?payload.title.slice(0,120):'FinIntech';
 await self.registration.showNotification(title,{body:typeof payload.body==='string'?payload.body.slice(0,1000):'Há uma atualização no seu painel financeiro.',icon:'/icons/icon-192x192.png',badge:'/icons/icon-72x72.png',tag:typeof payload.tag==='string'?payload.tag:'finance-update',data:{url:safeUrl(payload.url)}});
 for(const client of await self.clients.matchAll({type:'window'})) client.postMessage({type:'PUSH_RECEIVED'});
})()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 if(event.action==='dismiss')return;
 event.waitUntil((async()=>{ const url=safeUrl(event.notification.data?.url); for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) { if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus();} } return self.clients.openWindow(url); })());
});
// Credentials remain in the authenticated app. Reconcile on next login/focus if no client is open.
self.addEventListener('pushsubscriptionchange',event=>event.waitUntil((async()=>{ for(const client of await self.clients.matchAll({type:'window'})) client.postMessage({type:'PUSH_SUBSCRIPTION_CHANGED'}); })()));
