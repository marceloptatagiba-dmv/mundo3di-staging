/* Mundo 3Di — imagem (JPG) do orçamento, desenhada em canvas.
   Sem biblioteca e sem internet. Usa SÓ o objeto de Calc.dadosOrcamento(): custo, margem, perda e lucro nem chegam aqui. */
(function (root) {
  'use strict';

  var LARGURA = 1080, MARGEM = 72, ALTURA_MAX = 2600;
  var VERDE = '#448C04', VERDE_CLARO = '#7CC12A', PRETO = '#0E0F10', CINZA = '#4A524A', LINHA = '#D5DCCF', FUNDO_CAIXA = '#F4F6F2';
  var FONTE = 'Montserrat, system-ui, -apple-system, "Segoe UI", sans-serif';

  function fonte(peso, px) { return peso + ' ' + px + 'px ' + FONTE; }

  /* Quebra o texto em linhas que cabem na largura; palavra maior que a linha é cortada. */
  function quebrar(ctx, texto, largura) {
    var palavras = String(texto).split(' '), linhas = [], atual = '';
    palavras.forEach(function (p) {
      while (ctx.measureText(p).width > largura && p.length > 1) {
        var corte = p.length - 1;
        while (corte > 1 && ctx.measureText(p.slice(0, corte)).width > largura) corte--;
        if (atual) { linhas.push(atual); atual = ''; }
        linhas.push(p.slice(0, corte));
        p = p.slice(corte);
      }
      var tenta = atual ? atual + ' ' + p : p;
      if (ctx.measureText(tenta).width <= largura) { atual = tenta; }
      else { if (atual) linhas.push(atual); atual = p; }
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  function carregarImagem(src) {
    return new Promise(function (ok, falha) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { falha(new Error('imagem')); };
      img.src = src;
    });
  }

  function retanguloArredondado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Desenha tudo num canvas alto e devolve a altura usada; depois o canvas final é recortado nessa altura. */
  function desenhar(ctx, d, logo) {
    var W = LARGURA, M = MARGEM, util = W - 2 * M, y = 0;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, ALTURA_MAX);
    ctx.textBaseline = 'alphabetic';

    /* Faixa verde do topo */
    ctx.fillStyle = VERDE; ctx.fillRect(0, 0, W, 14);
    y = 14 + 56;

    /* Logo (à esquerda) e dados do negócio (à direita do logo) */
    var logoW = 0, logoH = 0;
    if (logo) {
      var escala = Math.min(280 / logo.naturalWidth, 130 / logo.naturalHeight);
      logoW = Math.round(logo.naturalWidth * escala); logoH = Math.round(logo.naturalHeight * escala);
      ctx.drawImage(logo, M, y, logoW, logoH);
    }
    var tx = logo ? M + logoW + 36 : M, tl = W - M - tx, ty = y + 6;
    ctx.fillStyle = PRETO; ctx.font = fonte(800, 42);
    var nomeLinhas = quebrar(ctx, d.negocioNome, tl).slice(0, 2);
    nomeLinhas.forEach(function (l) { ty += 46; ctx.fillText(l, tx, ty); });
    ctx.fillStyle = CINZA; ctx.font = fonte(500, 27);
    [d.whatsapp ? 'WhatsApp ' + d.whatsapp : '', d.instagram, [d.cidade, d.cnpj ? 'CNPJ ' + d.cnpj : ''].filter(Boolean).join(' · ')]
      .filter(Boolean).forEach(function (l) { quebrar(ctx, l, tl).slice(0, 2).forEach(function (x) { ty += 36; ctx.fillText(x, tx, ty); }); });
    y = Math.max(y + logoH, ty) + 44;
    ctx.fillStyle = LINHA; ctx.fillRect(M, y, util, 3); y += 56;

    /* Título, número, data e validade */
    ctx.fillStyle = VERDE; ctx.font = fonte(700, 26);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '4px';
    ctx.fillText('ORÇAMENTO', M, y);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    ctx.fillStyle = PRETO; ctx.font = fonte(800, 64);
    ctx.fillText('Nº ' + d.numero, M, y + 72);
    ctx.textAlign = 'right'; ctx.font = fonte(600, 28); ctx.fillStyle = CINZA;
    ctx.fillText('Data: ' + d.data, W - M, y + 22);
    if (d.validade) ctx.fillText('Válido até: ' + d.validade, W - M, y + 64);
    ctx.textAlign = 'left';
    y += 72 + 64;

    /* Blocos "rótulo + valor" */
    function bloco(rotulo, valor, maxLinhas) {
      if (!valor) return;
      ctx.fillStyle = CINZA; ctx.font = fonte(700, 22);
      if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
      ctx.fillText(rotulo, M, y);
      if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
      y += 16;
      ctx.fillStyle = PRETO; ctx.font = fonte(600, 36);
      quebrar(ctx, valor, util).slice(0, maxLinhas || 3).forEach(function (l) { y += 48; ctx.fillText(l, M, y); });
      y += 66;
    }
    bloco('CLIENTE', d.cliente, 2);
    bloco('PEÇA', d.descricao, 3);
    bloco('MATERIAL', d.material, 2);

    /* Quantidade e valor por peça */
    if (d.qtd > 1) {
      ctx.fillStyle = LINHA; ctx.fillRect(M, y - 8, util, 3); y += 44;
      ctx.fillStyle = CINZA; ctx.font = fonte(600, 32);
      ctx.fillText('Quantidade', M, y); ctx.fillText('Valor por peça', M, y + 56);
      ctx.fillStyle = PRETO; ctx.font = fonte(700, 34); ctx.textAlign = 'right';
      ctx.fillText(d.qtd + ' peças', W - M, y); ctx.fillText(d.valorPeca, W - M, y + 56);
      ctx.textAlign = 'left';
      y += 56 + 56;
    }

    /* Total em destaque */
    var caixaH = 190;
    ctx.fillStyle = PRETO; retanguloArredondado(ctx, M, y, util, caixaH, 28); ctx.fill();
    ctx.fillStyle = '#B9C2B3'; ctx.font = fonte(700, 26);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '4px';
    ctx.fillText(d.qtd > 1 ? 'TOTAL' : 'VALOR', M + 44, y + 64);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    ctx.fillStyle = VERDE_CLARO; ctx.font = fonte(800, 92);
    var tamanho = 92;
    while (ctx.measureText(d.total).width > util - 88 && tamanho > 40) { tamanho -= 4; ctx.font = fonte(800, tamanho); }
    ctx.fillText(d.total, M + 44, y + 150);
    y += caixaH + 60;

    /* Prazo, pagamento e observações */
    bloco('PRAZO DE ENTREGA', d.prazo, 2);
    bloco('PAGAMENTO', d.pagamento, 2);
    bloco('OBSERVAÇÕES', d.obs, 4);

    /* Rodapé: faixa verde */
    y += 12;
    ctx.fillStyle = VERDE; ctx.fillRect(0, y, W, 14);
    return y + 14;
  }

  /*
   * Gera o JPG do orçamento. dados: Calc.dadosOrcamento(...). logoSrc: dataURL do logo do cliente
   * ou o caminho do logo 3Di. Devolve uma Promise com o Blob (image/jpeg).
   */
  function gerar(dados, logoSrc) {
    var fontes = [fonte(500, 27), fonte(600, 36), fonte(700, 26), fonte(800, 64)];
    var esperaFontes = document.fonts && document.fonts.load
      ? Promise.all(fontes.map(function (f) { return document.fonts.load(f); })).catch(function () {})
      : Promise.resolve();
    var logo = carregarImagem(logoSrc).catch(function () { return carregarImagem('img/logo-3di.png'); }).catch(function () { return null; });
    return Promise.all([esperaFontes, logo]).then(function (x) {
      var alto = document.createElement('canvas');
      alto.width = LARGURA; alto.height = ALTURA_MAX;
      var altura = desenhar(alto.getContext('2d'), dados, x[1]);
      var final = document.createElement('canvas');
      final.width = LARGURA; final.height = Math.min(altura, ALTURA_MAX);
      var c = final.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, final.width, final.height);
      c.drawImage(alto, 0, 0);
      return new Promise(function (ok, falha) {
        final.toBlob(function (b) { b ? ok(b) : falha(new Error('toBlob')); }, 'image/jpeg', 0.92);
      });
    });
  }

  /* Reduz o logo enviado pelo cliente para no máximo 400 px (lado maior) e devolve um dataURL.
     PNG/WebP/GIF/SVG ficam em PNG (preserva transparência); o resto em JPEG. */
  function reduzirLogo(arquivo) {
    return new Promise(function (ok, falha) {
      var leitor = new FileReader();
      leitor.onerror = function () { falha(new Error('leitura')); };
      leitor.onload = function () {
        carregarImagem(leitor.result).then(function (img) {
          var lado = Math.max(img.naturalWidth, img.naturalHeight) || 1;
          var escala = Math.min(1, 400 / lado);
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * escala));
          c.height = Math.max(1, Math.round(img.naturalHeight * escala));
          var ctx = c.getContext('2d');
          var jpeg = /jpe?g/i.test(arquivo.type);
          if (jpeg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
          ctx.drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.9));
        }, falha);
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  root.OrcamentoImg = { gerar: gerar, reduzirLogo: reduzirLogo };
})(window);
