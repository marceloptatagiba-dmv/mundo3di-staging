// Teste das regras de cálculo: node teste-calculo.js
var C = require('./calc.js');
var T = require('./testes-casos.js');
var resultados = T.executar(C);
var falhas = 0;
resultados.forEach(function (x) {
  if (!x.ok) { falhas++; console.log('FALHA', x.nome, JSON.stringify(x.obtido), '≠', JSON.stringify(x.esperado)); }
});
console.log(falhas ? falhas + ' falha(s) de ' + resultados.length : 'Todos os ' + resultados.length + ' testes passaram');
process.exit(falhas ? 1 : 0);
