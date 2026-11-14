/* Orçamentador Mundo 3DI — registro dos envios e histórico (funções puras, sem tela; testadas no node) */
(function (root) {
  'use strict';

  var MAX_REGISTROS = 2000;
  var SITUACOES = ['enviado', 'aprovado', 'recusado'];
  var MAX_CORES = 8;
  var ATALHOS_MARGEM = [70, 80, 90, 100];
  var LIMITE_LEMBRETE_BACKUP = 20;       // orçamentos desde o último backup (o lembrete só é exibido na etapa do backup)
  var DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

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
    return r;
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
        x.status = m.status;
        x.statusEm = dataValida(m.statusEm) ? m.statusEm : new Date().toISOString();
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
  var ROTULOS_SITUACAO = { enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado', vencido: 'Vencido' };

  /* ---------- busca, período, resumo e agrupamento ---------- */

  /* minúsculas e sem acento: "José" e "jose" são iguais */
  function normalizarBusca(s) {
    var t = String(s == null ? '' : s).toLowerCase();
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.replace(/\s+/g, ' ').trim();
  }

  /* periodo: 'hoje' | '7' | '30' | 'tudo'. Dias contados com o de hoje (7 dias = hoje e os 6 anteriores). */
  function inicioDoPeriodo(periodo, hoje) {
    var h = inicioDoDia(hoje || new Date());
    if (periodo === 'hoje') return h;
    if (periodo === '7') return somarDias(h, -6);
    if (periodo === '30') return somarDias(h, -29);
    return null;
  }

  /*
   * Filtra por período e busca (cliente, peça ou nº) e ordena do mais novo para o mais antigo.
   * f: { periodo (padrão '30'), busca, hoje (Date) }
   */
  function filtrarRegistros(regs, f) {
    f = f || {};
    var inicio = inicioDoPeriodo(f.periodo === undefined ? '30' : f.periodo, f.hoje);
    var q = normalizarBusca(f.busca);
    var saida = (Array.isArray(regs) ? regs : []).filter(function (r) {
      if (inicio && new Date(r.ts).getTime() < inicio.getTime()) return false;
      if (!q) return true;
      var palheiro = normalizarBusca([r.cliente, r.descricao, numero4(r.n), r.n].join(' '));
      return palheiro.indexOf(q) !== -1;
    });
    saida.sort(function (a, b) {
      var d = new Date(b.ts).getTime() - new Date(a.ts).getTime();
      return d !== 0 ? d : b.n - a.n;
    });
    return saida;
  }

  /* Resumo da lista: enviados (todos), soma dos totais e aprovados (quantidade e soma). Soma em centavos inteiros. */
  function resumir(regs) {
    var lista = Array.isArray(regs) ? regs : [];
    var total = 0, apr = 0, qApr = 0;
    lista.forEach(function (r) {
      var c = Math.round(n0(r.total) * 100);
      total += c;
      if (r.status === 'aprovado') { apr += c; qApr++; }
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

  /* Lembrete de backup (só será exibido na etapa do backup): N orçamentos desde o último backup, a partir de 20.
     backup: { em: ISO } ou null (nenhum backup feito). */
  function precisaLembreteBackup(regs, backup, limite) {
    var lista = Array.isArray(regs) ? regs : [];
    var desde = backup && dataValida(backup.em) ? new Date(backup.em).getTime() : null;
    var qtd = desde === null ? lista.length : lista.filter(function (r) { return new Date(r.ts).getTime() > desde; }).length;
    return { mostrar: qtd >= (limite > 0 ? limite : LIMITE_LEMBRETE_BACKUP), qtd: qtd };
  }

  var Dados = {
    MAX_REGISTROS: MAX_REGISTROS, SITUACOES: SITUACOES, ROTULOS_SITUACAO: ROTULOS_SITUACAO, LIMITE_LEMBRETE_BACKUP: LIMITE_LEMBRETE_BACKUP,
    limparTexto: limparTexto, dataISO: dataISO, somarDias: somarDias, textoCampo: textoCampo, textoTempo: textoTempo,
    montarEntrada: montarEntrada, entradaParaCampos: entradaParaCampos,
    novoRegistro: novoRegistro, adicionarRegistro: adicionarRegistro, lerRegistro: lerRegistro, lerRegistros: lerRegistros,
    chaveRegistro: chaveRegistro, atualizarRegistro: atualizarRegistro, excluirRegistro: excluirRegistro,
    situacao: situacao, normalizarBusca: normalizarBusca, filtrarRegistros: filtrarRegistros, resumir: resumir,
    agruparPorDia: agruparPorDia, hora: hora, descreverEnvio: descreverEnvio, validadeCurta: validadeCurta,
    ultimosClientes: ultimosClientes, materialDoRegistro: materialDoRegistro, materialParaEnvio: materialParaEnvio,
    descricaoLinha: descricaoLinha, orcamentoDeRegistro: orcamentoDeRegistro, precisaLembreteBackup: precisaLembreteBackup
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Dados; }
  root.Dados = Dados;
})(typeof window !== 'undefined' ? window : globalThis);
