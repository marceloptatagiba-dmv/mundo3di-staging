// Teste das regras de cálculo: node teste-calculo.js
var C = require('./calc.js');
var D = require('./dados.js');
var T = require('./testes-casos.js');
var resultados = T.executar(C, D);

/* Só no node: confere os config-ambiente.js dos dois ambientes e o service worker (versão MAJOR.MINOR.PATCH, nome do cache) */
var fs = require('fs'), path = require('path'), vm = require('vm');
function ler(arq) { return fs.readFileSync(path.join(__dirname, arq), 'utf8'); }
function ambiente(arq) {
  var self = {};
  vm.runInNewContext(ler(arq), { self: self });
  return self.AMBIENTE_3DI;
}
function rodarSw(amb) {   // executa o sw.js de verdade com um ambiente; devolve o contexto (ou o erro)
  var self = { AMBIENTE_3DI: amb, addEventListener: function () {}, skipWaiting: function () {}, clients: {} };
  var ctx = { self: self, importScripts: function () {}, caches: {}, Request: function () {} };
  try { vm.runInNewContext(ler('sw.js'), ctx); return ctx; } catch (e) { return { erro: String(e.message || e) }; }
}
function igual(nome, obtido, esperado) { resultados.push({ nome: nome, ok: obtido === esperado, obtido: obtido, esperado: esperado }); }

/* O config-ambiente.js da raiz é o do ambiente em que o teste roda (na pasta local é o de produção; no staging publicado, o de teste).
   A comparação staging x produção só acontece quando os dois arquivos existem (pasta local, com ambientes/staging/). */
var raiz = ambiente('config-ambiente.js');
var temStaging = fs.existsSync(path.join(__dirname, 'ambientes', 'staging', 'config-ambiente.js'));
var stg = temStaging ? ambiente('ambientes/staging/config-ambiente.js') : (raiz.nome === 'teste' ? raiz : null);
var prod = raiz.nome === 'teste' ? null : raiz;
igual('ambiente: versão no formato MAJOR.MINOR.PATCH', C.VERSAO_RE.test(raiz.versao), true);
if (prod) igual('ambiente: versão da produção sem sufixo -teste.N', !/-teste/.test(prod.versao), true);
if (stg) {
  igual('ambiente: versão do staging com sufixo -teste.N', /-teste\.\d+$/.test(stg.versao) && C.VERSAO_RE.test(stg.versao), true);
  igual('ambiente: staging sem versaoCache antigo', stg.versaoCache, undefined);
}
if (prod && stg) {
  igual('ambiente: staging maior ou igual à produção', C.compararVersoes(stg.versao, prod.versao) >= 0, true);
  igual('ambiente: prefixos e chaves diferentes', (prod.prefixoCache !== stg.prefixoCache) + '|' + (prod.chaveConfig !== stg.chaveConfig), 'true|true');
}
igual('sw: nome do cache vem do config deste ambiente', rodarSw(raiz).VERSAO, raiz.prefixoCache + '-v' + raiz.versao);
igual('sw: nome do cache da produção', rodarSw({ prefixoCache: 'calc3di', versao: '0.4.0', extraCache: [] }).VERSAO, 'calc3di-v0.4.0');
igual('sw: nome do cache do staging', rodarSw({ prefixoCache: 'calc3di-teste', versao: '0.4.0-teste.3', extraCache: [] }).VERSAO, 'calc3di-teste-v0.4.0-teste.3');
igual('sw: cache do staging não começa com o prefixo que a produção apaga', rodarSw({ prefixoCache: 'calc3di-teste', versao: '0.4.0-teste.1', extraCache: [] }).VERSAO.indexOf('calc3di-v'), -1);
igual('sw: sem versao aborta a instalação', /sem versao/.test(rodarSw({ prefixoCache: 'calc3di', versaoCache: 'v10' }).erro || ''), true);
['v10', '0.4', '0.4.0.1', '0.4.0-beta.1', 4, ''].forEach(function (inv) {
  igual('sw: versao inválida (' + JSON.stringify(inv) + ') aborta', !!rodarSw({ prefixoCache: 'calc3di', versao: inv }).erro, true);
});

var falhas = 0;
resultados.forEach(function (x) {
  if (!x.ok) { falhas++; console.log('FALHA', x.nome, JSON.stringify(x.obtido), '≠', JSON.stringify(x.esperado)); }
});
console.log(falhas ? falhas + ' falha(s) de ' + resultados.length : 'Todos os ' + resultados.length + ' testes passaram');
process.exit(falhas ? 1 : 0);
