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
    /* Custo da hora detalhado: energiaHora e desgasteHora (R$/h) vêm de calcularImpressora(); sem eles vale o valor simples. */
    var detalhado = typeof e.energiaHora === 'number' && typeof e.desgasteHora === 'number';
    var valorHora = detalhado ? e.energiaHora + e.desgasteHora : e.valorHora;
    var valorMinuto = valorHora / 60;
    var energia = detalhado ? e.tempo * e.energiaHora / 60 : 0;
    var desgaste = detalhado ? e.tempo * e.desgasteHora / 60 : 0;
    var material = e.peso * valorGrama;
    var impressao = detalhado ? energia + desgaste : e.tempo * valorMinuto;
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
      detalhado: detalhado,
      energia: energia,
      desgaste: desgaste,
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

  /* ---------- Energia e desgaste da impressora (custo da hora detalhado) ---------- */

  var MAX_HORAS_ANO = 8760; // horas de um ano

  /* Valor em reais/watts que pode vir com separador de milhar: "4.000" = 4000, "4.000,50" = 4000,5, "12.5" = 12,5. */
  function lerDinheiro(valor) {
    var s = String(valor == null ? '' : valor).trim().replace(/\s/g, '');
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return lerNumero(s);
  }

  /* Inteiro >= 0 (vida útil, horas por ano): "6.000", "6 000" e "6000" = 6000. Vazio ou inválido = 0. */
  function lerInteiro(valor) {
    var n = parseInt(String(valor == null ? '' : valor).split(',')[0].replace(/\D/g, ''), 10);
    return isFinite(n) && n > 0 ? Math.min(n, 1000000) : 0;
  }

  /* Campos da impressora de uma configuração salva (objeto "impressora"). Tudo que faltar ou for inválido vira 0. */
  function lerImpressora(salvo) {
    var s = salvo && typeof salvo === 'object' ? salvo : {};
    function n(v) { return numeroValido(v) ? v : 0; }
    return {
      potenciaW: n(s.potenciaW), tarifa: n(s.tarifa), preco: n(s.preco), revenda: n(s.revenda),
      vidaUtil: n(s.vidaUtil), manutencaoAno: n(s.manutencaoAno), horasAno: Math.min(n(s.horasAno), MAX_HORAS_ANO)
    };
  }

  /*
   * Custo da hora no modo detalhado (R$ por hora de impressão):
   *   Energia   = potência (W) ÷ 1000 × tarifa (R$/kWh)
   *   Desgaste  = (preço − revenda) ÷ vida útil (h)  +  manutenção por ano ÷ horas impressas por ano
   *   Hora      = energia + desgaste
   * Vida útil ou horas por ano em branco (0) desligam a respectiva parte; revenda acima do preço não gera crédito.
   */
  function calcularImpressora(p) {
    var i = lerImpressora(p);
    var energiaHora = i.potenciaW / 1000 * i.tarifa;
    var depreciacaoHora = i.vidaUtil > 0 ? Math.max(0, i.preco - i.revenda) / i.vidaUtil : 0;
    var manutencaoHora = i.horasAno > 0 ? i.manutencaoAno / i.horasAno : 0;
    var desgasteHora = depreciacaoHora + manutencaoHora;
    return {
      energiaHora: energiaHora, depreciacaoHora: depreciacaoHora, manutencaoHora: manutencaoHora,
      desgasteHora: desgasteHora, horaTotal: energiaHora + desgasteHora
    };
  }

  var fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function moeda(n) { return fmtBRL.format(n); }
  function decimal(n, min, max) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
  }

  /* ---------- Meu negócio, numeração e registro de envios ---------- */

  var NOME_PADRAO = 'Mundo 3DI';
  var LIMITES_NEGOCIO = { nome: 40, whatsapp: 20, instagram: 40, cidade: 40, cnpj: 18, prazo: 40, pagamento: 80, obs: 160 };
  var VALIDADE_PADRAO = 7;     // dias
  var MAX_REGISTROS = 2000;

  /* Dados do negócio de uma configuração salva. Texto aparado e limitado; validade em dias (0 = não mostrar). */
  function lerNegocio(salvo) {
    var s = salvo && typeof salvo === 'object' ? salvo : {};
    var n = {};
    Object.keys(LIMITES_NEGOCIO).forEach(function (k) {
      n[k] = String(s[k] == null ? '' : s[k]).replace(/\s+/g, ' ').trim().slice(0, LIMITES_NEGOCIO[k]);
    });
    n.validadeDias = typeof s.validadeDias === 'number' && isFinite(s.validadeDias) && s.validadeDias >= 0
      ? Math.min(Math.round(s.validadeDias), 365) : VALIDADE_PADRAO;
    return n;
  }

  /* Nº do orçamento com 4 dígitos: 7 -> "0007". */
  function formatarNumero(n) {
    var s = String(Math.max(0, Math.floor(Number(n) || 0)));
    while (s.length < 4) s = '0' + s;
    return s;
  }

  function doisDigitos(n) { return (n < 10 ? '0' : '') + n; }
  function formatarData(d) { return doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function somarDias(d, dias) { var x = new Date(d.getTime()); x.setDate(x.getDate() + dias); return x; }

  /*
   * Tudo o que vai escrito na imagem do orçamento — e só isso. Não recebe custo, margem, perda nem lucro
   * como campo: o desenho da imagem usa apenas este objeto.
   * o: { negocio, numero, data (Date), cliente, descricao, material, prazo }
   */
  function dadosOrcamento(r, o) {
    var negocio = lerNegocio(o && o.negocio);
    var data = o && o.data instanceof Date ? o.data : new Date();
    function limpa(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
    var descricao = limpa(o && o.descricao, 120) || (r.qtd > 1 ? r.qtd + ' peças impressas em 3D' : 'Peça impressa em 3D');
    return {
      numero: formatarNumero(o && o.numero),
      data: formatarData(data),
      validade: negocio.validadeDias > 0 ? formatarData(somarDias(data, negocio.validadeDias)) : '',
      negocioNome: negocio.nome || NOME_PADRAO,
      whatsapp: negocio.whatsapp, instagram: negocio.instagram, cidade: negocio.cidade, cnpj: negocio.cnpj,
      cliente: limpa(o && o.cliente, 60),
      descricao: descricao,
      material: limpa(o && o.material, 30),
      qtd: r.qtd,
      valorPeca: r.qtd > 1 ? moeda(r.valorUnitario) : '',
      total: moeda(r.valorCobrar),
      prazo: limpa(o && o.prazo, LIMITES_NEGOCIO.prazo),
      pagamento: negocio.pagamento,
      obs: negocio.obs
    };
  }

  /* Registro local de um envio (texto ou imagem). custoTotal e lucro são de uso interno: nunca vão para o cliente. */
  function novoRegistro(r, o) {
    function c(n) { return Math.round(n * 100) / 100; }
    return {
      n: o.numero,
      ts: (o.quando instanceof Date ? o.quando : new Date()).toISOString(),
      formato: o.formato === 'imagem' ? 'imagem' : 'texto',
      qtd: r.qtd, valorPeca: c(r.valorUnitario), total: c(r.valorCobrar), custoTotal: c(r.custoTotal), lucro: c(r.lucro),
      material: o.material || '', cliente: o.cliente || '', descricao: o.descricao || ''
    };
  }

  /* Acrescenta um registro à lista (guarda no máximo MAX_REGISTROS; os mais antigos saem primeiro). */
  function adicionarRegistro(lista, reg, max) {
    var nova = Array.isArray(lista) ? lista.slice() : [];
    nova.push(reg);
    var limite = max > 0 ? max : MAX_REGISTROS;
    return nova.length > limite ? nova.slice(nova.length - limite) : nova;
  }

  /* Texto do orçamento para enviar ao cliente (não revela custo nem margem).
     opcoes.material: nome do filamento — só entra no texto se vier preenchido (opção "Mostrar filamento no orçamento").
     opcoes.numero: nº do orçamento (inteiro) · opcoes.negocio: nome do negócio (vazio = Mundo 3DI). */
  function textoOrcamento(r, opcoes) {
    var material = opcoes && opcoes.material ? String(opcoes.material).trim() : '';
    var negocio = opcoes && opcoes.negocio ? String(opcoes.negocio).trim() : '';
    var numero = opcoes && opcoes.numero > 0 ? ' Nº ' + formatarNumero(opcoes.numero) : '';
    var linhas = ['*Orçamento' + numero + ' — ' + (negocio || NOME_PADRAO) + '*'];
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
    precoKgMaterial: precoKgMaterial, lerMateriais: lerMateriais, lerPesoRolo: lerPesoRolo,
    lerDinheiro: lerDinheiro, lerInteiro: lerInteiro, lerImpressora: lerImpressora, calcularImpressora: calcularImpressora,
    MAX_HORAS_ANO: MAX_HORAS_ANO,
    NOME_PADRAO: NOME_PADRAO, LIMITES_NEGOCIO: LIMITES_NEGOCIO, VALIDADE_PADRAO: VALIDADE_PADRAO, MAX_REGISTROS: MAX_REGISTROS,
    lerNegocio: lerNegocio, formatarNumero: formatarNumero, formatarData: formatarData,
    dadosOrcamento: dadosOrcamento, novoRegistro: novoRegistro, adicionarRegistro: adicionarRegistro
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Calc; }
  root.Calc = Calc;
})(typeof window !== 'undefined' ? window : globalThis);
