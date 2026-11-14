/* Orçamentador Mundo 3DI — regras de cálculo (sem dependência de tela) */
(function (root) {
  'use strict';

  var PADROES = { precoKg: 150, valorHora: 2.25, perdaPct: 5, margemPct: 100, minimo: 0 };
  var PESO_ROLO_PADRAO = 1000;   // gramas
  var MAX_MATERIAIS = 12;

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

  /* ---------- Filamentos ---------- */

  /* Preço por kg de um filamento a partir do preço e do peso do rolo (rolo de 500 g a R$ 90 = R$ 180/kg). */
  function precoKgMaterial(m) {
    if (!m || !(m.precoRolo > 0)) return 0;
    var peso = m.pesoRolo > 0 ? m.pesoRolo : PESO_ROLO_PADRAO;
    return m.precoRolo / peso * 1000;
  }

  /* Peso do rolo em gramas inteiras: "1000", "1.000" e "1 000" = 1000. Vazio ou inválido = 1000. */
  function lerPesoRolo(valor) {
    var n = parseInt(String(valor == null ? '' : valor).split(',')[0].replace(/\D/g, ''), 10);
    return isFinite(n) && n > 0 ? Math.min(n, 100000) : PESO_ROLO_PADRAO;
  }

  function numeroValido(n) { return typeof n === 'number' && isFinite(n) && n >= 0; }

  /*
   * Lê a lista de filamentos de uma configuração salva.
   * Configuração antiga (v2, só "preço do rolo de 1 kg"): vira o filamento "PLA", rolo de 1000 g, padrão.
   * Retorna { materiais: [{ id, nome, precoRolo, pesoRolo }], materialPadrao: id } — sempre com 1 filamento ou mais.
   */
  function lerMateriais(salvo) {
    var lista = [], ids = {};
    if (salvo && Array.isArray(salvo.materiais)) {
      salvo.materiais.forEach(function (m) {
        if (!m || typeof m !== 'object' || lista.length >= MAX_MATERIAIS) return;
        var id = typeof m.id === 'string' && m.id && !ids[m.id] ? m.id : 'm' + (lista.length + 1);
        while (ids[id]) id += 'x';
        ids[id] = true;
        var nome = String(m.nome == null ? '' : m.nome).trim().slice(0, 30);
        lista.push({
          id: id,
          nome: nome || 'Filamento ' + (lista.length + 1),
          precoRolo: numeroValido(m.precoRolo) ? m.precoRolo : 0,
          pesoRolo: m.pesoRolo > 0 && isFinite(m.pesoRolo) ? m.pesoRolo : PESO_ROLO_PADRAO
        });
      });
    }
    if (!lista.length) {
      var kg = salvo && numeroValido(salvo.precoKg) ? salvo.precoKg : PADROES.precoKg;
      lista.push({ id: 'pla', nome: 'PLA', precoRolo: kg, pesoRolo: PESO_ROLO_PADRAO });
    }
    var padrao = lista[0].id;
    if (salvo && lista.some(function (m) { return m.id === salvo.materialPadrao; })) padrao = salvo.materialPadrao;
    return { materiais: lista, materialPadrao: padrao };
  }

  var fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function moeda(n) { return fmtBRL.format(n); }
  function decimal(n, min, max) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
  }

  /* Texto do orçamento para enviar ao cliente (não revela custo nem margem).
     opcoes.material: nome do filamento — só entra no texto se vier preenchido (opção "Mostrar filamento no orçamento"). */
  function textoOrcamento(r, opcoes) {
    var material = opcoes && opcoes.material ? String(opcoes.material).trim() : '';
    var linhas = ['*Orçamento — Mundo 3DI*'];
    if (r.qtd > 1) {
      linhas.push(r.qtd + ' peças impressas em 3D');
      if (material) linhas.push('Material: ' + material);
      linhas.push('Valor por peça: ' + moeda(r.valorUnitario));
      linhas.push('*Total: ' + moeda(r.valorCobrar) + '*');
    } else {
      linhas.push('Peça impressa em 3D');
      if (material) linhas.push('Material: ' + material);
      linhas.push('*Valor: ' + moeda(r.valorCobrar) + '*');
    }
    return linhas.join('\n');
  }

  var Calc = {
    PADROES: PADROES, lerNumero: lerNumero, lerTempo: lerTempo, formatarTempo: formatarTempo,
    lerQuantidade: lerQuantidade, calcular: calcular, moeda: moeda, decimal: decimal,
    textoOrcamento: textoOrcamento,
    PESO_ROLO_PADRAO: PESO_ROLO_PADRAO, MAX_MATERIAIS: MAX_MATERIAIS,
    precoKgMaterial: precoKgMaterial, lerMateriais: lerMateriais, lerPesoRolo: lerPesoRolo
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Calc; }
  root.Calc = Calc;
})(typeof window !== 'undefined' ? window : globalThis);
