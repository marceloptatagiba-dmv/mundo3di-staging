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
    var o = { peso: C.lerNumero(ePeso.value), tempoMin: C.lerTempo(eTempo.value), qtd: C.lerQuantidade(eQtd.value),
      extras: C.lerNumero(eExtras.value), margem: C.lerNumero(eMargem.value), materialId: fil.id, materialNome: fil.nome };
    if (multicorAtivo) {
      o.cores = cores.map(function (c) {
        var f = materialPorId(config, c.id) || fil;
        return { materialId: f.id, nome: f.nome, gramas: C.lerNumero(c.g) };
      });
      o.purgaG = C.lerNumero(purgaTxt);
    }
    return D.montarEntrada(o);
  }
  /* Grava o envio novo: avança o contador e guarda o registro com data e hora. Chamado só quando o envio aconteceu. */
  function registrarEnvio(numero, formato, extra) {
    var reg = D.novoRegistro(extra.orcamento, { numero: numero, formato: formato, material: extra.material, cliente: extra.cliente,
      descricao: extra.descricao, entrada: extra.entrada, prazo: extra.prazo, validadeAte: extra.validadeAte, versaoApp: versaoEmUso });
    try {
      localStorage.setItem(CHAVE_CONT, String(numero));
      var lista = JSON.parse(localStorage.getItem(CHAVE_REG) || '[]');
      localStorage.setItem(CHAVE_REG, JSON.stringify(D.adicionarRegistro(lista, reg, D.MAX_REGISTROS)));
    } catch (e) { /* armazenamento indisponível: o envio continua valendo, só não fica registrado */ }
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
    eImgDesc.value = envioReg ? envioReg.descricao : '';
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

  /* ---------- Histórico de orçamentos ---------- */
  var LEMBRETE_BACKUP_ATIVO = false;   // o lembrete entra na etapa do backup (v4, item 2); a faixa já existe, escondida
  var histPeriodo = '30', histBusca = '', histLimite = 50, histTimerBusca;
  var detChave = null;                 // orçamento aberto no detalhe

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function desenharHist() {
    var todos = lerLista(), hoje = new Date();
    var lista = D.filtrarRegistros(todos, { periodo: histPeriodo, busca: histBusca, hoje: hoje });
    var res = D.resumir(lista);
    $('hist-n').textContent = String(res.qtd);
    $('hist-total').textContent = moeda(res.total);
    $('hist-apr').textContent = String(res.aprovados);
    Array.prototype.forEach.call(document.querySelectorAll('[data-per]'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.per === histPeriodo));
    });
    var lemb = LEMBRETE_BACKUP_ATIVO ? D.precisaLembreteBackup(todos, null) : { mostrar: false, qtd: 0 };
    $('hist-lembrete').hidden = !lemb.mostrar;
    if (lemb.mostrar) $('hist-lembrete-txt').textContent = lemb.qtd + ' orçamentos desde o último backup.';

    var box = $('hist-lista'); box.textContent = '';
    var vazio = $('hist-vazio');
    if (!lista.length) {
      vazio.hidden = false;
      vazio.textContent = !todos.length ? 'Nenhum orçamento enviado ainda. Cada envio, em texto ou imagem, aparece aqui.'
        : histBusca ? 'Nada encontrado para “' + histBusca + '”.' : 'Nenhum orçamento neste período. Toque em Tudo para ver todos.';
    } else { vazio.hidden = true; }
    D.agruparPorDia(lista.slice(0, histLimite), hoje).forEach(function (g) {
      box.appendChild(el('div', 'dia', g.rotulo));
      var bloco = el('div', 'lista-hist');
      g.itens.forEach(function (r) {
        var it = el('button', 'item'); it.type = 'button';
        var meio = el('span', 'meio');
        meio.appendChild(el('span', 'sup', 'Nº ' + C.formatarNumero(r.n) + ' · ' + D.hora(r.ts) + ' · ' + (r.formato === 'imagem' ? 'Imagem' : 'Texto')));
        meio.appendChild(el('strong', r.cliente ? '' : 'sem', r.cliente || 'Sem cliente'));
        meio.appendChild(el('span', 'peca', D.descricaoLinha(r)));
        var dir = el('span', 'dir');
        dir.appendChild(el('b', '', moeda(r.total)));
        var st = D.situacao(r, hoje);
        dir.appendChild(el('span', 'pill ' + st, D.ROTULOS_SITUACAO[st]));
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
    b.addEventListener('click', function () { histPeriodo = b.dataset.per; histLimite = 50; desenharHist(); });
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
    $('det-catalogo').disabled = true;          // o catálogo chega na etapa 4
    $('det-cat-nota').hidden = false;
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
    montarSeletor(); aplicarModoMulticor(); atualizar();
    sairConfig();
    avisar(aviso || 'Dados do orçamento Nº ' + C.formatarNumero(reg.n) + ' na tela');
  }

  /* ---------- Navegação (o botão voltar do Android funciona) ---------- */
  function telaDaRota() { return location.hash === '#config' ? 'config' : location.hash === '#historico' ? 'hist' : 'calc'; }
  function mostrar(tela) {
    $('tela-calc').hidden = tela !== 'calc';
    $('tela-config').hidden = tela !== 'config';
    $('tela-hist').hidden = tela !== 'hist';
    if (tela === 'config') { preencherConfig(config); configInicial = JSON.stringify(lerConfigTela()); }
    if (tela === 'hist') desenharHist(); else fecharSheetsHist();
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
  $('ir-hist').addEventListener('click', function () { veioDaCalc = true; location.hash = 'historico'; });
  $('voltar').addEventListener('click', sairConfig);
  $('hist-voltar').addEventListener('click', sairConfig);

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
      multicor: multicorAtivo, cores: cores.map(function (c) { return { id: c.id, g: c.g }; }), purga: purgaTxt };
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
  montarSeletor();
  if (multicorAtivo) aplicarModoMulticor();
  rota();
  atualizar();
  avisarSeAtualizou();
})();
