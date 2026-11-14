/* Calculadora Mundo 3DI — funcionamento offline.
   Ao alterar qualquer arquivo do app, aumente o número da VERSAO (v2 -> v3) para os celulares baixarem a atualização.
   O prefixo do cache vem de config-ambiente.js, para produção e teste nunca apagarem o cache um do outro. */
importScripts('config-ambiente.js');
var AMB = self.AMBIENTE_3DI;
var PREFIXO = AMB.prefixoCache;
var VERSAO = PREFIXO + '-v2';
var ARQUIVOS = [
  './', 'index.html', 'calc.js', 'app.js', 'config-ambiente.js', 'manifest.webmanifest',
  'img/logo-3di.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'fonts/montserrat-latin-500-normal.woff2', 'fonts/montserrat-latin-600-normal.woff2',
  'fonts/montserrat-latin-700-normal.woff2', 'fonts/montserrat-latin-800-normal.woff2'
].concat(AMB.extraCache || []);

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
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
