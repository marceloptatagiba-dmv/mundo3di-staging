/* Orçamentador Mundo 3DI — funcionamento offline.
   Ao alterar qualquer arquivo do app, aumente a versaoCache em config-ambiente.js (v2 -> v3) para os celulares baixarem a atualização.
   Prefixo e versão do cache vêm de config-ambiente.js: produção e teste têm os seus e nunca apagam o cache um do outro. */
importScripts('config-ambiente.js');
var AMB = self.AMBIENTE_3DI;
/* Se o navegador entregar uma config-ambiente.js antiga (cache HTTP), aborta: a atualização é tentada de novo na próxima abertura. */
if (!AMB || !AMB.versaoCache) { throw new Error('config-ambiente.js desatualizado (sem versaoCache)'); }
var PREFIXO = AMB.prefixoCache;
var VERSAO = PREFIXO + '-' + AMB.versaoCache;
var ARQUIVOS = [
  './', 'index.html', 'calc.js', 'orcamento-img.js', 'app.js', 'config-ambiente.js', 'manifest.webmanifest',
  'img/logo-3di.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'fonts/montserrat-latin-500-normal.woff2', 'fonts/montserrat-latin-600-normal.woff2',
  'fonts/montserrat-latin-700-normal.woff2', 'fonts/montserrat-latin-800-normal.woff2'
].concat(AMB.extraCache || []);

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) {
    /* cache: 'reload' ignora o cache HTTP do navegador (o GitHub Pages guarda arquivos por até 10 minutos) */
    return Promise.all(ARQUIVOS.map(function (u) { return c.add(new Request(u, { cache: 'reload' })); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n.indexOf(PREFIXO + '-v') === 0 && n !== VERSAO; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (r) {
      return r || fetch(e.request).catch(function () {
        if (e.request.mode === 'navigate') return caches.match('index.html');
      });
    })
  );
});
