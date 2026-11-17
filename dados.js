/* Mundo 3Di — registro dos envios e histórico (funções puras, sem tela; testadas no node) */
(function (root) {
  'use strict';

  var MAX_REGISTROS = 5000;              // v6: sobe de 2.000 para 5.000; o app não descarta sozinho (ver estadoLimite)
  var LIMITE_AVISO_REGISTROS = 4500;     // a partir daqui avisa que o limite está perto
  /* Etapas gravadas em "status". 'enviado' é o "Orçado" da tela (o valor salvo não muda). Vencido não é gravado: é calculado. */
  var SITUACOES = ['pedido', 'enviado', 'aprovado', 'producao', 'embalagem', 'pronto', 'entregue', 'recusado', 'cancelado'];
  var SITUACOES_FILTRO = ['pedido', 'enviado', 'vencido', 'aprovado', 'producao', 'embalagem', 'pronto', 'entregue', 'recusado', 'cancelado'];   // chips da lista (vencido é calculado)
  var ETAPAS_VENDA = ['aprovado', 'producao', 'embalagem', 'pronto', 'entregue'];   // contam como venda (pela data fixa aprovadoEm)
  var ETAPAS_ABERTAS = ['pedido', 'enviado', 'aprovado', 'producao', 'embalagem', 'pronto'];   // ainda não encerradas
  var ESPERA_FILTRO = ['pedido', 'enviado', 'vencido', 'producao', 'embalagem', 'pronto'];   // filas de trabalho: ignoram o período
  var CANAIS = ['whatsapp', 'instagram', 'presencial', 'outro'];
  var CONDICOES = ['entrega', 'entrada', 'pago'];
  var FORMAS_PAGAMENTO = ['pix', 'dinheiro', 'cartao', 'transferencia', 'outro'];
  var ROTULOS_PAGAMENTO = { pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago' };
  var ENTRADA_PCT = 50;                  // entrada sugerida (% do total)
  var MAX_HISTORICO = 30;
  var MAX_TEXTO_PEDIDO = 600;
  var MAX_RECEBIMENTOS = 50;
  var DIAS_SEM_COBRAR = 3;               // depois de cobrar, a tarefa some por 3 dias
  var MAX_CORES = 8;
  var ATALHOS_MARGEM = [70, 80, 90, 100];
  var LIMITE_LEMBRETE_BACKUP = 20;       // orçamentos desde o último backup (a faixa de lembrete aparece só no Histórico)
  var BACKUP_APP = 'mundo3di';
  var BACKUP_FORMATO = 2;                // número do formato do arquivo: só muda quando o arquivo deixar de ser compatível (2 desde a 0.6.0: etapas e pagamentos; o 1 ainda é lido)
  var MAX_CATALOGO = 100;
  var NOME_PECA_MAX = 120; // nome da peça no catálogo; igual ao da descrição do orçamento (o nome vira a descrição quando ela fica vazia)
  var MAX_ARQUIVO_BACKUP = 20 * 1024 * 1024;   // bytes: acima disso o arquivo não é lido
  var DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DIAS_ANTIGO = 7;                   // orçamento aguardando resposta há 7 dias ou mais
  var MAX_TOP = 5;                       // itens em "Mais vendidos"

  /* ---------- utilitários ---------- */
  function dois(n) { return (n < 10 ? '0' : '') + n; }
  function numeroOk(n) { return typeof n === 'number' && isFinite(n) && n >= 0; }
  function n0(n) { return numeroOk(n) ? n : 0; }
  function c2(n) { return Math.round(n * 100) / 100; }
  function r4(n) { return Math.round(n * 10000) / 10000; }
  function limparTexto(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
  function numero4(n) {
    var s = String(Math.max(0, Math.floor(Number(n) || 0)));
    while (s.length < 4) s = '0' + s;
    return s;
  }
  function dataISO(d) { return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); }   // data local, AAAA-MM-DD
  function somarDias(d, dias) { var x = new Date(d.getTime()); x.setDate(x.getDate() + dias); return x; }
  function inicioDoDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function validoISO(s) { return typeof s === 'string' && ISO_DATA.test(s); }
  function dataValida(s) { return typeof s === 'string' && !isNaN(new Date(s).getTime()); }

  /* Número para devolver a um campo de texto da tela: sem separador de milhar (1.234 seria lido como 1,234), vírgula decimal. */
  function textoCampo(n) {
    var v = Number(n);
    if (!(v > 0) || !isFinite(v)) return '';
    return v.toFixed(4).replace(/\.?0+$/, '').replace('.', ',');
  }
  /* Minutos -> texto que o campo de tempo entende: 155 -> "2h35" · 45 -> "45" · 12,5 -> "12,5" (lerTempo devolve o mesmo valor). */
  function textoTempo(min) {
    var m = Number(min);
    if (!(m > 0) || !isFinite(m)) return '';
    if (Math.abs(m - Math.round(m)) > 1e-9) return textoCampo(m);
    m = Math.round(m);
    var h = Math.floor(m / 60), r = m % 60;
    return h === 0 ? String(r) : h + 'h' + dois(r);
  }

  /* ---------- o que foi digitado (entrada) ---------- */

  /*
   * Dados da mesa que geraram o orçamento: o necessário para "Usar de novo" e, mais tarde, para o catálogo.
   * o: { peso, tempoMin, qtd, extras (por peça), margem, materialId, materialNome, cores: [{ materialId, nome, gramas }], purgaG }
   * Sem objeto válido devolve null. Multicor: "cores" e "purgaG" só entram quando há cores.
   */
  function montarEntrada(o) {
    if (!o || typeof o !== 'object') return null;
    var e = {
      peso: r4(n0(o.peso)), tempoMin: r4(n0(o.tempoMin)),
      qtd: Math.min(9999, Math.max(1, Math.floor(n0(o.qtd)) || 1)),
      extras: r4(n0(o.extras)), margem: r4(n0(o.margem)),
      materialId: limparTexto(o.materialId, 40), materialNome: limparTexto(o.materialNome, 30)
    };
    if (Array.isArray(o.cores) && o.cores.length) {
      e.cores = o.cores.slice(0, MAX_CORES).map(function (c) {
        return { materialId: limparTexto(c && c.materialId, 40), nome: limparTexto(c && c.nome, 30), gramas: r4(n0(c && c.gramas)) };
      });
      e.purgaG = r4(n0(o.purgaG));
    }
    return e;
  }

  /* entrada -> o texto de cada campo da tela principal (para "Usar de novo") */
  function entradaParaCampos(e) {
    var x = montarEntrada(e);
    if (!x) return null;
    var multicor = !!(x.cores && x.cores.length);
    return {
      multicor: multicor,
      peso: multicor ? '' : textoCampo(x.peso),
      tempo: textoTempo(x.tempoMin),
      qtd: String(x.qtd),
      extras: textoCampo(x.extras),
      margem: x.margem > 0 ? textoCampo(x.margem) : '0',
      outra: ATALHOS_MARGEM.indexOf(x.margem) === -1,
      materialId: x.materialId, materialNome: x.materialNome,
      cores: multicor ? x.cores.map(function (c) { return { id: c.materialId, nome: c.nome, g: textoCampo(c.gramas) }; }) : [],
      purga: multicor ? textoCampo(x.purgaG) : ''
    };
  }

  /* ---------- registro de cada envio ---------- */

  /*
   * Registro local de um envio (texto ou imagem). custoTotal e lucro são de uso interno: nunca vão para o cliente.
   * r: resultado de Calc.calcular · o: { numero, formato, quando (Date), material, cliente, descricao, entrada, prazo,
   *    validadeAte ('AAAA-MM-DD'), catalogoId, versaoApp }
   * Campos novos (v4): entrada, prazo, validadeAte, status ('enviado'), statusEm, reenvios, catalogoId, versaoApp.
   */
  function novoRegistro(r, o) {
    var reg = {
      n: o.numero,
      ts: (o.quando instanceof Date ? o.quando : new Date()).toISOString(),
      formato: o.formato === 'imagem' ? 'imagem' : 'texto',
      qtd: r.qtd, valorPeca: c2(r.valorUnitario), total: c2(r.valorCobrar), custoTotal: c2(r.custoTotal), lucro: c2(r.lucro),
      material: limparTexto(o.material, 60), cliente: limparTexto(o.cliente, 60), descricao: limparTexto(o.descricao, 120),
      status: 'enviado', reenvios: 0
    };
    var entrada = montarEntrada(o.entrada);
    if (entrada) reg.entrada = entrada;
    if (o.prazo) reg.prazo = limparTexto(o.prazo, 40);
    if (validoISO(o.validadeAte)) reg.validadeAte = o.validadeAte;
    if (o.catalogoId) reg.catalogoId = limparTexto(o.catalogoId, 40);
    if (o.versaoApp) reg.versaoApp = limparTexto(o.versaoApp, 24);
    reg.historico = [{ etapa: 'enviado', em: reg.ts }];
    return reg;
  }

  /* Acrescenta um registro à lista (guarda no máximo MAX_REGISTROS; os mais antigos saem primeiro). */
  function adicionarRegistro(lista, reg, max) {
    var nova = Array.isArray(lista) ? lista.slice() : [];
    nova.push(reg);
    var limite = max > 0 ? max : MAX_REGISTROS;
    return nova.length > limite ? nova.slice(nova.length - limite) : nova;
  }

  /* Lê um registro salvo (de qualquer versão). Registro antigo, sem "entrada", continua válido. Inválido -> null. */
  function lerRegistro(x) {
    if (!x || typeof x !== 'object' || !dataValida(x.ts)) return null;
    var n = Number(x.n);
    if (!isFinite(n) || n < 0) return null;
    var r = {
      n: Math.floor(n), ts: x.ts, formato: x.formato === 'imagem' ? 'imagem' : 'texto',
      qtd: Math.max(1, Math.floor(n0(x.qtd)) || 1), valorPeca: n0(x.valorPeca), total: n0(x.total), custoTotal: n0(x.custoTotal),
      lucro: typeof x.lucro === 'number' && isFinite(x.lucro) ? x.lucro : 0,
      material: limparTexto(x.material, 60), cliente: limparTexto(x.cliente, 60), descricao: limparTexto(x.descricao, 120),
      status: SITUACOES.indexOf(x.status) !== -1 ? x.status : 'enviado',
      reenvios: Math.floor(n0(x.reenvios))
    };
    var entrada = montarEntrada(x.entrada);
    if (entrada) r.entrada = entrada;
    if (x.prazo) r.prazo = limparTexto(x.prazo, 40);
    if (validoISO(x.validadeAte)) r.validadeAte = x.validadeAte;
    if (dataValida(x.statusEm)) r.statusEm = x.statusEm;
    if (x.catalogoId) r.catalogoId = limparTexto(x.catalogoId, 40);
    if (x.versaoApp) r.versaoApp = limparTexto(x.versaoApp, 24);
    // v6: etapas, pedido, pagamento e cobrança (todos opcionais; registro antigo continua válido)
    if (dataValida(x.criadoEm)) r.criadoEm = x.criadoEm;
    if (CANAIS.indexOf(x.canal) !== -1) r.canal = x.canal;
    if (validoISO(x.prazoDesejado)) r.prazoDesejado = x.prazoDesejado;
    if (x.pedidoTexto) r.pedidoTexto = limparTexto(x.pedidoTexto, MAX_TEXTO_PEDIDO);
    if (dataValida(x.aprovadoEm)) r.aprovadoEm = x.aprovadoEm;
    if (Array.isArray(x.historico)) {
      var h = x.historico.filter(function (i) { return i && SITUACOES.indexOf(i.etapa) !== -1 && dataValida(i.em); })
        .map(function (i) { return { etapa: i.etapa, em: i.em }; }).slice(-MAX_HISTORICO);
      if (h.length) r.historico = h;
    }
    var pg = lerPagamento(x.pagamento);
    if (pg) r.pagamento = pg;
    if (dataValida(x.cobradoEm)) r.cobradoEm = x.cobradoEm;
    if (x.cobrancas) r.cobrancas = Math.floor(n0(x.cobrancas));
    return r;
  }
  /* Pagamento salvo: { condicao, entradaPrevista (R$), recebimentos: [{ valor (R$; estorno negativo), em, forma }] }. Inválido -> null. */
  function lerPagamento(x) {
    if (!objeto(x)) return null;
    var pg = { condicao: CONDICOES.indexOf(x.condicao) !== -1 ? x.condicao : 'entrega', recebimentos: [] };
    var ent = Number(x.entradaPrevista);
    if (isFinite(ent) && ent > 0) pg.entradaPrevista = c2(ent);
    if (Array.isArray(x.recebimentos)) {
      x.recebimentos.slice(0, MAX_RECEBIMENTOS).forEach(function (i) {
        var v = i && Number(i.valor);
        if (!isFinite(v) || centavos(v) === 0 || !dataValida(i.em)) return;
        pg.recebimentos.push({ valor: c2(v), em: i.em, forma: FORMAS_PAGAMENTO.indexOf(i.forma) !== -1 || i.forma === 'estorno' ? i.forma : 'outro' });
      });
    }
    return pg;
  }
  function lerRegistros(bruto) {
    if (!Array.isArray(bruto)) return [];
    var saida = [];
    bruto.forEach(function (x) { var r = lerRegistro(x); if (r) saida.push(r); });
    return saida;
  }

  /* Um registro é identificado pelo nº + data/hora (o mesmo par usado para juntar registros ao restaurar um backup). */
  function chaveRegistro(reg) { return reg.n + '|' + reg.ts; }

  /* Muda campos de um registro (só os permitidos). Devolve uma lista nova; chave inexistente não muda nada. */
  function atualizarRegistro(lista, chave, mudancas) {
    return (Array.isArray(lista) ? lista : []).map(function (r) {
      if (chaveRegistro(r) !== chave) return r;
      var x = {}, k;
      for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) x[k] = r[k];
      var m = mudancas || {};
      if (m.cliente !== undefined) x.cliente = limparTexto(m.cliente, 60);
      if (m.descricao !== undefined) x.descricao = limparTexto(m.descricao, 120);
      if (m.prazo !== undefined) { if (m.prazo) x.prazo = limparTexto(m.prazo, 40); else delete x.prazo; }
      if (m.validadeAte !== undefined && validoISO(m.validadeAte)) x.validadeAte = m.validadeAte;
      if (m.reenvios !== undefined) x.reenvios = Math.floor(n0(m.reenvios));
      if (m.status !== undefined && SITUACOES.indexOf(m.status) !== -1) {
        x = aplicarEtapa(x, m.status, dataValida(m.statusEm) ? m.statusEm : new Date().toISOString());   // grava historico e aprovadoEm (v6)
      }
      return x;
    });
  }
  /* Tira um registro da lista. (O contador de números fica de fora: não volta.) */
  function excluirRegistro(lista, chave) {
    return (Array.isArray(lista) ? lista : []).filter(function (r) { return chaveRegistro(r) !== chave; });
  }

  /* ---------- situação ---------- */

  /* 'enviado' | 'aprovado' | 'recusado' | 'vencido'. Vencido não é gravado: é um enviado cuja validade (validadeAte) já passou. */
  function situacao(reg, hoje) {
    var st = SITUACOES.indexOf(reg && reg.status) !== -1 ? reg.status : 'enviado';
    if (st === 'enviado' && validoISO(reg.validadeAte) && dataISO(hoje || new Date()) > reg.validadeAte) return 'vencido';
    return st;
  }
  /* Nomes das etapas na tela da v6 ("Orçado" no lugar de "Enviado"). */
  var ROTULOS_ETAPA = { pedido: 'Pedido', enviado: 'Orçado', vencido: 'Vencido', aprovado: 'Aprovado', producao: 'Produção', embalagem: 'Embalagem',
    pronto: 'Pronto', entregue: 'Entregue', recusado: 'Recusado', cancelado: 'Cancelado' };
  /* Nomes usados pela tela até a etapa 3 do lote v6 (que passa a usar ROTULOS_ETAPA): só "Enviado" difere. */
  var ROTULOS_SITUACAO = Object.assign({}, ROTULOS_ETAPA, { enviado: 'Enviado' });

  /* ---------- busca, período, resumo e agrupamento ---------- */

  /* minúsculas e sem acento: "José" e "jose" são iguais */
  function normalizarBusca(s) {
    var t = String(s == null ? '' : s).toLowerCase();
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.replace(/\s+/g, ' ').trim();
  }

  /* periodo: 'hoje' | '7' | '30' | 'mes' | 'tudo'. Dias contados com o de hoje (7 dias = hoje e os 6 anteriores); 'mes' = do dia 1º do mês até hoje. */
  function inicioDoPeriodo(periodo, hoje) {
    var h = inicioDoDia(hoje || new Date());
    if (periodo === 'hoje') return h;
    if (periodo === '7') return somarDias(h, -6);
    if (periodo === '30') return somarDias(h, -29);
    if (periodo === 'mes') return new Date(h.getFullYear(), h.getMonth(), 1);
    return null;
  }

  /*
   * Filtra por período, situação e busca (cliente, peça ou nº). Do mais novo para o mais antigo.
   * f: { periodo (padrão '30'), situacao (uma de SITUACOES_FILTRO; vazio = todas), pagamento ('pendente' | 'parcial' | 'pago'), busca, hoje (Date),
   *      venceEm ('AAAA-MM-DD': orçamentos que vencem nesse dia), prazoVencido (true: prazo desejado passado e ainda não entregue) }
   * Com situação:
   *  - pedido, enviado, vencido, produção, embalagem e pronto (as filas de trabalho) ignoram o período e saem do mais antigo para o mais novo;
   *  - o filtro de pagamento sozinho também é fila (quem ainda deve), sem período;
   *  - aprovado, entregue, recusado e cancelado usam a data da venda/resposta (a mesma regra do painel de vendas), mas a lista continua mostrando a hora do envio.
   */
  function filtrarRegistros(regs, f) {
    f = f || {};
    var sit = SITUACOES_FILTRO.indexOf(f.situacao) !== -1 ? f.situacao : '';
    var pag = ROTULOS_PAGAMENTO[f.pagamento] ? f.pagamento : '';
    var espera = ESPERA_FILTRO.indexOf(sit) !== -1 || (!sit && !!pag);
    var inicio = espera ? null : inicioDoPeriodo(f.periodo === undefined ? '30' : f.periodo, f.hoje);
    var fim = sit && !espera ? somarDias(inicioDoDia(f.hoje || new Date()), 1) : null;
    var q = normalizarBusca(f.busca);
    var saida = (Array.isArray(regs) ? regs : []).filter(function (r) {
      if (sit && situacao(r, f.hoje) !== sit) return false;
      if (f.venceEm && r.validadeAte !== f.venceEm) return false;
      if (f.prazoVencido && !(ETAPAS_ABERTAS.indexOf(r.status) !== -1 && validoISO(r.prazoDesejado) && r.prazoDesejado < dataISO(f.hoje || new Date()))) return false;
      if (pag && situacaoPagamento(r).estado !== pag) return false;
      var quando = sit && !espera ? dataDaVenda(r) : new Date(r.ts);
      if (!dentro(quando, inicio, fim)) return false;
      if (!q) return true;
      var palheiro = normalizarBusca([r.cliente, r.descricao, numero4(r.n), r.n].join(' '));
      return palheiro.indexOf(q) !== -1;
    });
    saida.sort(function (a, b) {
      var d = new Date(b.ts).getTime() - new Date(a.ts).getTime();
      if (d === 0) d = b.n - a.n;
      return espera ? -d : d;
    });
    return saida;
  }

  /* Quantos orçamentos aguardam resposta e quantos venceram (sem período), para as contagens dos chips. */
  function contarSituacoes(regs, hoje) {
    var c = { enviado: 0, vencido: 0 };
    (Array.isArray(regs) ? regs : []).forEach(function (r) { var st = situacao(r, hoje); if (st === 'enviado' || st === 'vencido') c[st]++; });
    return c;
  }

  /* Texto da etiqueta de quem aguarda resposta: "hoje", "há 1 dia", "há 14 dias" (âmbar a partir de DIAS_ANTIGO) · vencido: "venceu 10/11". */
  function textoEspera(reg, hoje) {
    var st = situacao(reg, hoje);
    if (st === 'vencido') return { texto: 'venceu ' + validadeCurta(reg.validadeAte, hoje), antigo: true };
    var d = diasDesde(reg.ts, hoje);
    return { texto: d <= 0 ? 'hoje' : d === 1 ? 'há 1 dia' : 'há ' + d + ' dias', antigo: d >= DIAS_ANTIGO };
  }

  /* Resumo da lista: enviados (todos), soma dos totais e aprovados (quantidade e soma). Soma em centavos inteiros. */
  function resumir(regs) {
    var lista = Array.isArray(regs) ? regs : [];
    var total = 0, apr = 0, qApr = 0;
    lista.forEach(function (r) {
      var c = Math.round(n0(r.total) * 100);
      total += c;
      if (ehVenda(r.status)) { apr += c; qApr++; }
    });
    return { qtd: lista.length, total: total / 100, aprovados: qApr, totalAprovados: apr / 100 };
  }

  function rotuloDia(d, h0) {
    var dif = Math.round((h0.getTime() - inicioDoDia(d).getTime()) / 86400000);
    if (dif === 0) return 'Hoje';
    if (dif === 1) return 'Ontem';
    var s = DIAS_SEMANA[d.getDay()] + ', ' + dois(d.getDate()) + '/' + dois(d.getMonth() + 1);
    return d.getFullYear() !== h0.getFullYear() ? s + '/' + d.getFullYear() : s;
  }
  /* Agrupa (lista já ordenada) por dia local: Hoje, Ontem, "Qua, 05/11". */
  function agruparPorDia(regs, hoje) {
    var h0 = inicioDoDia(hoje || new Date()), grupos = [], atual = null;
    (regs || []).forEach(function (r) {
      var d = new Date(r.ts), chave = dataISO(d);
      if (!atual || atual.chave !== chave) { atual = { chave: chave, rotulo: rotuloDia(d, h0), itens: [] }; grupos.push(atual); }
      atual.itens.push(r);
    });
    return grupos;
  }

  /* ---------- painel de vendas (v5) ---------- */

  /* Data em que a venda aconteceu: a da aprovação (aprovadoEm, fixa: avançar de etapa não muda). Sem ela usa statusEm (registro da 0.5) e, sem ele, a do envio. */
  function dataDaVenda(reg) { return dataValida(reg.aprovadoEm) ? new Date(reg.aprovadoEm) : dataValida(reg.statusEm) ? new Date(reg.statusEm) : new Date(reg.ts); }
  function dentro(d, ini, fim) { var t = d.getTime(); return (!ini || t >= ini.getTime()) && (!fim || t < fim.getTime()); }
  function centavos(n) { return Math.round((typeof n === 'number' && isFinite(n) ? n : 0) * 100); }
  function diasDesde(ts, hoje) { return Math.round((inicioDoDia(hoje || new Date()).getTime() - inicioDoDia(new Date(ts)).getTime()) / 86400000); }

  /* Intervalo [inicio, fim) do período anterior, de mesmo tamanho. Hoje e Tudo não têm comparação (null).
     Mês compara o mesmo trecho do mês anterior (1–14/11 com 1–14/10; mês mais curto: vai até o último dia dele). */
  function periodoAnterior(periodo, hoje) {
    var h = inicioDoDia(hoje || new Date()), ini = inicioDoPeriodo(periodo, h);
    if (periodo === '7' || periodo === '30') return { inicio: somarDias(ini, periodo === '7' ? -7 : -30), fim: ini };
    if (periodo === 'mes') {
      var a = new Date(ini.getFullYear(), ini.getMonth() - 1, 1);
      var diasDoMes = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
      return { inicio: a, fim: new Date(a.getFullYear(), a.getMonth(), Math.min(h.getDate(), diasDoMes) + 1) };
    }
    return null;
  }

  /* Aprovados com a data da venda dentro do período (e, se houver, que combinem com a busca). Usado pelo cartão da Lista. */
  function aprovadosDoPeriodo(regs, f) {
    f = f || {};
    var h0 = inicioDoDia(f.hoje || new Date()), fim = somarDias(h0, 1);
    var ini = inicioDoPeriodo(f.periodo === undefined ? '30' : f.periodo, f.hoje), q = normalizarBusca(f.busca);
    var cent = 0, qtd = 0;
    (Array.isArray(regs) ? regs : []).forEach(function (r) {
      if (!ehVenda(r.status) || !dentro(dataDaVenda(r), ini, fim)) return;
      if (q && normalizarBusca([r.cliente, r.descricao, numero4(r.n), r.n].join(' ')).indexOf(q) === -1) return;
      cent += centavos(r.total); qtd++;
    });
    return { aprovados: qtd, totalAprovados: cent / 100 };
  }

  /* Série de barras: por dia (7, 30 e mês) ou por mês (tudo). Hoje não tem série. */
  function serieVendas(vendas, periodo, ini, h0) {
    var mapa = {}, itens = [], d;
    if (periodo === 'hoje') return itens;
    function somar(chave, v) { var x = mapa[chave] || (mapa[chave] = { cent: 0, qtd: 0 }); x.cent += centavos(v.total); x.qtd++; }
    if (periodo === 'tudo') {
      if (!vendas.length) return itens;
      vendas.forEach(function (v) { var d2 = dataDaVenda(v); somar(d2.getFullYear() + '-' + dois(d2.getMonth() + 1), v); });
      var primeira = vendas.reduce(function (m, v) { var t = dataDaVenda(v).getTime(); return t < m ? t : m; }, Infinity);
      var pd = new Date(primeira);
      for (d = new Date(pd.getFullYear(), pd.getMonth(), 1); d.getTime() <= h0.getTime(); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        var ch = d.getFullYear() + '-' + dois(d.getMonth() + 1), x = mapa[ch] || { cent: 0, qtd: 0 };
        itens.push({ chave: ch, rotulo: MESES[d.getMonth()] + '/' + d.getFullYear(), valor: x.cent / 100, qtd: x.qtd });
      }
      return itens;
    }
    vendas.forEach(function (v) { somar(dataISO(dataDaVenda(v)), v); });
    for (d = new Date(ini.getTime()); d.getTime() <= h0.getTime(); d = somarDias(d, 1)) {
      var c = dataISO(d), y = mapa[c] || { cent: 0, qtd: 0 };
      itens.push({ chave: c, rotulo: DIAS_SEMANA[d.getDay()] + ', ' + dois(d.getDate()) + '/' + dois(d.getMonth() + 1), valor: y.cent / 100, qtd: y.qtd });
    }
    return itens;
  }

  /* Top MAX_TOP por valor aprovado. chaveNome(reg) -> { chave, nome } ; vendas em ordem do mais recente (o nome vem do mais recente que tiver um). */
  function ranking(vendas, chaveNome, nomeVazio) {
    var grupos = {}, ordem = [];
    vendas.forEach(function (v) {
      var k = chaveNome(v), g = grupos[k.chave];
      if (!g) { g = grupos[k.chave] = { nome: '', cent: 0, qtd: 0 }; ordem.push(g); }
      if (!g.nome && k.nome) g.nome = k.nome;
      g.cent += centavos(v.total); g.qtd++;
    });
    ordem.sort(function (a, b) { return b.cent - a.cent || b.qtd - a.qtd || String(a.nome || nomeVazio).localeCompare(String(b.nome || nomeVazio), 'pt'); });
    return ordem.slice(0, MAX_TOP).map(function (g) { return { nome: g.nome || nomeVazio, qtd: g.qtd, valor: g.cent / 100 }; });
  }

  /*
   * Painel de vendas. periodo: 'hoje' | '7' | '30' | 'mes' | 'tudo'. Valores em reais (somas em centavos inteiros).
   *  - Vendas, lucro, séries e rankings: orçamentos aprovados com a data da aprovação dentro do período.
   *  - Aguardando e vencidos: situação de agora, sem período.
   *  - variacao (%) contra o período anterior de mesmo tamanho; null em Hoje e Tudo ou quando o anterior não vendeu.
   */
  function resumoVendas(regs, periodo, hoje) {
    var lista = Array.isArray(regs) ? regs : [];
    var per = ['hoje', '7', '30', 'mes', 'tudo'].indexOf(periodo) !== -1 ? periodo : '30';
    var h0 = inicioDoDia(hoje || new Date()), fim = somarDias(h0, 1), ini = inicioDoPeriodo(per, h0);
    var vendas = lista.filter(function (r) { return ehVenda(r.status) && dentro(dataDaVenda(r), ini, fim); });
    vendas.sort(function (a, b) { return dataDaVenda(b).getTime() - dataDaVenda(a).getTime(); });
    var cent = 0, lucro = 0;
    vendas.forEach(function (r) { cent += centavos(r.total); lucro += centavos(r.lucro); });
    var qtd = vendas.length;

    var ant = periodoAnterior(per, h0), anterior = null, variacao = null;
    if (ant) {
      var ac = 0, aq = 0;
      lista.forEach(function (r) { if (ehVenda(r.status) && dentro(dataDaVenda(r), ant.inicio, ant.fim)) { ac += centavos(r.total); aq++; } });
      anterior = { vendas: ac / 100, qtd: aq };
      if (ac > 0) variacao = Math.round((cent - ac) / ac * 1000) / 10;
    }

    var ag = { qtd: 0, cent: 0, antigos: 0 }, ve = { qtd: 0, cent: 0 };
    lista.forEach(function (r) {
      var st = situacao(r, hoje || new Date());
      if (st === 'enviado') { ag.qtd++; ag.cent += centavos(r.total); if (diasDesde(r.ts, h0) >= DIAS_ANTIGO) ag.antigos++; }
      else if (st === 'vencido') { ve.qtd++; ve.cent += centavos(r.total); }
    });

    return {
      periodo: per, qtd: qtd, vendas: cent / 100, ticket: qtd ? Math.round(cent / qtd) / 100 : 0,
      lucro: lucro / 100, custo: (cent - lucro) / 100, margemReal: cent > 0 ? Math.round(lucro / cent * 1000) / 10 : 0,
      anterior: anterior, variacao: variacao,
      porDia: serieVendas(vendas, per, ini, h0),
      topClientes: ranking(vendas, function (v) { var n = limparTexto(v.cliente, 60); return { chave: normalizarBusca(n), nome: n }; }, 'Sem cliente'),
      topPecas: ranking(vendas, function (v) {
        var n = limparTexto(v.descricao, 120);
        return { chave: v.catalogoId ? 'c:' + v.catalogoId : 'd:' + normalizarBusca(n), nome: n };
      }, 'Sem descrição'),
      aguardando: { qtd: ag.qtd, total: ag.cent / 100, antigos: ag.antigos },
      vencidos: { qtd: ve.qtd, total: ve.cent / 100 }
    };
  }

  function hora(ts) { var d = new Date(ts); return dois(d.getHours()) + ':' + dois(d.getMinutes()); }
  function dataBR(d) { return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear(); }
  /* "Enviado hoje às 16:48 como imagem" · "Enviado em 05/11/2026 às 14:15 como texto" */
  function descreverEnvio(reg, hoje) {
    var d = new Date(reg.ts), h0 = inicioDoDia(hoje || new Date());
    var dif = Math.round((h0.getTime() - inicioDoDia(d).getTime()) / 86400000);
    var quando = dif === 0 ? 'hoje' : dif === 1 ? 'ontem' : 'em ' + dataBR(d);
    return 'Enviado ' + quando + ' às ' + hora(reg.ts) + ' como ' + (reg.formato === 'imagem' ? 'imagem' : 'texto');
  }
  /* '2026-11-21' -> '21/11' (mesmo ano) ou '21/11/2027' */
  function validadeCurta(iso, hoje) {
    if (!validoISO(iso)) return '';
    var p = iso.split('-'), ano = (hoje || new Date()).getFullYear();
    return p[2] + '/' + p[1] + (Number(p[0]) !== ano ? '/' + p[0] : '');
  }

  /* Até n clientes diferentes (sem diferenciar acento e maiúscula), do envio mais recente para o mais antigo. */
  function ultimosClientes(regs, n) {
    var lista = (Array.isArray(regs) ? regs : []).slice().sort(function (a, b) { return new Date(b.ts).getTime() - new Date(a.ts).getTime(); });
    var vistos = {}, saida = [];
    for (var i = 0; i < lista.length && saida.length < n; i++) {
      var nome = limparTexto(lista[i].cliente, 60), k = normalizarBusca(nome);
      if (!k || vistos[k]) continue;
      vistos[k] = true; saida.push(nome);
    }
    return saida;
  }

  /* ---------- texto de cada linha e material ---------- */

  function nomesCores(e) {
    var vistos = [];
    (e && e.cores || []).forEach(function (c) { if (c.gramas > 0 && c.nome && vistos.indexOf(c.nome) === -1) vistos.push(c.nome); });
    return vistos.join(' + ');
  }
  /* Material para mostrar só para você (histórico e detalhe), com ou sem a opção "mostrar material" ligada */
  function materialDoRegistro(reg) {
    var e = reg && reg.entrada;
    if (e && e.cores && e.cores.length) return nomesCores(e) || 'Multicor';
    if (e && e.materialNome) return e.materialNome;
    return reg && reg.material || '';
  }
  /* Material para o orçamento reenviado: só se a opção "Mostrar o filamento" estiver ligada hoje (mesma regra do envio) */
  function materialParaEnvio(reg, mostrar) {
    if (!mostrar) return '';
    var e = reg && reg.entrada;
    if (e && e.cores && e.cores.length) return nomesCores(e) ? nomesCores(e) + ' (multicor)' : '';
    if (e && e.materialNome) return e.materialNome;
    return reg && reg.material || '';
  }
  /* Segunda linha de cada item da lista: a peça ou "N peças · material" */
  function descricaoLinha(reg) {
    if (reg.descricao) return reg.descricao;
    var m = materialDoRegistro(reg);
    return reg.qtd + (reg.qtd > 1 ? ' peças' : ' peça') + (m ? ' · ' + m : '');
  }

  /* O registro como "orçamento" para refazer o texto ou a imagem com os mesmos valores (sem recalcular) */
  function orcamentoDeRegistro(reg) {
    return { qtd: reg.qtd, valorUnitario: reg.valorPeca, valorCobrar: reg.total };
  }

  /* Lembrete de backup: N orçamentos desde o último backup, a partir de 20.
     backup: { em: ISO } ou null (nenhum backup feito). */
  function precisaLembreteBackup(regs, backup, limite) {
    var lista = Array.isArray(regs) ? regs : [];
    var desde = backup && dataValida(backup.em) ? new Date(backup.em).getTime() : null;
    var qtd = desde === null ? lista.length : lista.filter(function (r) { return new Date(r.ts).getTime() > desde; }).length;
    return { mostrar: qtd >= (limite > 0 ? limite : LIMITE_LEMBRETE_BACKUP), qtd: qtd };
  }


  /* ---------- backup e restauração ---------- */

  function objeto(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function inteiroOk(x) { var n = Math.floor(Number(x)); return isFinite(n) && n > 0 ? n : 0; }
  function copiarObjeto(o) { return JSON.parse(JSON.stringify(o)); }

  /* Dados deste aparelho no formato do backup (e do "antes de restaurar"). */
  function montarDados(d) {
    d = d || {};
    return {
      config: objeto(d.config) ? d.config : {},
      logo: typeof d.logo === 'string' && /^data:image\//.test(d.logo) ? d.logo : '',
      contador: inteiroOk(d.contador),
      registros: migrarAprovadoEm(lerRegistros(d.registros)),   // v6: backup do formato 1 ganha aprovadoEm
      catalogo: Array.isArray(d.catalogo) ? d.catalogo.filter(objeto).slice(0, MAX_CATALOGO) : [],
      materialAtual: limparTexto(d.materialAtual, 40)
    };
  }

  /* Arquivo de backup. meta: { ambiente, versaoApp, criadoEm (Date) } */
  function montarBackup(dados, meta) {
    meta = meta || {};
    return {
      app: BACKUP_APP, formato: BACKUP_FORMATO,
      ambiente: limparTexto(meta.ambiente, 20), versaoApp: limparTexto(meta.versaoApp, 24),
      criadoEm: (meta.criadoEm instanceof Date ? meta.criadoEm : new Date()).toISOString(),
      dados: montarDados(dados)
    };
  }
  function nomeArquivoBackup(d) { return 'backup-orcamento-3di-' + dataISO(d || new Date()) + '.json'; }
  function nomeArquivoCSV(d) { return 'orcamentos-3di-' + dataISO(d || new Date()) + '.csv'; }

  /*
   * Lê o texto de um arquivo de backup. Devolve { ok: true, backup } ou { ok: false, erro: 'invalido' | 'novo' | 'grande' }.
   * 'novo' = feito por uma versão mais nova do formato (o app precisa ser atualizado).
   */
  var ERROS_BACKUP = {
    invalido: 'Este arquivo não é um backup do Mundo 3Di.',
    novo: 'Backup feito numa versão mais nova. Atualize o app.',
    grande: 'Este arquivo é grande demais para ser um backup do Mundo 3Di.'
  };
  function lerBackup(texto) {
    if (typeof texto !== 'string') return { ok: false, erro: 'invalido' };
    if (texto.length > MAX_ARQUIVO_BACKUP) return { ok: false, erro: 'grande' };
    var b;
    try { b = JSON.parse(texto.replace(/^﻿/, '')); } catch (e) { return { ok: false, erro: 'invalido' }; }
    if (!objeto(b) || b.app !== BACKUP_APP || typeof b.formato !== 'number' || !isFinite(b.formato) || b.formato < 1 || !objeto(b.dados)) return { ok: false, erro: 'invalido' };
    if (b.formato > BACKUP_FORMATO) return { ok: false, erro: 'novo' };
    return { ok: true, backup: {
      app: BACKUP_APP, formato: b.formato,
      ambiente: limparTexto(b.ambiente, 20), versaoApp: limparTexto(b.versaoApp, 24),
      criadoEm: dataValida(b.criadoEm) ? new Date(b.criadoEm).toISOString() : '',
      dados: montarDados(b.dados)
    } };
  }

  /* O que mostrar no painel "Restaurar backup" */
  function resumoBackup(b) {
    var d = b.dados, regs = d.registros, nums = regs.filter(function (r) { return r.n > 0; }).map(function (r) { return r.n; });
    var cfg = d.config || {};
    return {
      ambiente: b.ambiente, versaoApp: b.versaoApp, criadoEm: b.criadoEm,
      filamentos: Array.isArray(cfg.materiais) ? cfg.materiais.length : 0,
      temLogo: !!d.logo, pecas: d.catalogo.length, orcamentos: nums.length, pedidos: regs.length - nums.length,
      numMin: nums.length ? Math.min.apply(null, nums) : 0, numMax: nums.length ? Math.max.apply(null, nums) : 0,
      contador: d.contador
    };
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  /* "128 orçamentos (Nº 0001 a 0128)" · "1 orçamento (Nº 0007)" · "Nenhum orçamento" */
  function descreverOrcamentos(r) {
    var ped = r.pedidos ? ' e ' + plural(r.pedidos, 'pedido ainda sem orçamento', 'pedidos ainda sem orçamento') : '';
    if (!r.orcamentos) return r.pedidos ? plural(r.pedidos, 'pedido ainda sem orçamento', 'pedidos ainda sem orçamento') : 'Nenhum orçamento';
    var faixa = r.numMin === r.numMax ? 'Nº ' + numero4(r.numMin) : 'Nº ' + numero4(r.numMin) + ' a ' + numero4(r.numMax);
    return plural(r.orcamentos, 'orçamento', 'orçamentos') + ' (' + faixa + ')' + ped;
  }

  /*
   * Junta duas listas de orçamentos sem repetir (mesmo nº + mesma data/hora = mesmo registro; vale o da primeira lista),
   * da data mais antiga para a mais nova, guardando no máximo "max" (os mais antigos saem).
   */
  function juntarRegistros(principal, outros, max) {
    var vistos = {}, todos = [];
    [lerRegistros(principal), lerRegistros(outros)].forEach(function (lista) {
      lista.forEach(function (r) {
        var k = chaveRegistro(r), kc = r.criadoEm ? 'c|' + r.criadoEm : '';   // o pedido orçado muda de chave: criadoEm o identifica
        if (vistos[k] || (kc && vistos[kc])) return;
        vistos[k] = true; if (kc) vistos[kc] = true; todos.push(r);
      });
    });
    todos.sort(function (a, b) {
      var d = new Date(a.ts).getTime() - new Date(b.ts).getTime();
      return d !== 0 ? d : a.n - b.n;
    });
    var limite = max > 0 ? max : MAX_REGISTROS;
    return todos.length > limite ? todos.slice(todos.length - limite) : todos;
  }

  /*
   * Restaurar: substitui configurações, logo, catálogo e filamento atual pelos do backup; junta os orçamentos
   * (vale o registro deste aparelho quando é o mesmo); o contador fica com o maior número, para o próximo nunca repetir.
   */
  function restaurarDados(atual, backup) {
    var a = montarDados(atual), b = montarDados(backup);
    var regs = juntarRegistros(a.registros, b.registros, MAX_REGISTROS);
    var maior = Math.max(a.contador, b.contador);
    regs.forEach(function (r) { if (r.n > maior) maior = r.n; });   // nunca repetir o número de um registro que existe
    return { config: copiarObjeto(b.config), logo: b.logo, contador: maior, registros: regs, catalogo: b.catalogo, materialAtual: b.materialAtual };
  }

  /*
   * Desfazer a restauração: volta configurações, logo, catálogo e filamento do estado guardado e tira os orçamentos que
   * vieram do backup; os orçamentos feitos depois da restauração ficam. "antes" = { em, dados }.
   */
  function desfazerRestauracao(atual, antes) {
    var a = montarDados(atual), s = montarDados(antes && antes.dados);
    var desde = antes && dataValida(antes.em) ? new Date(antes.em).getTime() : 0;
    var novos = a.registros.filter(function (r) { return new Date(r.ts).getTime() > desde; });
    var regs = juntarRegistros(s.registros, novos, MAX_REGISTROS);
    var maior = Math.max(a.contador, s.contador);
    regs.forEach(function (r) { if (r.n > maior) maior = r.n; });
    return { config: copiarObjeto(s.config), logo: s.logo, contador: maior, registros: regs, catalogo: s.catalogo, materialAtual: s.materialAtual };
  }

  /* Situação do cartão Backup. backup: { em: ISO, qtd } ou null. */
  function descreverBackup(backup, regs, hoje) {
    var lista = Array.isArray(regs) ? regs : [];
    if (!backup || !dataValida(backup.em)) {
      return { titulo: 'Nenhum backup feito ainda', detalhe: lista.length ? plural(lista.length, 'orçamento ainda sem backup', 'orçamentos ainda sem backup') : '' };
    }
    var d = new Date(backup.em), h0 = inicioDoDia(hoje || new Date());
    var dias = Math.max(0, Math.round((h0.getTime() - inicioDoDia(d).getTime()) / 86400000));
    var quando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : 'há ' + dias + ' dias';
    var depois = precisaLembreteBackup(lista, backup).qtd;
    return { titulo: 'Último backup: ' + dataBR(d), detalhe: quando + ' · ' + (depois ? plural(depois, 'orçamento depois dele', 'orçamentos depois dele') : 'nenhum orçamento depois dele') };
  }
  /* Texto da faixa de lembrete no Histórico */
  function textoLembreteBackup(qtd, backup) {
    var n = plural(qtd, 'orçamento', 'orçamentos');
    return backup && dataValida(backup.em) ? n + ' desde o último backup.' : n + ' sem backup.';
  }

  /* ---------- planilha (CSV) ---------- */

  /* Texto de uma célula: entre aspas quando tem ; " ou quebra de linha; um texto que começaria com = + - @ ganha um apóstrofo
     na frente (o Excel/Planilhas não o tratam como fórmula). */
  function celulaCSV(v, ehTexto) {
    var t = String(v == null ? '' : v);
    if (ehTexto && /^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return /[;"\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  function decimalBR(n) { return c2(Number(n) || 0).toFixed(2).replace('.', ','); }
  var COLUNAS_CSV = ['Nº', 'Data', 'Hora', 'Formato', 'Cliente', 'Peça', 'Material', 'Quantidade', 'Valor por peça', 'Total', 'Custo total', 'Lucro', 'Situação', 'Reenvios',
    'Etapa', 'Data da aprovação', 'Data da etapa atual', 'Condição', 'Recebido', 'Falta'];
  var ROTULOS_CONDICAO = { entrega: 'Tudo na entrega', entrada: 'Entrada + restante', pago: 'Já pago' };
  /*
   * Histórico inteiro para Excel/Planilhas: separador ";", vírgula decimal, UTF-8 com BOM, linhas em ordem de data (a mais antiga primeiro).
   * Uso interno: tem custo e lucro.
   */
  function gerarCSV(regs, hoje) {
    var lista = (Array.isArray(regs) ? regs : []).slice().sort(function (a, b) {
      var d = new Date(a.ts).getTime() - new Date(b.ts).getTime();
      return d !== 0 ? d : a.n - b.n;
    });
    var linhas = [COLUNAS_CSV.map(function (c) { return celulaCSV(c, false); }).join(';')];
    lista.forEach(function (r) {
      var d = new Date(r.ts);
      var texto = { 4: true, 5: true, 6: true };     // cliente, peça e material: textos digitados pela pessoa
      var pg = situacaoPagamento(r), temPg = !!pg.estado || somaRecebida(r) !== 0;
      linhas.push([
        r.n > 0 ? numero4(r.n) : 'Pedido', dataBR(d), hora(r.ts), r.formato === 'imagem' ? 'Imagem' : 'Texto',
        r.cliente, r.descricao, materialDoRegistro(r), r.qtd,
        decimalBR(r.valorPeca), decimalBR(r.total), decimalBR(r.custoTotal), decimalBR(r.lucro),
        ROTULOS_ETAPA[situacao(r, hoje)], r.reenvios || 0,
        ROTULOS_ETAPA[r.status] || '', ehVenda(r.status) ? dataBR(dataDaVenda(r)) : '', dataValida(r.statusEm) ? dataBR(new Date(r.statusEm)) : '',
        temPg && r.pagamento ? ROTULOS_CONDICAO[r.pagamento.condicao] || '' : '', temPg ? decimalBR(pg.recebido) : '', pg.estado ? decimalBR(pg.falta) : ''
      ].map(function (v, i) { return celulaCSV(v, !!texto[i]); }).join(';'));
    });
    return '﻿' + linhas.join('\r\n') + '\r\n';
  }

  /* ---------- catálogo de peças recorrentes ---------- */

  /*
   * Peça do catálogo: { id, nome (120), descricao (120; vazia = nome), entrada (a da mesa), precoRef (valor por peça do último envio
   * ou de quando foi salva), precoRefEm (data/hora ISO), usos, usadoEm (data/hora ISO) }.
   * O preço de hoje NÃO fica guardado: é recalculado pela tela com os custos de hoje.
   */
  function lerPeca(x) {
    if (!objeto(x)) return null;
    var id = limparTexto(x.id, 40), nome = limparTexto(x.nome, NOME_PECA_MAX), entrada = montarEntrada(x.entrada);
    if (!id || !nome || !entrada) return null;
    var p = { id: id, nome: nome, descricao: limparTexto(x.descricao, 120), entrada: entrada,
      precoRef: c2(n0(x.precoRef)), precoRefEm: dataValida(x.precoRefEm) ? x.precoRefEm : '',
      usos: Math.floor(n0(x.usos)), usadoEm: dataValida(x.usadoEm) ? x.usadoEm : '' };
    return p;
  }
  /* Lê o catálogo salvo (de qualquer versão): descarta o inválido e o id repetido; no máximo MAX_CATALOGO peças. */
  function lerCatalogo(bruto) {
    if (!Array.isArray(bruto)) return [];
    var vistos = {}, saida = [];
    bruto.forEach(function (x) {
      var p = lerPeca(x);
      if (p && !vistos[p.id] && saida.length < MAX_CATALOGO) { vistos[p.id] = true; saida.push(p); }
    });
    return saida;
  }
  var contadorId = 0;
  function novoIdPeca(quando) {
    contadorId++;
    return 'p' + (quando instanceof Date ? quando : new Date()).getTime().toString(36) + contadorId.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }
  function acharPeca(catalogo, id) {
    var l = Array.isArray(catalogo) ? catalogo : [];
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  /* Peça com este nome (sem diferenciar maiúscula nem acento), ou null */
  function pecaComNome(catalogo, nome) {
    var alvo = normalizarBusca(limparTexto(nome, NOME_PECA_MAX)), l = Array.isArray(catalogo) ? catalogo : [];
    if (!alvo) return null;
    for (var i = 0; i < l.length; i++) if (normalizarBusca(l[i].nome) === alvo) return l[i];
    return null;
  }
  /*
   * Salva uma peça. o: { nome, descricao, entrada, precoRef, precoRefEm (ISO; sem ele, agora), quando (Date) }. Nome igual ao de uma peça existente SUBSTITUI a dela
   * (mantém o id, para os orçamentos já enviados continuarem ligados, e soma os usos), mas só com substituir === true;
   * sem isso devolve { ok:false, erro:'existe', existente }. Catálogo cheio -> { ok:false, erro:'cheio' }.
   * Devolve { ok:true, lista, peca, substituiu }.
   */
  function salvarPeca(catalogo, o, substituir) {
    var lista = lerCatalogo(catalogo), quando = (o && o.quando instanceof Date ? o.quando : new Date()).toISOString();
    var nome = limparTexto(o && o.nome, NOME_PECA_MAX), entrada = montarEntrada(o && o.entrada);
    if (!nome || !entrada) return { ok: false, erro: 'invalido' };
    var igual = pecaComNome(lista, nome);
    if (igual && !substituir) return { ok: false, erro: 'existe', existente: igual };
    if (!igual && lista.length >= MAX_CATALOGO) return { ok: false, erro: 'cheio' };
    var peca = { id: igual ? igual.id : novoIdPeca(o && o.quando), nome: nome, descricao: limparTexto(o && o.descricao, 120), entrada: entrada,
      precoRef: c2(n0(o && o.precoRef)), precoRefEm: dataValida(o && o.precoRefEm) ? o.precoRefEm : quando, usos: igual ? igual.usos : 0, usadoEm: igual ? igual.usadoEm : '' };
    var nova = igual ? lista.map(function (p) { return p.id === igual.id ? peca : p; }) : lista.concat([peca]);
    return { ok: true, lista: nova, peca: peca, substituiu: !!igual };
  }
  /* Edita nome e descrição (os dados técnicos não mudam aqui). Nome vazio ou de outra peça = não muda ({ ok:false, erro }). */
  function editarPeca(catalogo, id, m) {
    var lista = lerCatalogo(catalogo), alvo = acharPeca(lista, id);
    if (!alvo) return { ok: false, erro: 'naoExiste' };
    var nome = limparTexto(m && m.nome, NOME_PECA_MAX);
    if (!nome) return { ok: false, erro: 'invalido' };
    var outra = pecaComNome(lista, nome);
    if (outra && outra.id !== id) return { ok: false, erro: 'existe', existente: outra };
    return { ok: true, lista: lista.map(function (p) {
      return p.id === id ? Object.assign({}, p, { nome: nome, descricao: limparTexto(m && m.descricao, 120) }) : p;
    }) };
  }
  function excluirPeca(catalogo, id) { return lerCatalogo(catalogo).filter(function (p) { return p.id !== id; }); }
  /* Depois de um envio: o valor por peça enviado vira a referência e a peça sobe de uso. Id que não existe (peça excluída) não muda nada. */
  function registrarUsoPeca(catalogo, id, valorPeca, quando) {
    var q = (quando instanceof Date ? quando : new Date()).toISOString();
    return lerCatalogo(catalogo).map(function (p) {
      return p.id === id ? Object.assign({}, p, { precoRef: c2(n0(valorPeca)), precoRefEm: q, usos: p.usos + 1, usadoEm: q }) : p;
    });
  }
  /* Ordem da lista: usadas por último primeiro; sem uso, pela data em que foram salvas */
  function ordenarCatalogo(catalogo) {
    function quando(p) { return p.usadoEm || p.precoRefEm || ''; }
    return lerCatalogo(catalogo).map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
      var qa = quando(a.p), qb = quando(b.p);
      return qa === qb ? b.i - a.i : (qa < qb ? 1 : -1);
    }).map(function (x) { return x.p; });
  }
  function filtrarCatalogo(catalogo, busca) {
    var b = normalizarBusca(busca), l = ordenarCatalogo(catalogo);
    if (!b) return l;
    return l.filter(function (p) { return normalizarBusca(p.nome + ' ' + p.descricao).indexOf(b) !== -1; });
  }
  /* Texto que vai para o campo "Descrição da peça" do envio: a descrição da peça, ou o nome se ela estiver vazia */
  function descricaoDaPeca(p) { return p ? (p.descricao || p.nome) : ''; }

  /*
   * Pedido de N peças: peso, tempo (e, no multicolor, gramas de cada cor e purga) proporcionais à mesa:
   * peso = peso da mesa ÷ peças na mesa × N, e peças = N. Extras e margem não mudam. Valores exatos (sem arredondar).
   * Devolve uma entrada nova; a original não muda. Quantidade inválida = 1.
   */
  function entradaDoPedido(entrada, qtd) {
    var e = montarEntrada(entrada);
    if (!e) return null;
    var n = Math.min(9999, Math.max(1, Math.floor(Number(qtd)) || 1)), f = n / e.qtd;
    var s = { peso: e.peso * f, tempoMin: e.tempoMin * f, qtd: n, extras: e.extras, margem: e.margem, materialId: e.materialId, materialNome: e.materialNome };
    if (e.cores) {
      s.cores = e.cores.map(function (c) { return { materialId: c.materialId, nome: c.nome, gramas: c.gramas * f }; });
      s.purgaG = e.purgaG * f;
    }
    return s;
  }
  /* Quantidades dos atalhos do pedido: 1 peça, uma mesa, duas mesas e 50 (sem repetir) */
  function atalhosPedido(entrada) {
    var e = montarEntrada(entrada), mesa = e ? e.qtd : 1, saida = [];
    [1, mesa, mesa * 2, 50].forEach(function (n) { if (n <= 9999 && saida.indexOf(n) === -1) saida.push(n); });
    return saida.sort(function (a, b) { return a - b; });
  }
  /* Valor de hoje x valor do último envio, em centavos: { tipo: 'sobe'|'desce'|'igual', diff } (diff sempre positivo) */
  function compararPreco(hoje, ref) {
    var d = Math.round((n0(hoje) - n0(ref)) * 100);
    return { tipo: d > 0 ? 'sobe' : d < 0 ? 'desce' : 'igual', diff: Math.abs(d) / 100 };
  }
  /* "Mesa de 8 peças · 96 g de PLA · 4h10 · margem 100%" (1 peça: "1 peça · 48 g de PLA · …"; multicor: "… g em 2 cores") */
  function descreverEntrada(entrada) {
    var e = montarEntrada(entrada);
    if (!e) return '';
    var partes = [e.qtd > 1 ? 'Mesa de ' + e.qtd + ' peças' : '1 peça'];
    function g(n) { return textoCampo(Math.round(n * 100) / 100) || '0'; }
    if (e.cores && e.cores.length) {
      var gs = e.cores.filter(function (c) { return c.gramas > 0; });
      partes.push(g(gs.reduce(function (s, c) { return s + c.gramas; }, 0)) + ' g em ' + gs.length + (gs.length === 1 ? ' cor' : ' cores'));
    } else partes.push(g(e.peso) + ' g' + (e.materialNome ? ' de ' + e.materialNome : ''));
    var t = textoTempo(e.tempoMin);
    if (t) partes.push(t.indexOf('h') === -1 ? t + ' min' : t);
    partes.push('margem ' + (textoCampo(e.margem) || '0') + '%');
    return partes.join(' · ');
  }

  /* ====================================================================================================
   * v6 (0.6.0) · pedidos com etapas, pagamentos e tarefas do dia (partes 1 e 2 do lote)
   * Tudo aqui é função pura: recebe listas e devolve listas novas (nada de tela nem de localStorage).
   * ==================================================================================================== */

  /* Dinheiro para texto: "R$ 1.234,56" (espaço comum, não o da calculadora). */
  function moedaBR(n) {
    var c = Math.round(Math.abs(Number(n) || 0) * 100), inteiro = Math.floor(c / 100);
    return (n < 0 ? '-' : '') + 'R$ ' + String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dois(c % 100);
  }
  function paraISO(q) {
    if (q instanceof Date && !isNaN(q.getTime())) return q.toISOString();
    return dataValida(q) ? new Date(q).toISOString() : new Date().toISOString();
  }
  function ehVenda(status) { return ETAPAS_VENDA.indexOf(status) !== -1; }
  function etapasDeVenda() { return ETAPAS_VENDA.slice(); }
  function nomeDe(r) { return limparTexto(r && r.cliente, 60); }
  function rotuloNumero(r) { return r.n > 0 ? 'Nº ' + numero4(r.n) : 'Pedido'; }
  function diasTexto(d) { return d <= 0 ? 'hoje' : d === 1 ? 'há 1 dia' : 'há ' + d + ' dias'; }

  /* ---------- etapas ---------- */

  /* Próxima etapa do botão "Avançar" (depois de Aprovado). Pedido e Orçado não avançam por aqui (orçar e aprovar têm fluxo próprio). */
  function proximaEtapa(status) {
    var i = ETAPAS_VENDA.indexOf(status);
    return i !== -1 && i < ETAPAS_VENDA.length - 1 ? ETAPAS_VENDA[i + 1] : null;
  }
  /* Etapas à frente (para "pular"): de Aprovado em diante. */
  function etapasSeguintes(status) {
    var i = ETAPAS_VENDA.indexOf(status);
    return i === -1 ? [] : ETAPAS_VENDA.slice(i + 1);
  }
  /* Etapa para "voltar uma etapa": Aprovado volta a Orçado; Recusado e Cancelado voltam à última etapa de antes. */
  function etapaAnterior(reg) {
    var st = reg && reg.status, i = ETAPAS_VENDA.indexOf(st);
    if (i > 0) return ETAPAS_VENDA[i - 1];
    if (st === 'aprovado') return 'enviado';
    if (st === 'recusado' || st === 'cancelado') {
      var h = reg.historico || [];
      for (var k = h.length - 1; k >= 0; k--) if (h[k].etapa !== 'recusado' && h[k].etapa !== 'cancelado') return h[k].etapa;
      return st === 'cancelado' ? 'aprovado' : 'enviado';
    }
    return null;
  }

  /*
   * Troca a etapa de UM registro (cópia). Regras:
   *  - registra em historico { etapa, em } e atualiza status e statusEm;
   *  - aprovadoEm (data fixa da venda): gravado ao ENTRAR nas etapas de venda vindo de fora delas; as etapas seguintes não mexem;
   *    ao sair das etapas de venda (voltar a Orçado, Recusado, Cancelado) é apagado e a venda deixa de contar;
   *  - Pedido só vai para Recusado ou Cancelado (para orçar, use orcarPedido).
   */
  function aplicarEtapa(reg, etapa, em) {
    if (SITUACOES.indexOf(etapa) === -1 || etapa === 'pedido' || reg.status === etapa) return reg;
    if (reg.status === 'pedido' && etapa !== 'recusado' && etapa !== 'cancelado') return reg;
    var x = {}, k, quando = paraISO(em);
    for (k in reg) if (Object.prototype.hasOwnProperty.call(reg, k)) x[k] = reg[k];
    var estavaVenda = ehVenda(reg.status);
    x.status = etapa; x.statusEm = quando;
    x.historico = (Array.isArray(reg.historico) ? reg.historico.slice() : []).concat([{ etapa: etapa, em: quando }]).slice(-MAX_HISTORICO);
    if (ehVenda(etapa) && !estavaVenda) x.aprovadoEm = quando;
    else if (!ehVenda(etapa)) delete x.aprovadoEm;
    return x;
  }
  function mudarEtapa(lista, chave, etapa, em) {
    return (Array.isArray(lista) ? lista : []).map(function (r) { return chaveRegistro(r) === chave ? aplicarEtapa(r, etapa, em) : r; });
  }
  function mudarRegistro(lista, chave, fn) {
    return (Array.isArray(lista) ? lista : []).map(function (r) { return chaveRegistro(r) === chave ? fn(r) : r; });
  }

  /* Migração ao abrir a 0.6.0: quem já estava numa etapa de venda e não tem aprovadoEm recebe a data da última mudança (statusEm) ou, sem ela, a do envio. */
  function migrarAprovadoEm(lista) {
    return (Array.isArray(lista) ? lista : []).map(function (r) {
      if (!ehVenda(r.status) || dataValida(r.aprovadoEm)) return r;
      var x = {}, k;
      for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) x[k] = r[k];
      x.aprovadoEm = dataValida(r.statusEm) ? r.statusEm : r.ts;
      return x;
    });
  }

  /* Quantos registros em cada etapa (Vencido calculado) e em cada situação de pagamento: para os números dos chips. */
  function contarEtapas(regs, hoje) {
    var c = { pedido: 0, enviado: 0, vencido: 0, aprovado: 0, producao: 0, embalagem: 0, pronto: 0, entregue: 0, recusado: 0, cancelado: 0,
      pagamento: { pendente: 0, parcial: 0, pago: 0 } };
    (Array.isArray(regs) ? regs : []).forEach(function (r) {
      c[situacao(r, hoje)]++;
      var p = situacaoPagamento(r).estado;
      if (p) c.pagamento[p]++;
    });
    return c;
  }

  /* ---------- pedido (ainda sem orçamento) ---------- */

  /*
   * Anotar pedido: registro sem Nº (n = 0), sem preço. o: { cliente, texto (o que foi pedido; aceita colar a mensagem), qtd, prazoDesejado ('AAAA-MM-DD'),
   * canal ('whatsapp' | 'instagram' | 'presencial' | 'outro'), quando (Date) }.
   * descricao guarda o começo do texto (120); pedidoTexto guarda o texto inteiro (até 600).
   */
  function novoPedido(o, quando) {
    o = o || {};
    var ts = (quando instanceof Date ? quando : o.quando instanceof Date ? o.quando : new Date()).toISOString();
    var texto = limparTexto(o.texto, MAX_TEXTO_PEDIDO);
    var reg = {
      n: 0, ts: ts, criadoEm: ts, formato: 'texto', qtd: Math.max(1, Math.floor(n0(o.qtd)) || 1),
      valorPeca: 0, total: 0, custoTotal: 0, lucro: 0, material: '',
      cliente: limparTexto(o.cliente, 60), descricao: texto.slice(0, 120), status: 'pedido', reenvios: 0,
      historico: [{ etapa: 'pedido', em: ts }]
    };
    if (texto.length > 120) reg.pedidoTexto = texto;
    if (CANAIS.indexOf(o.canal) !== -1) reg.canal = o.canal;
    if (validoISO(o.prazoDesejado)) reg.prazoDesejado = o.prazoDesejado;
    return lerRegistro(reg);   // já no formato salvo (mesma ordem dos campos)
  }

  /*
   * "Orçar este pedido": ao enviar, o MESMO registro passa a Orçado (ganha Nº, data de envio, valores e entrada).
   * r e o: os mesmos de novoRegistro. Devolve { lista, chave, vinculado }. Pedido não encontrado (ou já orçado): cria registro novo, como antes.
   * Atenção: a chave do registro muda (nº e data do envio); quem chama guarda a chave nova.
   */
  function orcarPedido(lista, chavePedido, r, o) {
    var base = Array.isArray(lista) ? lista : [];
    var novo = novoRegistro(r, o), achou = false;
    var nova = base.map(function (p) {
      if (chaveRegistro(p) !== chavePedido || p.status !== 'pedido') return p;
      achou = true;
      var x = {}, k;
      for (k in novo) if (Object.prototype.hasOwnProperty.call(novo, k)) x[k] = novo[k];
      ['criadoEm', 'canal', 'prazoDesejado', 'pedidoTexto'].forEach(function (c) { if (p[c] !== undefined) x[c] = p[c]; });
      if (!x.cliente) x.cliente = p.cliente;
      if (!x.descricao) x.descricao = p.descricao;
      x.historico = (Array.isArray(p.historico) ? p.historico : [{ etapa: 'pedido', em: p.ts }]).concat([{ etapa: 'enviado', em: x.ts }]).slice(-MAX_HISTORICO);
      return x;
    });
    if (!achou) return { lista: adicionarRegistro(base, novo), chave: chaveRegistro(novo), vinculado: false };
    var orcado = nova.filter(function (p) { return p.n === novo.n && p.ts === novo.ts; })[0];
    return { lista: nova, chave: chaveRegistro(orcado), vinculado: true };
  }

  /* ---------- pagamentos ---------- */

  function somaRecebida(reg) {   // centavos; estorno entra negativo
    var rec = reg && reg.pagamento && reg.pagamento.recebimentos, s = 0;
    if (Array.isArray(rec)) rec.forEach(function (x) { s += centavos(x.valor); });
    return s;
  }
  /*
   * Situação do pagamento, calculada pela soma dos recebimentos (nunca fica inconsistente).
   * Só existe a partir de Aprovado e enquanto não Cancelado; fora disso estado = null.
   * { estado: 'pendente' | 'parcial' | 'pago' | null, rotulo, recebido, falta, total, texto }
   */
  function situacaoPagamento(reg) {
    var total = centavos(reg && reg.total), rec = somaRecebida(reg);
    if (!reg || !ehVenda(reg.status)) return { estado: null, rotulo: '', recebido: rec / 100, falta: 0, total: total / 100, texto: '' };
    var falta = Math.max(0, total - rec);
    var estado = rec <= 0 ? (total === 0 ? 'pago' : 'pendente') : falta > 0 ? 'parcial' : 'pago';
    var cond = reg.pagamento && reg.pagamento.condicao;
    var texto = estado === 'pago' ? 'Pago' : estado === 'pendente' ? 'Falta ' + moedaBR(falta / 100)
      : (cond === 'entrada' ? 'Entrada ' : 'Recebido ') + moedaBR(rec / 100) + ' · falta ' + moedaBR(falta / 100);
    return { estado: estado, rotulo: ROTULOS_PAGAMENTO[estado], recebido: rec / 100, falta: falta / 100, total: total / 100, texto: texto };
  }

  /* Entrada sugerida: 50% do total (em centavos inteiros). */
  function entradaSugerida(total) { return Math.round(centavos(total) * ENTRADA_PCT / 100) / 100; }

  /*
   * Condição de pagamento de um pedido aprovado. c: { condicao: 'entrega' | 'entrada' | 'pago', entradaPct (padrão 50) ou entradaValor (R$) }.
   * 'entrada' grava entradaPrevista (entre 0,01 e o total); 'pago' registra na hora um recebimento do que falta, na data da aprovação (ou em).
   */
  function definirCondicao(lista, chave, c, em) {
    c = c || {};
    var cond = CONDICOES.indexOf(c.condicao) !== -1 ? c.condicao : 'entrega';
    return mudarRegistro(lista, chave, function (r) {
      var x = {}, k;
      for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) x[k] = r[k];
      var pg = { condicao: cond, recebimentos: (r.pagamento && r.pagamento.recebimentos ? r.pagamento.recebimentos : []).slice() };
      if (r.pagamento && r.pagamento.entradaPrevista !== undefined && cond === 'entrada') pg.entradaPrevista = r.pagamento.entradaPrevista;
      var total = centavos(r.total);
      if (cond === 'entrada') {
        var ent = c.entradaValor !== undefined ? centavos(c.entradaValor) : Math.round(total * (c.entradaPct > 0 ? c.entradaPct : ENTRADA_PCT) / 100);
        pg.entradaPrevista = Math.min(Math.max(ent, total > 0 ? 1 : 0), total) / 100;
      }
      if (cond === 'pago') {
        var falta = total - somaRecebida({ pagamento: pg });
        if (falta > 0) pg.recebimentos.push({ valor: falta / 100, em: paraISO(em || r.aprovadoEm || r.statusEm), forma: 'outro' });
      }
      x.pagamento = pg;
      return x;
    });
  }
  /* Aprovar já com a condição de pagamento (o painel "Aprovado" faz as duas coisas de uma vez). */
  function aprovarComCondicao(lista, chave, c, em) {
    return definirCondicao(mudarEtapa(lista, chave, 'aprovado', em), chave, c, em);
  }

  /* Registra um recebimento { valor (R$, maior que 0), em, forma }. Só em pedidos de venda (Aprovado a Entregue). */
  function registrarRecebimento(lista, chave, rec) {
    rec = rec || {};
    var cent = centavos(rec.valor);
    if (cent <= 0) return lista;
    return mudarRegistro(lista, chave, function (r) {
      if (!ehVenda(r.status)) return r;
      var x = {}, k;
      for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) x[k] = r[k];
      var pg = r.pagamento || { condicao: 'entrega', recebimentos: [] };
      var lst = (pg.recebimentos || []).concat([{ valor: cent / 100, em: paraISO(rec.em), forma: FORMAS_PAGAMENTO.indexOf(rec.forma) !== -1 ? rec.forma : 'outro' }]);
      x.pagamento = Object.assign({}, pg, { recebimentos: lst.slice(-MAX_RECEBIMENTOS) });
      return x;
    });
  }
  function excluirRecebimento(lista, chave, indice) {
    return mudarRegistro(lista, chave, function (r) {
      var rec = r.pagamento && r.pagamento.recebimentos;
      if (!Array.isArray(rec) || !rec[indice]) return r;
      var x = Object.assign({}, r);
      x.pagamento = Object.assign({}, r.pagamento, { recebimentos: rec.filter(function (_, i) { return i !== indice; }) });
      return x;
    });
  }
  /*
   * Cancelar um pedido aprovado. Com dinheiro recebido o app pergunta "Ficou com você · Devolvi":
   * devolveu = true grava um estorno (recebimento negativo do total recebido); false mantém o valor. O registro fica.
   */
  function cancelarPedido(lista, chave, devolveu, em) {
    var quando = paraISO(em);
    return mudarRegistro(lista, chave, function (r) {
      var x = aplicarEtapa(r, 'cancelado', quando), rec = somaRecebida(r);
      if (devolveu && rec > 0) {
        var pg = r.pagamento || { condicao: 'entrega', recebimentos: [] };
        x.pagamento = Object.assign({}, pg, { recebimentos: (pg.recebimentos || []).concat([{ valor: -rec / 100, em: quando, forma: 'estorno' }]) });
      }
      return x;
    });
  }

  /* O que falta receber dos pedidos de venda (Cancelado fica de fora). { qtd (pedidos com saldo), total } */
  function aReceber(regs) {
    var cent = 0, qtd = 0;
    (Array.isArray(regs) ? regs : []).forEach(function (r) {
      var p = situacaoPagamento(r), f = Math.round(p.falta * 100);
      if (p.estado && f > 0) { cent += f; qtd++; }
    });
    return { qtd: qtd, total: cent / 100 };
  }
  /* Recebido no período, pela data de cada recebimento, já descontados os estornos. periodo: 'hoje' | '7' | '30' | 'mes' | 'tudo'. */
  function recebidoNoPeriodo(regs, periodo, hoje) {
    var h0 = inicioDoDia(hoje || new Date()), fim = somarDias(h0, 1), ini = inicioDoPeriodo(periodo, h0), cent = 0, qtd = 0;
    (Array.isArray(regs) ? regs : []).forEach(function (r) {
      var rec = r.pagamento && r.pagamento.recebimentos;
      if (!Array.isArray(rec)) return;
      rec.forEach(function (x) {
        if (!dataValida(x.em) || !dentro(new Date(x.em), ini, fim)) return;
        cent += centavos(x.valor); if (x.valor > 0) qtd++;
      });
    });
    return { total: cent / 100, qtd: qtd };
  }

  /* ---------- limite de registros ---------- */
  /* { qtd, max, perto (a partir de 4.500), cheio (5.000), texto }. O app não descarta sozinho: com cheio = true pede para excluir antes de gravar. */
  function estadoLimite(qtdOuLista) {
    var qtd = Array.isArray(qtdOuLista) ? qtdOuLista.length : Math.max(0, Math.floor(Number(qtdOuLista) || 0));
    return { qtd: qtd, max: MAX_REGISTROS, perto: qtd >= LIMITE_AVISO_REGISTROS, cheio: qtd >= MAX_REGISTROS,
      texto: qtd >= MAX_REGISTROS ? 'Limite de registros atingido: exclua pedidos antigos antes de anotar outro'
        : qtd >= LIMITE_AVISO_REGISTROS ? 'Perto do limite de registros: faça um backup e exclua pedidos antigos que não precisa' : '' };
  }

  /* ---------- cobrar resposta ---------- */
  /* Mensagem pronta (editável) para o WhatsApp. Nunca leva custo, margem nem lucro. */
  function mensagemCobranca(reg) {
    var cli = nomeDe(reg), desc = limparTexto(reg && reg.descricao, 120), total = moedaBR(reg && reg.total);
    return (cli ? 'Oi, ' + cli + '!' : 'Oi!') + ' Tudo bem? Passando para saber se você viu o orçamento Nº ' + numero4(reg && reg.n) +
      ' (' + (desc ? desc + ', ' : '') + total + '). Se quiser, ajusto a quantidade ou o prazo.';
  }
  /* Ao compartilhar a cobrança: grava cobradoEm e soma 1 em cobrancas. */
  function registrarCobranca(lista, chave, quando) {
    return mudarRegistro(lista, chave, function (r) {
      return Object.assign({}, r, { cobradoEm: paraISO(quando), cobrancas: Math.floor(n0(r.cobrancas)) + 1 });
    });
  }

  /* ---------- Início: pra fazer hoje e primeiro uso ---------- */

  /* Nomes para "Bia e Loja Exemplo" / "Bia, Ana e outros 2" (até 2 nomes). */
  function listaNomes(regs) {
    var nomes = [], vistos = {};
    regs.forEach(function (r) { var n = nomeDe(r), k = normalizarBusca(n); if (n && !vistos[k]) { vistos[k] = 1; nomes.push(n); } });
    if (nomes.length <= 2) return nomes.join(' e ');
    return nomes[0] + ', ' + nomes[1] + ' e outros ' + (nomes.length - 2);
  }
  /*
   * Lista ordenada de tarefas do dia (todas; a tela mostra as 6 primeiras e "Ver todas").
   * backup: { em: ISO } do último backup, ou null. Cada tarefa: { tipo, texto, valor (R$ ou null), acao, alvo, chave (quando é de um registro) }.
   * alvo: { tela: 'pedidos' | 'config-backup' | 'cobrar' | 'recebimento', filtro: { situacao, pagamento, venceEm } }.
   */
  function tarefasHoje(registros, agora, backup) {
    var hoje = agora instanceof Date ? agora : new Date(), h0 = inicioDoDia(hoje), hojeISO = dataISO(hoje);
    var lista = Array.isArray(registros) ? registros : [], saida = [];
    function soma(rs) { var c = 0; rs.forEach(function (r) { c += centavos(r.total); }); return c / 100; }
    function porData(campo) { return function (a, b) { return new Date(a[campo] || a.ts).getTime() - new Date(b[campo] || b.ts).getTime() || a.n - b.n; }; }
    function tarefa(tipo, texto, valor, acao, alvo, chave) {
      var t = { tipo: tipo, texto: texto, valor: valor === undefined ? null : valor, acao: acao, alvo: alvo };
      if (chave) t.chave = chave;
      saida.push(t);
    }

    // 1. orçamentos que vencem hoje
    var vencemHoje = lista.filter(function (r) { return r.status === 'enviado' && r.validadeAte === hojeISO; });
    if (vencemHoje.length) tarefa('vencem-hoje', vencemHoje.length === 1 ? '1 orçamento vence hoje' : vencemHoje.length + ' orçamentos vencem hoje',
      soma(vencemHoje), 'Ver', { tela: 'pedidos', filtro: { situacao: 'enviado', venceEm: hojeISO } });

    // 2. pedidos para orçar
    var pedidos = lista.filter(function (r) { return r.status === 'pedido'; }).sort(porData('criadoEm'));
    if (pedidos.length) {
      var dp = diasDesde(pedidos[0].criadoEm || pedidos[0].ts, h0);
      tarefa('pedidos', pedidos.length === 1 ? '1 pedido para orçar · ' + (dp <= 0 ? 'chegou hoje' : diasTexto(dp)) : pedidos.length + ' pedidos para orçar · o mais antigo ' + (dp <= 0 ? 'é de hoje' : diasTexto(dp)),
        null, 'Ver', { tela: 'pedidos', filtro: { situacao: 'pedido' } });
    }

    // 3. cobrar resposta (um por orçamento; some por 3 dias depois de cobrar)
    lista.filter(function (r) {
      if (situacao(r, hoje) !== 'enviado' || diasDesde(r.ts, h0) < DIAS_ANTIGO) return false;
      return !(dataValida(r.cobradoEm) && diasDesde(r.cobradoEm, h0) < DIAS_SEM_COBRAR);
    }).sort(porData('ts')).forEach(function (r) {
      var d = diasDesde(r.ts, h0), cli = nomeDe(r), num = 'Nº ' + numero4(r.n);
      tarefa('cobrar', cli ? cli + ': sem resposta há ' + d + ' dias · ' + num : num + ': sem resposta há ' + d + ' dias', r.total, 'Cobrar', { tela: 'cobrar' }, chaveRegistro(r));
    });

    // 4. receber entrada (condição com entrada e nada recebido)
    var semEntrada = lista.filter(function (r) {
      return ehVenda(r.status) && r.pagamento && r.pagamento.condicao === 'entrada' && n0(r.pagamento.entradaPrevista) > 0 && somaRecebida(r) <= 0;
    }).sort(porData('aprovadoEm'));
    semEntrada.forEach(function (r) {
      var cli = nomeDe(r);
      tarefa('receber-entrada', 'Receber entrada ' + (cli ? 'do ' + cli : '· ' + rotuloNumero(r)), r.pagamento.entradaPrevista, 'Recebi', { tela: 'recebimento' }, chaveRegistro(r));
    });

    // 5. prontos para entregar
    var prontos = lista.filter(function (r) { return r.status === 'pronto'; }).sort(porData('statusEm'));
    if (prontos.length) {
      var nm = listaNomes(prontos);
      tarefa('prontos', (prontos.length === 1 ? '1 pronto para entregar' : prontos.length + ' prontos para entregar') + (nm ? ' · ' + nm : ''),
        null, 'Ver', { tela: 'pedidos', filtro: { situacao: 'pronto' } });
    }

    // 6. receber restante (Pronto ou Entregue com saldo; quem já está em "receber entrada" não repete)
    lista.filter(function (r) {
      return (r.status === 'pronto' || r.status === 'entregue') && situacaoPagamento(r).falta > 0 && semEntrada.indexOf(r) === -1;
    }).sort(porData('statusEm')).forEach(function (r) {
      var cli = nomeDe(r), p = situacaoPagamento(r);
      tarefa('receber-restante', (p.recebido > 0 ? 'Receber restante ' : 'Receber ') + (cli ? 'de ' + cli : '· ' + rotuloNumero(r)), p.falta, 'Recebi', { tela: 'recebimento' }, chaveRegistro(r));
    });

    // 7. prazo vencido (prazo desejado passou e ainda não foi entregue)
    var atrasados = lista.filter(function (r) { return ETAPAS_ABERTAS.indexOf(r.status) !== -1 && validoISO(r.prazoDesejado) && r.prazoDesejado < hojeISO; });
    if (atrasados.length) tarefa('prazo-vencido', atrasados.length === 1 ? '1 pedido com prazo vencido' : atrasados.length + ' pedidos com prazo vencido',
      null, 'Ver', { tela: 'pedidos', filtro: { prazoVencido: true } });

    // 8. orçamentos vencidos
    var vencidos = lista.filter(function (r) { return situacao(r, hoje) === 'vencido'; });
    if (vencidos.length) tarefa('vencidos', vencidos.length === 1 ? '1 orçamento vencido' : vencidos.length + ' orçamentos vencidos', soma(vencidos), 'Ver',
      { tela: 'pedidos', filtro: { situacao: 'vencido' } });

    // 9. backup
    var lemb = precisaLembreteBackup(lista, backup);
    if (lemb.mostrar) tarefa('backup', 'Fazer backup · ' + textoLembreteBackup(lemb.qtd, backup).replace(/\.$/, ''), null, 'Fazer', { tela: 'config-backup' });

    // 10. perto do limite de registros
    var lim = estadoLimite(lista.length);
    if (lim.perto) tarefa('limite', lim.texto, null, 'Ver', { tela: 'config-backup' });

    return saida;
  }

  /* Primeiro uso: sem nenhum registro (orçamento ou pedido). config = o que está salvo no aparelho (ou null se nunca salvou). */
  function primeiroUso(registros, config) {
    var cfg = objeto(config) ? config : null;
    return {
      primeiroUso: !Array.isArray(registros) || registros.length === 0,
      itens: [
        { chave: 'filamento', texto: 'Preço do seu filamento', feito: !!cfg && Object.keys(cfg).length > 0, alvo: 'config-filamentos' },
        { chave: 'negocio', texto: 'Meu negócio', feito: !!(cfg && objeto(cfg.negocio) && limparTexto(cfg.negocio.nome, 60)), alvo: 'config-negocio' }
      ]
    };
  }

  var Dados = {
    LIMITE_AVISO_REGISTROS: LIMITE_AVISO_REGISTROS, ROTULOS_ETAPA: ROTULOS_ETAPA, ROTULOS_PAGAMENTO: ROTULOS_PAGAMENTO, ROTULOS_CONDICAO: ROTULOS_CONDICAO,
    CANAIS: CANAIS, CONDICOES: CONDICOES, FORMAS_PAGAMENTO: FORMAS_PAGAMENTO, ETAPAS_ABERTAS: ETAPAS_ABERTAS, ENTRADA_PCT: ENTRADA_PCT,
    moedaBR: moedaBR, ehVenda: ehVenda, etapasDeVenda: etapasDeVenda, proximaEtapa: proximaEtapa, etapasSeguintes: etapasSeguintes, etapaAnterior: etapaAnterior,
    mudarEtapa: mudarEtapa, migrarAprovadoEm: migrarAprovadoEm, contarEtapas: contarEtapas, novoPedido: novoPedido, orcarPedido: orcarPedido,
    situacaoPagamento: situacaoPagamento, entradaSugerida: entradaSugerida, definirCondicao: definirCondicao, aprovarComCondicao: aprovarComCondicao,
    registrarRecebimento: registrarRecebimento, excluirRecebimento: excluirRecebimento, cancelarPedido: cancelarPedido, aReceber: aReceber,
    recebidoNoPeriodo: recebidoNoPeriodo, estadoLimite: estadoLimite, mensagemCobranca: mensagemCobranca, registrarCobranca: registrarCobranca,
    tarefasHoje: tarefasHoje, primeiroUso: primeiroUso, lerPagamento: lerPagamento,
    MAX_REGISTROS: MAX_REGISTROS, SITUACOES: SITUACOES, ROTULOS_SITUACAO: ROTULOS_SITUACAO, LIMITE_LEMBRETE_BACKUP: LIMITE_LEMBRETE_BACKUP,
    limparTexto: limparTexto, dataISO: dataISO, somarDias: somarDias, textoCampo: textoCampo, textoTempo: textoTempo,
    montarEntrada: montarEntrada, entradaParaCampos: entradaParaCampos,
    novoRegistro: novoRegistro, adicionarRegistro: adicionarRegistro, lerRegistro: lerRegistro, lerRegistros: lerRegistros,
    chaveRegistro: chaveRegistro, atualizarRegistro: atualizarRegistro, excluirRegistro: excluirRegistro,
    situacao: situacao, normalizarBusca: normalizarBusca, filtrarRegistros: filtrarRegistros, resumir: resumir,
    SITUACOES_FILTRO: SITUACOES_FILTRO, contarSituacoes: contarSituacoes, textoEspera: textoEspera,
    DIAS_ANTIGO: DIAS_ANTIGO, MAX_TOP: MAX_TOP, resumoVendas: resumoVendas, aprovadosDoPeriodo: aprovadosDoPeriodo, periodoAnterior: periodoAnterior, dataDaVenda: dataDaVenda,
    agruparPorDia: agruparPorDia, hora: hora, descreverEnvio: descreverEnvio, validadeCurta: validadeCurta,
    ultimosClientes: ultimosClientes, materialDoRegistro: materialDoRegistro, materialParaEnvio: materialParaEnvio,
    descricaoLinha: descricaoLinha, orcamentoDeRegistro: orcamentoDeRegistro, precisaLembreteBackup: precisaLembreteBackup,
    BACKUP_APP: BACKUP_APP, BACKUP_FORMATO: BACKUP_FORMATO, MAX_ARQUIVO_BACKUP: MAX_ARQUIVO_BACKUP, ERROS_BACKUP: ERROS_BACKUP, COLUNAS_CSV: COLUNAS_CSV,
    montarDados: montarDados, montarBackup: montarBackup, nomeArquivoBackup: nomeArquivoBackup, nomeArquivoCSV: nomeArquivoCSV,
    lerBackup: lerBackup, resumoBackup: resumoBackup, descreverOrcamentos: descreverOrcamentos, juntarRegistros: juntarRegistros,
    restaurarDados: restaurarDados, desfazerRestauracao: desfazerRestauracao, descreverBackup: descreverBackup,
    textoLembreteBackup: textoLembreteBackup, gerarCSV: gerarCSV, dataBR: dataBR,
    MAX_CATALOGO: MAX_CATALOGO, NOME_PECA_MAX: NOME_PECA_MAX, lerPeca: lerPeca, lerCatalogo: lerCatalogo, acharPeca: acharPeca, pecaComNome: pecaComNome, salvarPeca: salvarPeca,
    editarPeca: editarPeca, excluirPeca: excluirPeca, registrarUsoPeca: registrarUsoPeca, ordenarCatalogo: ordenarCatalogo,
    filtrarCatalogo: filtrarCatalogo, descricaoDaPeca: descricaoDaPeca, entradaDoPedido: entradaDoPedido, atalhosPedido: atalhosPedido,
    compararPreco: compararPreco, descreverEntrada: descreverEntrada
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Dados; }
  root.Dados = Dados;
})(typeof window !== 'undefined' ? window : globalThis);
