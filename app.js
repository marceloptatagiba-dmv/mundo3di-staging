/* Orçamentador Mundo 3DI — interface */
(function () {
  'use strict';

  var C = window.Calc;
  var AMB = window.AMBIENTE_3DI || {};
  var CHAVE = AMB.chaveConfig || 'mundo3di-calculadora-config';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Configurações (salvas no aparelho) ---------- */
  function carregarConfig() {
    var cfg = { precoKg: C.PADROES.precoKg, valorHora: C.PADROES.valorHora, perdaPct: C.PADROES.perdaPct, minimo: C.PADROES.minimo };
    var salvo = null;
    try {
      salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (salvo) {
        ['precoKg', 'valorHora', 'perdaPct', 'minimo'].forEach(function (k) {
          if (typeof salvo[k] === 'number' && isFinite(salvo[k]) && salvo[k] >= 0) cfg[k] = salvo[k];
        });
      }
    } catch (e) { salvo = null; /* armazenamento indisponível: usa padrões */ }
    /* Filamentos: configuração da v2 (só preço do rolo) vira "PLA" com o mesmo preço */
    var mats = C.lerMateriais(salvo);
    cfg.materiais = mats.materiais;
    cfg.materialPadrao = mats.materialPadrao;
    cfg.mostrarMaterial = !!(salvo && salvo.mostrarMaterial === true);
    /* Custo da hora: Simples (padrão, usa valorHora) ou Detalhado (usa o objeto "impressora"). Os dois ficam salvos. */
    cfg.modoHora = salvo && salvo.modoHora === 'detalhado' ? 'detalhado' : 'simples';
    cfg.impressora = C.lerImpressora(salvo && salvo.impressora);
    cfg.negocio = C.lerNegocio(salvo && salvo.negocio);
    cfg.arredondamento = C.lerArredondamento(salvo && salvo.arredondamento);
    cfg.precoKg = C.precoKgMaterial(materialPorId(cfg, cfg.materialPadrao));
    return cfg;
  }
  function salvarConfig(cfg) {
    try { localStorage.setItem(CHAVE, JSON.stringify(cfg)); return true; } catch (e) { return false; }
  }
  function materialPorId(cfg, id) {
    for (var i = 0; i < cfg.materiais.length; i++) if (cfg.materiais[i].id === id) return cfg.materiais[i];
    return null;
  }
  var config = carregarConfig();

  /* Último filamento usado na tela de orçamento (se foi excluído, volta para o padrão) */
  var CHAVE_MAT = CHAVE + '-material';
  var materialAtual = null;
  try { materialAtual = localStorage.getItem(CHAVE_MAT); } catch (e) {}
  function filamentoAtual() {
    return materialPorId(config, materialAtual) || materialPorId(config, config.materialPadrao) || config.materiais[0];
  }

  /* ---------- Formatação ---------- */
  var moeda = C.moeda;
  function num(n) { return C.decimal(n, 0, 2); }          // 5 | 12,5
  function dinheiro(n) { return C.decimal(n, 2, 2); }     // 150,00
  function fino(n) { return C.decimal(n, 2, 4); }         // 0,0375

  /* ---------- Orçamento ---------- */
  var ePeso = $('peso'), eTempo = $('tempo'), eMargem = $('margem'), eQtd = $('qtd'), eExtras = $('extras');
  var eMaterial = $('material');
  var configInicial = '';   // foto das configurações ao abrir a tela (para saber se há alteração não salva)

  /* Peça multicor: só em memória (não grava no aparelho). cores = [{ id do filamento, g texto }] */
  var MULTI = '__multicor';
  var multicorAtivo = false;
  var cores = [{ id: null, g: '' }, { id: null, g: '' }];
  var purgaTxt = '';
  /* Pedido do catálogo: peso e tempo proporcionais ficam exatos na conta, mesmo com o campo mostrando arredondado (5h13).
     Vale só enquanto o campo continua com o texto que a tela colocou; se a pessoa digitar, vale o que foi digitado. */
  var exato = {};      // { chave: { txt, val } } — chaves: peso, tempo, purga, c0, c1…
  function lerExato(chave, txt, leitor) { var x = exato[chave]; return x && x.txt === txt ? x.val : leitor(txt); }
  function coresCalculo() {
    return cores.map(function (c, i) {
      var f = materialPorId(config, c.id) || filamentoAtual();
      return { gramas: lerExato('c' + i, c.g, C.lerNumero), precoKg: C.precoKgMaterial(f), nome: f.nome };
    });
  }
  function nomesCores() {
    var vistos = [];
    coresCalculo().forEach(function (c) { if (c.gramas > 0 && vistos.indexOf(c.nome) < 0) vistos.push(c.nome); });
    return vistos.join(' + ');
  }

  function montarSeletor() {
    eMaterial.textContent = '';
    config.materiais.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m.id; o.textContent = m.nome;
      eMaterial.appendChild(o);
    });
    var o = document.createElement('option');
    o.value = MULTI; o.textContent = 'Multicor (AMS)';
    eMaterial.appendChild(o);
    eMaterial.value = multicorAtivo ? MULTI : filamentoAtual().id;
  }
  /* Nome de filamento longo: o rótulo "Peso da mesa" encurta para "Peso" para o nome caber */
  function ajustarRotuloPeso() {
    var rot = document.querySelector('label[for="peso"]'), nome = $('material-nome');
    rot.textContent = 'Peso da mesa';
    if (nome.scrollWidth > nome.clientWidth) rot.textContent = 'Peso';
  }
  window.addEventListener('resize', ajustarRotuloPeso);
  function aplicarModoMulticor() {
    ePeso.readOnly = multicorAtivo;
    ePeso.setAttribute('inputmode', multicorAtivo ? 'none' : 'decimal');
    ePeso.parentNode.classList.toggle('multi', multicorAtivo);
    $('material-nome').textContent = multicorAtivo ? 'Multicor' : filamentoAtual().nome;
    ajustarRotuloPeso();
  }
  eMaterial.addEventListener('change', function () {
    if (eMaterial.value === MULTI) { multicorAtivo = true; aplicarModoMulticor(); atualizar(); abrirCores(); return; }
    if (multicorAtivo) ePeso.value = '';
    multicorAtivo = false; aplicarModoMulticor();
    materialAtual = eMaterial.value;
    try { localStorage.setItem(CHAVE_MAT, materialAtual); } catch (e) {}
    atualizar();
  });
  var atalhos = Array.prototype.slice.call(document.querySelectorAll('[data-margem]'));
  var outraAberta = false;

  function atualizar() {
    var peso = lerExato('peso', ePeso.value, C.lerNumero);
    var tempo = lerExato('tempo', eTempo.value, C.lerTempo);
    var margem = C.lerNumero(eMargem.value);
    var qtd = C.lerQuantidade(eQtd.value);
    var extrasPeca = C.lerNumero(eExtras.value);
    var fil = filamentoAtual();
    var precoKg = C.precoKgMaterial(fil);
    var imp = config.modoHora === 'detalhado' ? C.calcularImpressora(config.impressora) : null;
    var cc = multicorAtivo ? coresCalculo() : null;
    var r = C.calcular({ peso: peso, tempo: tempo, cores: cc, purgaG: multicorAtivo ? lerExato('purga', purgaTxt, C.lerNumero) : 0, margemPct: margem, qtd: qtd, extrasPeca: extrasPeca,
      precoKg: precoKg, valorHora: config.valorHora, perdaPct: config.perdaPct, minimo: config.minimo,
      energiaHora: imp ? imp.energiaHora : undefined, desgasteHora: imp ? imp.desgasteHora : undefined,
      arredondar: config.arredondamento });

    var nomeChip = multicorAtivo ? 'Multicor' : fil.nome;
    if ($('material-nome').textContent !== nomeChip) { $('material-nome').textContent = nomeChip; ajustarRotuloPeso(); }
    if (multicorAtivo) {
      ePeso.value = r.pesoTotal > 0 ? num(r.pesoTotal) : '';
      var nc = cc.filter(function (c) { return c.gramas > 0; }).length;
      $('d-material').textContent = num(r.pesoTotal) + ' g em ' + nc + (nc === 1 ? ' cor' : ' cores');
    } else {
      $('d-material').textContent = num(peso) + ' g de ' + fil.nome + ' × ' + moeda(precoKg) + '/kg';
    }
    $('v-material').textContent = moeda(r.material);
    $('r-purga').hidden = !multicorAtivo || r.purgaGramas <= 0;
    $('d-purga').textContent = num(r.purgaGramas) + ' g × ' + moeda(r.precoMedioGrama * 1000) + '/kg (média)';
    $('v-purga').textContent = moeda(r.purga);
    /* Modo simples: uma linha "Impressão". Modo detalhado: "Energia" e "Desgaste da impressora". */
    $('r-impressao').hidden = r.detalhado;
    $('r-energia').hidden = !r.detalhado;
    $('r-desgaste').hidden = !r.detalhado;
    $('d-impressao').textContent = C.formatarTempo(tempo) + ' × ' + moeda(config.valorHora) + '/h';
    $('v-impressao').textContent = moeda(r.impressao);
    if (imp) {
      $('d-energia').textContent = C.formatarTempo(tempo) + ' × ' + moeda(imp.energiaHora) + '/h';
      $('v-energia').textContent = moeda(r.energia);
      $('d-desgaste').textContent = C.formatarTempo(tempo) + ' × ' + moeda(imp.desgasteHora) + '/h';
      $('v-desgaste').textContent = moeda(r.desgaste);
    }
    $('v-base').textContent = moeda(r.custoBase);
    $('r-perda').textContent = 'Perda/Refugo (' + num(config.perdaPct) + '%)';
    $('v-perda').textContent = '+ ' + moeda(r.perda);
    $('r-extras').hidden = r.extras <= 0;
    $('d-extras').textContent = qtd + ' × ' + moeda(extrasPeca);
    $('v-extras').textContent = '+ ' + moeda(r.extras);
    $('v-total').textContent = moeda(r.custoTotal);
    /* Arredondamento: só aparece quando acrescentou alguma coisa ao valor */
    $('r-arred').hidden = !(r.arredondamento > 0.004);
    $('d-arred').textContent = 'Valor por peça de ' + moeda(r.valorAntesArredondar) + ' para ' + moeda(r.valorUnitario);
    $('v-arred').textContent = '+ ' + moeda(r.arredondamento);
    $('v-lucro').textContent = moeda(r.lucro);
    $('v-final').textContent = moeda(r.valorCobrar);
    $('d-unit').hidden = qtd <= 1;
    $('d-unit').textContent = moeda(r.valorUnitario) + ' cada (' + qtd + ' peças)';
    $('d-final').hidden = !r.minimoAplicado;
    $('d-final').textContent = 'Preço mínimo do pedido aplicado (cálculo: ' + moeda(r.valorCalculado) + ')';

    atalhos.forEach(function (b) {
      b.setAttribute('aria-pressed', String(!outraAberta && Number(b.dataset.margem) === margem));
    });
    $('margem-outra').setAttribute('aria-pressed', String(outraAberta));
    $('margem-campo').hidden = !outraAberta;
    ultimoValor = moeda(r.valorCobrar);
    ultimoOrcamento = r;
    desenharVinculo();
  }
  var ultimoValor = 'R$ 0,00';
  var ultimoOrcamento = null;

  [ePeso, eTempo, eMargem, eQtd, eExtras].forEach(function (el) {
    el.addEventListener('input', atualizar);
    el.addEventListener('focus', function () { setTimeout(function () { el.select(); }, 0); });
  });
  atalhos.forEach(function (b) {
    b.addEventListener('click', function () { outraAberta = false; eMargem.value = b.dataset.margem; atualizar(); });
  });

  $('margem-outra').addEventListener('click', function () { outraAberta = true; atualizar(); eMargem.focus(); });

  /* ---------- Folha de cores (multicor) ---------- */
  var folhaCores = $('folha-cores'), listaCores = $('cores-lista'), ePurga = $('purga');
  function opcoesFilamento(sel, id) {
    config.materiais.forEach(function (m) {
      var o = document.createElement('option'); o.value = m.id; o.textContent = m.nome; sel.appendChild(o);
    });
    sel.value = id;
  }
  function desenharCores() {
    listaCores.textContent = '';
    cores.forEach(function (c, i) {
      if (!materialPorId(config, c.id)) c.id = filamentoAtual().id;
      var linha = document.createElement('div'); linha.className = 'cor-linha';
      var sel = document.createElement('select'); sel.setAttribute('aria-label', 'Filamento da cor ' + (i + 1));
      opcoesFilamento(sel, c.id);
      sel.addEventListener('change', function () { c.id = sel.value; atualizar(); });
      var cx = document.createElement('label'); cx.className = 'caixa';
      var inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off';
      inp.placeholder = '0'; inp.value = c.g; inp.setAttribute('aria-label', 'Gramas da cor ' + (i + 1));
      inp.addEventListener('input', function () { c.g = inp.value; atualizar(); });
      inp.addEventListener('focus', function () { setTimeout(function () { inp.select(); }, 0); });
      var u = document.createElement('small'); u.textContent = 'g';
      cx.appendChild(inp); cx.appendChild(u);
      var tira = document.createElement('button'); tira.type = 'button'; tira.className = 'tira'; tira.textContent = '×';
      tira.setAttribute('aria-label', 'Remover cor ' + (i + 1)); tira.hidden = cores.length <= 1;
      tira.addEventListener('click', function () { cores.splice(i, 1); desenharCores(); atualizar(); });
      linha.appendChild(sel); linha.appendChild(cx); linha.appendChild(tira);
      listaCores.appendChild(linha);
    });
    $('cores-mais').hidden = cores.length >= C.MAX_CORES;
  }
  function abrirCores() {
    desenharCores(); ePurga.value = purgaTxt; folhaCores.hidden = false;
    var primeiro = listaCores.querySelector('input'); if (primeiro) setTimeout(function () { primeiro.focus(); }, 50);
  }
  function fecharCores() { folhaCores.hidden = true; }
  $('cores-mais').addEventListener('click', function () {
    cores.push({ id: filamentoAtual().id, g: '' }); desenharCores(); atualizar();
    var ins = listaCores.querySelectorAll('input'); ins[ins.length - 1].focus();
  });
  ePurga.addEventListener('input', function () { purgaTxt = ePurga.value; atualizar(); });
  ePurga.addEventListener('focus', function () { setTimeout(function () { ePurga.select(); }, 0); });
  $('cores-pronto').addEventListener('click', fecharCores);
  $('cores-fechar').addEventListener('click', fecharCores);
  $('cores-fundo').addEventListener('click', fecharCores);
  ePeso.addEventListener('click', function () { if (multicorAtivo) abrirCores(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !folhaCores.hidden) fecharCores(); });

  $('limpar').addEventListener('click', function () {
    outraAberta = false; exato = {}; vinculo = null;
    purgaTxt = ''; cores.forEach(function (c) { c.g = ''; });
    ePeso.value = ''; eTempo.value = ''; eQtd.value = '1'; eExtras.value = ''; eMargem.value = String(C.PADROES.margemPct);
    atualizar(); ePeso.focus();
  });

  /* ---------- Copiar valor ---------- */
  function copiarTexto(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
    return new Promise(function (ok, falha) {
      var t = document.createElement('textarea');
      t.value = txt; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? ok() : falha(); } catch (e) { falha(e); }
      document.body.removeChild(t);
    });
  }
  var timerCopia;
  $('copiar').addEventListener('click', function () {
    copiarTexto(ultimoValor).then(function () {
      $('copiar-txt').textContent = 'Copiado!';
      clearTimeout(timerCopia);
      timerCopia = setTimeout(function () { $('copiar-txt').textContent = 'Copiar'; }, 1500);
    }, function () { avisar('Não foi possível copiar'); });
  });

  /* ---------- Numeração e registro dos envios (só neste aparelho) ---------- */
  var D = window.Dados;
  var CHAVE_CONT = CHAVE + '-contador';     // último número usado
  var CHAVE_REG = CHAVE + '-registros';     // lista de envios com data e hora
  var CHAVE_LOGO = CHAVE + '-logo';         // logo do cliente (dataURL, até 400 px)
  var LOGO_3DI = 'img/logo-3di.png';

  function lerLogoSalvo() { try { return localStorage.getItem(CHAVE_LOGO) || ''; } catch (e) { return ''; } }
  function proximoNumero() {
    var n = 0;
    try { n = parseInt(localStorage.getItem(CHAVE_CONT) || '0', 10) || 0; } catch (e) {}
    return n + 1;
  }
  function lerLista() {
    try { return D.lerRegistros(JSON.parse(localStorage.getItem(CHAVE_REG) || '[]')); } catch (e) { return []; }
  }
  function gravarLista(lista) {
    try { localStorage.setItem(CHAVE_REG, JSON.stringify(lista)); return true; } catch (e) { avisar('Não deu para salvar'); return false; }
  }
  /* O que está digitado na mesa agora (guardado no registro para "Usar de novo") */
  function entradaAtual() {
    var fil = filamentoAtual();
    var o = { peso: lerExato('peso', ePeso.value, C.lerNumero), tempoMin: lerExato('tempo', eTempo.value, C.lerTempo), qtd: C.lerQuantidade(eQtd.value),
      extras: C.lerNumero(eExtras.value), margem: C.lerNumero(eMargem.value), materialId: fil.id, materialNome: fil.nome };
    if (multicorAtivo) {
      o.cores = cores.map(function (c, i) {
        var f = materialPorId(config, c.id) || fil;
        return { materialId: f.id, nome: f.nome, gramas: lerExato('c' + i, c.g, C.lerNumero) };
      });
      o.purgaG = lerExato('purga', purgaTxt, C.lerNumero);
    }
    return D.montarEntrada(o);
  }
  /* Grava o envio novo: avança o contador e guarda o registro com data e hora. Chamado só quando o envio aconteceu. */
  function registrarEnvio(numero, formato, extra) {
    var reg = D.novoRegistro(extra.orcamento, { numero: numero, formato: formato, material: extra.material, cliente: extra.cliente,
      descricao: extra.descricao, entrada: extra.entrada, prazo: extra.prazo, validadeAte: extra.validadeAte, versaoApp: versaoEmUso,
      catalogoId: pecaVinculada() ? vinculo.id : '' });
    try {
      localStorage.setItem(CHAVE_CONT, String(numero));
      var lista = JSON.parse(localStorage.getItem(CHAVE_REG) || '[]');
      localStorage.setItem(CHAVE_REG, JSON.stringify(D.adicionarRegistro(lista, reg, D.MAX_REGISTROS)));
    } catch (e) { /* armazenamento indisponível: o envio continua valendo, só não fica registrado */ }
    /* Peça do catálogo: o valor enviado vira a referência e ela sobe de uso */
    if (reg.catalogoId) gravarCatalogo(D.registrarUsoPeca(lerCatalogo(), reg.catalogoId, reg.valorPeca, new Date(reg.ts)));
  }
  /* Reenvio: mesmo número, o contador não anda; soma 1 em "reenvios" */
  function registrarReenvio(reg, extra) {
    var m = { reenvios: (reg.reenvios || 0) + 1, cliente: extra.cliente };
    if (extra.formato === 'imagem') { m.descricao = extra.descricao; m.prazo = extra.prazo; }
    gravarLista(D.atualizarRegistro(lerLista(), D.chaveRegistro(reg), m));
    if (!$('tela-hist').hidden) desenharHist();
  }

  /* ---------- Enviar orçamento: painel com Texto ou Imagem ---------- */
  var folha = $('folha'), eCliente = $('env-cliente'), eImgDesc = $('img-descricao'), eImgPrazo = $('img-prazo');
  var imagem = null;            // { arquivo, url, numero, data, validadeAte } — imagem já pronta para enviar
  var tokenImagem = 0, timerImagem;
  var envioReg = null;          // null = orçamento novo · registro = reenvio daquele orçamento

  function nomeFilamentoEnvio() {
    if (envioReg) return D.materialParaEnvio(envioReg, config.mostrarMaterial);
    return config.mostrarMaterial ? (multicorAtivo ? (nomesCores() ? nomesCores() + ' (multicor)' : '') : filamentoAtual().nome) : '';
  }
  function orcamentoEnvio() { return envioReg ? D.orcamentoDeRegistro(envioReg) : ultimoOrcamento; }
  function numeroEnvio() { return envioReg ? envioReg.n : proximoNumero(); }
  function whatsappTexto(texto) { window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }

  function desenharChipsClientes() {
    var box = $('env-clientes'); box.textContent = '';
    var nomes = envioReg ? [] : D.ultimosClientes(lerLista(), 3);
    nomes.forEach(function (nome) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip claro'; b.textContent = nome;
      b.addEventListener('click', function () { eCliente.value = nome; agendarImagem(); });
      box.appendChild(b);
    });
    box.hidden = nomes.length === 0;
  }

  function abrirFolha(reg) {
    envioReg = reg || null;
    if (!envioReg && (!ultimoOrcamento || ultimoOrcamento.valorCobrar <= 0)) { avisar('Preencha peso e tempo primeiro'); return; }
    eCliente.value = envioReg ? envioReg.cliente : '';
    eImgDesc.value = envioReg ? envioReg.descricao : (pecaVinculada() ? D.descricaoDaPeca(pecaVinculada()) : '');
    eImgPrazo.value = envioReg && envioReg.prazo ? envioReg.prazo : config.negocio.prazo;
    $('painel-imagem').hidden = true; $('abrir-imagem').setAttribute('aria-pressed', 'false');
    $('folha-rotulo').textContent = envioReg ? 'Reenviar orçamento' : 'Enviar orçamento';
    $('folha-numero').textContent = 'Nº ' + C.formatarNumero(numeroEnvio());
    desenharChipsClientes();
    descartarImagem();
    folha.hidden = false;
    $('enviar-texto').focus();      // o campo Cliente não pega o foco: abrir o teclado atrapalharia quem não usa
  }
  function fecharFolha() { folha.hidden = true; tokenImagem++; clearTimeout(timerImagem); descartarImagem(); }
  $('whatsapp').addEventListener('click', function () { abrirFolha(null); });
  $('folha-fechar').addEventListener('click', fecharFolha);
  $('folha-fundo').addEventListener('click', fecharFolha);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !folha.hidden) fecharFolha(); });

  /* Texto: compartilhamento nativo; sem suporte (ou erro), abre o WhatsApp */
  $('enviar-texto').addEventListener('click', function () {
    var reg = envioReg, numero = numeroEnvio(), orc = orcamentoEnvio(), entrada = reg ? null : entradaAtual();
    var cliente = D.limparTexto(eCliente.value, 60);
    var texto = C.textoOrcamento(orc, { material: nomeFilamentoEnvio(), numero: numero, negocio: config.negocio.nome });
    var registrar = function () {
      if (reg) registrarReenvio(reg, { formato: 'texto', cliente: cliente });
      else registrarEnvio(numero, 'texto', { orcamento: orc, material: nomeFilamentoEnvio(), cliente: cliente, entrada: entrada });
    };
    fecharFolha();
    if (navigator.share) {
      navigator.share({ text: texto }).then(registrar, function (e) {
        if (!e || e.name !== 'AbortError') { whatsappTexto(texto); registrar(); }
      });
    } else { whatsappTexto(texto); registrar(); }
  });

  /* Imagem: é desenhada assim que o painel abre (e a cada mudança nos campos), para o botão "Enviar imagem"
     chamar o compartilhamento na hora do toque — o iPhone não aceita compartilhar depois de uma espera. */
  function descartarImagem() {
    if (imagem) URL.revokeObjectURL(imagem.url);
    imagem = null;
    $('img-previa').hidden = true; $('img-previa').removeAttribute('src');
    $('enviar-imagem').disabled = true;
  }
  /* Data e validade: orçamento novo = hoje + validade do negócio · reenvio = os do orçamento original */
  function datasEnvio() {
    if (envioReg) return { data: new Date(envioReg.ts), validadeAte: envioReg.validadeAte || '' };
    var d = new Date(), dias = config.negocio.validadeDias;
    return { data: d, validadeAte: dias > 0 ? D.dataISO(D.somarDias(d, dias)) : '' };
  }
  function dadosDaImagem(numero, datas) {
    return C.dadosOrcamento(orcamentoEnvio(), {
      negocio: config.negocio, numero: numero, data: datas.data, validadeAte: datas.validadeAte, material: nomeFilamentoEnvio(),
      cliente: eCliente.value, descricao: eImgDesc.value, prazo: eImgPrazo.value
    });
  }
  function prepararImagem() {
    var meu = ++tokenImagem, numero = numeroEnvio(), datas = datasEnvio();
    $('img-estado').textContent = 'Preparando a imagem…';
    $('enviar-imagem').disabled = true;
    OrcamentoImg.gerar(dadosDaImagem(numero, datas), lerLogoSalvo() || LOGO_3DI).then(function (blob) {
      if (meu !== tokenImagem) return;
      var antigo = imagem; if (antigo) URL.revokeObjectURL(antigo.url);
      var arquivo = new File([blob], 'orcamento-' + C.formatarNumero(numero) + '.jpg', { type: 'image/jpeg' });
      imagem = { arquivo: arquivo, url: URL.createObjectURL(blob), numero: numero, validadeAte: datas.validadeAte };
      $('img-previa').src = imagem.url; $('img-previa').hidden = false;
      $('img-estado').textContent = Math.round(blob.size / 1024) + ' KB · pronta para enviar';
      $('enviar-imagem').disabled = false;
    }, function () {
      if (meu !== tokenImagem) return;
      $('img-estado').textContent = 'Não foi possível criar a imagem.';
    });
  }
  function agendarImagem() {
    if ($('painel-imagem').hidden) return;
    $('enviar-imagem').disabled = true;
    clearTimeout(timerImagem); timerImagem = setTimeout(prepararImagem, 250);
  }
  $('abrir-imagem').addEventListener('click', function () {
    $('painel-imagem').hidden = false; $('abrir-imagem').setAttribute('aria-pressed', 'true');
    prepararImagem();
  });
  [eCliente, eImgDesc, eImgPrazo].forEach(function (el) { el.addEventListener('input', agendarImagem); selecionarAoFocar(el); });

  function baixarImagem(img) {
    var a = document.createElement('a');
    a.href = img.url; a.download = img.arquivo.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  $('enviar-imagem').addEventListener('click', function () {
    var img = imagem;
    if (!img) return;
    var reg = envioReg, orc = orcamentoEnvio(), entrada = reg ? null : entradaAtual();
    var extra = { orcamento: orc, formato: 'imagem', material: nomeFilamentoEnvio(), cliente: D.limparTexto(eCliente.value, 60),
      descricao: D.limparTexto(eImgDesc.value, 120), prazo: D.limparTexto(eImgPrazo.value, 40), validadeAte: img.validadeAte, entrada: entrada };
    var gravar = function () { if (reg) registrarReenvio(reg, extra); else registrarEnvio(img.numero, 'imagem', extra); };
    var registrar = function () { gravar(); fecharFolha(); };
    if (navigator.canShare && navigator.canShare({ files: [img.arquivo] })) {
      navigator.share({ files: [img.arquivo] }).then(registrar, function (e) {
        if (!e || e.name !== 'AbortError') { baixarImagem(img); registrar(); }
      });
    } else {
      baixarImagem(img);               // sem compartilhamento de arquivo: baixa o JPG
      avisar('Imagem salva no aparelho');
      gravar();
      setTimeout(fecharFolha, 2000);    // dá tempo do download começar antes de liberar o arquivo
    }
  });

  /* ---------- Aviso rápido ---------- */
  var timerAviso;
  function avisar(msg) {
    var a = $('aviso'); a.textContent = msg; a.classList.add('ver');
    clearTimeout(timerAviso); timerAviso = setTimeout(function () { a.classList.remove('ver'); }, 1800);
  }

  /* ---------- Tela de configurações ---------- */
  var cHora = $('cfg-hora'), cPerda = $('cfg-perda'), cMin = $('cfg-minimo'), cMostrar = $('cfg-mostrar-material');
  var cPot = $('cfg-pot'), cTarifa = $('cfg-tarifa'), cPrecoImp = $('cfg-preco-imp'), cRevenda = $('cfg-revenda'),
      cVida = $('cfg-vida'), cHorasAno = $('cfg-horas-ano'), cManut = $('cfg-manut');
  var modoEdicao = 'simples';
  var cNeg = { nome: $('neg-nome'), whatsapp: $('neg-whatsapp'), instagram: $('neg-instagram'), cidade: $('neg-cidade'),
    cnpj: $('neg-cnpj'), prazo: $('neg-prazo'), pagamento: $('neg-pagamento'), obs: $('neg-obs') };
  var cValidade = $('neg-validade');
  /* WhatsApp: formata como (xx) xxxx-xxxx enquanto digita, mantendo o cursor no mesmo dígito */
  (function () {
    var el = cNeg.whatsapp, antes = '';
    function digitos(s) { return s.replace(/\D/g, ''); }
    function colocar(d, nDig) {          // escreve o número formatado e põe o cursor depois do dígito nº nDig
      var f = C.formatarTelefone(d), cont = 0, i = 0;
      el.value = f;
      while (i < f.length && cont < nDig) { if (/\d/.test(f[i])) cont++; i++; }
      try { el.setSelectionRange(i, i); } catch (e) {}
      antes = digitos(f);
    }
    el.addEventListener('input', function (ev) {
      var pos = el.selectionStart == null ? el.value.length : el.selectionStart;
      var d = digitos(el.value), nCursor = digitos(el.value.slice(0, pos)).length;
      // apagou só "(", ")", "-" ou espaço: o formato os recoloca, então apaga o dígito anterior
      if (ev.inputType && ev.inputType.indexOf('delete') === 0 && d === antes && nCursor > 0) {
        d = d.slice(0, nCursor - 1) + d.slice(nCursor); nCursor--;
      }
      colocar(d, nCursor);
    });
    el.addEventListener('focus', function () { antes = digitos(el.value); });
  })();
  var logoPendente;   // undefined = sem mudança · '' = remover · texto = novo logo (só vale ao tocar em Salvar)
  var lista = $('lista-materiais');
  var ICONE_LIXO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

  function selecionarAoFocar(el) { el.addEventListener('focus', function () { setTimeout(function () { el.select(); }, 0); }); }

  /* Um bloco por filamento: nome, preço do rolo, peso do rolo, padrão e excluir */
  function linhaMaterial(m, padrao) {
    var d = document.createElement('div');
    d.className = 'mat'; d.dataset.id = m.id;
    d.innerHTML =
      '<div class="mat-topo"><label class="caixa"><input class="m-nome" type="text" maxlength="30" autocomplete="off" placeholder="Ex.: PETG" aria-label="Nome do filamento"></label>' +
      '<button class="icone-p m-excluir" type="button" aria-label="Excluir filamento">' + ICONE_LIXO + '</button></div>' +
      '<div class="grade2">' +
      '<label class="campo"><span>Preço do rolo</span><span class="caixa"><b>R$</b><input class="m-preco" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"></span></label>' +
      '<label class="campo"><span>Peso do rolo</span><span class="caixa"><input class="m-peso" type="text" inputmode="numeric" autocomplete="off" placeholder="1000"><small>g</small></span></label>' +
      '</div>' +
      '<div class="mat-rodape"><label><input type="radio" name="mat-padrao" class="m-padrao">Padrão</label><span class="ajuda m-ajuda"></span></div>';
    var nome = d.querySelector('.m-nome'), preco = d.querySelector('.m-preco'), peso = d.querySelector('.m-peso');
    nome.value = m.nome;
    preco.value = m.precoRolo > 0 || m.nome ? dinheiro(m.precoRolo) : '';
    peso.value = String(Math.round(m.pesoRolo || C.PESO_ROLO_PADRAO)); // sem separador de milhar
    d.querySelector('.m-padrao').checked = padrao;
    [preco, peso].forEach(function (el) { el.addEventListener('input', function () { ajudaMaterial(d); }); selecionarAoFocar(el); });
    d.querySelector('.m-excluir').addEventListener('click', function () {
      var eraPadrao = d.querySelector('.m-padrao').checked;
      lista.removeChild(d);
      if (eraPadrao) lista.querySelector('.m-padrao').checked = true;
      estadoLista();
    });
    ajudaMaterial(d);
    return d;
  }
  function lerLinha(d) {
    return {
      id: d.dataset.id,
      nome: d.querySelector('.m-nome').value.trim(),
      precoRolo: C.lerNumero(d.querySelector('.m-preco').value),
      pesoRolo: C.lerPesoRolo(d.querySelector('.m-peso').value)
    };
  }
  function ajudaMaterial(d) {
    var m = lerLinha(d);
    d.querySelector('.m-ajuda').textContent = 'R$ ' + fino(C.precoKgMaterial(m) / 1000) + ' por grama';
  }
  function linhas() { return Array.prototype.slice.call(lista.querySelectorAll('.mat')); }
  function estadoLista() {
    var ls = linhas();
    ls.forEach(function (d) { d.querySelector('.m-excluir').disabled = ls.length <= 1; });
    $('add-material').hidden = ls.length >= C.MAX_MATERIAIS;
  }
  $('add-material').addEventListener('click', function () {
    var d = linhaMaterial({ id: 'm' + Date.now().toString(36), nome: '', precoRolo: 0, pesoRolo: C.PESO_ROLO_PADRAO }, false);
    lista.appendChild(d);
    estadoLista();
    d.querySelector('.m-nome').focus();
  });

  function preencherConfig(cfg) {
    lista.textContent = '';
    cfg.materiais.forEach(function (m) { lista.appendChild(linhaMaterial(m, m.id === cfg.materialPadrao)); });
    estadoLista();
    cMostrar.checked = !!cfg.mostrarMaterial;
    preencherCustos(cfg);
    preencherImpressora(cfg.impressora);
    definirModo(cfg.modoHora);
    preencherNegocio(cfg.negocio);
  }
  /* ---------- Meu negócio e logo ---------- */
  function preencherNegocio(n) {
    Object.keys(cNeg).forEach(function (k) { cNeg[k].value = n[k]; });
    cValidade.value = String(n.validadeDias);
    logoPendente = undefined;
    mostrarLogo(lerLogoSalvo());
  }
  function mostrarLogo(src) {
    $('cfg-logo-prev').src = src || LOGO_3DI;
    $('cfg-logo-remover').hidden = !src;
    $('cfg-logo-escolher').textContent = src ? 'Trocar logo' : 'Escolher logo';
    $('a-logo').textContent = src ? 'Será reduzido a 400 px neste aparelho.' : 'Sem logo seu, a imagem usa o logo 3Di.';
  }
  function lerNegocioTela() {
    var n = {};
    Object.keys(cNeg).forEach(function (k) { n[k] = cNeg[k].value; });
    n.validadeDias = C.lerInteiro(cValidade.value);
    return C.lerNegocio(n);
  }
  $('cfg-logo-escolher').addEventListener('click', function () { $('cfg-logo-arq').click(); });
  $('cfg-logo-arq').addEventListener('change', function () {
    var arq = this.files && this.files[0];
    this.value = '';
    if (!arq) return;
    OrcamentoImg.reduzirLogo(arq).then(function (src) {
      logoPendente = src; mostrarLogo(src);
      avisar('Logo pronto — toque em Salvar');
    }, function () { avisar('Não foi possível ler essa imagem'); });
  });
  $('cfg-logo-remover').addEventListener('click', function () { logoPendente = ''; mostrarLogo(''); });
  function preencherCustos(cfg) {
    cHora.value = dinheiro(cfg.valorHora);
    cPerda.value = num(cfg.perdaPct);
    cMin.value = dinheiro(cfg.minimo || 0);
    definirArredondamento(cfg.arredondamento);
    ajudasConfig();
  }
  /* Arredondamento do valor por peça: Exato · ,50 · ,90 · Inteiro (sempre para cima) */
  var arredEdicao = 'exato';
  var botoesArred = Array.prototype.slice.call(document.querySelectorAll('[data-arr]'));
  function definirArredondamento(modo) {
    arredEdicao = C.lerArredondamento(modo);
    botoesArred.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.arr === arredEdicao)); });
    var exemplo = {
      exato: 'Sem arredondar: o valor sai exatamente como calculado.',
      '50': 'Sobe para o próximo ,50. Ex.: R$ 2,36 vira ' + moeda(C.arredondarCima(2.36, '50')) + '.',
      '90': 'Sobe para o próximo ,90. Ex.: R$ 2,36 vira ' + moeda(C.arredondarCima(2.36, '90')) + '.',
      inteiro: 'Sobe para o próximo real. Ex.: R$ 2,36 vira ' + moeda(C.arredondarCima(2.36, 'inteiro')) + '.'
    };
    $('a-arred').textContent = exemplo[arredEdicao] + (arredEdicao === 'exato' ? '' : ' Com o preço mínimo aplicado, não arredonda.');
  }
  botoesArred.forEach(function (b) { b.addEventListener('click', function () { definirArredondamento(b.dataset.arr); }); });
  /* Campos da impressora: vazios quando 0 (aparece o "0" cinza do placeholder) */
  function preencherImpressora(p) {
    function din(n) { return n > 0 ? dinheiro(n) : ''; }
    cPot.value = p.potenciaW > 0 ? num(p.potenciaW) : '';
    cTarifa.value = p.tarifa > 0 ? fino(p.tarifa) : '';
    cPrecoImp.value = din(p.preco);
    cRevenda.value = din(p.revenda);
    cVida.value = p.vidaUtil > 0 ? String(Math.round(p.vidaUtil)) : '';      // sem separador de milhar
    cHorasAno.value = p.horasAno > 0 ? String(Math.round(p.horasAno)) : '';
    cManut.value = din(p.manutencaoAno);
  }
  function lerImpressoraTela() {
    return C.lerImpressora({
      potenciaW: C.lerDinheiro(cPot.value), tarifa: C.lerNumero(cTarifa.value),
      preco: C.lerDinheiro(cPrecoImp.value), revenda: C.lerDinheiro(cRevenda.value),
      vidaUtil: C.lerInteiro(cVida.value), horasAno: C.lerInteiro(cHorasAno.value),
      manutencaoAno: C.lerDinheiro(cManut.value)
    });
  }
  /* Alternar entre Simples e Detalhado só mostra/esconde: nenhum campo é apagado */
  function definirModo(modo) {
    modoEdicao = modo === 'detalhado' ? 'detalhado' : 'simples';
    $('modo-simples').setAttribute('aria-pressed', String(modoEdicao === 'simples'));
    $('modo-detalhado').setAttribute('aria-pressed', String(modoEdicao === 'detalhado'));
    $('hora-simples').hidden = modoEdicao !== 'simples';
    $('hora-detalhado').hidden = modoEdicao !== 'detalhado';
    ajudasConfig();
  }
  $('modo-simples').addEventListener('click', function () { definirModo('simples'); });
  $('modo-detalhado').addEventListener('click', function () { definirModo('detalhado'); });

  function ajudasConfig() {
    var simples = C.lerNumero(cHora.value);
    $('a-hora').textContent = 'Equivale a R$ ' + fino(simples / 60) + ' por minuto';
    /* Valor por hora calculado ao vivo, comparado com o modo Simples (evita baixar o preço sem perceber) */
    var p = C.calcularImpressora(lerImpressoraTela());
    $('a-det-total').textContent = 'Custo da hora: ' + moeda(p.horaTotal) + ' por hora';
    $('a-det-partes').textContent = 'Energia ' + moeda(p.energiaHora) + '/h + desgaste ' + moeda(p.desgasteHora) + '/h';
    var cmp = $('a-det-comparar');
    if (p.horaTotal <= 0) {
      cmp.textContent = 'Preencha os campos acima para calcular. Valor do modo Simples: ' + moeda(simples) + '/h.';
      cmp.className = 'alerta';
    } else if (simples > 0 && p.horaTotal < simples) {
      cmp.textContent = 'Fica abaixo do modo Simples (' + moeda(simples) + '/h). Confira antes de salvar.';
      cmp.className = 'alerta';
    } else {
      cmp.textContent = 'Modo Simples: ' + moeda(simples) + '/h.';
      cmp.className = '';
    }
  }
  [cHora, cPerda, cMin, cPot, cTarifa, cPrecoImp, cRevenda, cVida, cHorasAno, cManut].forEach(function (el) {
    el.addEventListener('input', ajudasConfig);
    selecionarAoFocar(el);
  });

  /* Lê o que está na tela de configurações (sem gravar) */
  function lerConfigTela() {
    var padrao = null;
    var materiais = linhas().map(function (d) {
      if (d.querySelector('.m-padrao').checked) padrao = d.dataset.id;
      return lerLinha(d);
    });
    var mats = C.lerMateriais({ materiais: materiais, materialPadrao: padrao });
    var cfg = {
      valorHora: C.lerNumero(cHora.value), perdaPct: C.lerNumero(cPerda.value), minimo: C.lerNumero(cMin.value),
      materiais: mats.materiais, materialPadrao: mats.materialPadrao, mostrarMaterial: cMostrar.checked,
      modoHora: modoEdicao, impressora: lerImpressoraTela(), negocio: lerNegocioTela(), arredondamento: arredEdicao
    };
    cfg.precoKg = C.precoKgMaterial(materialPorId(cfg, cfg.materialPadrao)); // compatibilidade com a v2
    return cfg;
  }
  /* Grava as configurações da tela e atualiza o orçamento. Retorna false se o aparelho não deixou gravar. */
  function gravarConfigTela() {
    config = lerConfigTela();
    var ok = salvarConfig(config);
    if (logoPendente !== undefined) {
      try {
        if (logoPendente) localStorage.setItem(CHAVE_LOGO, logoPendente); else localStorage.removeItem(CHAVE_LOGO);
      } catch (e) { ok = false; }
      logoPendente = undefined;
    }
    montarSeletor();
    atualizar();
    return ok;
  }
  $('form-config').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var ok = gravarConfigTela();
    sairConfig();
    avisar(ok ? 'Configurações salvas' : 'Salvo só até fechar o app');
  });
  /* Restaura hora (modo Simples), perda, preço mínimo e arredondamento (Exato); a lista de filamentos, o modo escolhido, os dados da impressora e os dados do negócio são mantidos */
  $('restaurar').addEventListener('click', function () {
    preencherCustos(C.PADROES);
    avisar('Padrões restaurados — toque em Salvar');
  });

  /* ---------- Backup, restauração e planilha ---------- */
  var CHAVE_BACKUP = CHAVE + '-backup';              // { em, qtd }: último backup feito (data e quantos orçamentos havia)
  var CHAVE_ANTES = CHAVE + '-antes-restaurar';      // { em, dados }: o estado de antes da última restauração (para desfazer)
  var CHAVE_CAT = CHAVE + '-catalogo';               // catálogo de peças recorrentes (também entra no backup)
  var emEntrega = false;                             // arquivo sendo compartilhado: evita toque duplo

  function lerJSON(chave) { try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { return null; } }
  function lerEstadoBackup() { var b = lerJSON(CHAVE_BACKUP); return b && typeof b.em === 'string' ? b : null; }
  function lerAntes() {
    var a = lerJSON(CHAVE_ANTES);
    return a && typeof a.em === 'string' && a.dados && typeof a.dados === 'object' ? a : null;
  }
  /* Tudo o que o backup guarda, como está neste aparelho agora (configurações já salvas; o que está só digitado na tela de Configurações não entra) */
  function dadosDoAparelho() {
    var cfg = lerJSON(CHAVE), cont = 0;
    try { cont = parseInt(localStorage.getItem(CHAVE_CONT) || '0', 10) || 0; } catch (e) {}
    return D.montarDados({ config: cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : config, logo: lerLogoSalvo(), contador: cont,
      registros: lerLista(), catalogo: D.lerCatalogo(lerJSON(CHAVE_CAT)), materialAtual: materialAtual || '' });
  }
  function gravarDados(d) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(d.config));
      if (d.logo) localStorage.setItem(CHAVE_LOGO, d.logo); else localStorage.removeItem(CHAVE_LOGO);
      localStorage.setItem(CHAVE_REG, JSON.stringify(d.registros));
      localStorage.setItem(CHAVE_CONT, String(d.contador));
      localStorage.setItem(CHAVE_CAT, JSON.stringify(d.catalogo));
      if (d.materialAtual) localStorage.setItem(CHAVE_MAT, d.materialAtual); else localStorage.removeItem(CHAVE_MAT);
      return true;
    } catch (e) { return false; }
  }
  /* Depois de restaurar ou desfazer: recarrega da memória do aparelho o que a tela mostra */
  function aplicarNaTela() {
    config = carregarConfig();
    try { materialAtual = localStorage.getItem(CHAVE_MAT); } catch (e) { materialAtual = null; }
    montarSeletor(); validarVinculo(); atualizar();
    preencherConfig(config); configInicial = JSON.stringify(lerConfigTela());
    desenharBackup();
  }
  function desenharBackup() {
    var d = D.descreverBackup(lerEstadoBackup(), lerLista(), new Date());
    $('backup-titulo').textContent = d.titulo;
    $('backup-detalhe').textContent = d.detalhe;
    $('backup-detalhe').hidden = !d.detalhe;
    $('backup-desfazer').hidden = !lerAntes();
  }

  function baixarArquivo(arq) {
    var url = URL.createObjectURL(arq), a = document.createElement('a');
    a.href = url; a.download = arq.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  /* Compartilhamento nativo (Drive, e-mail, WhatsApp); sem suporte a arquivo, baixa. Deve ser chamado direto do toque (o iPhone exige).
     Alguns apps do menu do iPhone não aceitam .json: se o aparelho recusar o tipo, tenta como texto simples antes de baixar.
     aoConcluir('enviou' | 'baixou' | 'cancelou'): quem cancela o compartilhamento não conta como backup feito. */
  function entregarArquivo(arq, aoConcluir) {
    var opcoes = [arq], alvo = null;
    if (arq.type !== 'text/plain') opcoes.push(new File([arq], arq.name, { type: 'text/plain' }));
    if (navigator.share && navigator.canShare) {
      for (var i = 0; i < opcoes.length && !alvo; i++) {
        try { if (navigator.canShare({ files: [opcoes[i]] })) alvo = opcoes[i]; } catch (e) {}
      }
    }
    emEntrega = true;
    if (!alvo) { baixarArquivo(arq); emEntrega = false; aoConcluir('baixou'); return; }
    navigator.share({ files: [alvo], title: arq.name }).then(function () { emEntrega = false; aoConcluir('enviou'); }, function (e) {
      emEntrega = false;
      if (e && e.name === 'AbortError') { aoConcluir('cancelou'); return; }
      baixarArquivo(arq); aoConcluir('baixou');
    });
  }

  function fazerBackup() {
    if (emEntrega) return;
    var agora = new Date(), dados = dadosDoAparelho();
    var texto = JSON.stringify(D.montarBackup(dados, { ambiente: AMB.nome, versaoApp: versaoEmUso, criadoEm: agora }));
    var arq = new File([texto], D.nomeArquivoBackup(agora), { type: 'application/json' });
    entregarArquivo(arq, function (como) {
      if (como === 'cancelou') return;
      try {
        localStorage.setItem(CHAVE_BACKUP, JSON.stringify({ em: agora.toISOString(), qtd: dados.registros.length }));
        localStorage.removeItem(CHAVE_ANTES);       // o "Desfazer restauração" vale até o próximo backup
      } catch (e) {}
      desenharBackup();
      if (!$('tela-hist').hidden) desenharHist();
      avisar(como === 'baixou' ? 'Backup salvo no aparelho' : 'Backup feito');
    });
  }
  $('backup-fazer').addEventListener('click', fazerBackup);
  $('hist-lembrete-fazer').addEventListener('click', fazerBackup);

  /* Planilha (CSV) com o histórico inteiro: uso interno, tem custo e lucro */
  $('backup-planilha').addEventListener('click', function () {
    if (emEntrega) return;
    var lista = lerLista(), agora = new Date();
    if (!lista.length) { avisar('Nenhum orçamento para exportar'); return; }
    var arq = new File([D.gerarCSV(lista, agora)], D.nomeArquivoCSV(agora), { type: 'text/csv' });
    entregarArquivo(arq, function (como) { if (como === 'baixou') avisar('Planilha salva no aparelho'); });
  });

  /* Restaurar: escolher o arquivo -> painel de confirmação com o resumo */
  var folhaRestaurar = $('folha-restaurar'), folhaDesfazer = $('folha-desfazer');
  var restauracao = null;      // backup lido, esperando a confirmação
  function lerTextoArquivo(arq) {
    if (arq.text) return arq.text();
    return new Promise(function (ok, erro) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result)); };
      r.onerror = function () { erro(r.error); };
      r.readAsText(arq);
    });
  }
  function nomeAmbiente(n) { return n === 'producao' ? 'produção' : n === 'teste' ? 'teste' : ''; }
  function abrirRestaurar(nome, res) {
    restauracao = null;
    var erro = $('restaurar-erro');
    ['restaurar-arquivo', 'restaurar-itens', 'restaurar-acontece', 'restaurar-desfazer', 'restaurar-sim'].forEach(function (id) { $(id).hidden = true; });
    $('restaurar-nao').textContent = 'Cancelar';
    erro.hidden = !!res.ok;
    if (!res.ok) {
      erro.textContent = D.ERROS_BACKUP[res.erro] || D.ERROS_BACKUP.invalido;
      $('restaurar-nao').textContent = 'Fechar';
      folhaRestaurar.hidden = false;
      return;
    }
    var b = res.backup, r = D.resumoBackup(b), atual = dadosDoAparelho();
    restauracao = b;
    $('restaurar-nome').textContent = nome;
    var quando = b.criadoEm ? D.dataBR(new Date(b.criadoEm)) + ' às ' + D.hora(b.criadoEm) : 'data desconhecida';
    var amb = nomeAmbiente(b.ambiente);
    $('restaurar-info').textContent = quando + (amb ? ' · ' + amb : '') + (b.versaoApp ? ' · versão ' + b.versaoApp : '');
    var itens = [
      r.filamentos ? 'Configurações e ' + r.filamentos + (r.filamentos === 1 ? ' filamento' : ' filamentos') : 'Configurações',
      r.temLogo ? 'Logo e dados do negócio' : (atual.logo ? 'Dados do negócio, sem logo (o logo deste celular será removido)' : 'Dados do negócio, sem logo'),
      r.pecas ? r.pecas + (r.pecas === 1 ? ' peça no catálogo' : ' peças no catálogo') : 'Nenhuma peça no catálogo',
      D.descreverOrcamentos(r)
    ];
    var ul = $('restaurar-itens'); ul.textContent = '';
    itens.forEach(function (t) {
      var li = document.createElement('li');
      li.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
      li.appendChild(document.createTextNode(t));
      ul.appendChild(li);
    });
    var proximo = D.restaurarDados(atual, b.dados).contador + 1;
    $('restaurar-explica').textContent = 'Substitui configurações, logo e catálogo deste celular. Junta os orçamentos, sem repetir. A numeração segue do maior número: o próximo será Nº ' + C.formatarNumero(proximo) + '.';
    var avisos = [];
    if (amb && AMB.nome && b.ambiente !== AMB.nome) avisos.push('Este backup foi feito no ambiente de ' + amb + ' e este app é o de ' + (nomeAmbiente(AMB.nome) || AMB.nome) + '.');
    if (b.versaoApp && versaoEmUso && C.compararVersoes(b.versaoApp, versaoEmUso) === 1) avisos.push('Feito numa versão mais nova (' + b.versaoApp + ') que a deste app (' + versaoEmUso + ').');
    $('restaurar-aviso').textContent = avisos.join(' ');
    $('restaurar-aviso').hidden = !avisos.length;
    ['restaurar-arquivo', 'restaurar-itens', 'restaurar-acontece', 'restaurar-desfazer', 'restaurar-sim'].forEach(function (id) { $(id).hidden = false; });
    folhaRestaurar.hidden = false;
  }
  function fecharRestaurar() { folhaRestaurar.hidden = true; restauracao = null; }
  function fecharPaineisBackup() { fecharRestaurar(); folhaDesfazer.hidden = true; }
  $('backup-restaurar').addEventListener('click', function () { $('backup-arq').click(); });
  $('backup-arq').addEventListener('change', function () {
    var arq = this.files && this.files[0];
    this.value = '';
    if (!arq) return;
    if (arq.size > D.MAX_ARQUIVO_BACKUP) { abrirRestaurar(arq.name, { ok: false, erro: 'grande' }); return; }
    lerTextoArquivo(arq).then(function (t) { abrirRestaurar(arq.name, D.lerBackup(t)); },
      function () { abrirRestaurar(arq.name, { ok: false, erro: 'invalido' }); });
  });
  $('restaurar-fechar').addEventListener('click', fecharRestaurar);
  $('restaurar-nao').addEventListener('click', fecharRestaurar);
  $('restaurar-fundo').addEventListener('click', fecharRestaurar);
  $('restaurar-sim').addEventListener('click', function () {
    if (!restauracao) return;
    var atual = dadosDoAparelho(), novo = D.restaurarDados(atual, restauracao.dados);
    try {
      localStorage.setItem(CHAVE_ANTES, JSON.stringify({ em: new Date().toISOString(), dados: atual }));
    } catch (e) { fecharRestaurar(); avisar('Não deu para guardar o estado atual: nada foi mudado'); return; }
    if (!gravarDados(novo)) {
      gravarDados(atual);
      try { localStorage.removeItem(CHAVE_ANTES); } catch (e) {}
      fecharRestaurar(); avisar('Não deu para restaurar: nada foi mudado'); return;
    }
    fecharRestaurar();
    aplicarNaTela();
    avisar('Backup restaurado');
  });

  /* Desfazer restauração (até o próximo backup ou restauração) */
  $('backup-desfazer').addEventListener('click', function () { folhaDesfazer.hidden = false; });
  function fecharDesfazer() { folhaDesfazer.hidden = true; }
  $('desfazer-nao').addEventListener('click', fecharDesfazer);
  $('desfazer-fundo').addEventListener('click', fecharDesfazer);
  $('desfazer-sim').addEventListener('click', function () {
    var antes = lerAntes();
    fecharDesfazer();
    if (!antes) { desenharBackup(); return; }
    var atual = dadosDoAparelho();
    if (!gravarDados(D.desfazerRestauracao(atual, antes))) { gravarDados(atual); avisar('Não deu para desfazer: nada foi mudado'); return; }
    try { localStorage.removeItem(CHAVE_ANTES); } catch (e) {}
    aplicarNaTela();
    avisar('Restauração desfeita');
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (!folhaDesfazer.hidden) fecharDesfazer(); else if (!folhaRestaurar.hidden) fecharRestaurar();
  });

  /* ---------- Histórico de orçamentos ---------- */
  var LEMBRETE_BACKUP_ATIVO = true;    // faixa de lembrete de backup no topo do histórico (20 ou mais orçamentos desde o último backup)
  var histPeriodo = '30', histSituacao = '', histBusca = '', histLimite = 50, histTimerBusca;
  var CHAVE_PERIODO = CHAVE + '-periodo';          // período escolhido (vale para a Lista e para o painel de vendas)
  try { var perSalvo = localStorage.getItem(CHAVE_PERIODO); if (['hoje', '7', '30', 'mes', 'tudo'].indexOf(perSalvo) !== -1) histPeriodo = perSalvo; } catch (e) {}
  var ROTULO_SIT = { enviado: 'Enviado', vencido: 'Vencido', aprovado: 'Aprovado', recusado: 'Recusado' };
  var detChave = null;                 // orçamento aberto no detalhe

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function desenharHist() {
    var todos = lerLista(), hoje = new Date();
    var espera = histSituacao === 'enviado' || histSituacao === 'vencido';   // fila de quem aguarda resposta: sem período, do mais antigo para o mais novo
    var lista = D.filtrarRegistros(todos, { periodo: histPeriodo, situacao: histSituacao, busca: histBusca, hoje: hoje });
    var res = D.resumir(lista);
    $('hist-n').textContent = String(res.qtd);
    $('hist-total').textContent = moeda(res.total);
    var apr = D.aprovadosDoPeriodo(todos, { periodo: histPeriodo, busca: histBusca, hoje: hoje });   // aprovados pela data da aprovação (a mesma regra do painel de vendas)
    $('hist-apr').textContent = String(apr.aprovados);
    $('hist-apr-valor').textContent = moeda(apr.totalAprovados);
    Array.prototype.forEach.call(document.querySelectorAll('[data-per]'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.per === histPeriodo));
    });
    var cont = D.contarSituacoes(todos, hoje);
    Array.prototype.forEach.call(document.querySelectorAll('[data-sit]'), function (b) {
      var st = b.dataset.sit;
      b.setAttribute('aria-pressed', String(st === histSituacao));
      b.textContent = ROTULO_SIT[st] + (cont[st] ? ' ' + cont[st] : '');
    });
    $('hist-per').hidden = espera;
    $('hist-resumo').hidden = !!histSituacao;
    var resSit = $('hist-sit-resumo');
    resSit.hidden = !histSituacao;
    if (histSituacao) {
      var ordem = espera ? ' · mais antigos primeiro' : '';
      resSit.textContent = res.qtd + (res.qtd === 1 ? ' orçamento' : ' orçamentos') + ' · ' + moeda(res.total) + ordem;
    }
    var ultimoBackup = lerEstadoBackup();
    var lemb = LEMBRETE_BACKUP_ATIVO ? D.precisaLembreteBackup(todos, ultimoBackup) : { mostrar: false, qtd: 0 };
    $('hist-lembrete').hidden = !lemb.mostrar;
    if (lemb.mostrar) $('hist-lembrete-txt').textContent = D.textoLembreteBackup(lemb.qtd, ultimoBackup);

    var box = $('hist-lista'); box.textContent = '';
    var vazio = $('hist-vazio');
    if (!lista.length) {
      vazio.hidden = false;
      vazio.textContent = !todos.length ? 'Nenhum orçamento enviado ainda. Cada envio, em texto ou imagem, aparece aqui.'
        : histBusca ? 'Nada encontrado para “' + histBusca + '”.'
        : histSituacao === 'enviado' ? 'Nenhum orçamento aguardando resposta.'
        : histSituacao === 'vencido' ? 'Nenhum orçamento vencido.'
        : histSituacao ? 'Nenhum orçamento ' + (histSituacao === 'aprovado' ? 'aprovado' : 'recusado') + ' neste período. Toque em Tudo para ver todos.'
        : 'Nenhum orçamento neste período. Toque em Tudo para ver todos.';
    } else { vazio.hidden = true; }
    var grupos = espera ? [{ rotulo: '', itens: lista.slice(0, histLimite) }] : D.agruparPorDia(lista.slice(0, histLimite), hoje);
    grupos.forEach(function (g) {
      if (g.rotulo) box.appendChild(el('div', 'dia', g.rotulo));
      var bloco = el('div', 'lista-hist');
      g.itens.forEach(function (r) {
        var it = el('button', 'item'); it.type = 'button';
        var meio = el('span', 'meio');
        meio.appendChild(el('span', 'sup', 'Nº ' + C.formatarNumero(r.n) + ' · ' + D.hora(r.ts) + ' · ' + (r.formato === 'imagem' ? 'Imagem' : 'Texto')));
        meio.appendChild(el('strong', r.cliente ? '' : 'sem', r.cliente || 'Sem cliente'));
        meio.appendChild(el('span', 'peca', D.descricaoLinha(r)));
        var dir = el('span', 'dir');
        dir.appendChild(el('b', '', moeda(r.total)));
        if (espera) {
          var te = D.textoEspera(r, hoje);
          dir.appendChild(el('span', 'pill ' + (te.antigo ? 'vencido' : 'enviado'), te.texto));
        } else {
          var st = D.situacao(r, hoje);
          dir.appendChild(el('span', 'pill ' + st, D.ROTULOS_SITUACAO[st]));
        }
        it.appendChild(meio); it.appendChild(dir);
        it.addEventListener('click', function () { abrirDetalhe(r); });
        bloco.appendChild(it);
      });
      box.appendChild(bloco);
    });
    $('hist-mais').hidden = lista.length <= histLimite;
  }
  $('hist-busca').addEventListener('input', function () {
    clearTimeout(histTimerBusca);
    histTimerBusca = setTimeout(function () { histBusca = $('hist-busca').value.trim(); histLimite = 50; desenharHist(); }, 150);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-per]'), function (b) {
    b.addEventListener('click', function () {
      histPeriodo = b.dataset.per; histLimite = 50;
      try { localStorage.setItem(CHAVE_PERIODO, histPeriodo); } catch (e) {}
      desenharHist();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-sit]'), function (b) {
    b.addEventListener('click', function () { histSituacao = histSituacao === b.dataset.sit ? '' : b.dataset.sit; histLimite = 50; desenharHist(); });
  });
  $('hist-mais').addEventListener('click', function () { histLimite += 50; desenharHist(); });

  /* Detalhe do orçamento */
  var folhaDet = $('folha-det'), folhaExcluir = $('folha-excluir');
  function regAberto() {
    var l = lerLista();
    for (var i = 0; i < l.length; i++) if (D.chaveRegistro(l[i]) === detChave) return l[i];
    return null;
  }
  function dm(iso) { var d = new Date(iso); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function desenharDetalhe(reg) {
    var hoje = new Date(), st = D.situacao(reg, hoje);
    $('det-numero').textContent = 'Nº ' + C.formatarNumero(reg.n);
    var sub = D.descreverEnvio(reg, hoje);
    if (reg.validadeAte) sub += ' · validade até ' + D.validadeCurta(reg.validadeAte, hoje);
    if (reg.reenvios > 0) sub += ' · reenviado ' + reg.reenvios + (reg.reenvios === 1 ? ' vez' : ' vezes');
    $('det-sub').textContent = sub;
    $('det-cliente').value = reg.cliente; $('det-peca').value = reg.descricao;
    $('det-qtd').textContent = reg.qtd > 1 ? reg.qtd + ' × ' + moeda(reg.valorPeca) : '1 peça';
    var mat = D.materialDoRegistro(reg);
    $('det-mat').textContent = [mat, reg.entrada ? 'margem ' + num(reg.entrada.margem) + '%' : ''].filter(Boolean).join(' · ');
    $('det-total').textContent = moeda(reg.total);
    $('det-custo').textContent = moeda(reg.custoTotal);
    $('det-lucro').textContent = moeda(reg.lucro);
    Array.prototype.forEach.call($('det-seg').querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.st === reg.status)); });
    $('det-st-info').textContent = st === 'vencido' ? 'Venceu em ' + D.validadeCurta(reg.validadeAte, hoje) + '. Marque Aprovado ou Recusado quando o cliente responder.'
      : reg.statusEm && reg.status !== 'enviado' ? D.ROTULOS_SITUACAO[reg.status] + ' em ' + dm(reg.statusEm) : '';
    $('det-antigo').hidden = !!reg.entrada;
    $('det-usar').disabled = !reg.entrada;
    $('det-catalogo').disabled = !reg.entrada;  // registro antigo, sem os dados da mesa, não vira peça
  }
  function abrirDetalhe(reg) {
    detChave = D.chaveRegistro(reg);
    desenharDetalhe(reg);
    folhaDet.hidden = false;
  }
  function guardarEdicao() {
    var reg = detChave && regAberto();
    if (!reg) return;
    var c = D.limparTexto($('det-cliente').value, 60), p = D.limparTexto($('det-peca').value, 120);
    if (c === reg.cliente && p === reg.descricao) return;
    gravarLista(D.atualizarRegistro(lerLista(), detChave, { cliente: c, descricao: p }));
    desenharHist();
  }
  function fecharDetalhe() { guardarEdicao(); folhaDet.hidden = true; detChave = null; }
  function fecharSheetsHist() { folhaDet.hidden = true; folhaExcluir.hidden = true; detChave = null; }
  $('det-fechar').addEventListener('click', fecharDetalhe);
  $('det-fundo').addEventListener('click', fecharDetalhe);
  ['det-cliente', 'det-peca'].forEach(function (id) { $(id).addEventListener('change', guardarEdicao); selecionarAoFocar($(id)); });
  Array.prototype.forEach.call($('det-seg').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      var reg = regAberto();
      if (!reg || reg.status === b.dataset.st) return;
      guardarEdicao();
      if (gravarLista(D.atualizarRegistro(lerLista(), detChave, { status: b.dataset.st }))) { desenharDetalhe(regAberto()); desenharHist(); }
    });
  });
  $('det-reenviar').addEventListener('click', function () {
    guardarEdicao();
    var reg = regAberto(); if (!reg) return;
    folhaDet.hidden = true; detChave = null;
    abrirFolha(reg);
  });
  $('det-usar').addEventListener('click', function () {
    guardarEdicao();
    var reg = regAberto(); if (!reg || !reg.entrada) return;
    fecharSheetsHist();
    usarDeNovo(reg);
  });
  $('det-catalogo').addEventListener('click', function () {
    guardarEdicao();
    var reg = regAberto(); if (!reg || !reg.entrada) return;
    fecharSheetsHist();
    var calc = calcularEntrada(reg.entrada);
    abrirSalvar({ entrada: reg.entrada, precoRef: reg.valorPeca, precoRefEm: reg.ts, precoHoje: calc.r.valorUnitario, ligar: false },
      D.limparTexto(reg.descricao, D.NOME_PECA_MAX));
  });
  $('det-excluir').addEventListener('click', function () {
    var reg = regAberto(); if (!reg) return;
    $('excluir-txt').textContent = 'O orçamento Nº ' + C.formatarNumero(reg.n) + ' sai do histórico. O número dele não volta: o próximo orçamento continua de onde parou.';
    folhaExcluir.hidden = false;
  });
  function fecharExcluir() { folhaExcluir.hidden = true; }
  $('excluir-nao').addEventListener('click', fecharExcluir);
  $('excluir-fundo').addEventListener('click', fecharExcluir);
  $('excluir-sim').addEventListener('click', function () {
    if (!detChave) return;
    if (gravarLista(D.excluirRegistro(lerLista(), detChave))) { fecharSheetsHist(); desenharHist(); avisar('Orçamento excluído'); }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (!folhaExcluir.hidden) fecharExcluir(); else if (!folhaDet.hidden) fecharDetalhe();
  });

  /* Usar de novo: devolve à tela principal os dados da mesa daquele orçamento (o próximo envio ganha número novo) */
  function usarDeNovo(reg) {
    var c = D.entradaParaCampos(reg.entrada);
    if (!c) return;
    var aviso = preencherTela(c);
    exato = {};
    var peca = reg.catalogoId ? D.acharPeca(lerCatalogo(), reg.catalogoId) : null;
    vinculo = peca ? { id: peca.id, nome: peca.nome } : null;
    atualizar();
    sairConfig();
    avisar(aviso || 'Dados do orçamento Nº ' + C.formatarNumero(reg.n) + ' na tela');
  }
  /* Põe na tela principal os campos de uma entrada (c = D.entradaParaCampos). Devolve um aviso, se algum filamento não existe mais. */
  function preencherTela(c) {
    var aviso = '';
    ePeso.value = c.peso; eTempo.value = c.tempo; eQtd.value = c.qtd; eExtras.value = c.extras; eMargem.value = c.margem;
    outraAberta = c.outra;
    if (c.multicor) {
      multicorAtivo = true; purgaTxt = c.purga;
      cores = c.cores.map(function (x) { return { id: materialPorId(config, x.id) ? x.id : null, g: x.g }; });
      if (c.cores.some(function (x) { return !materialPorId(config, x.id); })) aviso = 'Algum filamento não existe mais: usei o filamento atual nessas cores';
    } else {
      multicorAtivo = false; purgaTxt = '';
      var m = materialPorId(config, c.materialId);
      if (m) { materialAtual = m.id; try { localStorage.setItem(CHAVE_MAT, materialAtual); } catch (e) {} }
      else if (c.materialNome) aviso = 'O filamento “' + c.materialNome + '” não existe mais: usei ' + filamentoAtual().nome;
    }
    montarSeletor(); aplicarModoMulticor();
    return aviso;
  }

  /* ---------- Catálogo de peças recorrentes ---------- */
  var vinculo = null;                  // peça do catálogo ligada ao orçamento da tela: { id, nome }
  function lerCatalogo() { return D.lerCatalogo(lerJSON(CHAVE_CAT)); }
  function gravarCatalogo(lista) {
    try { localStorage.setItem(CHAVE_CAT, JSON.stringify(lista)); return true; } catch (e) { avisar('Não deu para salvar'); return false; }
  }
  function pecaVinculada() { return vinculo ? D.acharPeca(lerCatalogo(), vinculo.id) : null; }
  /* Se a peça ligada foi excluída (ou o backup trocou o catálogo), desliga; senão pega o nome de hoje */
  function validarVinculo() {
    var p = pecaVinculada();
    vinculo = p ? { id: p.id, nome: p.nome } : null;
    desenharVinculo();
  }
  /* Título do cartão: link "Catálogo" ou selo com o nome da peça, a quantidade e o × */
  function desenharVinculo() {
    var cheio = !!vinculo;
    $('cat-link').classList.toggle('cheio', cheio);
    $('cat-desvincular').hidden = !cheio;
    $('cat-link-txt').textContent = cheio ? vinculo.nome + ' · ' + C.lerQuantidade(eQtd.value) : 'Catálogo';
  }
  $('cat-desvincular').addEventListener('click', function () { vinculo = null; desenharVinculo(); });

  /* Cálculo de uma entrada com os custos de hoje. Filamento que não existe mais: usa o padrão e avisa. */
  function calcularEntrada(e) {
    var padrao = materialPorId(config, config.materialPadrao) || config.materiais[0], faltando = [];
    function fil(id, nome, avisar) {
      var m = materialPorId(config, id);
      if (m) return m;
      if (avisar && nome && faltando.indexOf(nome) < 0) faltando.push(nome);
      return padrao;
    }
    var multi = !!(e.cores && e.cores.length);
    var f0 = fil(e.materialId, e.materialNome, !multi);
    var cc = multi ? e.cores.map(function (c) { var f = fil(c.materialId, c.nome, true); return { gramas: c.gramas, precoKg: C.precoKgMaterial(f), nome: f.nome }; }) : null;
    var imp = config.modoHora === 'detalhado' ? C.calcularImpressora(config.impressora) : null;
    var r = C.calcular({ peso: e.peso, tempo: e.tempoMin, cores: cc, purgaG: multi ? e.purgaG : 0, margemPct: e.margem, qtd: e.qtd, extrasPeca: e.extras,
      precoKg: C.precoKgMaterial(f0), valorHora: config.valorHora, perdaPct: config.perdaPct, minimo: config.minimo,
      energiaHora: imp ? imp.energiaHora : undefined, desgasteHora: imp ? imp.desgasteHora : undefined, arredondar: config.arredondamento });
    var aviso = '';
    if (faltando.length === 1) aviso = 'Filamento ' + faltando[0] + ' foi excluído; usando ' + padrao.nome;
    else if (faltando.length > 1) aviso = 'Filamentos ' + faltando.join(', ') + ' foram excluídos; usando ' + padrao.nome;
    return { r: r, aviso: aviso };
  }

  /* Tela do catálogo */
  var catTimerBusca;
  function fecharPaineisCat() { ['folha-cat-salvar', 'folha-cat-pedido', 'folha-cat-editar'].forEach(function (id) { $(id).hidden = true; }); salvando = null; pedido = null; editando = null; }
  function desenharCat() {
    var todos = lerCatalogo(), busca = $('cat-busca').value.trim(), lista = D.filtrarCatalogo(todos, busca);
    var ok = !!(ultimoOrcamento && ultimoOrcamento.valorCobrar > 0);
    $('cat-salvar-atual').disabled = !ok;
    $('cat-atual-txt').textContent = ok ? D.descreverEntrada(entradaAtual()) + ' · ' + moeda(ultimoOrcamento.valorUnitario) + ' por peça' : 'Preencha peso e tempo na calculadora primeiro';
    $('cat-busca-caixa').hidden = todos.length === 0;
    var box = $('cat-lista'); box.textContent = '';
    if (lista.length) {
      var bloco = el('div', 'lista-hist');
      lista.forEach(function (p) {
        var c = calcularEntrada(p.entrada), unit = c.r.valorUnitario;
        var it = el('button', 'cat'); it.type = 'button';
        var topo = el('div', 'topo'); topo.appendChild(el('strong', '', p.nome));
        var b = el('b', '', moeda(unit)); b.appendChild(el('small', '', ' /peça')); topo.appendChild(b);
        var info = el('div', 'info');
        var mat = D.materialDoRegistro({ entrada: p.entrada });
        info.appendChild(el('span', '', [p.entrada.qtd + ' por mesa', mat, p.usadoEm ? 'usado ' + dm(p.usadoEm) : 'salvo ' + dm(p.precoRefEm)].filter(Boolean).join(' · ')));
        if (p.precoRef > 0) {
          var cmp = D.compararPreco(unit, p.precoRef);
          info.appendChild(el('span', 'var ' + cmp.tipo, cmp.tipo === 'igual' ? '= último envio'
            : (cmp.tipo === 'sobe' ? '↑ ' : '↓ ') + moeda(cmp.diff) + (p.precoRefEm ? ' desde ' + dm(p.precoRefEm) : '')));
        }
        it.appendChild(topo); it.appendChild(info);
        if (c.aviso) it.appendChild(el('p', 'alerta', c.aviso));
        it.addEventListener('click', function () { abrirPedido(p.id); });
        bloco.appendChild(it);
      });
      box.appendChild(bloco);
    }
    var vazio = $('cat-vazio');
    vazio.hidden = lista.length > 0;
    vazio.textContent = todos.length === 0 ? 'Nenhuma peça salva. Calcule uma peça e toque em “Salvar o orçamento atual”.' : 'Nenhuma peça encontrada.';
    $('cat-nota').hidden = lista.length === 0;
  }
  $('cat-busca').addEventListener('input', function () { clearTimeout(catTimerBusca); catTimerBusca = setTimeout(desenharCat, 150); });

  /* Salvar no catálogo (da calculadora ou do detalhe do histórico) */
  var salvando = null;     // { entrada, precoRef, precoRefEm, precoHoje, ligar, confirmado: nome normalizado já confirmado para substituir }
  function abrirSalvar(info, nomeSugerido) {
    salvando = info; salvando.confirmado = '';
    $('cs-nome').value = nomeSugerido || ''; $('cs-desc').value = '';
    $('cs-resumo').textContent = D.descreverEntrada(info.entrada);
    $('cs-preco').textContent = 'Hoje ' + moeda(info.precoHoje) + ' por peça';
    textoBotaoSalvar();
    $('cs-aviso').hidden = true;
    $('folha-cat-salvar').hidden = false;
    $('cs-nome').focus();
  }
  function textoBotaoSalvar() {
    var ex = salvando && D.pecaComNome(lerCatalogo(), $('cs-nome').value);
    var confirmando = ex && salvando.confirmado === D.normalizarBusca(ex.nome);
    $('cs-salvar').textContent = ex ? 'Substituir “' + ex.nome + '”' : 'Salvar';
    if (!ex) { salvando && (salvando.confirmado = ''); $('cs-aviso').hidden = true; }
    return confirmando;
  }
  $('cs-nome').addEventListener('input', textoBotaoSalvar);
  selecionarAoFocar($('cs-nome'));
  $('cat-salvar-atual').addEventListener('click', function () {
    if (!ultimoOrcamento || ultimoOrcamento.valorCobrar <= 0) return;
    abrirSalvar({ entrada: entradaAtual(), precoRef: ultimoOrcamento.valorUnitario, precoHoje: ultimoOrcamento.valorUnitario, ligar: true },
      vinculo ? vinculo.nome : '');
  });
  $('cs-salvar').addEventListener('click', function () {
    if (!salvando) return;
    var nome = D.limparTexto($('cs-nome').value, D.NOME_PECA_MAX);
    if (!nome) { $('cs-aviso').textContent = 'Dê um nome para a peça.'; $('cs-aviso').hidden = false; $('cs-nome').focus(); return; }
    var ex = D.pecaComNome(lerCatalogo(), nome);
    if (ex && salvando.confirmado !== D.normalizarBusca(ex.nome)) {     // primeiro toque: pergunta; segundo toque: substitui
      salvando.confirmado = D.normalizarBusca(ex.nome);
      $('cs-aviso').textContent = 'Já existe “' + ex.nome + '”. Toque de novo para substituir.'; $('cs-aviso').hidden = false;
      return;
    }
    var res = D.salvarPeca(lerCatalogo(), { nome: nome, descricao: $('cs-desc').value, entrada: salvando.entrada, precoRef: salvando.precoRef, precoRefEm: salvando.precoRefEm }, !!ex);
    if (!res.ok) {
      $('cs-aviso').textContent = res.erro === 'cheio' ? 'O catálogo está cheio (' + D.MAX_CATALOGO + ' peças). Exclua uma peça para salvar outra.' : 'Não foi possível salvar.';
      $('cs-aviso').hidden = false; return;
    }
    if (!gravarCatalogo(res.lista)) return;
    if (salvando.ligar) { vinculo = { id: res.peca.id, nome: res.peca.nome }; desenharVinculo(); }
    else if (vinculo && vinculo.id === res.peca.id) { vinculo.nome = res.peca.nome; desenharVinculo(); }
    var veioDoCat = !$('tela-cat').hidden;
    $('folha-cat-salvar').hidden = true; salvando = null;
    if (veioDoCat) desenharCat();
    avisar(res.substituiu ? 'Peça substituída no catálogo' : 'Peça salva no catálogo');
  });
  function fecharSalvar() { $('folha-cat-salvar').hidden = true; salvando = null; }
  $('cs-fechar').addEventListener('click', fecharSalvar);
  $('cs-fundo').addEventListener('click', fecharSalvar);

  /* Pedido: quantidade, total ao vivo e os três caminhos (enviar, abrir na calculadora, editar) */
  var pedido = null;       // { id }
  function qtdPedido() { return C.lerQuantidade($('cp-qtd').value); }
  function abrirPedido(id) {
    var p = D.acharPeca(lerCatalogo(), id); if (!p) return;
    pedido = { id: id };
    $('cp-titulo').textContent = p.nome;
    $('cp-sub').textContent = D.descreverEntrada(p.entrada);
    $('cp-qtd').value = String(p.entrada.qtd);
    var box = $('cp-atalhos'); box.textContent = '';
    D.atalhosPedido(p.entrada).forEach(function (n) {
      var b = el('button', 'chip'); b.type = 'button';
      b.appendChild(el('span', '', String(n)));
      var rot = p.entrada.qtd > 1 && n === p.entrada.qtd ? '1 mesa' : p.entrada.qtd > 1 && n === p.entrada.qtd * 2 ? '2 mesas' : '';
      if (rot) b.appendChild(el('small', '', rot));
      b.addEventListener('click', function () { $('cp-qtd').value = String(n); desenharPedido(); });
      box.appendChild(b);
    });
    $('folha-cat-pedido').hidden = false;
    desenharPedido();
  }
  function desenharPedido() {
    var p = pedido && D.acharPeca(lerCatalogo(), pedido.id); if (!p) return;
    var q = qtdPedido(), c = calcularEntrada(D.entradaDoPedido(p.entrada, q));
    $('cp-total').textContent = moeda(c.r.valorCobrar);
    $('cp-ref').textContent = moeda(c.r.valorUnitario) + ' cada' + (p.precoRef > 0 ? ' · último envio: ' + moeda(p.precoRef) + (p.precoRefEm ? ' em ' + dm(p.precoRefEm) : '') : '');
    $('cp-alerta').textContent = c.aviso; $('cp-alerta').hidden = !c.aviso;
    Array.prototype.forEach.call($('cp-atalhos').children, function (b) { b.setAttribute('aria-pressed', String(b.firstChild.textContent === String(q))); });
  }
  $('cp-qtd').addEventListener('input', desenharPedido);
  selecionarAoFocar($('cp-qtd'));
  $('cp-menos').addEventListener('click', function () { $('cp-qtd').value = String(Math.max(1, qtdPedido() - 1)); desenharPedido(); });
  $('cp-mais').addEventListener('click', function () { $('cp-qtd').value = String(Math.min(9999, qtdPedido() + 1)); desenharPedido(); });
  function fecharPedido() { $('folha-cat-pedido').hidden = true; pedido = null; }
  $('cp-fechar').addEventListener('click', fecharPedido);
  $('cp-fundo').addEventListener('click', fecharPedido);

  /* Põe o pedido na tela principal (peso e tempo proporcionais ficam exatos na conta) e liga a peça ao orçamento */
  function pedidoNaTela(p, q) {
    var e = D.entradaDoPedido(p.entrada, q), c = D.entradaParaCampos(e);
    function g2(n) { return D.textoCampo(Math.round(n * 100) / 100); }
    var ex = {};
    if (!c.multicor) { c.peso = g2(e.peso); ex.peso = { txt: c.peso, val: e.peso }; }
    c.tempo = D.textoTempo(Math.round(e.tempoMin)); ex.tempo = { txt: c.tempo, val: e.tempoMin };
    if (c.multicor) {
      c.cores.forEach(function (x, i) { x.g = g2(e.cores[i].gramas); ex['c' + i] = { txt: x.g, val: e.cores[i].gramas }; });
      c.purga = g2(e.purgaG); ex.purga = { txt: c.purga, val: e.purgaG };
    }
    var aviso = preencherTela(c);
    exato = ex;
    vinculo = { id: p.id, nome: p.nome };
    atualizar();
    return aviso;
  }
  $('cp-abrir').addEventListener('click', function () {
    var p = pedido && D.acharPeca(lerCatalogo(), pedido.id); if (!p) return;
    var aviso = pedidoNaTela(p, qtdPedido());
    fecharPedido(); sairConfig();
    avisar(aviso || 'Peça “' + (p.nome.length > 30 ? p.nome.slice(0, 29).trim() + '…' : p.nome) + '” na tela');   // o aviso é estreito: nome de até 120 letras vai abreviado
  });
  $('cp-enviar').addEventListener('click', function () {
    var p = pedido && D.acharPeca(lerCatalogo(), pedido.id); if (!p) return;
    pedidoNaTela(p, qtdPedido());
    fecharPedido(); sairConfig();
    abrirFolha(null);                // direto no painel de envio, com a descrição da peça já preenchida
  });

  /* Editar: nome, descrição e excluir */
  var editando = null;     // { id, excluir: true quando já pediu a confirmação }
  $('cp-editar').addEventListener('click', function () {
    var p = pedido && D.acharPeca(lerCatalogo(), pedido.id); if (!p) return;
    fecharPedido();
    editando = { id: p.id, excluir: false };
    $('ce-nome').value = p.nome; $('ce-desc').value = p.descricao;
    $('ce-aviso').hidden = true; $('ce-excluir').textContent = 'Excluir peça';
    $('folha-cat-editar').hidden = false;
  });
  selecionarAoFocar($('ce-nome'));
  $('ce-salvar').addEventListener('click', function () {
    if (!editando) return;
    var res = D.editarPeca(lerCatalogo(), editando.id, { nome: $('ce-nome').value, descricao: $('ce-desc').value });
    if (!res.ok) {
      $('ce-aviso').textContent = res.erro === 'existe' ? 'Já existe outra peça com esse nome.' : 'Dê um nome para a peça.';
      $('ce-aviso').hidden = false; return;
    }
    if (!gravarCatalogo(res.lista)) return;
    $('folha-cat-editar').hidden = true; editando = null;
    validarVinculo(); desenharCat(); avisar('Peça atualizada');
  });
  $('ce-excluir').addEventListener('click', function () {
    if (!editando) return;
    if (!editando.excluir) {      // primeiro toque pede a confirmação
      editando.excluir = true; $('ce-excluir').textContent = 'Toque de novo para excluir';
      $('ce-aviso').textContent = 'A peça sai do catálogo. Os orçamentos já enviados continuam no histórico.'; $('ce-aviso').hidden = false;
      return;
    }
    if (!gravarCatalogo(D.excluirPeca(lerCatalogo(), editando.id))) return;
    $('folha-cat-editar').hidden = true; editando = null;
    validarVinculo(); desenharCat(); avisar('Peça excluída');
  });
  function fecharEditar() { $('folha-cat-editar').hidden = true; editando = null; }
  $('ce-fechar').addEventListener('click', fecharEditar);
  $('ce-fundo').addEventListener('click', fecharEditar);
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (!$('folha-cat-editar').hidden) fecharEditar(); else if (!$('folha-cat-salvar').hidden) fecharSalvar(); else if (!$('folha-cat-pedido').hidden) fecharPedido();
  });

  /* ---------- Navegação (o botão voltar do Android funciona) ---------- */
  function telaDaRota() { return location.hash === '#config' ? 'config' : location.hash === '#historico' ? 'hist' : location.hash === '#catalogo' ? 'cat' : 'calc'; }
  function mostrar(tela) {
    $('tela-calc').hidden = tela !== 'calc';
    $('tela-config').hidden = tela !== 'config';
    $('tela-hist').hidden = tela !== 'hist';
    $('tela-cat').hidden = tela !== 'cat';
    if (tela === 'config') { preencherConfig(config); configInicial = JSON.stringify(lerConfigTela()); desenharBackup(); }
    else fecharPaineisBackup();
    if (tela === 'hist') desenharHist(); else fecharSheetsHist();
    if (tela === 'cat') { $('cat-busca').value = ''; desenharCat(); } else fecharPaineisCat();
    desenharVersao();
    window.scrollTo(0, 0);
  }
  function rota() {
    var t = telaDaRota();
    if (t === 'calc') veioDaCalc = false;
    mostrar(t);
  }
  window.addEventListener('hashchange', rota);
  var veioDaCalc = false;
  function sairConfig() {
    if (veioDaCalc) { veioDaCalc = false; history.back(); }
    else { history.replaceState(null, '', location.pathname + location.search); rota(); }
  }
  $('ir-config').addEventListener('click', function () { veioDaCalc = true; location.hash = 'config'; });
  $('ir-hist').addEventListener('click', function () { veioDaCalc = true; histSituacao = ''; location.hash = 'historico'; });
  $('voltar').addEventListener('click', sairConfig);
  $('hist-voltar').addEventListener('click', sairConfig);
  $('cat-voltar').addEventListener('click', sairConfig);
  $('cat-abrir').addEventListener('click', function () { veioDaCalc = true; location.hash = 'catalogo'; });

  /* ---------- Convite para instalar ---------- */
  var instalado = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var dispensado = false;
  try { dispensado = localStorage.getItem(CHAVE + '-instalar') === 'nao'; } catch (e) {}
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var pedidoInstalar = null;

  function mostrarConvite(texto, comBotao) {
    if (instalado || dispensado) return;
    $('instalar-texto').textContent = texto;
    $('instalar-btn').hidden = !comBotao;
    $('instalar').hidden = false;
  }
  if (ios) mostrarConvite('Para instalar: toque em Compartilhar e depois em “Adicionar à Tela de Início”.', false);
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault(); pedidoInstalar = ev;
    mostrarConvite('Instale o orçamentador na tela inicial para usar sem internet.', true);
  });
  $('instalar-btn').addEventListener('click', function () {
    if (!pedidoInstalar) return;
    pedidoInstalar.prompt();
    pedidoInstalar.userChoice.then(function () { pedidoInstalar = null; $('instalar').hidden = true; });
  });
  $('instalar-fechar').addEventListener('click', function () {
    $('instalar').hidden = true;
    try { localStorage.setItem(CHAVE + '-instalar', 'nao'); } catch (e) {}
  });
  window.addEventListener('appinstalled', function () { $('instalar').hidden = true; });

  /* ---------- Versão e aviso de nova versão ---------- */
  /* Novidades por MAJOR.MINOR (o sufixo -teste.N do staging é ignorado na busca). */
  var NOVIDADES = { '0.4': 'histórico, backup e catálogo' };
  var CHAVE_VISTA = CHAVE + '-versao-vista';
  var CHAVE_RETOMAR = CHAVE + '-retomar';
  var versaoEmUso = C.lerVersao(AMB.versao) ? AMB.versao : '';   // lida de config-ambiente.js (a que esta tela carregou)
  var versaoNova = null;      // null = nada pendente · texto = versão pronta ('' = não deu para saber o número)
  var faixaFechada = false;   // o × esconde a faixa até a próxima abertura

  function desenharVersao() {
    var pendente = versaoNova !== null;
    var link = $('versao-atualizar');
    $('versao-uso').textContent = pendente ? 'versão ' + versaoEmUso + ' ·'
      : 'Orçamento 3DI' + (versaoEmUso ? ' · versão ' + versaoEmUso : '');
    link.hidden = !pendente;
    link.textContent = (versaoNova ? versaoNova + ' pronta' : 'Nova versão pronta') + ' — Atualizar';
    $('faixa-titulo').textContent = versaoNova ? 'Versão ' + versaoNova + ' pronta' : 'Nova versão pronta';
    /* Em Configurações a faixa fica escondida: a linha do cabeçalho já tem o link */
    $('faixa-versao').hidden = !pendente || faixaFechada || !$('tela-config').hidden;
  }

  /* O que foi digitado na tela principal, guardado só até a página recarregar */
  function estadoParaRetomar() {
    return { peso: ePeso.value, tempo: eTempo.value, qtd: eQtd.value, extras: eExtras.value, margem: eMargem.value, outra: outraAberta,
      multicor: multicorAtivo, cores: cores.map(function (c) { return { id: c.id, g: c.g }; }), purga: purgaTxt,
      vinculo: vinculo ? { id: vinculo.id, nome: vinculo.nome } : null };
  }
  function retomarCampos() {
    var d = null;
    try { d = JSON.parse(sessionStorage.getItem(CHAVE_RETOMAR) || 'null'); sessionStorage.removeItem(CHAVE_RETOMAR); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') return;
    function txt(v) { return typeof v === 'string' ? v.slice(0, 40) : ''; }
    ePeso.value = txt(d.peso); eTempo.value = txt(d.tempo); eQtd.value = txt(d.qtd) || '1'; eExtras.value = txt(d.extras);
    eMargem.value = txt(d.margem) || String(C.PADROES.margemPct);
    outraAberta = d.outra === true;
    purgaTxt = txt(d.purga);
    if (d.vinculo && typeof d.vinculo.id === 'string' && d.vinculo.id) vinculo = { id: txt(d.vinculo.id), nome: D.limparTexto(d.vinculo.nome, D.NOME_PECA_MAX) };
    if (d.multicor === true && Array.isArray(d.cores) && d.cores.length) {
      multicorAtivo = true;
      cores = d.cores.slice(0, C.MAX_CORES).map(function (c) { return { id: c && typeof c.id === 'string' ? c.id : null, g: txt(c && c.g) }; });
    }
  }
  function atualizarAgora() {
    try { sessionStorage.setItem(CHAVE_RETOMAR, JSON.stringify(estadoParaRetomar())); } catch (e) {}
    history.replaceState(null, '', location.pathname + location.search);   // volta para a tela principal
    location.reload();
  }
  $('faixa-atualizar').addEventListener('click', atualizarAgora);
  $('faixa-fechar').addEventListener('click', function () { faixaFechada = true; desenharVersao(); });

  /* Link "pronta — Atualizar" em Configurações: com alteração não salva, pergunta antes */
  var folhaAtualizar = $('folha-atualizar');
  function configAlterada() { return logoPendente !== undefined || JSON.stringify(lerConfigTela()) !== configInicial; }
  $('versao-atualizar').addEventListener('click', function () {
    if (configAlterada()) folhaAtualizar.hidden = false; else atualizarAgora();
  });
  $('atualizar-cancelar').addEventListener('click', function () { folhaAtualizar.hidden = true; });
  $('atualizar-fundo').addEventListener('click', function () { folhaAtualizar.hidden = true; });
  $('atualizar-salvar').addEventListener('click', function () {
    if (!gravarConfigTela()) { folhaAtualizar.hidden = true; avisar('Não deu para salvar: não atualizei'); return; }
    atualizarAgora();
  });

  /* Pergunta ao service worker novo qual é a versão dele (1 s de espera; sem resposta, a faixa não cita o número) */
  function perguntarVersao(sw) {
    return new Promise(function (resolver) {
      if (!sw || typeof MessageChannel === 'undefined') return resolver('');
      var canal = new MessageChannel(), fim = false;
      function terminar(v) { if (fim) return; fim = true; clearTimeout(espera); resolver(v); }
      var espera = setTimeout(function () { terminar(''); }, 1000);
      canal.port1.onmessage = function (ev) { var v = ev.data && ev.data.versao; terminar(C.lerVersao(v) ? v : ''); };
      try { sw.postMessage({ tipo: 'versao' }, [canal.port2]); } catch (e) { terminar(''); }
    });
  }

  /* Aviso depois de atualizar: compara a versão em uso com a última vista neste aparelho (primeira abertura não mostra nada) */
  var timerAvisoVersao;
  function avisarSeAtualizou() {
    if (!versaoEmUso) return;
    var vista = null;
    try { vista = localStorage.getItem(CHAVE_VISTA); } catch (e) {}
    var aviso = vista ? C.avisoAtualizado(versaoEmUso, vista, NOVIDADES) : null;
    if (!vista || C.compararVersoes(versaoEmUso, vista) !== -1) {      // não regrava se a versão em uso for mais antiga que a vista
      try { localStorage.setItem(CHAVE_VISTA, versaoEmUso); } catch (e) {}
    }
    if (!aviso) return;
    var a = $('aviso-versao');
    $('aviso-versao-titulo').textContent = aviso.titulo;
    $('aviso-versao-detalhe').textContent = aviso.detalhe;
    a.classList.add('ver');
    clearTimeout(timerAvisoVersao); timerAvisoVersao = setTimeout(function () { a.classList.remove('ver'); }, 5000);
  }

  /* ---------- Funcionamento offline ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); });

    /* Versão nova pronta: o service worker novo assume a página (controllerchange). Na primeira instalação
       não havia versão controlando a página, então não avisa. Nunca recarrega sozinho. */
    var jaControlada = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!jaControlada) { jaControlada = true; return; }
      perguntarVersao(navigator.serviceWorker.controller).then(function (v) {
        if (v && v === versaoEmUso) return;      // nada de novo
        versaoNova = v; faixaFechada = false; desenharVersao();
      });
    });

    /* O app instalado no iPhone fica dias em memória: ao voltar para ele, procura atualização (no máximo a cada 30 min) */
    var ultimaProcura = Date.now();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible' || Date.now() - ultimaProcura < 30 * 60 * 1000) return;
      ultimaProcura = Date.now();
      navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update(); }).catch(function () {});
    });
  }

  /* ---------- Início ---------- */
  retomarCampos();            // devolve o que estava na tela antes de "Atualizar" (uma única vez)
  validarVinculo();           // a peça do catálogo ainda existe? (o nome mostrado vem do catálogo)
  montarSeletor();
  if (multicorAtivo) aplicarModoMulticor();
  rota();
  atualizar();
  avisarSeAtualizou();
})();
