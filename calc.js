/* Mundo 3Di — regras de cálculo (sem dependência de tela) */
(function (root) {
  'use strict';

  var PADROES = { precoKg: 150, valorHora: 2.25, perdaPct: 5, margemPct: 100, minimo: 0, arredondamento: 'exato' };
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

  /* ---------- Arredondamento do valor por peça ---------- */

  var MODOS_ARREDONDAMENTO = ['exato', '50', '90', 'inteiro'];

  /* Modo salvo ou digitado -> um dos quatro modos válidos; qualquer outra coisa vira "exato". */
  function lerArredondamento(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    return MODOS_ARREDONDAMENTO.indexOf(s) !== -1 ? s : 'exato';
  }

  /*
   * Arredonda um valor em reais SEMPRE PARA CIMA, conta em centavos inteiros:
   *   50     -> próximo múltiplo de R$ 0,50   (2,36 -> 2,50)
   *   90     -> próximo valor terminado em ,90 (2,36 -> 2,90 · 2,91 -> 3,90)
   *   inteiro-> próximo real                    (2,36 -> 3,00 · 3,00 -> 3,00)
   *   exato  -> sem mudança. Valor zero (ou negativo) nunca é arredondado.
   * O valor é primeiro levado a centavos (o que a tela mostra); quem já está no formato não muda.
   */
  function arredondarCima(valor, modo) {
    var m = lerArredondamento(modo);
    if (!(valor > 0) || m === 'exato') return valor;
    var c = Math.round(valor * 100), r;
    if (m === '50') r = Math.ceil(c / 50) * 50;
    else if (m === 'inteiro') r = Math.ceil(c / 100) * 100;
    else { r = Math.floor(c / 100) * 100 + 90; if (r < c) r += 100; }
    return r / 100;
  }

  /* Quantidade de peças: inteiro >= 1 (vazio ou inválido = 1). */
  function lerQuantidade(valor) {
    var n = parseInt(String(valor == null ? '' : valor).replace(/\D/g, ''), 10);
    return isFinite(n) && n >= 1 ? Math.min(n, 9999) : 1;
  }

  /* ---------- Peças multicor (AMS) ---------- */

  var MAX_CORES = 8;

  /*
   * cores: [{ gramas, precoKg }] · purgaG: purga + torre (g), copiada do fatiador.
   * Material = soma de gramas × preço por grama de cada cor.
   * A purga é cobrada pelo PREÇO MÉDIO PONDERADO das cores usadas (média dos preços por grama, ponderada pelas gramas):
   *   PLA 30 g × 0,15 + PETG 10 g × 0,12 = 5,70 ÷ 40 g = 0,1425/g → purga de 8 g = R$ 1,14.
   * Sem gramas nas cores, a purga usa o preço da primeira cor (para não sair de graça).
   */
  function resumirCores(cores, purgaG) {
    var lista = Array.isArray(cores) ? cores.slice(0, MAX_CORES) : [];
    var pesoCores = 0, material = 0, usadas = 0;
    lista.forEach(function (c) {
      var g = c && c.gramas > 0 && isFinite(c.gramas) ? c.gramas : 0;
      var kg = c && c.precoKg > 0 && isFinite(c.precoKg) ? c.precoKg : 0;
      pesoCores += g; material += g * kg / 1000;
      if (g > 0) usadas++;
    });
    var gPurga = purgaG > 0 && isFinite(purgaG) ? purgaG : 0;
    var precoMedioGrama = pesoCores > 0 ? material / pesoCores
      : (lista.length && lista[0] && lista[0].precoKg > 0 ? lista[0].precoKg / 1000 : 0);
    return {
      quantidadeCores: usadas, pesoCores: pesoCores, material: material,
      purgaG: gPurga, precoMedioGrama: precoMedioGrama, purga: gPurga * precoMedioGrama
    };
  }

  /*
   * Peso e tempo são da mesa inteira (como o fatiador informa); qtd = peças na mesa.
   * Custo base   = material (peso × preço kg / 1000; multicor: soma das cores) + purga (multicor) + tempo × (valor hora / 60)
   * Perda/Refugo = custo base × perda%
   * Extras       = extras por peça × qtd (sem perda)
   * Custo total  = custo base + perda + extras
   * Valor final  = custo total × (1 + margem%), nunca abaixo do preço mínimo do pedido;
   *                depois, se houver arredondamento (e o mínimo não foi aplicado), o valor por peça sobe para ,50 / ,90 / inteiro
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
    /* Peça multicor: e.cores = [{ gramas, precoKg }] e e.purgaG (purga + torre, em gramas). Sem e.cores vale o peso único. */
    var multicor = Array.isArray(e.cores);
    var rc = multicor ? resumirCores(e.cores, e.purgaG) : null;
    var material = multicor ? rc.material : e.peso * valorGrama;
    var purga = multicor ? rc.purga : 0;
    var impressao = detalhado ? energia + desgaste : e.tempo * valorMinuto;
    var custoBase = material + purga + impressao;
    var perda = custoBase * e.perdaPct / 100;
    var extras = extrasPeca * qtd;
    var custoTotal = custoBase + perda + extras;
    var valorCalculado = custoTotal * (1 + e.margemPct / 100);
    var minimoAplicado = minimo > 0 && custoTotal > 0 && valorCalculado < minimo;
    /* Ordem: cálculo → preço mínimo → arredondamento (só no valor por peça; com o mínimo aplicado não arredonda) */
    var modoArred = lerArredondamento(e.arredondar);
    var valorBase = minimoAplicado ? minimo : valorCalculado;
    var arredondado = !minimoAplicado && modoArred !== 'exato' && valorCalculado > 0;
    var valorCobrar = valorBase;
    if (arredondado) {
      valorCobrar = Math.round(arredondarCima(valorCalculado / qtd, modoArred) * qtd * 100) / 100;
    }
    return {
      qtd: qtd,
      valorGrama: valorGrama,
      valorMinuto: valorMinuto,
      material: material,                                      // só o filamento das peças (sem a purga)
      multicor: multicor,
      pesoTotal: multicor ? rc.pesoCores : e.peso,             // gramas das peças (sem a purga)
      purga: purga,                                            // R$ da purga + torre
      purgaGramas: multicor ? rc.purgaG : 0,
      precoMedioGrama: multicor ? rc.precoMedioGrama : 0,
      materialTotal: material + purga,                         // material + purga
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
      arredondamento: valorCobrar - valorBase,                 // R$ acrescentados ao total pelo arredondamento
      valorAntesArredondar: valorBase / qtd,                   // valor por peça antes de arredondar
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

  /*
   * Telefone no padrão brasileiro: (21) 8898-0197 (fixo, 10 dígitos) ou (21) 98898-0197 (celular, 11 dígitos).
   * Vai formatando enquanto digita. Ignora o "+55"/"55" quando vem com DDI (12 ou 13 dígitos). Mais de 11 dígitos: corta.
   */
  function formatarTelefone(texto) {
    var d = String(texto == null ? '' : texto).replace(/\D/g, '');
    if (d.length >= 12 && d.slice(0, 2) === '55') d = d.slice(2);
    d = d.slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return '(' + d;
    var corte = d.length > 10 ? 7 : 6;                     // 11 dígitos: 5+4; até 10: 4+4
    var ddd = '(' + d.slice(0, 2) + ') ';
    if (d.length <= corte) return ddd + d.slice(2);
    return ddd + d.slice(2, corte) + '-' + d.slice(corte);
  }

  /* ---------- Meu negócio e dados do orçamento (o registro dos envios fica em dados.js) ---------- */

  var NOME_PADRAO = 'Mundo 3Di';
  var LIMITES_NEGOCIO = { nome: 40, whatsapp: 20, instagram: 40, cidade: 40, cnpj: 18, prazo: 40, pagamento: 80, obs: 160 };
  var VALIDADE_PADRAO = 7;     // dias

  /* Dados do negócio de uma configuração salva. Texto aparado e limitado; validade em dias (0 = não mostrar). */
  function lerNegocio(salvo) {
    var s = salvo && typeof salvo === 'object' ? salvo : {};
    var n = {};
    Object.keys(LIMITES_NEGOCIO).forEach(function (k) {
      n[k] = String(s[k] == null ? '' : s[k]).replace(/\s+/g, ' ').trim().slice(0, LIMITES_NEGOCIO[k]);
    });
    // WhatsApp salvo só com números (ou em outro formato) aparece sempre como (xx) xxxx-xxxx
    var dw = n.whatsapp.replace(/\D/g, '');
    if (dw.length === 10 || dw.length === 11 || (dw.length >= 12 && dw.length <= 13 && dw.slice(0, 2) === '55')) n.whatsapp = formatarTelefone(dw);
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
  /* '2026-11-21' -> '21/11/2026'; qualquer outra coisa -> '' */
  function isoParaBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso == null ? '' : iso));
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }
  function somarDias(d, dias) { var x = new Date(d.getTime()); x.setDate(x.getDate() + dias); return x; }

  /*
   * Tudo o que vai escrito na imagem do orçamento — e só isso. Não recebe custo, margem, perda nem lucro
   * como campo: o desenho da imagem usa apenas este objeto.
   * o: { negocio, numero, data (Date), cliente, descricao, material, prazo, validadeAte }
   * validadeAte ('AAAA-MM-DD', ou '' para não mostrar): vale no lugar de data + validade padrão (reenvio de um orçamento antigo).
   */
  function dadosOrcamento(r, o) {
    var negocio = lerNegocio(o && o.negocio);
    var data = o && o.data instanceof Date ? o.data : new Date();
    function limpa(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
    var descricao = limpa(o && o.descricao, 120) || (r.qtd > 1 ? r.qtd + ' peças impressas em 3D' : 'Peça impressa em 3D');
    var validade = negocio.validadeDias > 0 ? formatarData(somarDias(data, negocio.validadeDias)) : '';
    if (o && typeof o.validadeAte === 'string') validade = isoParaBR(o.validadeAte);
    return {
      numero: formatarNumero(o && o.numero),
      data: formatarData(data),
      validade: validade,
      negocioNome: negocio.nome || NOME_PADRAO,
      whatsapp: negocio.whatsapp, instagram: negocio.instagram, cidade: negocio.cidade, cnpj: negocio.cnpj,
      cliente: limpa(o && o.cliente, 60),
      descricao: descricao,
      material: limpa(o && o.material, 60),
      qtd: r.qtd,
      valorPeca: r.qtd > 1 ? moeda(r.valorUnitario) : '',
      total: moeda(r.valorCobrar),
      prazo: limpa(o && o.prazo, LIMITES_NEGOCIO.prazo),
      pagamento: negocio.pagamento,
      obs: negocio.obs
    };
  }

  /* Texto do orçamento para enviar ao cliente (não revela custo nem margem).
     opcoes.material: nome do filamento — só entra no texto se vier preenchido (opção "Mostrar filamento no orçamento").
     opcoes.numero: nº do orçamento (inteiro) · opcoes.negocio: nome do negócio (vazio = Mundo 3Di).
     opcoes.descricao: descrição da peça (vazia = "Peça impressa em 3D") · opcoes.prazo: prazo de entrega (vazio = sem a linha). Desde o 0.6.0-teste.13. */
  function textoOrcamento(r, opcoes) {
    var material = opcoes && opcoes.material ? String(opcoes.material).trim() : '';
    var descricao = opcoes && opcoes.descricao ? String(opcoes.descricao).replace(/\s+/g, ' ').trim() : '';
    var prazo = opcoes && opcoes.prazo ? String(opcoes.prazo).replace(/\s+/g, ' ').trim() : '';
    var negocio = opcoes && opcoes.negocio ? String(opcoes.negocio).trim() : '';
    var numero = opcoes && opcoes.numero > 0 ? ' Nº ' + formatarNumero(opcoes.numero) : '';
    var linhas = ['*Orçamento' + numero + ' — ' + (negocio || NOME_PADRAO) + '*'];
    if (r.qtd > 1) {
      linhas.push(descricao ? r.qtd + ' peças · ' + descricao : r.qtd + ' peças impressas em 3D');
      if (material) linhas.push('Material: ' + material);
      linhas.push('Valor por peça: ' + moeda(r.valorUnitario));
      linhas.push('*Total: ' + moeda(r.valorCobrar) + '*');
    } else {
      linhas.push(descricao || 'Peça impressa em 3D');
      if (material) linhas.push('Material: ' + material);
      linhas.push('*Valor: ' + moeda(r.valorCobrar) + '*');
    }
    if (prazo) linhas.push('Prazo de entrega: ' + prazo);
    return linhas.join('\n');
  }

  /* ---------- Versão do app: MAJOR.MINOR.PATCH (staging: com sufixo -teste.N) ---------- */
  var VERSAO_RE = /^(\d+)\.(\d+)\.(\d+)(?:-teste\.(\d+))?$/;

  /* "0.4.0" ou "0.4.0-teste.2" -> { maior, menor, patch, teste (número ou null) }; formato inválido -> null */
  function lerVersao(texto) {
    var m = VERSAO_RE.exec(String(texto == null ? '' : texto));
    if (!m) return null;
    return { maior: Number(m[1]), menor: Number(m[2]), patch: Number(m[3]), teste: m[4] === undefined ? null : Number(m[4]) };
  }

  /* -1 (a anterior a b), 0 (iguais) ou 1 (a posterior a b); versão inválida -> null.
     Como no semver, 0.4.0-teste.5 vem antes de 0.4.0. */
  function compararVersoes(a, b) {
    var x = lerVersao(a), y = lerVersao(b);
    if (!x || !y) return null;
    var pa = [x.maior, x.menor, x.patch], pb = [y.maior, y.menor, y.patch];
    for (var i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
    if (x.teste === y.teste) return 0;
    if (x.teste === null) return 1;
    if (y.teste === null) return -1;
    return x.teste < y.teste ? -1 : 1;
  }

  /* Aviso mostrado uma vez depois de atualizar. Compara a versão em uso com a última vista neste aparelho.
     novidades: { '0.4': 'histórico, backup e catálogo' } por MAJOR.MINOR (o sufixo -teste.N é ignorado na busca).
     Retorna { titulo, detalhe } ou null quando não há o que avisar (versão igual, mais antiga ou inválida). */
  function avisoAtualizado(atual, vista, novidades) {
    var a = lerVersao(atual), v = lerVersao(vista);
    if (!a || !v || compararVersoes(atual, vista) <= 0) return null;
    var titulo = 'Atualizado para a ' + atual;
    if (a.maior !== v.maior || a.menor !== v.menor) {
      var n = novidades && novidades[a.maior + '.' + a.menor];
      return { titulo: titulo, detalhe: n ? 'Novo: ' + n : '' };
    }
    if (a.patch !== v.patch) return { titulo: titulo + ' (correções)', detalhe: '' };
    return { titulo: titulo, detalhe: '' };   // só mudou o número do teste (staging)
  }

  var Calc = {
    PADROES: PADROES, lerNumero: lerNumero, lerTempo: lerTempo, formatarTempo: formatarTempo,
    lerQuantidade: lerQuantidade, calcular: calcular, moeda: moeda, decimal: decimal,
    textoOrcamento: textoOrcamento,
    PESO_ROLO_PADRAO: PESO_ROLO_PADRAO, MAX_MATERIAIS: MAX_MATERIAIS,
    precoKgMaterial: precoKgMaterial, lerMateriais: lerMateriais, lerPesoRolo: lerPesoRolo,
    lerDinheiro: lerDinheiro, lerInteiro: lerInteiro, lerImpressora: lerImpressora, calcularImpressora: calcularImpressora,
    MAX_HORAS_ANO: MAX_HORAS_ANO,
    formatarTelefone: formatarTelefone,
    MAX_CORES: MAX_CORES, resumirCores: resumirCores,
    MODOS_ARREDONDAMENTO: MODOS_ARREDONDAMENTO, lerArredondamento: lerArredondamento, arredondarCima: arredondarCima,
    NOME_PADRAO: NOME_PADRAO, LIMITES_NEGOCIO: LIMITES_NEGOCIO, VALIDADE_PADRAO: VALIDADE_PADRAO,
    lerNegocio: lerNegocio, formatarNumero: formatarNumero, formatarData: formatarData,
    dadosOrcamento: dadosOrcamento,
    VERSAO_RE: VERSAO_RE, lerVersao: lerVersao, compararVersoes: compararVersoes, avisoAtualizado: avisoAtualizado
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Calc; }
  root.Calc = Calc;
})(typeof window !== 'undefined' ? window : globalThis);
