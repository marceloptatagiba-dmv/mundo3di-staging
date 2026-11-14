/* Calculadora Mundo 3DI — regras de cálculo (sem dependência de tela) */
(function (root) {
  'use strict';

  var PADROES = { precoKg: 150, valorHora: 2.25, perdaPct: 5, margemPct: 100, minimo: 0 };

  /* Converte texto digitado (vírgula ou ponto) em número >= 0. Vazio ou inválido = 0. */
  function lerNumero(valor) {
    var s = String(valor == null ? '' : valor).trim().replace(/\s/g, '');
    if (s.indexOf(',') !== -1) {
      s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 -> 1234.56
    }
    var n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : 0;
  }

  /*
   * Converte o tempo digitado em minutos. Aceita o formato do fatiador:
   *   2h35 · 2h 35min · 2:35 · 2h · 1,5h · 35min · 35 (número puro = minutos)
   */
  function lerTempo(valor) {
    var s = String(valor == null ? '' : valor).trim().toLowerCase().replace(/\s/g, '');
    var m;
    if (!s) return 0;
    if ((m = /^(\d+):(\d{1,2})$/.exec(s))) return Number(m[1]) * 60 + Number(m[2]);
    if ((m = /^(\d+(?:[.,]\d+)?)h(?:(\d{1,2})(?:min|m)?)?$/.exec(s))) {
      return lerNumero(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
    }
    if ((m = /^(\d+(?:[.,]\d+)?)(?:min|m)$/.exec(s))) return lerNumero(m[1]);
    return lerNumero(s);
  }

  /* Minutos -> "2h35" (a partir de 1 hora) ou "35 min". */
  function formatarTempo(min) {
    var t = Math.round(min);
    var h = Math.floor(t / 60), m = t % 60;
    if (h === 0) return decimal(min, 0, 2) + ' min';
    return h + 'h' + (m < 10 ? '0' : '') + m;
  }

  /* Quantidade de peças: inteiro >= 1 (vazio ou inválido = 1). */
  function lerQuantidade(valor) {
    var n = parseInt(String(valor == null ? '' : valor).replace(/\D/g, ''), 10);
    return isFinite(n) && n >= 1 ? Math.min(n, 9999) : 1;
  }

  /*
   * Peso e tempo são da mesa inteira (como o fatiador informa); qtd = peças na mesa.
   * Custo base   = peso × (preço kg / 1000) + tempo × (valor hora / 60)
   * Perda/Refugo = custo base × perda%
   * Extras       = extras por peça × qtd (sem perda)
   * Custo total  = custo base + perda + extras
   * Valor final  = custo total × (1 + margem%), nunca abaixo do preço mínimo do pedido
   * Lucro        = valor final − custo total
   * Unitário     = valor final ÷ qtd
   */
  function calcular(e) {
    var qtd = e.qtd >= 1 ? e.qtd : 1;
    var extrasPeca = e.extrasPeca > 0 ? e.extrasPeca : 0;
    var minimo = e.minimo > 0 ? e.minimo : 0;
    var valorGrama = e.precoKg / 1000;
    var valorMinuto = e.valorHora / 60;
    var material = e.peso * valorGrama;
    var impressao = e.tempo * valorMinuto;
    var custoBase = material + impressao;
    var perda = custoBase * e.perdaPct / 100;
    var extras = extrasPeca * qtd;
    var custoTotal = custoBase + perda + extras;
    var valorCalculado = custoTotal * (1 + e.margemPct / 100);
    var minimoAplicado = minimo > 0 && custoTotal > 0 && valorCalculado < minimo;
    var valorCobrar = minimoAplicado ? minimo : valorCalculado;
    return {
      qtd: qtd,
      valorGrama: valorGrama,
      valorMinuto: valorMinuto,
      material: material,
      impressao: impressao,
      custoBase: custoBase,
      perda: perda,
      extras: extras,
      custoTotal: custoTotal,
      valorCalculado: valorCalculado,
      minimoAplicado: minimoAplicado,
      valorCobrar: valorCobrar,
      lucro: valorCobrar - custoTotal,
      valorUnitario: valorCobrar / qtd
    };
  }

  var fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function moeda(n) { return fmtBRL.format(n); }
  function decimal(n, min, max) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
  }

  /* Texto do orçamento para enviar ao cliente (não revela custo nem margem). */
  function textoOrcamento(r) {
    var linhas = ['*Orçamento — Mundo 3DI*'];
    if (r.qtd > 1) {
      linhas.push(r.qtd + ' peças impressas em 3D');
      linhas.push('Valor por peça: ' + moeda(r.valorUnitario));
      linhas.push('*Total: ' + moeda(r.valorCobrar) + '*');
    } else {
      linhas.push('Peça impressa em 3D');
      linhas.push('*Valor: ' + moeda(r.valorCobrar) + '*');
    }
    return linhas.join('\n');
  }

  var Calc = {
    PADROES: PADROES, lerNumero: lerNumero, lerTempo: lerTempo, formatarTempo: formatarTempo,
    lerQuantidade: lerQuantidade, calcular: calcular, moeda: moeda, decimal: decimal,
    textoOrcamento: textoOrcamento
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Calc; }
  root.Calc = Calc;
})(typeof window !== 'undefined' ? window : globalThis);
