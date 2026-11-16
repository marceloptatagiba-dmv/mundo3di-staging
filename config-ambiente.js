/* Configuração do ambiente — TESTE (staging).
   Prefixo e chave próprios: nada aqui mexe no cache nem nas configurações da produção.
   Toda alteração de arquivo sobe a versao (o cache do app é <prefixo>-v<versao>).
   Também marca visualmente o app (faixa âmbar, subtítulo, título) e pede aos buscadores para não indexar. */
(function (root) {
  'use strict';
  root.AMBIENTE_3DI = {
    nome: 'teste',
    prefixoCache: 'calc3di-teste',
    versao: '0.5.3-teste.1',   // MAJOR.MINOR.PATCH-teste.N: o N sobe a cada publicação no staging; na produção vale o mesmo número sem o sufixo
    chaveConfig: 'mundo3di-teste-config',
    extraCache: ['testes.html', 'testes-casos.js']
  };
  if (typeof document === 'undefined') return; // dentro do service worker não há tela

  var robots = document.createElement('meta');
  robots.name = 'robots'; robots.content = 'noindex, nofollow';
  document.head.appendChild(robots);
  if (document.title.indexOf('(teste)') === -1) document.title += ' (teste)';

  var estilo = document.createElement('style');
  estilo.textContent = 'html::before{content:"";position:fixed;top:0;left:0;right:0;height:5px;background:#F59E0B;z-index:50;pointer-events:none}';
  document.head.appendChild(estilo);

  document.addEventListener('DOMContentLoaded', function () {
    var sub = document.querySelector('.marca span');
    if (sub) sub.textContent = 'Ambiente de teste';
  });
})(self);
