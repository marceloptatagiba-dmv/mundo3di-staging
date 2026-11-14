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

  /* Peça multicor: só em memória (não grava no aparelho). cores = [{ id do filamento, g texto }] */
  var MULTI = '__multicor';
  var multicorAtivo = false;
  var cores = [{ id: null, g: '' }, { id: null, g: '' }];
  var purgaTxt = '';
  function coresCalculo() {
    return cores.map(function (c) {
      var f = materialPorId(config, c.id) || filamentoAtual();
      return { gramas: C.lerNumero(c.g), precoKg: C.precoKgMaterial(f), nome: f.nome };
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
    var peso = C.lerNumero(ePeso.value);
    var tempo = C.lerTempo(eTempo.value);
    var margem = C.lerNumero(eMargem.value);
    var qtd = C.lerQuantidade(eQtd.value);
    var extrasPeca = C.lerNumero(eExtras.value);
    var fil = filamentoAtual();
    var precoKg = C.precoKgMaterial(fil);
    var imp = config.modoHora === 'detalhado' ? C.calcularImpressora(config.impressora) : null;
    var cc = multicorAtivo ? coresCalculo() : null;
    var r = C.calcular({ peso: peso, tempo: tempo, cores: cc, purgaG: multicorAtivo ? C.lerNumero(purgaTxt) : 0, margemPct: margem, qtd: qtd, extrasPeca: extrasPeca,
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
    outraAberta = false;
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
  /* Grava o envio: avança o contador e guarda o registro com data e hora. Chamado só quando o envio aconteceu. */
  function registrarEnvio(numero, formato, extra) {
    var reg = C.novoRegistro(ultimoOrcamento, { numero: numero, formato: formato, material: extra.material, cliente: extra.cliente, descricao: extra.descricao });
    try {
      localStorage.setItem(CHAVE_CONT, String(numero));
      var lista = JSON.parse(localStorage.getItem(CHAVE_REG) || '[]');
      localStorage.setItem(CHAVE_REG, JSON.stringify(C.adicionarRegistro(lista, reg, C.MAX_REGISTROS)));
    } catch (e) { /* armazenamento indisponível: o envio continua valendo, só não fica registrado */ }
  }

  /* ---------- Enviar orçamento: painel com Texto ou Imagem ---------- */
  var folha = $('folha'), eImgCliente = $('img-cliente'), eImgDesc = $('img-descricao'), eImgPrazo = $('img-prazo');
  var imagem = null;            // { arquivo, url, numero } — imagem já pronta para enviar
  var tokenImagem = 0, timerImagem;

  function nomeFilamentoEnvio() { return config.mostrarMaterial ? (multicorAtivo ? (nomesCores() ? nomesCores() + ' (multicor)' : '') : filamentoAtual().nome) : ''; }
  function whatsappTexto(texto) { window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }

  function abrirFolha() {
    if (!ultimoOrcamento || ultimoOrcamento.valorCobrar <= 0) { avisar('Preencha peso e tempo primeiro'); return; }
    eImgCliente.value = ''; eImgDesc.value = ''; eImgPrazo.value = config.negocio.prazo;
    $('painel-imagem').hidden = true; $('abrir-imagem').setAttribute('aria-pressed', 'false');
    $('folha-numero').textContent = 'Nº ' + C.formatarNumero(proximoNumero());
    descartarImagem();
    folha.hidden = false;
    $('enviar-texto').focus();
  }
  function fecharFolha() { folha.hidden = true; tokenImagem++; clearTimeout(timerImagem); descartarImagem(); }
  $('whatsapp').addEventListener('click', abrirFolha);
  $('folha-fechar').addEventListener('click', fecharFolha);
  $('folha-fundo').addEventListener('click', fecharFolha);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !folha.hidden) fecharFolha(); });

  /* Texto: compartilhamento nativo; sem suporte (ou erro), abre o WhatsApp */
  $('enviar-texto').addEventListener('click', function () {
    var numero = proximoNumero();
    var texto = C.textoOrcamento(ultimoOrcamento, { material: nomeFilamentoEnvio(), numero: numero, negocio: config.negocio.nome });
    var registrar = function () { registrarEnvio(numero, 'texto', { material: nomeFilamentoEnvio() }); };
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
  function dadosDaImagem(numero) {
    return C.dadosOrcamento(ultimoOrcamento, {
      negocio: config.negocio, numero: numero, data: new Date(), material: nomeFilamentoEnvio(),
      cliente: eImgCliente.value, descricao: eImgDesc.value, prazo: eImgPrazo.value
    });
  }
  function prepararImagem() {
    var meu = ++tokenImagem, numero = proximoNumero();
    $('img-estado').textContent = 'Preparando a imagem…';
    $('enviar-imagem').disabled = true;
    OrcamentoImg.gerar(dadosDaImagem(numero), lerLogoSalvo() || LOGO_3DI).then(function (blob) {
      if (meu !== tokenImagem) return;
      var antigo = imagem; if (antigo) URL.revokeObjectURL(antigo.url);
      var arquivo = new File([blob], 'orcamento-' + C.formatarNumero(numero) + '.jpg', { type: 'image/jpeg' });
      imagem = { arquivo: arquivo, url: URL.createObjectURL(blob), numero: numero };
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
    eImgCliente.focus();
  });
  [eImgCliente, eImgDesc, eImgPrazo].forEach(function (el) { el.addEventListener('input', agendarImagem); selecionarAoFocar(el); });

  function baixarImagem(img) {
    var a = document.createElement('a');
    a.href = img.url; a.download = img.arquivo.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  $('enviar-imagem').addEventListener('click', function () {
    var img = imagem;
    if (!img) return;
    var extra = { material: nomeFilamentoEnvio(), cliente: C.dadosOrcamento(ultimoOrcamento, { cliente: eImgCliente.value }).cliente,
      descricao: eImgDesc.value.trim().slice(0, 120) };
    var registrar = function () { registrarEnvio(img.numero, 'imagem', extra); fecharFolha(); };
    if (navigator.canShare && navigator.canShare({ files: [img.arquivo] })) {
      navigator.share({ files: [img.arquivo] }).then(registrar, function (e) {
        if (!e || e.name !== 'AbortError') { baixarImagem(img); registrar(); }
      });
    } else {
      baixarImagem(img);               // sem compartilhamento de arquivo: baixa o JPG
      avisar('Imagem salva no aparelho');
      registrarEnvio(img.numero, 'imagem', extra);
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

  $('form-config').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var padrao = null;
    var materiais = linhas().map(function (d) {
      if (d.querySelector('.m-padrao').checked) padrao = d.dataset.id;
      return lerLinha(d);
    });
    var mats = C.lerMateriais({ materiais: materiais, materialPadrao: padrao });
    config = {
      valorHora: C.lerNumero(cHora.value), perdaPct: C.lerNumero(cPerda.value), minimo: C.lerNumero(cMin.value),
      materiais: mats.materiais, materialPadrao: mats.materialPadrao, mostrarMaterial: cMostrar.checked,
      modoHora: modoEdicao, impressora: lerImpressoraTela(), negocio: lerNegocioTela(), arredondamento: arredEdicao
    };
    config.precoKg = C.precoKgMaterial(materialPorId(config, config.materialPadrao)); // compatibilidade com a v2
    var ok = salvarConfig(config);
    if (logoPendente !== undefined) {
      try {
        if (logoPendente) localStorage.setItem(CHAVE_LOGO, logoPendente); else localStorage.removeItem(CHAVE_LOGO);
      } catch (e) { ok = false; }
      logoPendente = undefined;
    }
    montarSeletor();
    atualizar();
    sairConfig();
    avisar(ok ? 'Configurações salvas' : 'Salvo só até fechar o app');
  });
  /* Restaura hora (modo Simples), perda, preço mínimo e arredondamento (Exato); a lista de filamentos, o modo escolhido, os dados da impressora e os dados do negócio são mantidos */
  $('restaurar').addEventListener('click', function () {
    preencherCustos(C.PADROES);
    avisar('Padrões restaurados — toque em Salvar');
  });

  /* ---------- Navegação (o botão voltar do Android funciona) ---------- */
  function mostrar(tela) {
    var cfg = tela === 'config';
    $('tela-calc').hidden = cfg;
    $('tela-config').hidden = !cfg;
    if (cfg) preencherConfig(config);
    window.scrollTo(0, 0);
  }
  function rota() {
    if (location.hash !== '#config') veioDaCalc = false;
    mostrar(location.hash === '#config' ? 'config' : 'calc');
  }
  window.addEventListener('hashchange', rota);
  var veioDaCalc = false;
  function sairConfig() {
    if (veioDaCalc) { veioDaCalc = false; history.back(); }
    else { history.replaceState(null, '', location.pathname + location.search); rota(); }
  }
  $('ir-config').addEventListener('click', function () { veioDaCalc = true; location.hash = 'config'; });
  $('voltar').addEventListener('click', sairConfig);

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

  /* ---------- Funcionamento offline ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); });
  }

  /* ---------- Início ---------- */
  montarSeletor();
  rota();
  atualizar();
})();
