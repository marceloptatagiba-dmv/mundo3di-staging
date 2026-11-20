/* Casos de teste das regras de cálculo.
   Usado por teste-calculo.js (node) e por testes.html (ambiente de teste, no celular). */
(function (root) {
  'use strict';

  function executar(C, D) {
    var resultados = [];
    var NB = /[  ]/g;
    function m(n) { return C.moeda(n).replace(NB, ' '); }
    function igual(nome, obtido, esperado) {
      resultados.push({ nome: nome, ok: obtido === esperado, obtido: obtido, esperado: esperado });
    }

    // Regras da v1 (conferidas com a planilha)
    var casos = [
      { nome: 'Planilha (5 g, 10 min)', e: { peso: 5, tempo: 10, precoKg: 150, valorHora: 2.25, perdaPct: 5, margemPct: 100 },
        esperado: { custoBase: 'R$ 1,13', perda: 'R$ 0,06', custoTotal: 'R$ 1,18', valorCobrar: 'R$ 2,36' } },
      { nome: 'Tudo zero', e: { peso: 0, tempo: 0, precoKg: 150, valorHora: 2.25, perdaPct: 5, margemPct: 100 },
        esperado: { custoBase: 'R$ 0,00', perda: 'R$ 0,00', custoTotal: 'R$ 0,00', valorCobrar: 'R$ 0,00' } },
      { nome: 'Margem 0 e perda 0', e: { peso: 100, tempo: 60, precoKg: 120, valorHora: 3, perdaPct: 0, margemPct: 0 },
        esperado: { custoBase: 'R$ 15,00', perda: 'R$ 0,00', custoTotal: 'R$ 15,00', valorCobrar: 'R$ 15,00' } },
      { nome: 'Margem 70%', e: { peso: 200, tempo: 300, precoKg: 150, valorHora: 2.25, perdaPct: 5, margemPct: 70 },
        esperado: { custoBase: 'R$ 41,25', perda: 'R$ 2,06', custoTotal: 'R$ 43,31', valorCobrar: 'R$ 73,63' } }
    ];
    casos.forEach(function (c) {
      var r = C.calcular(c.e);
      Object.keys(c.esperado).forEach(function (k) { igual(c.nome + ' · ' + k, m(r[k]), c.esperado[k]); });
    });
    [['12,5', 12.5], ['12.5', 12.5], ['1.234,56', 1234.56], ['', 0], ['abc', 0], ['-3', 0], [' 7 ', 7]].forEach(function (t) {
      igual('lerNumero ' + JSON.stringify(t[0]), C.lerNumero(t[0]), t[1]);
    });

    // v2 · 1. tempo h:min
    [['2h35', 155], ['2h 35min', 155], ['2:35', 155], ['2h', 120], ['1,5h', 90], ['35min', 35], ['35', 35],
     ['12,5', 12.5], ['', 0], ['abc', 0], ['0:45', 45], ['2H35', 155]].forEach(function (t) {
      igual('lerTempo ' + t[0], C.lerTempo(t[0]), t[1]);
    });
    igual('formatarTempo 155', C.formatarTempo(155), '2h35');
    igual('formatarTempo 120', C.formatarTempo(120), '2h00');
    igual('formatarTempo 45', C.formatarTempo(45), '45 min');

    // v2 · 2. quantidade
    [['', 1], ['0', 1], ['3', 3], ['12', 12], ['2,7', 27], ['abc', 1], ['1.000', 1000]].forEach(function (t) {
      igual('lerQuantidade ' + JSON.stringify(t[0]), C.lerQuantidade(t[0]), t[1]);
    });
    var base = { peso: 5, tempo: 10, precoKg: 150, valorHora: 2.25, perdaPct: 5, margemPct: 100 };
    function com(extra) { return C.calcular(Object.assign({}, base, extra)); }
    var r1 = C.calcular(base); // sem campos novos = comportamento da v1
    igual('v1 intacto: valor', m(r1.valorCobrar), 'R$ 2,36');
    igual('v1 intacto: qtd', r1.qtd, 1);
    igual('v1 intacto: lucro', m(r1.lucro), 'R$ 1,18');
    var r3 = com({ peso: 15, tempo: 30, qtd: 3 }); // mesa de 3 peças
    igual('mesa 3 pç: total', m(r3.valorCobrar), 'R$ 7,09');
    igual('mesa 3 pç: unitário', m(r3.valorUnitario), 'R$ 2,36');

    // v2 · 3. extras por peça (sem perda; entram no custo total e na margem)
    var re = com({ extrasPeca: 1.5, qtd: 2 });
    igual('extras: valor', m(re.extras), 'R$ 3,00');
    igual('extras: custo total', m(re.custoTotal), 'R$ 4,18');
    igual('extras: a cobrar', m(re.valorCobrar), 'R$ 8,36');

    // v2 · 4. lucro
    igual('lucro = cobrar − custo', m(re.lucro), 'R$ 4,18');

    // v2 · 6. preço mínimo
    var rmin = com({ minimo: 10 });
    igual('mínimo aplicado', m(rmin.valorCobrar), 'R$ 10,00');
    igual('mínimo: flag', rmin.minimoAplicado, true);
    igual('mínimo: lucro', m(rmin.lucro), 'R$ 8,82');
    igual('mínimo abaixo do valor: não interfere', m(com({ minimo: 1 }).valorCobrar), 'R$ 2,36');
    igual('mínimo com tudo zero fica 0', m(com({ peso: 0, tempo: 0, minimo: 10 }).valorCobrar), 'R$ 0,00');

    // v2 · 5. texto do orçamento
    igual('texto 1 peça', C.textoOrcamento(r1).replace(NB, ' '), '*Orçamento — Mundo 3Di*\nPeça impressa em 3D\n*Valor: R$ 2,36*');
    igual('texto 3 peças', C.textoOrcamento(r3).replace(NB, ' '),
      '*Orçamento — Mundo 3Di*\n3 peças impressas em 3D\nValor por peça: R$ 2,36\n*Total: R$ 7,09*');

    // v3 · 1. vários filamentos
    igual('filamento: rolo 1 kg a R$ 150 = R$ 150/kg', C.precoKgMaterial({ precoRolo: 150, pesoRolo: 1000 }), 150);
    igual('filamento: rolo 500 g a R$ 90 = R$ 0,18/g', m(C.precoKgMaterial({ precoRolo: 90, pesoRolo: 500 }) / 1000), 'R$ 0,18');
    igual('filamento: peso do rolo vazio = 1000 g', C.precoKgMaterial({ precoRolo: 120, pesoRolo: 0 }), 120);
    igual('filamento: preço vazio = 0', C.precoKgMaterial({ precoRolo: 0, pesoRolo: 1000 }), 0);
    [['1000', 1000], ['1.000', 1000], ['1 000', 1000], ['500', 500], ['250g', 250], ['', 1000], ['0', 1000], ['abc', 1000], ['750,5', 750]].forEach(function (t) {
      igual('lerPesoRolo ' + JSON.stringify(t[0]), C.lerPesoRolo(t[0]), t[1]);
    });
    var pla = C.lerMateriais(null);
    igual('sem nada salvo: 1 filamento', pla.materiais.length, 1);
    igual('sem nada salvo: PLA', pla.materiais[0].nome, 'PLA');
    igual('sem nada salvo: R$ 150 / 1000 g', pla.materiais[0].precoRolo + '/' + pla.materiais[0].pesoRolo, '150/1000');
    var rPla = com({ precoKg: C.precoKgMaterial(pla.materiais[0]) });
    igual('PLA padrão = planilha R$ 2,36', m(rPla.valorCobrar), 'R$ 2,36');
    var mig = C.lerMateriais({ precoKg: 135.5, valorHora: 3, perdaPct: 5, minimo: 0 });
    igual('migração da v2: PLA com o preço antigo', mig.materiais[0].nome + ' ' + mig.materiais[0].precoRolo + ' ' + mig.materiais[0].pesoRolo, 'PLA 135.5 1000');
    igual('migração da v2: PLA é o padrão', mig.materialPadrao, mig.materiais[0].id);
    var lista = C.lerMateriais({ materiais: [
      { id: 'a', nome: ' PLA ', precoRolo: 150, pesoRolo: 1000 },
      { id: 'b', nome: '', precoRolo: 90, pesoRolo: 500 },
      { id: 'b', nome: 'TPU', precoRolo: -5, pesoRolo: 'x' }
    ], materialPadrao: 'zzz' });
    igual('lista: nome sem espaços', lista.materiais[0].nome, 'PLA');
    igual('lista: nome vazio vira "Filamento 2"', lista.materiais[1].nome, 'Filamento 2');
    igual('lista: id repetido é corrigido', lista.materiais[2].id !== 'b', true);
    igual('lista: preço inválido = 0 e peso inválido = 1000', lista.materiais[2].precoRolo + '/' + lista.materiais[2].pesoRolo, '0/1000');
    igual('lista: padrão inexistente vira o primeiro', lista.materialPadrao, 'a');
    igual('lista: padrão salvo é mantido', C.lerMateriais({ materiais: [{ id: 'a', nome: 'PLA', precoRolo: 1 }, { id: 'b', nome: 'PETG', precoRolo: 1 }], materialPadrao: 'b' }).materialPadrao, 'b');
    var muitos = []; for (var i = 0; i < 20; i++) muitos.push({ id: 'x' + i, nome: 'F' + i, precoRolo: 100 });
    igual('lista: no máximo ' + C.MAX_MATERIAIS + ' filamentos', C.lerMateriais({ materiais: muitos }).materiais.length, C.MAX_MATERIAIS);
    igual('lista vazia salva: cria PLA', C.lerMateriais({ materiais: [], precoKg: 99 }).materiais[0].precoRolo, 99);
    var rTpu = com({ peso: 100, tempo: 0, precoKg: C.precoKgMaterial({ precoRolo: 90, pesoRolo: 500 }) });
    igual('TPU 100 g (rolo 500 g a R$ 90): material', m(rTpu.material), 'R$ 18,00');
    igual('texto sem material (opção desligada)', C.textoOrcamento(r1, { material: '' }).replace(NB, ' '), '*Orçamento — Mundo 3Di*\nPeça impressa em 3D\n*Valor: R$ 2,36*');
    igual('texto com material (1 peça)', C.textoOrcamento(r1, { material: 'PETG' }).replace(NB, ' '),
      '*Orçamento — Mundo 3Di*\nPeça impressa em 3D\nMaterial: PETG\n*Valor: R$ 2,36*');
    igual('texto com material (3 peças)', C.textoOrcamento(r3, { material: 'PETG' }).replace(NB, ' '),
      '*Orçamento — Mundo 3Di*\n3 peças impressas em 3D\nMaterial: PETG\nValor por peça: R$ 2,36\n*Total: R$ 7,09*');
    // 0.6.0-teste.13: descrição e prazo também no texto
    igual('texto com descrição e prazo (1 peça)', C.textoOrcamento(r1, { numero: 3, descricao: ' Miniatura do  Jason ', prazo: '5 dias úteis' }).replace(NB, ' '),
      '*Orçamento Nº 0003 — Mundo 3Di*\nMiniatura do Jason\n*Valor: R$ 2,36*\nPrazo de entrega: 5 dias úteis');
    igual('texto com descrição, material e prazo (3 peças)', C.textoOrcamento(r3, { descricao: 'Chaveiro com logo', material: 'PETG', prazo: '1 semana' }).replace(NB, ' '),
      '*Orçamento — Mundo 3Di*\n3 peças · Chaveiro com logo\nMaterial: PETG\nValor por peça: R$ 2,36\n*Total: R$ 7,09*\nPrazo de entrega: 1 semana');
    igual('texto: descrição e prazo vazios (ou só espaços) ficam de fora', C.textoOrcamento(r1, { descricao: '  ', prazo: '' }).replace(NB, ' ') + '|' + C.textoOrcamento(r3, { prazo: ' ' }).replace(NB, ' '),
      '*Orçamento — Mundo 3Di*\nPeça impressa em 3D\n*Valor: R$ 2,36*|*Orçamento — Mundo 3Di*\n3 peças impressas em 3D\nValor por peça: R$ 2,36\n*Total: R$ 7,09*');
    igual('texto: só prazo, sem descrição', C.textoOrcamento(r1, { prazo: 'amanhã' }).replace(NB, ' '), '*Orçamento — Mundo 3Di*\nPeça impressa em 3D\n*Valor: R$ 2,36*\nPrazo de entrega: amanhã');
    igual('texto com descrição e prazo nunca mostra custo nem margem', /custo|margem|lucro|perda/i.test(C.textoOrcamento(r3, { descricao: 'Vaso', prazo: '3 dias', material: 'PLA' })), false);
    var txtMat = C.textoOrcamento(r3, { material: 'PETG' }).toLowerCase();
    igual('texto nunca mostra custo nem margem', /custo|margem|lucro|perda/.test(txtMat), false);

    // v3 · 2. energia e desgaste da impressora
    var exemplo = { potenciaW: 120, tarifa: 0.95, preco: 4000, revenda: 1000, vidaUtil: 6000, manutencaoAno: 300, horasAno: 1500 };
    var imp = C.calcularImpressora(exemplo);
    igual('impressora: energia 120 W a R$ 0,95/kWh = R$ 0,11/h', m(imp.energiaHora), 'R$ 0,11');
    igual('impressora: depreciação (4.000 − 1.000) ÷ 6.000 h = R$ 0,50/h', m(imp.depreciacaoHora), 'R$ 0,50');
    igual('impressora: manutenção 300 ÷ 1.500 h = R$ 0,20/h', m(imp.manutencaoHora), 'R$ 0,20');
    igual('impressora: desgaste = R$ 0,70/h', m(imp.desgasteHora), 'R$ 0,70');
    igual('impressora: hora total ≈ R$ 0,81/h', m(imp.horaTotal), 'R$ 0,81');
    var semEnergia = C.calcularImpressora(Object.assign({}, exemplo, { tarifa: 0 }));
    igual('tarifa zerada: só desgaste', m(semEnergia.horaTotal) + '/' + m(semEnergia.energiaHora), 'R$ 0,70/R$ 0,00');
    var semPotencia = C.calcularImpressora(Object.assign({}, exemplo, { potenciaW: 0 }));
    igual('potência zerada: só desgaste', m(semPotencia.horaTotal) + '/' + m(semPotencia.energiaHora), 'R$ 0,70/R$ 0,00');
    igual('vida útil em branco: sem depreciação (e sem divisão por zero)', m(C.calcularImpressora(Object.assign({}, exemplo, { vidaUtil: 0 })).depreciacaoHora), 'R$ 0,00');
    igual('horas por ano em branco: sem manutenção (e sem divisão por zero)', m(C.calcularImpressora(Object.assign({}, exemplo, { horasAno: 0 })).manutencaoHora), 'R$ 0,00');
    igual('revenda acima do preço: depreciação 0 (sem crédito)', C.calcularImpressora(Object.assign({}, exemplo, { revenda: 5000 })).depreciacaoHora, 0);
    igual('tudo vazio: hora 0', C.calcularImpressora({}).horaTotal, 0);
    igual('sem nada salvo: hora 0', C.calcularImpressora(null).horaTotal, 0);
    igual('horas por ano limitadas a 8.760', C.lerImpressora({ horasAno: 99999 }).horasAno, C.MAX_HORAS_ANO);
    igual('lerImpressora ignora texto, negativo e NaN',
      JSON.stringify(C.lerImpressora({ potenciaW: 'x', tarifa: -1, preco: NaN, revenda: null })),
      JSON.stringify({ potenciaW: 0, tarifa: 0, preco: 0, revenda: 0, vidaUtil: 0, manutencaoAno: 0, horasAno: 0 }));
    // leitura dos campos digitados
    [['4000', 4000], ['4.000', 4000], ['4.000,50', 4000.5], ['1.234.567', 1234567], ['12.5', 12.5], ['0,95', 0.95], ['120', 120], ['', 0], ['abc', 0]].forEach(function (t) {
      igual('lerDinheiro ' + JSON.stringify(t[0]), C.lerDinheiro(t[0]), t[1]);
    });
    [['6000', 6000], ['6.000', 6000], ['6 000', 6000], ['1500h', 1500], ['', 0], ['abc', 0], ['-5', 5]].forEach(function (t) {
      igual('lerInteiro ' + JSON.stringify(t[0]), C.lerInteiro(t[0]), t[1]);
    });
    igual('tarifa "0.950" continua sendo R$ 0,95 (lerNumero)', C.lerNumero('0.950'), 0.95);
    // o cálculo do orçamento com o custo da hora detalhado
    var rSimples = C.calcular(Object.assign({}, base, { tempo: 60, peso: 0 }));
    igual('modo simples: 60 min = R$ 2,25 de impressão', m(rSimples.impressao), 'R$ 2,25');
    igual('modo simples: sem energia/desgaste separados', rSimples.detalhado + '/' + rSimples.energia + '/' + rSimples.desgaste, 'false/0/0');
    var rDet = C.calcular(Object.assign({}, base, { tempo: 60, peso: 0, energiaHora: imp.energiaHora, desgasteHora: imp.desgasteHora }));
    igual('modo detalhado: 60 min = R$ 0,81 de impressão', m(rDet.impressao), 'R$ 0,81');
    igual('modo detalhado: energia', m(rDet.energia), 'R$ 0,11');
    igual('modo detalhado: desgaste', m(rDet.desgaste), 'R$ 0,70');
    igual('modo detalhado: energia + desgaste = impressão', Math.abs(rDet.energia + rDet.desgaste - rDet.impressao) < 1e-12, true);
    igual('modo detalhado: perda incide sobre a impressão', m(rDet.perda), 'R$ 0,04');
    igual('modo detalhado: tempo 2h35 usa minutos', m(C.calcular(Object.assign({}, base, { peso: 0, tempo: C.lerTempo('2h35'), energiaHora: imp.energiaHora, desgasteHora: imp.desgasteHora })).impressao), 'R$ 2,10');
    igual('modo detalhado: valorHora simples é ignorado', m(C.calcular(Object.assign({}, base, { valorHora: 99, tempo: 60, peso: 0, energiaHora: imp.energiaHora, desgasteHora: imp.desgasteHora })).impressao), 'R$ 0,81');
    igual('planilha segue R$ 2,36 com o modo simples', m(C.calcular(base).valorCobrar), 'R$ 2,36');

    // v3 · 3. orçamento em imagem: numeração, dados, registro
    [[1, '0001'], [7, '0007'], [42, '0042'], [1234, '1234'], [12345, '12345'], [0, '0000'], ['x', '0000']].forEach(function (t) {
      igual('formatarNumero ' + t[0], C.formatarNumero(t[0]), t[1]);
    });
    igual('formatarData', C.formatarData(new Date(2026, 10, 14)), '14/11/2026');
    var neg0 = C.lerNegocio(null);
    igual('negócio vazio: validade padrão 7 dias', neg0.validadeDias, 7);
    igual('negócio vazio: textos vazios', neg0.nome + neg0.whatsapp + neg0.pagamento + neg0.obs, '');
    var neg1 = C.lerNegocio({ nome: '  Oficina   do João  ', whatsapp: '(11) 99999-0000', obs: new Array(300).join('x'), validadeDias: 0 });
    igual('negócio: espaços aparados e repetidos juntados', neg1.nome, 'Oficina do João');
    igual('negócio: observação limitada a 160', neg1.obs.length, 160);
    igual('negócio: validade 0 é respeitada (não mostrar)', neg1.validadeDias, 0);
    igual('negócio: validade inválida volta a 7', C.lerNegocio({ validadeDias: -3 }).validadeDias, 7);
    igual('negócio: validade máxima 365', C.lerNegocio({ validadeDias: 9999 }).validadeDias, 365);
    var hoje = new Date(2026, 10, 14, 15, 30);
    var d1 = C.dadosOrcamento(r1, { negocio: null, numero: 3, data: hoje });
    igual('dados: nº', d1.numero, '0003');
    igual('dados: data e validade (+7 dias)', d1.data + ' → ' + d1.validade, '14/11/2026 → 21/11/2026');
    igual('dados: nome padrão Mundo 3Di', d1.negocioNome, 'Mundo 3Di');
    igual('dados: 1 peça sem "valor por peça"', d1.valorPeca, '');
    igual('dados: total', d1.total.replace(NB, ' '), 'R$ 2,36');
    igual('dados: descrição padrão (1 peça)', d1.descricao, 'Peça impressa em 3D');
    var d3 = C.dadosOrcamento(r3, { negocio: { nome: 'Oficina X', validadeDias: 15, pagamento: 'Pix ou cartão', obs: 'Garantia de 30 dias' },
      numero: 12, data: hoje, cliente: ' Maria ', descricao: 'Suporte de celular', material: 'PETG', prazo: '5 dias úteis' });
    igual('dados: 3 peças mostram valor por peça', d3.valorPeca.replace(NB, ' ') + ' / ' + d3.total.replace(NB, ' '), 'R$ 2,36 / R$ 7,09');
    igual('dados: validade de 15 dias', d3.validade, '29/11/2026');
    igual('dados: campos preenchidos', [d3.negocioNome, d3.cliente, d3.descricao, d3.material, d3.prazo, d3.pagamento, d3.obs].join('|'),
      'Oficina X|Maria|Suporte de celular|PETG|5 dias úteis|Pix ou cartão|Garantia de 30 dias');
    igual('dados: descrição padrão (3 peças)', C.dadosOrcamento(r3, { numero: 1, data: hoje }).descricao, '3 peças impressas em 3D');
    igual('dados: validade 0 não mostra validade', C.dadosOrcamento(r1, { negocio: { validadeDias: 0 }, numero: 1, data: hoje }).validade, '');
    var rExtra = com({ extrasPeca: 1.5, qtd: 2, energiaHora: 0.114, desgasteHora: 0.7, peso: 40, tempo: 120 });
    var dadosExtra = JSON.stringify(C.dadosOrcamento(rExtra, { negocio: { nome: 'Oficina X', pagamento: 'Pix', obs: 'Obrigado' }, numero: 5, data: hoje, cliente: 'Ana', descricao: 'Vaso', material: 'PLA', prazo: '3 dias' })).toLowerCase();
    igual('dados (imagem) nunca trazem custo, margem, perda, lucro, energia ou desgaste', /custo|margem|lucro|perda|energia|desgaste/.test(dadosExtra), false);
    var chaves = Object.keys(C.dadosOrcamento(rExtra, { numero: 1 })).sort().join(',');
    igual('dados: só os campos esperados (nenhum campo de custo entra por acidente)', chaves,
      'cidade,cliente,cnpj,data,descricao,instagram,material,negocioNome,numero,obs,pagamento,prazo,qtd,total,validade,valorPeca,whatsapp');
    igual('dados: valores de custo não aparecem em lugar nenhum',
      [rExtra.custoTotal, rExtra.lucro, rExtra.perda, rExtra.custoBase].every(function (v) { return dadosExtra.indexOf(m(v).replace(NB, ' ').toLowerCase()) === -1; }), true);
    igual('texto com nº: título', C.textoOrcamento(r1, { numero: 7 }).replace(NB, ' '), '*Orçamento Nº 0007 — Mundo 3Di*\nPeça impressa em 3D\n*Valor: R$ 2,36*');
    igual('texto com nome do negócio', C.textoOrcamento(r3, { numero: 12, negocio: 'Oficina X', material: 'PETG' }).replace(NB, ' '),
      '*Orçamento Nº 0012 — Oficina X*\n3 peças impressas em 3D\nMaterial: PETG\nValor por peça: R$ 2,36\n*Total: R$ 7,09*');
    igual('texto sem nº continua igual à v2', C.textoOrcamento(r1).replace(NB, ' '), '*Orçamento — Mundo 3Di*\nPeça impressa em 3D\n*Valor: R$ 2,36*');
    var reg = D.novoRegistro(re, { numero: 9, formato: 'imagem', quando: new Date(Date.UTC(2026, 10, 14, 18, 30)), material: 'PLA', cliente: 'Ana', descricao: 'Vaso' });
    igual('registro: nº, formato e data/hora', reg.n + ' ' + reg.formato + ' ' + reg.ts, '9 imagem 2026-11-14T18:30:00.000Z');
    igual('registro: valores (qtd 2, extras R$ 1,50)', [reg.qtd, reg.valorPeca, reg.total, reg.custoTotal, reg.lucro].join('/'), '2/4.18/8.36/4.18/4.18');
    igual('registro: cliente, material e peça', reg.cliente + '|' + reg.material + '|' + reg.descricao, 'Ana|PLA|Vaso');
    igual('registro: formato desconhecido vira texto', D.novoRegistro(r1, { numero: 1, formato: 'x' }).formato, 'texto');
    var lista = [];
    for (var j = 1; j <= 5; j++) lista = D.adicionarRegistro(lista, { n: j }, 3);
    igual('registros: mantém os 3 mais recentes', lista.map(function (x) { return x.n; }).join(','), '3,4,5');
    igual('registros: lista inválida começa do zero', D.adicionarRegistro(null, { n: 1 }).length, 1);

    // v3 · 4. arredondamento (sempre para cima, no valor por peça)
    function arr(v, modo) { return C.arredondarCima(v, modo); }
    igual('arredondar exato: 2,36 não muda', arr(2.36, 'exato'), 2.36);
    igual('arredondar ,50: 2,36 → 2,50', arr(2.36, '50'), 2.5);
    igual('arredondar ,50: 2,51 → 3,00', arr(2.51, '50'), 3);
    igual('arredondar ,50: 2,50 já no formato não muda', arr(2.5, '50'), 2.5);
    igual('arredondar ,90: 2,36 → 2,90', arr(2.36, '90'), 2.9);
    igual('arredondar ,90: 2,91 → 3,90', arr(2.91, '90'), 3.9);
    igual('arredondar ,90: 2,90 já no formato não muda', arr(2.9, '90'), 2.9);
    igual('arredondar ,90: 0,05 → 0,90', arr(0.05, '90'), 0.9);
    igual('arredondar inteiro: 2,36 → 3,00', arr(2.36, 'inteiro'), 3);
    igual('arredondar inteiro: 3,00 já no formato não muda', arr(3, 'inteiro'), 3);
    igual('arredondar inteiro: 3,01 → 4,00', arr(3.01, 'inteiro'), 4);
    igual('arredondar: valor com fração de centavo usa o que a tela mostra (2,5049 → 2,50)', arr(2.5049, '50'), 2.5);
    igual('arredondar: imprecisão de ponto flutuante não sobe (0,1+0,2 → ,50 = 0,50)', arr(0.1 + 0.2 + 0.2, '50'), 0.5);
    igual('arredondar: zero nunca vira ,90', arr(0, '90'), 0);
    [['exato', 'exato'], ['50', '50'], ['90', '90'], ['inteiro', 'inteiro'], ['INTEIRO', 'inteiro'], ['', 'exato'], ['xyz', 'exato'], [null, 'exato'], [90, '90']].forEach(function (t) {
      igual('lerArredondamento ' + JSON.stringify(t[0]), C.lerArredondamento(t[0]), t[1]);
    });
    igual('padrão do arredondamento é exato', C.PADROES.arredondamento, 'exato');
    igual('sem o campo "arredondar": planilha R$ 2,36', m(C.calcular(base).valorCobrar), 'R$ 2,36');
    igual('exato: planilha R$ 2,36 e arredondamento 0', m(com({ arredondar: 'exato' }).valorCobrar) + ' ' + com({ arredondar: 'exato' }).arredondamento, 'R$ 2,36 0');
    var ra50 = com({ arredondar: '50' });
    igual('cálculo ,50: R$ 2,50', m(ra50.valorCobrar), 'R$ 2,50');
    igual('cálculo ,50: arredondamento +R$ 0,14', m(ra50.arredondamento), 'R$ 0,14');
    igual('cálculo ,50: valor por peça antes de arredondar R$ 2,36', m(ra50.valorAntesArredondar), 'R$ 2,36');
    igual('cálculo ,50: lucro recalculado com o valor arredondado (2,50 − 1,18)', m(ra50.lucro), 'R$ 1,32');
    igual('cálculo ,90: R$ 2,90', m(com({ arredondar: '90' }).valorCobrar), 'R$ 2,90');
    igual('cálculo inteiro: R$ 3,00', m(com({ arredondar: 'inteiro' }).valorCobrar), 'R$ 3,00');
    var exato25 = com({ peso: 100, tempo: 0, precoKg: 25, perdaPct: 0, margemPct: 0, arredondar: '50' });
    igual('valor já no formato (R$ 2,50) não muda e não acrescenta nada', m(exato25.valorCobrar) + ' ' + exato25.arredondamento, 'R$ 2,50 0');
    // mínimo → arredondamento
    var rMinArr = com({ minimo: 10, arredondar: 'inteiro' });
    igual('mínimo aplicado: não arredonda', m(rMinArr.valorCobrar) + ' ' + rMinArr.minimoAplicado + ' ' + rMinArr.arredondamento, 'R$ 10,00 true 0');
    var rMin240 = com({ minimo: 2.4, arredondar: 'inteiro' });
    igual('mínimo R$ 2,40 aplicado: fica 2,40 (e não 3,00)', m(rMin240.valorCobrar), 'R$ 2,40');
    igual('mínimo não aplicado (R$ 1,00): arredonda normalmente', m(com({ minimo: 1, arredondar: 'inteiro' }).valorCobrar), 'R$ 3,00');
    // quantidade: o valor por peça é arredondado e o total = peças × valor arredondado
    var r3a = com({ peso: 15, tempo: 30, qtd: 3, arredondar: '50' });
    igual('3 peças ,50: valor por peça R$ 2,50', m(r3a.valorUnitario), 'R$ 2,50');
    igual('3 peças ,50: total = 3 × 2,50 = R$ 7,50', m(r3a.valorCobrar), 'R$ 7,50');
    igual('3 peças ,50: arredondamento no total +R$ 0,41', m(r3a.arredondamento), 'R$ 0,41');
    igual('3 peças ,90: total R$ 8,70', m(com({ peso: 15, tempo: 30, qtd: 3, arredondar: '90' }).valorCobrar), 'R$ 8,70');
    igual('3 peças inteiro: total R$ 9,00', m(com({ peso: 15, tempo: 30, qtd: 3, arredondar: 'inteiro' }).valorCobrar), 'R$ 9,00');
    igual('3 peças exato continua R$ 7,09', m(com({ peso: 15, tempo: 30, qtd: 3 }).valorCobrar), 'R$ 7,09');
    igual('tudo zero com ,90: continua R$ 0,00', m(com({ peso: 0, tempo: 0, arredondar: '90' }).valorCobrar), 'R$ 0,00');
    igual('modo inválido = exato', m(com({ arredondar: 'abc' }).valorCobrar), 'R$ 2,36');
    // orçamento enviado mostra o valor arredondado, sem revelar o arredondamento
    var txtArr = C.textoOrcamento(r3a, { numero: 1 }).replace(NB, ' ');
    igual('texto mostra o valor arredondado', txtArr, '*Orçamento Nº 0001 — Mundo 3Di*\n3 peças impressas em 3D\nValor por peça: R$ 2,50\n*Total: R$ 7,50*');
    igual('texto não cita arredondamento', /arredond/.test(txtArr.toLowerCase()), false);
    igual('imagem: total e valor por peça arredondados', (function () { var d = C.dadosOrcamento(r3a, { numero: 1 }); return d.valorPeca.replace(NB, ' ') + ' / ' + d.total.replace(NB, ' '); })(), 'R$ 2,50 / R$ 7,50');
    igual('dados da imagem não citam arredondamento', /arredond/.test(JSON.stringify(C.dadosOrcamento(r3a, { numero: 1 })).toLowerCase()), false);

    // ---------- peças multicor (item 5) ----------
    var rUma = com({ cores: [{ gramas: 5, precoKg: 150 }], purgaG: 0 });
    igual('multicor: 1 cor sem purga = caso da planilha R$ 2,36', m(rUma.valorCobrar), 'R$ 2,36');
    igual('multicor: sem "cores" continua igual (sem purga)', m(com({}).valorCobrar) + ' ' + com({}).multicor + ' ' + m(com({}).purga), 'R$ 2,36 false R$ 0,00');
    var rMc = C.calcular({ peso: 40, tempo: 0, precoKg: 150, valorHora: 0, perdaPct: 0, margemPct: 0,
      cores: [{ gramas: 30, precoKg: 150 }, { gramas: 10, precoKg: 120 }], purgaG: 8 });
    igual('multicor: material das cores R$ 5,70', m(rMc.material), 'R$ 5,70');
    igual('multicor: purga R$ 1,14 (preço médio 0,1425/g)', m(rMc.purga) + ' ' + rMc.precoMedioGrama.toFixed(4), 'R$ 1,14 0.1425');
    igual('multicor: material + purga R$ 6,84', m(rMc.materialTotal), 'R$ 6,84');
    igual('multicor: custo e valor = R$ 6,84', m(rMc.custoTotal) + ' ' + m(rMc.valorCobrar), 'R$ 6,84 R$ 6,84');
    igual('multicor: peso das peças 40 g, purga 8 g', rMc.pesoTotal + ' ' + rMc.purgaGramas, '40 8');
    var rMesma = C.calcular({ tempo: 0, valorHora: 0, perdaPct: 0, margemPct: 0, precoKg: 150,
      cores: [{ gramas: 20, precoKg: 150 }, { gramas: 10, precoKg: 150 }], purgaG: 10 });
    igual('multicor: mesmo material, purga no preço dele (R$ 1,50)', m(rMesma.purga), 'R$ 1,50');
    var rSemG = C.calcular({ tempo: 0, valorHora: 0, perdaPct: 0, margemPct: 0, precoKg: 150,
      cores: [{ gramas: 0, precoKg: 200 }], purgaG: 10 });
    igual('multicor: sem gramas, purga usa preço da 1ª cor (R$ 2,00)', m(rSemG.purga) + ' ' + m(rSemG.material), 'R$ 2,00 R$ 0,00');
    var rNeg = C.resumirCores([{ gramas: -5, precoKg: 150 }, { gramas: 10, precoKg: 100 }], -3);
    igual('multicor: gramas e purga negativas são ignoradas', rNeg.pesoCores + ' ' + rNeg.purgaG + ' ' + rNeg.material.toFixed(2), '10 0 1.00');
    igual('multicor: lista vazia = tudo zero', C.resumirCores([], 5).purga + ' ' + C.resumirCores([], 5).material, '0 0');
    igual('multicor: limite de cores', C.resumirCores(new Array(12).fill({ gramas: 1, precoKg: 100 })).quantidadeCores, C.MAX_CORES);
    var rMcArr = C.calcular({ tempo: 0, valorHora: 0, perdaPct: 0, margemPct: 100, precoKg: 150, arredondar: 'inteiro',
      cores: [{ gramas: 30, precoKg: 150 }, { gramas: 10, precoKg: 120 }], purgaG: 8 });
    igual('multicor: margem 100% e arredondamento inteiro → R$ 14,00', m(rMcArr.valorCobrar), 'R$ 14,00');

    // ---------- telefone (WhatsApp) ----------
    var ft = C.formatarTelefone;
    igual('telefone: celular 11 dígitos', ft('21988980197'), '(21) 98898-0197');
    igual('telefone: fixo 10 dígitos', ft('2133334444'), '(21) 3333-4444');
    igual('telefone: digitando 1 dígito', ft('2'), '(2');
    igual('telefone: digitando 2 dígitos', ft('21'), '(21');
    igual('telefone: digitando 3 dígitos', ft('219'), '(21) 9');
    igual('telefone: digitando 6 dígitos', ft('219889'), '(21) 9889');
    igual('telefone: digitando 7 dígitos', ft('2198898'), '(21) 9889-8');
    igual('telefone: já formatado não muda', ft('(21) 98898-0197'), '(21) 98898-0197');
    igual('telefone: com +55', ft('+55 21 98898-0197'), '(21) 98898-0197');
    igual('telefone: mais de 11 dígitos corta', ft('219889801971234'), '(21) 98898-0197');
    igual('telefone: vazio e letras', ft('') + '|' + ft('abc'), '|');
    igual('telefone: salvo só com números aparece formatado', C.lerNegocio({ whatsapp: '21988980197' }).whatsapp, '(21) 98898-0197');
    igual('telefone: imagem usa formato', C.dadosOrcamento(r1, { negocio: { whatsapp: '2133334444' }, numero: 1 }).whatsapp, '(21) 3333-4444');
    igual('telefone: texto livre (não telefone) fica como está', C.lerNegocio({ whatsapp: 'só pelo Insta' }).whatsapp, 'só pelo Insta');


    /* ---- Versão MAJOR.MINOR.PATCH e aviso depois de atualizar ---- */
    var NOV = { '0.4': 'histórico, backup e catálogo' };
    function v(t) { var x = C.lerVersao(t); return x ? [x.maior, x.menor, x.patch, x.teste].join('.') : null; }
    igual('versão: formato válido (produção e staging)', v('0.4.0') + '|' + v('0.4.0-teste.12') + '|' + v('1.10.3'), '0.4.0.|0.4.0.12|1.10.3.');
    igual('versão: formato inválido', ['', '0.4', '0.4.0.1', 'v0.4.0', '0.4.0-beta.1', '0.4.0-teste', '0.4.0-teste.', ' 0.4.0', null, undefined, 4].map(function (t) { return v(t); }).join('|'), '||||||||||');
    igual('versão: comparar números (10 > 9, não texto)', C.compararVersoes('0.10.0', '0.9.0') + '|' + C.compararVersoes('0.4.1', '0.4.0') + '|' + C.compararVersoes('0.3.9', '0.4.0') + '|' + C.compararVersoes('1.0.0', '0.99.99'), '1|1|-1|1');
    igual('versão: 0.4.0-teste.5 vem antes de 0.4.0', C.compararVersoes('0.4.0-teste.5', '0.4.0') + '|' + C.compararVersoes('0.4.0', '0.4.0-teste.5') + '|' + C.compararVersoes('0.4.0-teste.5', '0.3.0'), '-1|1|1');
    igual('versão: teste.10 depois de teste.9 e iguais', C.compararVersoes('0.4.0-teste.10', '0.4.0-teste.9') + '|' + C.compararVersoes('0.4.0', '0.4.0') + '|' + C.compararVersoes('0.4.0-teste.2', '0.4.0-teste.2'), '1|0|0');
    igual('versão: comparar com inválida = null', C.compararVersoes('abc', '0.4.0') + '|' + C.compararVersoes('0.4.0', ''), 'null|null');
    var av = function (a, b) { var r = C.avisoAtualizado(a, b, NOV); return r ? r.titulo + ' / ' + r.detalhe : null; };
    igual('aviso: novo MINOR mostra a novidade', av('0.4.0', '0.3.0'), 'Atualizado para a 0.4.0 / Novo: histórico, backup e catálogo');
    igual('aviso: staging ignora o sufixo na busca da novidade', av('0.4.0-teste.1', '0.3.0'), 'Atualizado para a 0.4.0-teste.1 / Novo: histórico, backup e catálogo');
    igual('aviso: só PATCH = correções', av('0.4.1', '0.4.0'), 'Atualizado para a 0.4.1 (correções) / ');
    igual('aviso: só mudou o teste.N (staging) = sem novidade nem correções', av('0.4.0-teste.2', '0.4.0-teste.1'), 'Atualizado para a 0.4.0-teste.2 / ');
    igual('aviso: MINOR sem novidade cadastrada = só o título', av('0.5.0', '0.4.0'), 'Atualizado para a 0.5.0 / ');
    igual('aviso: mesma versão, mais antiga ou inválida = nada', av('0.4.0', '0.4.0') + '|' + av('0.3.0', '0.4.0') + '|' + av('0.4.0', 'lixo') + '|' + av('', '0.3.0'), 'null|null|null|null');
    igual('aviso: staging para produção da mesma versão', av('0.4.0', '0.4.0-teste.3'), 'Atualizado para a 0.4.0 / ');

    /* ---- v4 · etapa 2: registro com os dados digitados e histórico de orçamentos (dados.js) ---- */
    var hojeH = new Date(2026, 10, 14, 18, 0);            // sábado, 14/11/2026 (hora local, o mesmo fuso das datas dos registros)
    function em(dias, h, min) { return new Date(2026, 10, 14 - dias, h === undefined ? 12 : h, min || 0); }
    function mkReg(n, dias, extra) {
      var o = Object.assign({ n: n, ts: em(dias, 10 + (n % 8)).toISOString(), formato: 'texto', qtd: 1, valorPeca: 10, total: 10, custoTotal: 5, lucro: 5, material: '', cliente: '', descricao: '', status: 'enviado', reenvios: 0 }, extra || {});
      return o;
    }

    // item 0 · registro com a entrada
    var entPlanilha = { peso: 5, tempoMin: 10, qtd: 1, extras: 0, margem: 100, materialId: 'pla', materialNome: 'PLA' };
    var regNovo = D.novoRegistro(r1, { numero: 14, formato: 'imagem', quando: em(0, 16, 48), material: 'PLA', cliente: 'Ana Souza', descricao: 'Suporte de celular',
      entrada: entPlanilha, prazo: '5 dias úteis', validadeAte: '2026-11-21', versaoApp: '0.4.0-teste.2' });
    igual('registro v4: entrada gravada', JSON.stringify(regNovo.entrada), JSON.stringify({ peso: 5, tempoMin: 10, qtd: 1, extras: 0, margem: 100, materialId: 'pla', materialNome: 'PLA' }));
    igual('registro v4: versaoApp, situação, reenvios, prazo e validade', [regNovo.versaoApp, regNovo.status, regNovo.reenvios, regNovo.prazo, regNovo.validadeAte].join('|'), '0.4.0-teste.2|enviado|0|5 dias úteis|2026-11-21');
    igual('registro v4: sem catálogo não grava catalogoId nem statusEm', 'catalogoId' in regNovo || 'statusEm' in regNovo, false);
    igual('registro v4: tamanho razoável (~400 bytes; com entrada cabe em 800)', JSON.stringify(regNovo).length < 800, true);
    igual('registro v4: sem entrada informada não inventa entrada', 'entrada' in D.novoRegistro(r1, { numero: 1 }), false);
    igual('registro v4: cliente do painel vai para o registro também no envio em texto', D.novoRegistro(r1, { numero: 1, formato: 'texto', cliente: '  Ana   Souza ' }).cliente, 'Ana Souza');
    igual('registro v4: versão do staging é aceita (com sufixo)', D.novoRegistro(r1, { numero: 1, versaoApp: '0.4.0-teste.2' }).versaoApp, '0.4.0-teste.2');
    var entMulti = { peso: 40, tempoMin: 155, qtd: 3, extras: 1.5, margem: 80, materialId: 'pla', materialNome: 'PLA',
      cores: [{ materialId: 'pla', nome: 'PLA', gramas: 30 }, { materialId: 'petg', nome: 'PETG', gramas: 10 }], purgaG: 8 };
    var eM = D.montarEntrada(entMulti);
    igual('entrada multicor: cores e purga', eM.cores.length + '|' + eM.cores[1].nome + '|' + eM.purgaG, '2|PETG|8');
    igual('entrada: sem cores não grava purga', 'purgaG' in D.montarEntrada({ peso: 5, tempoMin: 10, qtd: 1, purgaG: 9 }), false);
    igual('entrada: limite de 8 cores', D.montarEntrada({ cores: new Array(12).fill({ nome: 'x', gramas: 1 }) }).cores.length, 8);
    igual('entrada: inválida vira null', D.montarEntrada(null) + '|' + D.montarEntrada('x'), 'null|null');
    igual('entrada: valores negativos e lixo viram 0 e quantidade mínima 1', JSON.stringify(D.montarEntrada({ peso: -3, tempoMin: 'x', qtd: 0, extras: NaN, margem: -1 })),
      '{"peso":0,"tempoMin":0,"qtd":1,"extras":0,"margem":0,"materialId":"","materialNome":""}');

    // texto de volta para os campos (textoCampo e textoTempo precisam voltar ao mesmo valor)
    [[5, '5'], [48.37, '48,37'], [1234.5, '1234,5'], [1000, '1000'], [0.0375, '0,0375'], [100, '100'], [0, ''], [-2, ''], [NaN, '']].forEach(function (t) {
      igual('textoCampo ' + t[0], D.textoCampo(t[0]), t[1]);
    });
    [1234.5, 48.37, 1000, 7, 0.5].forEach(function (n) { igual('textoCampo volta ao mesmo número ' + n, C.lerNumero(D.textoCampo(n)), n); });
    [[155, '2h35'], [120, '2h00'], [60, '1h00'], [45, '45'], [10, '10'], [1, '1'], [12.5, '12,5'], [0, ''], [600, '10h00'], [605, '10h05']].forEach(function (t) {
      igual('textoTempo ' + t[0], D.textoTempo(t[0]), t[1]);
    });
    [10, 45, 60, 155, 120, 12.5, 0.5, 599, 1440].forEach(function (mi) { igual('textoTempo volta ao mesmo tempo ' + mi, C.lerTempo(D.textoTempo(mi)), mi); });
    var cp = D.entradaParaCampos(entPlanilha);
    igual('usar de novo: campos da planilha', [cp.peso, cp.tempo, cp.qtd, cp.extras, cp.margem, cp.outra, cp.multicor].join('|'), '5|10|1||100|false|false');
    igual('usar de novo recalcula: planilha dá R$ 2,36 com os preços de hoje', m(C.calcular({ peso: C.lerNumero(cp.peso), tempo: C.lerTempo(cp.tempo), qtd: C.lerQuantidade(cp.qtd),
      extrasPeca: C.lerNumero(cp.extras), margemPct: C.lerNumero(cp.margem), precoKg: 150, valorHora: 2.25, perdaPct: 5 }).valorCobrar), 'R$ 2,36');
    igual('usar de novo recalcula com preços novos (rolo a R$ 200/kg)', m(C.calcular({ peso: C.lerNumero(cp.peso), tempo: C.lerTempo(cp.tempo), precoKg: 200, valorHora: 2.25, perdaPct: 5, margemPct: C.lerNumero(cp.margem) }).valorCobrar), 'R$ 2,89');
    var cm = D.entradaParaCampos(entMulti);
    igual('usar de novo multicor: cores, purga e margem 80 (atalho)', [cm.multicor, cm.peso, cm.cores.map(function (c) { return c.id + ':' + c.g; }).join(','), cm.purga, cm.margem, cm.outra, cm.tempo, cm.qtd, cm.extras].join('|'),
      'true||pla:30,petg:10|8|80|false|2h35|3|1,5');
    igual('usar de novo: margem fora dos atalhos abre "Outra"', D.entradaParaCampos({ peso: 1, tempoMin: 1, qtd: 1, margem: 85.5 }).outra + '|' + D.entradaParaCampos({ peso: 1, tempoMin: 1, qtd: 1, margem: 85.5 }).margem, 'true|85,5');
    igual('usar de novo: registro antigo (sem entrada) não tem campos', D.entradaParaCampos(undefined), null);
    // o orçamento recalculado a partir dos campos devolvidos é o mesmo da época (mesmos preços): mesa de 3 peças com extras, margem 80
    var rEnt = C.calcular({ peso: 15, tempo: 30, qtd: 3, extrasPeca: 1.5, margemPct: 80, precoKg: 150, valorHora: 2.25, perdaPct: 5 });
    var cE = D.entradaParaCampos(D.montarEntrada({ peso: 15, tempoMin: 30, qtd: 3, extras: 1.5, margem: 80 }));
    var rVolta = C.calcular({ peso: C.lerNumero(cE.peso), tempo: C.lerTempo(cE.tempo), qtd: C.lerQuantidade(cE.qtd), extrasPeca: C.lerNumero(cE.extras), margemPct: C.lerNumero(cE.margem), precoKg: 150, valorHora: 2.25, perdaPct: 5 });
    igual('usar de novo: mesmos preços, mesmo valor', m(rVolta.valorCobrar) + ' ' + m(rVolta.valorUnitario), m(rEnt.valorCobrar) + ' ' + m(rEnt.valorUnitario));

    // registros antigos (v3, sem os campos novos) continuam abrindo
    var antigo = { n: 3, ts: em(2, 9).toISOString(), formato: 'imagem', qtd: 2, valorPeca: 4.18, total: 8.36, custoTotal: 4.18, lucro: 4.18, material: 'PLA', cliente: 'Ana', descricao: 'Vaso' };
    var lidos = D.lerRegistros([antigo, null, 7, { n: 'x', ts: 'lixo' }, { n: 1 }, { n: 5, ts: 'não é data' }]);
    igual('registro antigo: lista lê só os válidos', lidos.length, 1);
    igual('registro antigo: sem entrada, situação enviado, 0 reenvios', ('entrada' in lidos[0]) + '|' + lidos[0].status + '|' + lidos[0].reenvios + '|' + ('versaoApp' in lidos[0]), 'false|enviado|0|false');
    igual('registro antigo: dados preservados', [lidos[0].n, lidos[0].cliente, lidos[0].total, lidos[0].material].join('|'), '3|Ana|8.36|PLA');
    igual('registros: lista que não é lista vira vazia', D.lerRegistros(null).length + '|' + D.lerRegistros('x').length, '0|0');
    igual('registro: situação desconhecida volta a enviado', D.lerRegistros([Object.assign({}, antigo, { status: 'lixo' })])[0].status, 'enviado');
    igual('registro: ida e volta (ler o que foi gravado) não muda nada', JSON.stringify(D.lerRegistros([regNovo])[0]), JSON.stringify(regNovo));

    // item 1 · período, busca, resumo
    var base30 = [
      mkReg(14, 0, { cliente: 'Ana Souza', descricao: 'Suporte de celular', qtd: 10, total: 62.41, formato: 'imagem' }),
      mkReg(13, 0, { cliente: 'Oficina do Léo', total: 17.48, status: 'aprovado' }),
      mkReg(12, 0, { total: 27.33 }),
      mkReg(11, 1, { cliente: 'Marina Lopes', descricao: 'Vaso geométrico', total: 60.17, status: 'aprovado' }),
      mkReg(10, 1, { cliente: 'José Carlos', total: 79.5, status: 'recusado' }),
      mkReg(9, 9, { cliente: 'Escola Arco-Íris', total: 95, validadeAte: '2026-11-12' }),
      mkReg(8, 40, { cliente: 'Antigo', total: 20 })
    ];
    var ids = function (l) { return l.map(function (x) { return x.n; }).join(','); };
    igual('período hoje', ids(D.filtrarRegistros(base30, { periodo: 'hoje', hoje: hojeH })), '14,13,12');
    igual('período 7 dias (hoje e os 6 anteriores)', ids(D.filtrarRegistros(base30, { periodo: '7', hoje: hojeH })), '14,13,12,11,10');
    igual('período 30 dias (padrão)', ids(D.filtrarRegistros(base30, { hoje: hojeH })), '14,13,12,11,10,9');
    igual('período tudo', ids(D.filtrarRegistros(base30, { periodo: 'tudo', hoje: hojeH })), '14,13,12,11,10,9,8');
    igual('período: borda dos 7 dias (6 dias atrás entra, 7 não)', ids(D.filtrarRegistros([mkReg(1, 6), mkReg(2, 7)], { periodo: '7', hoje: hojeH })), '1');
    igual('ordem: do mais novo para o mais antigo', ids(D.filtrarRegistros([mkReg(1, 3), mkReg(2, 0), mkReg(3, 1)], { periodo: 'tudo', hoje: hojeH })), '2,3,1');
    igual('busca por cliente sem diferenciar acento e maiúscula', ids(D.filtrarRegistros(base30, { busca: 'JOSE', periodo: 'tudo', hoje: hojeH })), '10');
    igual('busca por cliente com acento digitado', ids(D.filtrarRegistros(base30, { busca: 'léo', periodo: 'tudo', hoje: hojeH })), '13');
    igual('busca pela peça', ids(D.filtrarRegistros(base30, { busca: 'suporte', periodo: 'tudo', hoje: hojeH })), '14');
    igual('busca pelo nº (com e sem zeros)', ids(D.filtrarRegistros(base30, { busca: '0011', periodo: 'tudo', hoje: hojeH })) + '|' + ids(D.filtrarRegistros(base30, { busca: '8', periodo: 'tudo', hoje: hojeH })), '11|8');
    igual('busca vazia ou só espaços não filtra', ids(D.filtrarRegistros(base30, { busca: '   ', hoje: hojeH })), '14,13,12,11,10,9');
    igual('busca respeita o período', ids(D.filtrarRegistros(base30, { busca: 'antigo', hoje: hojeH })) + '|' + ids(D.filtrarRegistros(base30, { busca: 'antigo', periodo: 'tudo', hoje: hojeH })), '|8');
    igual('normalizarBusca', D.normalizarBusca('  José   AÇAÍ ') , 'jose acai');
    var res = D.resumir(D.filtrarRegistros(base30, { hoje: hojeH }));
    igual('resumo: enviados, soma e aprovados', res.qtd + '|' + res.total + '|' + res.aprovados + '|' + res.totalAprovados, '6|341.89|2|77.65');
    igual('resumo: lista vazia', JSON.stringify(D.resumir([])), '{"qtd":0,"total":0,"aprovados":0,"totalAprovados":0}');
    igual('resumo: soma em centavos (0,10 + 0,20 = 0,30)', D.resumir([mkReg(1, 0, { total: 0.1 }), mkReg(2, 0, { total: 0.2 })]).total, 0.3);
    var dias = D.agruparPorDia(D.filtrarRegistros(base30, { periodo: 'tudo', hoje: hojeH }), hojeH);
    igual('agrupar por dia: rótulos', dias.map(function (g) { return g.rotulo + '(' + g.itens.length + ')'; }).join(' · '), 'Hoje(3) · Ontem(2) · Qui, 05/11(1) · Seg, 05/10(1)');
    igual('agrupar por dia: outro ano mostra o ano', D.agruparPorDia([mkReg(1, 400)], hojeH)[0].rotulo, 'Sex, 10/10/2025');
    igual('agrupar por dia: lista vazia', D.agruparPorDia([], hojeH).length, 0);

    // situação: Vencido é calculado, não gravado
    igual('situação: enviado com validade passada = vencido', D.situacao(base30[5], hojeH), 'vencido');
    igual('situação: último dia da validade ainda vale', D.situacao(mkReg(1, 0, { validadeAte: '2026-11-14' }), hojeH) + '|' + D.situacao(mkReg(1, 0, { validadeAte: '2026-11-13' }), hojeH), 'enviado|vencido');
    igual('situação: aprovado e recusado nunca viram vencido', D.situacao(mkReg(1, 0, { status: 'aprovado', validadeAte: '2026-01-01' }), hojeH) + '|' + D.situacao(mkReg(1, 0, { status: 'recusado', validadeAte: '2026-01-01' }), hojeH), 'aprovado|recusado');
    igual('situação: sem validade (texto, registro antigo) nunca vence', D.situacao(base30[0], hojeH) + '|' + D.situacao(mkReg(1, 90), hojeH), 'enviado|enviado');
    igual('situação: vencido não é gravado no registro', D.atualizarRegistro(base30, D.chaveRegistro(base30[5]), { cliente: 'Escola' })[5].status, 'enviado');

    // mudar situação, editar, reenviar, excluir
    var chave14 = D.chaveRegistro(base30[0]);
    var comStatus = D.atualizarRegistro(base30, chave14, { status: 'aprovado', statusEm: em(0, 17).toISOString() });
    igual('mudar situação grava situação e data', comStatus[0].status + '|' + comStatus[0].statusEm.slice(0, 10), 'aprovado|2026-11-14');
    igual('mudar situação não mexe nos outros nem na lista original', base30[0].status + '|' + comStatus[1].status + '|' + comStatus.length, 'enviado|aprovado|7');
    igual('mudar situação: valor inválido é ignorado', D.atualizarRegistro(base30, chave14, { status: 'vencido' })[0].status, 'enviado');
    igual('mudar situação sem data usa agora', /^\d{4}-\d{2}-\d{2}T/.test(D.atualizarRegistro(base30, chave14, { status: 'recusado' })[0].statusEm), true);
    var editado = D.atualizarRegistro(base30, chave14, { cliente: '  Ana   S. ', descricao: 'Porta-chaves' });
    igual('editar cliente e peça', editado[0].cliente + '|' + editado[0].descricao, 'Ana S.|Porta-chaves');
    igual('editar não muda valores nem entrada', editado[0].total + '|' + editado[0].qtd, '62.41|10');
    igual('chave inexistente não muda nada', JSON.stringify(D.atualizarRegistro(base30, '999|x', { cliente: 'Z' })), JSON.stringify(base30));
    var reenv = D.atualizarRegistro(base30, chave14, { reenvios: base30[0].reenvios + 1 });
    igual('reenviar: soma 1 em reenvios, sem novo registro e mesmo nº', reenv[0].reenvios + '|' + reenv.length + '|' + reenv[0].n, '1|7|14');
    igual('reenviar: o orçamento refeito do registro tem o mesmo texto do original',
      C.textoOrcamento(D.orcamentoDeRegistro(regNovo), { numero: regNovo.n }), C.textoOrcamento(r1, { numero: 14 }));
    igual('reenviar: a imagem refeita do registro tem os mesmos valores',
      JSON.stringify(C.dadosOrcamento(D.orcamentoDeRegistro(D.novoRegistro(r3, { numero: 2 })), { numero: 2, data: hojeH })), JSON.stringify(C.dadosOrcamento(r3, { numero: 2, data: hojeH })));
    igual('reenviar: validade do envio original vale no lugar da de hoje', C.dadosOrcamento(r1, { numero: 1, data: hojeH, validadeAte: '2026-11-21' }).validade + '|' + C.dadosOrcamento(r1, { numero: 1, data: hojeH, validadeAte: '' }).validade + '|' + C.dadosOrcamento(r1, { numero: 1, data: hojeH }).validade, '21/11/2026||21/11/2026');
    var semEle = D.excluirRegistro(base30, chave14);
    igual('excluir tira só o registro escolhido', semEle.length + '|' + ids(semEle), '6|13,12,11,10,9,8');
    igual('excluir chave inexistente não muda nada', D.excluirRegistro(base30, '999|x').length, 7);

    // clientes recentes e texto de cada linha
    igual('últimos 3 clientes diferentes (mais recente primeiro, sem repetir)', D.ultimosClientes(base30.concat([mkReg(15, 0, { cliente: 'ana souza' })]), 3).join(', '), 'ana souza, Oficina do Léo, Marina Lopes');
    igual('últimos clientes: sem cliente não entra; lista curta', D.ultimosClientes([mkReg(1, 0), mkReg(2, 1, { cliente: 'Zé' })], 3).join(','), 'Zé');
    igual('linha: peça digitada', D.descricaoLinha(base30[0]), 'Suporte de celular');
    igual('linha: N peças · material (da entrada)', D.descricaoLinha(mkReg(1, 0, { qtd: 10, entrada: D.montarEntrada(entPlanilha) })), '10 peças · PLA');
    igual('linha: 1 peça sem material', D.descricaoLinha(mkReg(1, 0)), '1 peça');
    igual('linha: registro antigo usa o material gravado', D.descricaoLinha(lidos[0]), 'Vaso');
    igual('material do registro multicor', D.materialDoRegistro({ entrada: eM }) + '|' + D.materialParaEnvio({ entrada: eM }, true) + '|' + D.materialParaEnvio({ entrada: eM }, false), 'PLA + PETG|PLA + PETG (multicor)|');
    igual('material para o reenvio só com a opção ligada', D.materialParaEnvio({ entrada: D.montarEntrada(entPlanilha) }, true) + '|' + D.materialParaEnvio({ entrada: D.montarEntrada(entPlanilha) }, false), 'PLA|');
    igual('material do registro antigo vem do que foi gravado', D.materialDoRegistro({ material: 'PETG' }) + '|' + D.materialParaEnvio({ material: 'PETG' }, true), 'PETG|PETG');
    igual('descrição do envio', D.descreverEnvio(base30[0], hojeH) + ' / ' + D.descreverEnvio(base30[3], hojeH) + ' / ' + D.descreverEnvio(base30[5], hojeH),
      'Enviado hoje às ' + D.hora(base30[0].ts) + ' como imagem / Enviado ontem às ' + D.hora(base30[3].ts) + ' como texto / Enviado em 05/11/2026 às ' + D.hora(base30[5].ts) + ' como texto');
    igual('validade curta', D.validadeCurta('2026-11-21', hojeH) + '|' + D.validadeCurta('2027-01-05', hojeH) + '|' + D.validadeCurta('', hojeH), '21/11|05/01/2027|');
    igual('rótulos de situação', ['enviado', 'aprovado', 'recusado', 'vencido'].map(function (k) { return D.ROTULOS_SITUACAO[k]; }).join(','), 'Enviado,Aprovado,Recusado,Vencido');

    // lembrete de backup
    var muitos = []; for (var q = 1; q <= 20; q++) muitos.push(mkReg(q, 0));
    igual('lembrete: sem backup, 20 orçamentos = mostrar', JSON.stringify(D.precisaLembreteBackup(muitos, null)), '{"mostrar":true,"qtd":20}');
    igual('lembrete: sem backup, 19 orçamentos = não mostrar', D.precisaLembreteBackup(muitos.slice(1), null).mostrar, false);
    igual('lembrete: conta só os depois do backup', JSON.stringify(D.precisaLembreteBackup(muitos, { em: em(0, 10, 30).toISOString() })), '{"mostrar":false,"qtd":' + muitos.filter(function (x) { return new Date(x.ts) > em(0, 10, 30); }).length + '}');
    igual('lembrete: limite padrão 20', D.LIMITE_LEMBRETE_BACKUP, 20);

    /* ---- v4 · etapa 3: backup, restauração e planilha (dados.js) ---- */
    var LOGO = 'data:image/png;base64,iVBORw0KGgo=';
    var cfgBackup = { precoKg: 150, valorHora: 2.25, perdaPct: 5, minimo: 0, materiais: [{ id: 'pla', nome: 'PLA', preco: 150, pesoG: 1000 }, { id: 'petg', nome: 'PETG', preco: 130, pesoG: 1000 }], materialPadrao: 'pla' };
    var regsBk = [mkReg(1, 5, { cliente: 'Ana', entrada: D.montarEntrada(entPlanilha), versaoApp: '0.4.0' }), mkReg(2, 3), mkReg(3, 1, { status: 'aprovado', statusEm: em(1, 9).toISOString() })];
    var aparelho = { config: cfgBackup, logo: LOGO, contador: 3, registros: regsBk, catalogo: [{ id: 'c1', nome: 'Suporte' }], materialAtual: 'petg' };
    var arqBk = D.montarBackup(aparelho, { ambiente: 'producao', versaoApp: '0.4.0', criadoEm: em(0, 18, 40) });
    igual('backup: cabeçalho do arquivo', [arqBk.app, arqBk.formato, arqBk.ambiente, arqBk.versaoApp, arqBk.criadoEm === em(0, 18, 40).toISOString()].join('|'), 'mundo3di|2|producao|0.4.0|true');
    igual('backup: dados guardados', Object.keys(arqBk.dados).join(','), 'config,logo,contador,registros,catalogo,materialAtual');
    igual('backup: versaoApp do staging aceita o sufixo', D.montarBackup(aparelho, { versaoApp: '0.4.0-teste.3' }).versaoApp, '0.4.0-teste.3');
    igual('backup: nome do arquivo', D.nomeArquivoBackup(hojeH), 'backup-orcamento-3di-2026-11-14.json');
    igual('backup: nome da planilha', D.nomeArquivoCSV(hojeH), 'orcamentos-3di-2026-11-14.csv');
    var lido = D.lerBackup(JSON.stringify(arqBk));
    igual('backup: ida e volta (exportar → restaurar) dá os mesmos dados', lido.ok + '|' + JSON.stringify(lido.backup.dados), 'true|' + JSON.stringify(D.montarDados(aparelho)));
    igual('backup: ida e volta mantém entrada e situação dos orçamentos', lido.backup.dados.registros[0].entrada.materialNome + '|' + lido.backup.dados.registros[2].status, 'PLA|aprovado');
    igual('backup: arquivo com BOM é lido', D.lerBackup('﻿' + JSON.stringify(arqBk)).ok, true);
    igual('backup: sem logo e sem catálogo', JSON.stringify(D.lerBackup(JSON.stringify(D.montarBackup({ config: cfgBackup, contador: 1, registros: [] }, {}))).backup.dados.catalogo) + '|' + D.lerBackup(JSON.stringify(D.montarBackup({ config: cfgBackup }, {}))).backup.dados.logo + '|', '[]||');
    igual('backup: logo que não é imagem é descartado', D.montarDados({ logo: 'javascript:alert(1)' }).logo, '');
    igual('backup: registros inválidos são descartados na leitura', D.lerBackup(JSON.stringify({ app: 'mundo3di', formato: 1, dados: { registros: [regsBk[0], null, { n: 'x' }, 7] } })).backup.dados.registros.length, 1);
    igual('backup: catálogo guarda no máximo 100 peças', D.montarDados({ catalogo: new Array(130).fill({ id: 'x' }) }).catalogo.length, 100);
    function erroBk(txt) { var r = D.lerBackup(txt); return r.ok ? 'ok' : r.erro; }
    igual('backup inválido: texto que não é JSON', erroBk('isto não é json'), 'invalido');
    igual('backup inválido: JSON de outro app', erroBk('{"app":"outro","formato":1,"dados":{}}'), 'invalido');
    igual('backup inválido: sem dados', erroBk('{"app":"mundo3di","formato":1}'), 'invalido');
    igual('backup inválido: lista em vez de arquivo', erroBk('[1,2]'), 'invalido');
    igual('backup inválido: formato que não é número', erroBk('{"app":"mundo3di","formato":"1","dados":{}}'), 'invalido');
    igual('backup inválido: arquivo da planilha', erroBk('Nº;Data;Hora'), 'invalido');
    igual('backup de formato mais novo pede atualizar o app', erroBk('{"app":"mundo3di","formato":3,"dados":{}}'), 'novo');
    igual('backup: mensagens de erro', D.ERROS_BACKUP.invalido + ' / ' + D.ERROS_BACKUP.novo, 'Este arquivo não é um backup do Mundo 3Di. / Backup feito numa versão mais nova. Atualize o app.');
    igual('backup: arquivo grande demais não é lido', erroBk(new Array(D.MAX_ARQUIVO_BACKUP + 2).join('a')), 'grande');
    igual('backup de outro ambiente é aceito', D.lerBackup(JSON.stringify(D.montarBackup(aparelho, { ambiente: 'teste' }))).backup.ambiente, 'teste');
    var rb = D.resumoBackup(lido.backup);
    igual('resumo do backup', [rb.filamentos, rb.temLogo, rb.pecas, rb.orcamentos, rb.numMin, rb.numMax].join('|'), '2|true|1|3|1|3');
    igual('resumo: texto dos orçamentos', D.descreverOrcamentos(rb) + ' / ' + D.descreverOrcamentos({ orcamentos: 1, numMin: 7, numMax: 7 }) + ' / ' + D.descreverOrcamentos({ orcamentos: 0 }), '3 orçamentos (Nº 0001 a 0003) / 1 orçamento (Nº 0007) / Nenhum orçamento');

    // restaurar: substitui configurações, logo, catálogo e filamento; junta orçamentos; contador pelo maior
    var celular = { config: { precoKg: 99, materiais: [{ id: 'abs', nome: 'ABS', preco: 99, pesoG: 1000 }], materialPadrao: 'abs' }, logo: 'data:image/png;base64,AAAA', contador: 6,
      registros: [mkReg(3, 1, { status: 'recusado' }), mkReg(5, 0), mkReg(6, 0)], catalogo: [], materialAtual: 'abs' };
    var rest = D.restaurarDados(celular, lido.backup.dados);
    igual('restaurar: substitui configurações, logo, catálogo e filamento atual', JSON.stringify(rest.config) + '|' + (rest.logo === LOGO) + '|' + rest.catalogo.length + '|' + rest.materialAtual, JSON.stringify(cfgBackup) + '|true|1|petg');
    igual('restaurar: junta os orçamentos sem repetir (mesmo nº + data/hora) e em ordem de data', rest.registros.map(function (r) { return r.n; }).join(','), '1,2,3,5,6');
    igual('restaurar: no registro repetido vale o deste aparelho', rest.registros.filter(function (r) { return r.n === 3; })[0].status, 'recusado');
    igual('restaurar: contador = o maior (do aparelho)', rest.contador, 6);
    igual('restaurar: contador = o maior (do backup)', D.restaurarDados({ contador: 2, registros: [] }, { contador: 128, registros: [] }).contador, 128);
    igual('restaurar: o próximo número nunca repete um registro que existe', D.restaurarDados({ contador: 0, registros: [mkReg(9, 0)] }, { contador: 4, registros: [] }).contador, 9);
    igual('restaurar: mesmo nº com data/hora diferente são dois registros', D.juntarRegistros([mkReg(7, 0)], [mkReg(7, 3)]).length, 2);
    igual('restaurar: backup sem logo tira o logo deste aparelho', D.restaurarDados(celular, D.montarDados({ config: cfgBackup })).logo, '');
    igual('restaurar: não muda o objeto do aparelho nem do backup', celular.registros.length + '|' + lido.backup.dados.registros.length, '3|3');
    var muitosR = []; for (var qq = 1; qq <= 2005; qq++) muitosR.push(mkReg(qq, 40 - Math.floor(qq / 100), { ts: new Date(2026, 0, 1, 0, qq).toISOString() }));
    var juntos = D.juntarRegistros(muitosR.slice(0, 1500), muitosR.slice(1000), 2000);
    igual('restaurar: limite de 2.000 orçamentos (saem os mais antigos)', juntos.length + '|' + juntos[0].n + '|' + juntos[1999].n, '2000|6|2005');

    // desfazer a restauração
    var antes = { em: em(0, 18, 50).toISOString(), dados: D.montarDados(celular) };
    var depoisRest = D.restaurarDados(celular, lido.backup.dados);
    var novoEnvio = mkReg(7, 0, { ts: em(0, 19, 5).toISOString() });
    var aposDepois = { config: depoisRest.config, logo: depoisRest.logo, contador: 7, registros: D.juntarRegistros(depoisRest.registros, [novoEnvio]), catalogo: depoisRest.catalogo, materialAtual: depoisRest.materialAtual };
    var desfeito = D.desfazerRestauracao(aposDepois, antes);
    igual('desfazer: volta configurações, logo, catálogo e filamento', JSON.stringify(desfeito.config) + '|' + desfeito.logo + '|' + desfeito.catalogo.length + '|' + desfeito.materialAtual, JSON.stringify(celular.config) + '|data:image/png;base64,AAAA|0|abs');
    igual('desfazer: tira os orçamentos do backup e mantém os enviados depois', desfeito.registros.map(function (r) { return r.n; }).join(','), '3,5,6,7');
    igual('desfazer: contador não volta atrás', desfeito.contador, 7);
    igual('desfazer: sem estado guardado válido não quebra', D.desfazerRestauracao(aposDepois, null).registros.length >= 1, true);

    // situação do cartão Backup e lembrete
    var umDia = []; for (var u = 1; u <= 9; u++) umDia.push(mkReg(u, 0, { ts: em(0, 12, u).toISOString() }));
    igual('cartão: nenhum backup, nenhum orçamento', JSON.stringify(D.descreverBackup(null, [], hojeH)), '{"titulo":"Nenhum backup feito ainda","detalhe":""}');
    igual('cartão: nenhum backup, com orçamentos', D.descreverBackup(null, umDia, hojeH).detalhe + '|' + D.descreverBackup(null, umDia.slice(0, 1), hojeH).detalhe, '9 orçamentos ainda sem backup|1 orçamento ainda sem backup');
    var bkAntigo = { em: new Date(2026, 10, 2, 18, 40).toISOString(), qtd: 3 };
    igual('cartão: último backup, há 12 dias e orçamentos depois dele', JSON.stringify(D.descreverBackup(bkAntigo, umDia, hojeH)), '{"titulo":"Último backup: 02/11/2026","detalhe":"há 12 dias · 9 orçamentos depois dele"}');
    igual('cartão: backup de hoje, sem orçamento depois', JSON.stringify(D.descreverBackup({ em: em(0, 17).toISOString() }, [], hojeH)), '{"titulo":"Último backup: 14/11/2026","detalhe":"hoje · nenhum orçamento depois dele"}');
    igual('cartão: ontem e 1 orçamento depois', D.descreverBackup({ em: em(1, 9).toISOString() }, [mkReg(1, 0)], hojeH).detalhe, 'ontem · 1 orçamento depois dele');
    igual('cartão: backup com data inválida vale como nenhum', D.descreverBackup({ em: 'lixo' }, [], hojeH).titulo, 'Nenhum backup feito ainda');
    igual('lembrete: texto com e sem backup', D.textoLembreteBackup(21, bkAntigo) + ' / ' + D.textoLembreteBackup(1, null), '21 orçamentos desde o último backup. / 1 orçamento sem backup.');
    igual('lembrete: depois do backup a contagem recomeça', D.precisaLembreteBackup(muitos, { em: em(0, 23).toISOString() }).qtd, 0);

    // planilha (CSV)
    var csvRegs = [
      mkReg(2, 0, { cliente: 'Zé; "Pé" Ltda', descricao: 'Chaveiro\nlogo', qtd: 50, valorPeca: 1.59, total: 79.5, custoTotal: 40.25, lucro: 39.25, status: 'recusado', formato: 'imagem', reenvios: 2 }),
      mkReg(1, 9, { cliente: 'José', descricao: 'Vaso geométrico', qtd: 1, valorPeca: 1234.5, total: 1234.5, custoTotal: 600, lucro: 634.5, validadeAte: '2026-11-12', entrada: D.montarEntrada(entPlanilha) }),
      mkReg(3, 1, { cliente: '=SOMA(A1)', lucro: -2.5 })
    ];
    var csv = D.gerarCSV(csvRegs, hojeH), linhasCsv = csv.split('\r\n');
    igual('planilha: começa com BOM e termina com quebra de linha', (csv.charCodeAt(0) === 0xFEFF) + '|' + (linhasCsv[linhasCsv.length - 1] === ''), 'true|true');
    igual('planilha: colunas', linhasCsv[0].replace('﻿', ''), 'Nº;Data;Hora;Formato;Cliente;Peça;Material;Quantidade;Valor por peça;Total;Custo total;Lucro;Situação;Reenvios;Etapa;Data da aprovação;Data da etapa atual;Condição;Recebido;Falta');
    igual('planilha: uma linha por orçamento, do mais antigo para o mais novo', linhasCsv.length + '|' + linhasCsv[1].split(';')[0] + ',' + linhasCsv[2].split(';')[0], '5|0001,0003');
    igual('planilha: acento, vírgula decimal e situação calculada (vencido)', linhasCsv[1], '0001;05/11/2026;' + D.hora(csvRegs[1].ts) + ';Texto;José;Vaso geométrico;PLA;1;1234,50;1234,50;600,00;634,50;Vencido;0;Orçado;;;;;');
    igual('planilha: fórmula não é interpretada e lucro negativo sai com sinal', linhasCsv[2], '0003;13/11/2026;' + D.hora(csvRegs[2].ts) + ";Texto;'=SOMA(A1);;;1;10,00;10,00;5,00;-2,50;Orçado;0;Orçado;;;;;");
    igual('planilha: ; e aspas entre aspas, aspas dobradas e quebra de linha dentro do campo', csv.indexOf('"Zé; ""Pé"" Ltda";"Chaveiro\nlogo"') > -1, true);
    igual('planilha: imagem recusada com reenvios', csv.indexOf(';Imagem;') > -1 && csv.indexOf(';79,50;40,25;39,25;Recusado;2') > -1, true);
    igual('planilha: sem orçamento só tem o cabeçalho', D.gerarCSV([], hojeH).split('\r\n').filter(Boolean).length, 1);
    igual('planilha: não muda a lista original', csvRegs[0].n + ',' + csvRegs[1].n, '2,1');
    igual('planilha: aceita registro com 2.000 linhas', D.gerarCSV(muitosR.slice(0, 2000).map(function (r) { return D.lerRegistro(r); }), hojeH).split('\r\n').length, 2002);

    /* ---- v4 · etapa 4: catálogo de peças recorrentes (dados.js) ---- */
    var entMesa = { peso: 96, tempoMin: 250, qtd: 8, extras: 0.5, margem: 100, materialId: 'pla', materialNome: 'PLA' };
    var catQuando = new Date(2026, 10, 14, 10, 0);
    var s1 = D.salvarPeca([], { nome: '  Suporte   de celular ', descricao: 'Suporte para celular', entrada: entMesa, precoRef: 6.24, quando: catQuando });
    igual('catálogo: salvar peça nova', s1.ok + '|' + s1.substituiu + '|' + s1.lista.length + '|' + s1.peca.nome + '|' + s1.peca.usos + '|' + s1.peca.precoRef, 'true|false|1|Suporte de celular|0|6.24');
    igual('catálogo: peça guarda a entrada da mesa e a data da referência', JSON.stringify(s1.peca.entrada) + '|' + s1.peca.precoRefEm, JSON.stringify(D.montarEntrada(entMesa)) + '|' + catQuando.toISOString());
    igual('catálogo: precoRefEm vindo do histórico é mantido', D.salvarPeca([], { nome: 'A', entrada: entMesa, precoRef: 1, precoRefEm: '2026-10-28T12:00:00.000Z' }).peca.precoRefEm, '2026-10-28T12:00:00.000Z');
    igual('catálogo: nome vazio ou sem entrada não salva', D.salvarPeca([], { nome: '  ', entrada: entMesa }).erro + '|' + D.salvarPeca([], { nome: 'A' }).erro, 'invalido|invalido');
    igual('catálogo: nome cortado em 120 e descrição em 120', D.salvarPeca([], { nome: new Array(200).join('a'), descricao: new Array(200).join('b'), entrada: entMesa }).peca.nome.length + '|' + D.salvarPeca([], { nome: 'A', descricao: new Array(200).join('b'), entrada: entMesa }).peca.descricao.length, '120|120');
    var nomeLongo = 'Abridor de lata Boneco de Neve - cód. 3524517';
    igual('catálogo: nome de 45 letras (v0.4.1) é salvo inteiro', nomeLongo.length + '|' + D.salvarPeca([], { nome: nomeLongo, entrada: entMesa }).peca.nome, '45|' + nomeLongo);
    igual('catálogo: nome longo é lido inteiro e a busca por nome o acha', D.lerCatalogo(D.salvarPeca([], { nome: nomeLongo, entrada: entMesa }).lista)[0].nome + '|' + !!D.pecaComNome(D.salvarPeca([], { nome: nomeLongo, entrada: entMesa }).lista, nomeLongo), nomeLongo + '|true');
    var curta = D.salvarPeca([], { nome: 'Curto', entrada: entMesa }).lista;
    igual('catálogo: editar aceita nome longo e o limite exportado é 120', D.editarPeca(curta, curta[0].id, { nome: nomeLongo }).lista[0].nome.length + '|' + D.NOME_PECA_MAX, '45|120');
    var ex1 = D.salvarPeca(s1.lista, { nome: 'SUPORTE DE CELULAR', entrada: entMesa, precoRef: 7 });
    igual('catálogo: nome igual (sem diferenciar maiúscula) pergunta antes de substituir', ex1.ok + '|' + ex1.erro + '|' + ex1.existente.id, 'false|existe|' + s1.peca.id);
    igual('catálogo: nome igual sem acento também conta', D.pecaComNome(D.salvarPeca([], { nome: 'Pingente Coração', entrada: entMesa }).lista, 'pingente coracao') !== null, true);
    var usada = D.registrarUsoPeca(s1.lista, s1.peca.id, 6.3, new Date(2026, 10, 20, 9, 0));
    var sub = D.salvarPeca(usada, { nome: 'Suporte de celular', descricao: 'Novo', entrada: { peso: 50, tempoMin: 100, qtd: 1, margem: 80 }, precoRef: 9 }, true);
    igual('catálogo: substituir mantém o id e os usos (orçamentos já enviados continuam ligados)', sub.ok + '|' + sub.substituiu + '|' + sub.lista.length + '|' + (sub.peca.id === s1.peca.id) + '|' + sub.peca.usos + '|' + sub.peca.entrada.peso + '|' + sub.peca.precoRef, 'true|true|1|true|1|50|9');
    var cheio = []; for (var ci = 0; ci < 100; ci++) cheio.push({ id: 'p' + ci, nome: 'Peça ' + ci, entrada: entMesa });
    igual('catálogo: no máximo 100 peças', D.lerCatalogo(cheio.concat([{ id: 'x', nome: 'Extra', entrada: entMesa }])).length + '|' + D.salvarPeca(D.lerCatalogo(cheio), { nome: 'Nova', entrada: entMesa }).erro, '100|cheio');
    igual('catálogo: com 100 peças ainda dá para substituir uma', D.salvarPeca(D.lerCatalogo(cheio), { nome: 'Peça 3', entrada: entMesa }, true).ok, true);
    igual('catálogo: leitura descarta peça inválida e id repetido', D.lerCatalogo([null, 5, { id: '', nome: 'a', entrada: entMesa }, { id: 'a', nome: '', entrada: entMesa }, { id: 'a', nome: 'ok', entrada: null },
      { id: 'b', nome: 'B', entrada: entMesa }, { id: 'b', nome: 'B2', entrada: entMesa }]).map(function (p) { return p.nome; }).join(','), 'B');
    igual('catálogo: não é lista = vazio', D.lerCatalogo(null).length + '|' + D.lerCatalogo({}).length + '|' + D.lerCatalogo('x').length, '0|0|0');
    igual('catálogo: dados esquisitos viram padrão', JSON.stringify(D.lerPeca({ id: 'a', nome: 'A', entrada: entMesa, precoRef: 'x', usos: -3, usadoEm: 'lixo', precoRefEm: 5 })).indexOf('"usos":0') > -1 && D.lerPeca({ id: 'a', nome: 'A', entrada: entMesa, usadoEm: 'lixo' }).usadoEm === '', true);
    igual('catálogo: usar a peça atualiza referência, usos e último uso', usada[0].precoRef + '|' + usada[0].usos + '|' + usada[0].usadoEm + '|' + usada[0].precoRefEm, '6.3|1|' + new Date(2026, 10, 20, 9, 0).toISOString() + '|' + new Date(2026, 10, 20, 9, 0).toISOString());
    igual('catálogo: usar peça que não existe não muda nada', JSON.stringify(D.registrarUsoPeca(s1.lista, 'nao-existe', 5, catQuando)), JSON.stringify(s1.lista));
    var edit = D.editarPeca(s1.lista, s1.peca.id, { nome: 'Suporte novo', descricao: 'Desc' });
    igual('catálogo: editar nome e descrição (dados técnicos ficam)', edit.ok + '|' + edit.lista[0].nome + '|' + edit.lista[0].descricao + '|' + edit.lista[0].entrada.peso + '|' + edit.lista[0].id, 'true|Suporte novo|Desc|96|' + s1.peca.id);
    var dois2 = D.salvarPeca(s1.lista, { nome: 'Chaveiro', entrada: entMesa }).lista;
    igual('catálogo: editar para o nome de outra peça não deixa; o próprio nome pode', D.editarPeca(dois2, dois2[1].id, { nome: 'suporte de celular' }).erro + '|' + D.editarPeca(dois2, dois2[1].id, { nome: 'CHAVEIRO' }).ok, 'existe|true');
    igual('catálogo: editar nome vazio ou peça que não existe', D.editarPeca(dois2, dois2[0].id, { nome: ' ' }).erro + '|' + D.editarPeca(dois2, 'zzz', { nome: 'A' }).erro, 'invalido|naoExiste');
    igual('catálogo: excluir só tira a peça pedida', D.excluirPeca(dois2, dois2[0].id).map(function (p) { return p.nome; }).join(',') + '|' + D.excluirPeca(dois2, 'zzz').length, 'Chaveiro|2');
    var ord = D.lerCatalogo([
      { id: 'a', nome: 'Antiga', entrada: entMesa, precoRefEm: '2026-10-01T10:00:00.000Z', usadoEm: '2026-11-01T10:00:00.000Z' },
      { id: 'b', nome: 'Nunca usada', entrada: entMesa, precoRefEm: '2026-11-10T10:00:00.000Z' },
      { id: 'c', nome: 'Usada ontem', entrada: entMesa, precoRefEm: '2026-09-01T10:00:00.000Z', usadoEm: '2026-11-13T10:00:00.000Z' }]);
    igual('catálogo: ordem = usadas por último (sem uso, pela data de quando foi salva)', D.ordenarCatalogo(ord).map(function (p) { return p.id; }).join(','), 'c,b,a');
    igual('catálogo: busca por nome ou descrição, sem diferenciar acento', D.filtrarCatalogo(D.lerCatalogo([{ id: 'a', nome: 'Pingente Coração', descricao: 'Lembrança', entrada: entMesa }, { id: 'b', nome: 'Chaveiro', entrada: entMesa }]), 'CORAÇÃO').map(function (p) { return p.id; }).join(',') + '|'
      + D.filtrarCatalogo(D.lerCatalogo([{ id: 'a', nome: 'Pingente', descricao: 'Lembrança', entrada: entMesa }]), 'lembranca').length + '|' + D.filtrarCatalogo(ord, '').length + '|' + D.filtrarCatalogo(ord, 'xyz').length, 'a|1|3|0');
    igual('catálogo: descrição vazia usa o nome', D.descricaoDaPeca({ nome: 'Suporte', descricao: '' }) + '|' + D.descricaoDaPeca({ nome: 'Suporte', descricao: 'Para celular' }) + '|' + D.descricaoDaPeca(null), 'Suporte|Para celular|');

    // pedido: peso e tempo proporcionais; o valor por peça não muda
    var ped = D.entradaDoPedido(entMesa, 10);
    igual('pedido: peso e tempo proporcionais às peças da mesa', ped.peso + '|' + ped.tempoMin + '|' + ped.qtd + '|' + ped.extras + '|' + ped.margem, '120|312.5|10|0.5|100');
    igual('pedido: a entrada original não muda', JSON.stringify(entMesa), JSON.stringify({ peso: 96, tempoMin: 250, qtd: 8, extras: 0.5, margem: 100, materialId: 'pla', materialNome: 'PLA' }));
    igual('pedido: quantidade inválida = 1 peça', D.entradaDoPedido(entMesa, 0).qtd + '|' + D.entradaDoPedido(entMesa, 'x').qtd + '|' + D.entradaDoPedido(entMesa, 99999).qtd, '1|1|9999');
    function precoPedido(e) { return C.calcular({ peso: e.peso, tempo: e.tempoMin, margemPct: e.margem, qtd: e.qtd, extrasPeca: e.extras, precoKg: 150, valorHora: 2.25, perdaPct: 5, minimo: 0 }); }
    igual('pedido: valor por peça igual ao da mesa (8, 10, 1, 16, 50 peças)', [8, 10, 1, 16, 50].map(function (q) { return C.moeda(precoPedido(D.entradaDoPedido(entMesa, q)).valorUnitario); }).join('|'),
      new Array(6).join(C.moeda(precoPedido(entMesa).valorUnitario) + '|').slice(0, -1));
    igual('pedido: total = valor por peça × quantidade', precoPedido(D.entradaDoPedido(entMesa, 10)).valorCobrar.toFixed(6), (precoPedido(entMesa).valorUnitario * 10).toFixed(6));
    var entMulti = { peso: 30, tempoMin: 60, qtd: 2, extras: 0, margem: 100, materialId: 'pla', materialNome: 'PLA', cores: [{ materialId: 'pla', nome: 'PLA', gramas: 20 }, { materialId: 'petg', nome: 'PETG', gramas: 10 }], purgaG: 4 };
    var pedM = D.entradaDoPedido(entMulti, 6);
    igual('pedido: multicor escala gramas de cada cor e a purga', pedM.cores.map(function (c) { return c.gramas; }).join(',') + '|' + pedM.purgaG + '|' + pedM.qtd + '|' + pedM.tempoMin, '60,30|12|6|180');
    igual('pedido: atalhos 1, uma mesa, duas mesas e 50 (sem repetir)', D.atalhosPedido(entMesa).join(',') + '|' + D.atalhosPedido({ peso: 1, tempoMin: 1, qtd: 1 }).join(',') + '|' + D.atalhosPedido({ peso: 1, tempoMin: 1, qtd: 25 }).join(',') + '|' + D.atalhosPedido({ peso: 1, tempoMin: 1, qtd: 50 }).join(','), '1,8,16,50|1,2,50|1,25,50|1,50,100');
    igual('catálogo: diferença para o último envio', ['sobe', 'igual', 'desce'].join() === [D.compararPreco(6.30, 6.24), D.compararPreco(6.24, 6.24), D.compararPreco(6.20, 6.24)].map(function (x) { return x.tipo; }).join() ? D.compararPreco(6.30, 6.24).diff + '|' + D.compararPreco(6.20, 6.24).diff + '|' + D.compararPreco(6.2400001, 6.24).tipo : 'tipos errados', '0.06|0.04|igual');
    igual('catálogo: resumo da mesa', D.descreverEntrada(entMesa) + ' / ' + D.descreverEntrada({ peso: 48, tempoMin: 155, qtd: 1, margem: 100, materialNome: 'PLA' }) + ' / ' + D.descreverEntrada(entMulti) + ' / ' + D.descreverEntrada({ peso: 12.5, tempoMin: 45, qtd: 1, margem: 70 }),
      'Mesa de 8 peças · 96 g de PLA · 4h10 · margem 100% / 1 peça · 48 g de PLA · 2h35 · margem 100% / Mesa de 2 peças · 30 g em 2 cores · 1h00 · margem 100% / 1 peça · 12,5 g · 45 min · margem 70%');

    // registro ligado à peça e backup
    var regCat = D.novoRegistro(r1, { numero: 20, formato: 'imagem', quando: em(0, 11), entrada: entMesa, catalogoId: s1.peca.id });
    igual('registro v4: com peça do catálogo grava catalogoId e a leitura mantém', regCat.catalogoId + '|' + D.lerRegistro(JSON.parse(JSON.stringify(regCat))).catalogoId, s1.peca.id + '|' + s1.peca.id);
    var bkCat = D.lerBackup(JSON.stringify(D.montarBackup({ config: cfgBackup, contador: 1, registros: [regCat], catalogo: s1.lista }, {})));
    igual('backup: catálogo e catalogoId fazem a ida e volta', bkCat.ok + '|' + D.lerCatalogo(bkCat.backup.dados.catalogo)[0].nome + '|' + bkCat.backup.dados.registros[0].catalogoId + '|' + D.resumoBackup(bkCat.backup).pecas, 'true|Suporte de celular|' + s1.peca.id + '|1');
    var restCat = D.restaurarDados({ config: cfgBackup, contador: 1, registros: [], catalogo: dois2 }, bkCat.backup.dados);
    igual('restaurar: o catálogo do backup substitui o do aparelho; desfazer devolve o antigo', restCat.catalogo.length + '|' + D.desfazerRestauracao(restCat, { em: catQuando.toISOString(), dados: { config: cfgBackup, contador: 1, registros: [], catalogo: dois2 } }).catalogo.length, '1|2');


    /* ---- v5 · painel de vendas: resumoVendas, período Mês e aprovados pela data da aprovação ---- */
    function pvVenda(n, diasEnvio, diasAprov, total, lucro, cli, desc, extra) {
      return mkReg(n, diasEnvio, Object.assign({ status: 'aprovado', statusEm: em(diasAprov).toISOString(), total: total, lucro: lucro, custoTotal: total - lucro, cliente: cli, descricao: desc }, extra || {}));
    }
    var pvVendas = [
      pvVenda(40, 29, 28, 148.50, 74.25, 'Loja Geek Point', 'Suporte de celular'),
      pvVenda(41, 26, 25, 96.00, 48.00, 'Carla Mendes', 'Chaveiro 3Di'),
      pvVenda(42, 24, 23, 312.80, 156.40, 'Ana Souza', 'Suporte de fone'),
      pvVenda(43, 22, 21, 87.40, 43.70, '', 'Chaveiro 3Di'),
      pvVenda(44, 19, 18, 420.00, 210.00, 'Loja Geek Point', 'Suporte de celular'),
      pvVenda(45, 17, 16, 134.60, 67.30, 'Rafael Lima', 'Vaso geométrico'),
      pvVenda(46, 15, 14, 265.00, 132.50, 'Ana Souza', 'Suporte de fone'),
      pvVenda(47, 12, 11, 188.70, 94.35, 'Carla Mendes', 'Chaveiro 3Di'),
      pvVenda(48, 9, 8, 74.30, 37.15, '', 'Vaso geométrico'),
      pvVenda(49, 5, 4, 389.00, 194.50, 'Loja Geek Point', 'Suporte de celular'),
      pvVenda(50, 2, 1, 370.00, 155.75, 'Ana Souza', 'Suporte de fone')
    ];
    var pvAntes = [pvVenda(20, 41, 40, 1500, 750, 'Ana Souza', 'Suporte de fone'), pvVenda(21, 34, 33, 601.10, 300, 'Carla Mendes', 'Chaveiro 3Di'), pvVenda(19, 61, 60, 999, 500, 'Antigo', 'Vaso geométrico')];
    var pvEspera = [[0, 14, 138], [1, 10, 156.40], [2, 8, 172], [3, 6, 188.20], [4, 5, 62.40], [5, 3, 485], [6, 1, 214], [7, 0, 96.40]].map(function (t) { return mkReg(60 + t[0], t[1], { total: t[2], validadeAte: '2026-11-21' }); });
    var pvVencidos = [mkReg(70, 20, { total: 200, validadeAte: '2026-11-10' }), mkReg(71, 25, { total: 150.20, validadeAte: '2026-11-01' }), mkReg(72, 9, { total: 116, validadeAte: '2026-11-13' })];
    var pvRecusados = [mkReg(73, 6, { total: 129, status: 'recusado', statusEm: em(5).toISOString() }), mkReg(74, 3, { total: 50, status: 'recusado', statusEm: em(2).toISOString() })];
    var pvTodos = [].concat(pvVendas, pvAntes, pvEspera, pvVencidos, pvRecusados);
    var pv30 = D.resumoVendas(pvTodos, '30', hojeH);
    igual('painel 30 dias: vendas, quantidade e ticket médio', [pv30.vendas, pv30.qtd, pv30.ticket].join('|'), '2486.3|11|226.03');
    igual('painel 30 dias: lucro, custo e margem real', [pv30.lucro, pv30.custo, pv30.margemReal].join('|'), '1213.9|1272.4|48.8');
    igual('painel 30 dias: período anterior e variação (+18,3%)', [pv30.anterior.vendas, pv30.anterior.qtd, pv30.variacao].join('|'), '2101.1|2|18.3');
    igual('painel: aguardando (8, R$ 1.512,40, 3 com 7 dias ou mais) e vencidos (3, R$ 466,20)', [pv30.aguardando.qtd, pv30.aguardando.total, pv30.aguardando.antigos, pv30.vencidos.qtd, pv30.vencidos.total].join('|'), '8|1512.4|3|3|466.2');
    igual('painel: recusados e enviados não entram nas vendas', pv30.qtd, 11);
    igual('painel: mais vendidos por cliente (Sem cliente entra pelo valor)', pv30.topClientes.map(function (x) { return x.nome + ':' + x.valor + ':' + x.qtd; }).join('|'),
      'Loja Geek Point:957.5:3|Ana Souza:947.8:3|Carla Mendes:284.7:2|Sem cliente:161.7:2|Rafael Lima:134.6:1');
    igual('painel: mais vendidos por peça', pv30.topPecas.map(function (x) { return x.nome + ':' + x.valor + ':' + x.qtd; }).join('|'),
      'Suporte de celular:957.5:3|Suporte de fone:947.8:3|Chaveiro 3Di:372.1:3|Vaso geométrico:208.9:2');
    var pvSoma = 0, pvDiasComVenda = 0;
    pv30.porDia.forEach(function (x) { pvSoma += Math.round(x.valor * 100); if (x.qtd) pvDiasComVenda++; });
    igual('painel 30 dias: 30 barras, de 16/10 a 14/11, somando as vendas', pv30.porDia.length + '|' + pv30.porDia[0].chave + '|' + pv30.porDia[29].chave + '|' + pvSoma / 100 + '|' + pvDiasComVenda, '30|2026-10-16|2026-11-14|2486.3|11');
    igual('painel: barra do dia (Sex, 13/11 = R$ 370,00)', pv30.porDia[28].rotulo + '|' + pv30.porDia[28].valor + '|' + pv30.porDia[29].valor, 'Sex, 13/11|370|0');
    var pvHoje = D.resumoVendas(pvTodos, 'hoje', hojeH);
    igual('painel Hoje: sem vendas, sem variação, sem série; aguardando continua', [pvHoje.vendas, pvHoje.qtd, pvHoje.ticket, pvHoje.variacao, pvHoje.anterior, pvHoje.porDia.length, pvHoje.aguardando.qtd, pvHoje.vencidos.qtd].join('|'), '0|0|0|||0|8|3');
    var pv7 = D.resumoVendas(pvTodos, '7', hojeH);
    igual('painel 7 dias: 10/11 e 13/11, 7 barras, variação contra 01–07/11', [pv7.vendas, pv7.qtd, pv7.porDia.length, pv7.anterior.vendas, pv7.variacao].join('|'), '759|2|7|263|188.6');
    var pvMes = D.resumoVendas(pvTodos, 'mes', hojeH);
    igual('painel Mês: 1–14/11, 14 barras, variação contra 1–14/10', [pvMes.vendas, pvMes.qtd, pvMes.porDia.length, pvMes.anterior.vendas, pvMes.variacao].join('|'), '1022|4|14|2101.1|-51.4');
    var pvTudo = D.resumoVendas(pvTodos, 'tudo', hojeH);
    igual('painel Tudo: por mês (set, out, nov), sem variação', [pvTudo.vendas, pvTudo.qtd, pvTudo.variacao, pvTudo.porDia.map(function (x) { return x.rotulo + '=' + x.valor + '/' + x.qtd; }).join(',')].join('|'),
      '5586.4|14||set/2026=999/1,out/2026=3565.4/9,nov/2026=1022/4');
    igual('painel: período inválido volta para 30 dias', D.resumoVendas(pvTodos, 'xyz', hojeH).periodo + '|' + D.resumoVendas(pvTodos, undefined, hojeH).vendas, '30|2486.3');
    igual('painel: a venda vale na data da aprovação (enviado em 30/10, aprovado em 03/11 = venda de novembro)',
      D.resumoVendas([pvVenda(90, 15, 11, 100, 40, 'X', 'Y')], 'mes', hojeH).vendas + '|' + D.resumoVendas([pvVenda(90, 15, 11, 100, 40, 'X', 'Y')], '7', hojeH).vendas, '100|0');
    igual('painel: aprovado sem statusEm entra pela data do envio', D.resumoVendas([mkReg(91, 2, { status: 'aprovado', total: 50 })], '7', hojeH).vendas + '|' + D.resumoVendas([mkReg(91, 20, { status: 'aprovado', total: 50 })], '7', hojeH).vendas, '50|0');
    igual('painel: borda dos 30 dias (29 dias atrás entra, 30 não)', D.resumoVendas([pvVenda(92, 30, 29, 10, 5, '', ''), pvVenda(93, 31, 30, 20, 10, '', '')], '30', hojeH).vendas, 10);
    igual('painel: aprovado que voltou para enviado sai das vendas e passa a aguardar', (function () {
      var l = D.atualizarRegistro([pvVenda(94, 3, 2, 80, 40, '', '')], D.chaveRegistro(pvVenda(94, 3, 2, 80, 40, '', '')), { status: 'enviado' });
      var r = D.resumoVendas(l, '30', hojeH); return r.vendas + '|' + r.aguardando.qtd + '|' + r.aguardando.total;
    })(), '0|1|80');
    igual('painel: soma em centavos (0,10 + 0,20 = 0,30)', D.resumoVendas([pvVenda(95, 1, 0, 0.1, 0.05, '', ''), pvVenda(96, 1, 0, 0.2, 0.1, '', '')], 'hoje', hojeH).vendas, 0.3);
    igual('painel: lucro negativo (vendeu abaixo do custo) entra na soma', D.resumoVendas([pvVenda(97, 1, 0, 10, -2, '', '')], 'hoje', hojeH).lucro + '|' + D.resumoVendas([pvVenda(97, 1, 0, 10, -2, '', '')], 'hoje', hojeH).margemReal, '-2|-20');
    var pvVazio = D.resumoVendas([], '30', hojeH);
    igual('painel: lista vazia dá tudo zero, 30 barras zeradas, sem erro', [pvVazio.vendas, pvVazio.qtd, pvVazio.ticket, pvVazio.lucro, pvVazio.margemReal, pvVazio.variacao, pvVazio.porDia.length, pvVazio.topClientes.length, pvVazio.topPecas.length, pvVazio.aguardando.qtd, pvVazio.vencidos.qtd].join('|'), '0|0|0|0|0||30|0|0|0|0');
    igual('painel: entrada que não é lista não quebra', D.resumoVendas(null, '30', hojeH).qtd + '|' + D.resumoVendas('x', 'tudo', hojeH).porDia.length, '0|0');
    igual('painel: peças agrupam por catalogoId e, sem ele, pela descrição sem acento e maiúscula', (function () {
      var l = [pvVenda(100, 1, 0, 10, 5, '', 'Vaso Geométrico', { catalogoId: 'p1' }), pvVenda(101, 1, 0, 20, 10, '', 'vaso geometrico (grande)', { catalogoId: 'p1' }),
               pvVenda(102, 2, 1, 5, 2, '', 'Chaveiro'), pvVenda(103, 2, 1, 6, 3, '', 'CHAVEIRO'), pvVenda(104, 2, 1, 7, 3, '', '')];
      return D.resumoVendas(l, '7', hojeH).topPecas.map(function (x) { return x.nome + ':' + x.valor + ':' + x.qtd; }).join('|');
    })(), 'Vaso Geométrico:30:2|Chaveiro:11:2|Sem descrição:7:1');
    igual('painel: clientes iguais com acento ou caixa diferente viram um só', D.resumoVendas([pvVenda(105, 1, 0, 10, 5, 'José', 'A'), pvVenda(106, 1, 0, 10, 5, 'JOSE', 'A')], 'hoje', hojeH).topClientes.length, 1);
    igual('painel: só os 5 primeiros em mais vendidos', D.resumoVendas([1, 2, 3, 4, 5, 6, 7].map(function (i) { return pvVenda(110 + i, 1, 0, i, i / 2, 'Cliente ' + i, 'Peça ' + i); }), 'hoje', hojeH).topClientes.map(function (x) { return x.nome; }).join(','), 'Cliente 7,Cliente 6,Cliente 5,Cliente 4,Cliente 3');
    igual('período anterior do Mês: mês mais curto vai até o último dia dele; janeiro usa dezembro', (function () {
      var a = D.periodoAnterior('mes', new Date(2026, 2, 31, 9)), b = D.periodoAnterior('mes', new Date(2026, 0, 15, 9));
      return D.dataISO(a.inicio) + '/' + D.dataISO(a.fim) + '|' + D.dataISO(b.inicio) + '/' + D.dataISO(b.fim);
    })(), '2026-02-01/2026-03-01|2025-12-01/2025-12-16');
    igual('período anterior: Hoje e Tudo não têm', D.periodoAnterior('hoje', hojeH) + '|' + D.periodoAnterior('tudo', hojeH), 'null|null');
    igual('período Mês no histórico: do dia 1º até hoje', ids(D.filtrarRegistros([mkReg(1, 13), mkReg(2, 14)], { periodo: 'mes', hoje: hojeH })), '1');
    // cartão da Lista: aprovados pela data da aprovação (e pela busca), enviados e total pela data do envio
    var pvCartao = D.aprovadosDoPeriodo(pvVendas.concat(pvEspera), { periodo: '30', hoje: hojeH });
    igual('cartão da Lista: aprovados e valor aprovado em 30 dias', pvCartao.aprovados + '|' + pvCartao.totalAprovados, '11|2486.3');
    igual('cartão da Lista: aprovado agora entra mesmo que o envio tenha sido antes do período', D.aprovadosDoPeriodo([pvVenda(120, 40, 1, 100, 50, '', '')], { periodo: '7', hoje: hojeH }).aprovados + '|' + D.resumir(D.filtrarRegistros([pvVenda(120, 40, 1, 100, 50, '', '')], { periodo: '7', hoje: hojeH })).qtd, '1|0');
    igual('cartão da Lista: a busca vale também para os aprovados', D.aprovadosDoPeriodo(pvVendas, { periodo: 'tudo', busca: 'ANA', hoje: hojeH }).totalAprovados + '|' + D.aprovadosDoPeriodo(pvVendas, { periodo: 'tudo', busca: 'zzz', hoje: hojeH }).aprovados, '947.8|0');
    // filtro por situação no histórico
    var idsSit = function (f) { return ids(D.filtrarRegistros(pvTodos.concat([mkReg(80, 100, { total: 1 })]), Object.assign({ hoje: hojeH }, f))); };
    igual('situação enviado: aguardando resposta, sem período, do mais antigo para o mais novo', idsSit({ situacao: 'enviado' }), '80,60,61,62,63,64,65,66,67');
    igual('situação enviado ignora o período escolhido', idsSit({ situacao: 'enviado', periodo: 'hoje' }), '80,60,61,62,63,64,65,66,67');
    igual('situação vencido: validade já passou, do mais antigo para o mais novo', idsSit({ situacao: 'vencido' }), '71,70,72');
    // desde o 0.6.0-teste.12 Aprovado é fila de trabalho (espera produção): sem período, do mais antigo para o mais novo
    igual('situação aprovado: fila, sem período, do mais antigo para o mais novo', idsSit({ situacao: 'aprovado', periodo: '30' }), '19,20,21,40,41,42,43,44,45,46,47,48,49,50');
    igual('situação aprovado ignora o período escolhido (Hoje mostra os mesmos)', idsSit({ situacao: 'aprovado', periodo: 'hoje' }), idsSit({ situacao: 'aprovado', periodo: '30' }));
    igual('situação aprovado: aprovado há 20 dias também aparece com 7 dias', ids(D.filtrarRegistros([pvVenda(130, 40, 1, 100, 50, '', '')], { situacao: 'aprovado', periodo: '7', hoje: hojeH })) + '|' + ids(D.filtrarRegistros([pvVenda(130, 3, 20, 100, 50, '', '')], { situacao: 'aprovado', periodo: '7', hoje: hojeH })), '130|130');
    igual('situação recusado (7 dias)', idsSit({ situacao: 'recusado', periodo: '7' }), '74,73');
    igual('situação combina com a busca', idsSit({ situacao: 'aprovado', periodo: 'tudo', busca: 'ANA' }), '20,42,46,50');
    igual('situação desconhecida ou vazia não filtra', idsSit({ situacao: 'lixo', periodo: 'tudo' }) === idsSit({ periodo: 'tudo' }), true);
    igual('sem situação a ordem continua do mais novo para o mais antigo', idsSit({ periodo: 'hoje' }).split(',')[0], '67');
    var pvCont = D.contarSituacoes(pvTodos, hojeH);
    igual('contagem dos chips: 8 aguardando e 3 vencidos', pvCont.enviado + '|' + pvCont.vencido + '|' + D.contarSituacoes(null, hojeH).enviado, '8|3|0');
    var esp = function (n, dias, extra) { var t = D.textoEspera(mkReg(n, dias, extra), hojeH); return t.texto + '/' + t.antigo; };
    igual('etiqueta de espera: hoje, há 1 dia, há 6 dias, há 7 dias (âmbar), há 14 dias', [esp(1, 0), esp(2, 1), esp(3, 6), esp(4, 7), esp(5, 14)].join(' · '), 'hoje/false · há 1 dia/false · há 6 dias/false · há 7 dias/true · há 14 dias/true');
    igual('etiqueta de espera: vencido mostra quando venceu', esp(6, 20, { validadeAte: '2026-11-10' }), 'venceu 10/11/true');

    // 2.000 registros: uma passada
    var pvMuitos = []; for (var pvI = 0; pvI < 2000; pvI++) pvMuitos.push(pvVenda(1000 + pvI, pvI % 60 + 1, pvI % 60, 10 + (pvI % 7), 5, 'Cliente ' + (pvI % 13), 'Peça ' + (pvI % 9)));
    var pvT0 = Date.now(), pvM = D.resumoVendas(pvMuitos, 'tudo', hojeH);
    igual('painel: 2.000 registros em menos de 1 segundo', pvM.qtd + '|' + (Date.now() - pvT0 < 1000), '2000|true');


    /* ---- v6 · etapa 1: pedidos com etapas, pagamentos, tarefas do dia e backup formato 2 (dados.js) ---- */
    var v6 = {};
    v6.iso = function (dias, h, min) { return em(dias, h, min).toISOString(); };
    v6.venda = function (n, diasAprov, total, extra) {   // aprovado há diasAprov dias (com aprovadoEm), enviado 3 dias antes
      return mkReg(n, diasAprov + 3, Object.assign({ status: 'aprovado', statusEm: v6.iso(diasAprov), aprovadoEm: v6.iso(diasAprov), total: total, lucro: total / 2, custoTotal: total / 2 }, extra || {}));
    };
    v6.tipos = function (ts) { return ts.map(function (t) { return t.tipo; }).join(','); };
    v6.ns = function (lista) { return lista.map(function (x) { return x.n; }).join(','); };
    igual('v6: limites e formato (5.000 registros, aviso em 4.500, backup formato 2)', [D.MAX_REGISTROS, D.LIMITE_AVISO_REGISTROS, D.BACKUP_FORMATO].join('|'), '5000|4500|2');
    igual('v6: etapas gravadas', D.SITUACOES.join(','), 'pedido,enviado,aprovado,producao,embalagem,pronto,entregue,recusado,cancelado');
    igual('v6: etapas que contam como venda', D.etapasDeVenda().join(','), 'aprovado,producao,embalagem,pronto,entregue');
    igual('v6: rótulos das etapas (Orçado é o novo nome de enviado)', ['pedido', 'enviado', 'vencido', 'aprovado', 'producao', 'embalagem', 'pronto', 'entregue', 'recusado', 'cancelado'].map(function (k) { return D.ROTULOS_ETAPA[k]; }).join(','),
      'Pedido,Orçado,Vencido,Aprovado,Produção,Embalagem,Pronto,Entregue,Recusado,Cancelado');
    igual('v6: a tela atual segue com "Enviado" até a etapa 3', D.ROTULOS_SITUACAO.enviado + '|' + D.ROTULOS_SITUACAO.producao, 'Enviado|Produção');
    igual('v6: dinheiro em texto', [D.moedaBR(0), D.moedaBR(2.36), D.moedaBR(1234.5), D.moedaBR(466.2), D.moedaBR(1234567.891)].join('|'), 'R$ 0,00|R$ 2,36|R$ 1.234,50|R$ 466,20|R$ 1.234.567,89');

    // novo registro enviado já nasce com o histórico; registro antigo (sem campos v6) continua igual
    var v6Novo = D.novoRegistro(r1, { numero: 5, quando: em(0, 9) });
    igual('v6: registro enviado nasce com historico', JSON.stringify(v6Novo.historico), JSON.stringify([{ etapa: 'enviado', em: v6Novo.ts }]));
    var v6Antigo = D.lerRegistro(mkReg(7, 4, { status: 'aprovado', statusEm: v6.iso(2) }));
    igual('v6: registro da 0.5 não ganha campos novos ao ser lido', ['historico', 'aprovadoEm', 'pagamento', 'criadoEm', 'cobradoEm'].filter(function (k) { return k in v6Antigo; }).join(','), '');
    var v6Completo = D.lerRegistro(Object.assign(mkReg(8, 4, { status: 'producao', statusEm: v6.iso(1) }), { aprovadoEm: v6.iso(3), criadoEm: v6.iso(6), canal: 'whatsapp', prazoDesejado: '2026-11-20',
      pedidoTexto: 'Preciso de 40 chaveiros', historico: [{ etapa: 'pedido', em: v6.iso(6) }, { etapa: 'aprovado', em: v6.iso(3) }, { etapa: 'lixo', em: v6.iso(2) }],
      pagamento: { condicao: 'entrada', entradaPrevista: 5, recebimentos: [{ valor: 5, em: v6.iso(3), forma: 'pix' }, { valor: 0, em: v6.iso(3), forma: 'pix' }, { valor: 2, em: 'x', forma: 'pix' }, { valor: 1, em: v6.iso(2), forma: 'banana' }] },
      cobradoEm: v6.iso(2), cobrancas: 2 }));
    igual('v6: leitura guarda os campos novos e descarta o que é inválido', [v6Completo.aprovadoEm === v6.iso(3), v6Completo.canal, v6Completo.prazoDesejado, v6Completo.pedidoTexto.length, v6Completo.historico.length,
      v6Completo.pagamento.condicao, v6Completo.pagamento.entradaPrevista, v6Completo.pagamento.recebimentos.length, v6Completo.pagamento.recebimentos[1].forma, v6Completo.cobrancas].join('|'), 'true|whatsapp|2026-11-20|23|2|entrada|5|2|outro|2');
    igual('v6: ida e volta de um registro completo não muda nada', JSON.stringify(D.lerRegistro(v6Completo)), JSON.stringify(v6Completo));
    igual('v6: canal inválido e prazo inválido saem', ['canal' in D.lerRegistro(mkReg(9, 0, { canal: 'pombo' })), 'prazoDesejado' in D.lerRegistro(mkReg(9, 0, { prazoDesejado: 'amanhã' }))].join('|'), 'false|false');

    // migração de aprovadoEm
    var v6Mig = D.migrarAprovadoEm([mkReg(1, 5, { status: 'aprovado', statusEm: v6.iso(2) }), mkReg(2, 5, { status: 'aprovado' }), mkReg(3, 5), mkReg(4, 5, { status: 'recusado', statusEm: v6.iso(1) }),
      mkReg(5, 5, { status: 'pronto', statusEm: v6.iso(1) }), mkReg(6, 5, { status: 'aprovado', statusEm: v6.iso(2), aprovadoEm: v6.iso(4) })]);
    igual('migração: aprovado recebe a data de statusEm; sem statusEm, a do envio; pronto idem', [v6Mig[0].aprovadoEm === v6.iso(2), v6Mig[1].aprovadoEm === mkReg(2, 5).ts, v6Mig[4].aprovadoEm === v6.iso(1)].join('|'), 'true|true|true');
    igual('migração: enviado e recusado não ganham; quem já tem fica como está', ['aprovadoEm' in v6Mig[2], 'aprovadoEm' in v6Mig[3], v6Mig[5].aprovadoEm === v6.iso(4)].join('|'), 'false|false|true');
    igual('migração: é idempotente e não mexe na lista de entrada', JSON.stringify(D.migrarAprovadoEm(v6Mig)) + '|' + ('aprovadoEm' in mkReg(1, 5, { status: 'aprovado' })), JSON.stringify(v6Mig) + '|false');
    igual('migração: os números do painel de hoje não mudam', D.resumoVendas(v6Mig, 'tudo', hojeH).vendas + '|' + D.resumoVendas([mkReg(1, 5, { status: 'aprovado', statusEm: v6.iso(2) }), mkReg(2, 5, { status: 'aprovado' }), mkReg(5, 5, { status: 'pronto', statusEm: v6.iso(1) }), mkReg(6, 5, { status: 'aprovado', statusEm: v6.iso(2) })], 'tudo', hojeH).vendas, '40|40');

    // mudar etapa: data da venda fixa, histórico, pular e voltar
    var v6L = [D.lerRegistro(mkReg(10, 4, { total: 100, lucro: 40, custoTotal: 60 })), D.lerRegistro(mkReg(11, 4, { total: 50 }))], v6K = D.chaveRegistro(v6L[0]);
    var v6A = D.mudarEtapa(v6L, v6K, 'aprovado', em(3, 15));
    igual('etapa: aprovar grava status, statusEm, aprovadoEm e historico; o resto da lista fica', [v6A[0].status, v6A[0].statusEm === v6.iso(3, 15), v6A[0].aprovadoEm === v6.iso(3, 15), v6A[0].historico.map(function (h) { return h.etapa; }).join('>'), v6A[1] === v6L[1], v6L[0].status].join('|'), 'aprovado|true|true|aprovado|true|enviado');
    var v6P = D.mudarEtapa(D.mudarEtapa(D.mudarEtapa(v6A, v6K, 'producao', em(2)), v6K, 'embalagem', em(1)), v6K, 'pronto', em(0, 9));
    igual('etapa: avançar não muda a data da venda (aprovadoEm) e o histórico cresce', [v6P[0].status, v6P[0].aprovadoEm === v6.iso(3, 15), v6P[0].statusEm === v6.iso(0, 9), v6P[0].historico.length].join('|'), 'pronto|true|true|4');
    igual('etapa: venda continua no dia da aprovação ao avançar (painel)', D.resumoVendas(v6P, 'hoje', hojeH).vendas + '|' + D.resumoVendas(v6P, '7', hojeH).vendas + '|' + D.resumoVendas(v6A, '7', hojeH).vendas, '0|100|100');
    igual('etapa: todas as etapas de venda contam no painel e no cartão da lista', ['aprovado', 'producao', 'embalagem', 'pronto', 'entregue'].map(function (e) { var l = [v6.venda(1, 1, 80, { status: e })]; return D.resumoVendas(l, '7', hojeH).vendas + '/' + D.aprovadosDoPeriodo(l, { periodo: '7', hoje: hojeH }).aprovados + '/' + D.resumir(l).aprovados; }).join(','), '80/1/1,80/1/1,80/1/1,80/1/1,80/1/1');
    igual('etapa: pedido, orçado, recusado e cancelado não contam como venda', ['pedido', 'enviado', 'recusado', 'cancelado'].map(function (e) { return D.resumoVendas([v6.venda(1, 1, 80, { status: e })], '7', hojeH).vendas; }).join(','), '0,0,0,0');
    var v6Pu = D.mudarEtapa(v6A, v6K, 'entregue', em(1));
    igual('etapa: pular de Aprovado para Entregue', v6Pu[0].status + '|' + v6Pu[0].historico.length + '|' + (v6Pu[0].aprovadoEm === v6.iso(3, 15)), 'entregue|2|true');
    igual('etapa: voltar uma etapa (Pronto, Embalagem, Produção, Aprovado, Orçado, Pedido)', ['pronto', 'embalagem', 'producao', 'aprovado', 'enviado', 'pedido'].map(function (e) { return D.etapaAnterior({ status: e }); }).join(','), 'embalagem,producao,aprovado,enviado,,');
    var v6Volta = D.mudarEtapa(v6P, v6K, D.etapaAnterior(v6P[0]), em(0, 10));
    igual('etapa: voltar de Pronto a Embalagem mantém a data da venda', v6Volta[0].status + '|' + (v6Volta[0].aprovadoEm === v6.iso(3, 15)), 'embalagem|true');
    var v6Desf = D.mudarEtapa(v6A, v6K, 'enviado', em(2));
    igual('etapa: voltar a Orçado apaga aprovadoEm e a venda sai; aprovar de novo grava a data nova', [('aprovadoEm' in v6Desf[0]), D.resumoVendas(v6Desf, '7', hojeH).vendas, D.mudarEtapa(v6Desf, v6K, 'aprovado', em(1))[0].aprovadoEm === v6.iso(1)].join('|'), 'false|0|true');
    var v6Canc = D.mudarEtapa(v6P, v6K, 'cancelado', em(0, 11));
    igual('etapa: Cancelado sai das vendas, o registro fica e dá para voltar à etapa anterior', [v6Canc.length, D.resumoVendas(v6Canc, 'tudo', hojeH).vendas, 'aprovadoEm' in v6Canc[0], D.etapaAnterior(v6Canc[0])].join('|'), '2|0|false|pronto');
    igual('etapa: a mesma etapa, etapa inválida e chave inexistente não mudam nada', [D.mudarEtapa(v6A, v6K, 'aprovado', em(0))[0] === v6A[0], D.mudarEtapa(v6A, v6K, 'lixo', em(0))[0] === v6A[0], JSON.stringify(D.mudarEtapa(v6A, 'x|y', 'pronto', em(0))) === JSON.stringify(v6A)].join('|'), 'true|true|true');
    igual('etapa: próxima etapa e fim da linha', ['aprovado', 'producao', 'embalagem', 'pronto', 'entregue', 'enviado', 'pedido', 'cancelado'].map(function (e) { return D.proximaEtapa(e) || ''; }).join(','), 'producao,embalagem,pronto,entregue,,,,');
    igual('etapa: etapas para pular', D.etapasSeguintes('producao').join(',') + '|' + D.etapasSeguintes('entregue').length + '|' + D.etapasSeguintes('enviado').length, 'embalagem,pronto,entregue|0|0');
    igual('etapa: atualizarRegistro (tela atual) também grava aprovadoEm e histórico', (function () {
      var x = D.atualizarRegistro(v6L, v6K, { status: 'aprovado', statusEm: v6.iso(2) })[0];
      return [x.aprovadoEm === v6.iso(2), x.historico.length].join('|');
    })(), 'true|1');
    igual('etapa: Recusado volta à etapa anterior pelo histórico', D.etapaAnterior(D.mudarEtapa(v6L, v6K, 'recusado', em(0))[0]), 'enviado');

    // pedido ainda sem orçamento
    var v6Ped = D.novoPedido({ cliente: '  Carlos  Lima ', texto: 'Preciso de 40 chaveiros com a logo da loja, para sexta', qtd: 40, prazoDesejado: '2026-11-20', canal: 'whatsapp' }, em(2, 9));
    igual('pedido: n = 0, sem preço, etapa Pedido, criado e histórico', [v6Ped.n, v6Ped.status, v6Ped.total, v6Ped.cliente, v6Ped.qtd, v6Ped.criadoEm === v6.iso(2, 9), v6Ped.ts === v6Ped.criadoEm, v6Ped.historico[0].etapa, v6Ped.canal, v6Ped.prazoDesejado].join('|'),
      '0|pedido|0|Carlos Lima|40|true|true|pedido|whatsapp|2026-11-20');
    var v6Longo = new Array(300).join('a');
    igual('pedido: texto curto fica na descrição; texto longo guarda o inteiro e a descrição corta em 120', [D.novoPedido({ texto: 'Chaveiro' }).descricao, 'pedidoTexto' in D.novoPedido({ texto: 'Chaveiro' }), D.novoPedido({ texto: v6Longo }).descricao.length, D.novoPedido({ texto: v6Longo }).pedidoTexto.length].join('|'), 'Chaveiro|false|120|299');
    igual('pedido: texto vai só até 600; canal e prazo inválidos saem; quantidade mínima 1', [D.novoPedido({ texto: new Array(900).join('b') }).pedidoTexto.length, 'canal' in D.novoPedido({ texto: 'x', canal: 'fax' }), 'prazoDesejado' in D.novoPedido({ texto: 'x', prazoDesejado: 'logo' }), D.novoPedido({ texto: 'x', qtd: 0 }).qtd].join('|'), '600|false|false|1');
    igual('pedido: sobrevive à leitura e ao backup', JSON.stringify(D.lerRegistro(v6Ped)) === JSON.stringify(v6Ped), true);
    var v6Fila = [v6Ped, D.lerRegistro(mkReg(20, 1, { total: 100 })), D.lerRegistro(mkReg(21, 3, { total: 200, status: 'aprovado', statusEm: v6.iso(2) }))];
    igual('pedido: não é enviado, nem aguardando resposta, nem venda, nem vencido', [D.contarSituacoes(v6Fila, hojeH).enviado, D.resumoVendas(v6Fila, 'tudo', hojeH).aguardando.qtd, D.resumoVendas(v6Fila, 'tudo', hojeH).qtd, D.situacao(v6Ped, hojeH)].join('|'), '1|1|1|pedido');
    var v6Kp = D.chaveRegistro(v6Ped);
    igual('pedido: etapa Pedido só vai para Recusado ou Cancelado', ['aprovado', 'pronto', 'cancelado'].map(function (e) { return D.mudarEtapa([v6Ped], v6Kp, e, em(0))[0].status; }).join(','), 'pedido,pedido,cancelado');
    var v6Orc = D.orcarPedido(v6Fila, v6Kp, r1, { numero: 77, quando: em(0, 14), cliente: 'Carlos Lima', descricao: 'Chaveiro com logo', entrada: entPlanilha, prazo: '5 dias úteis', validadeAte: '2026-11-21', versaoApp: '0.6.0-teste.1' });
    var v6Of = v6Orc.lista[0];
    igual('orçar pedido: o mesmo registro vira Orçado (não cria outro)', [v6Orc.lista.length, v6Orc.vinculado, v6Of.status, v6Of.n, v6Of.ts === v6.iso(0, 14), v6Of.total, v6Of.cliente, v6Of.descricao, D.chaveRegistro(v6Of) === v6Orc.chave].join('|'), '3|true|enviado|77|true|2.36|Carlos Lima|Chaveiro com logo|true');
    igual('orçar pedido: guarda criação, canal, prazo desejado e acrescenta ao histórico', [v6Of.criadoEm === v6.iso(2, 9), v6Of.canal, v6Of.prazoDesejado, v6Of.historico.map(function (h) { return h.etapa; }).join('>'), D.contarSituacoes(v6Orc.lista, hojeH).enviado, !!v6Of.entrada].join('|'), 'true|whatsapp|2026-11-20|pedido>enviado|2|true');
    igual('orçar pedido: sem descrição digitada fica a do pedido; sem pedido vinculado cria registro novo', [D.orcarPedido(v6Fila, v6Kp, r1, { numero: 78, quando: em(0, 15) }).lista[0].descricao, D.orcarPedido(v6Fila, 'x|y', r1, { numero: 79, quando: em(0, 15) }).lista.length, D.orcarPedido(v6Fila, 'x|y', r1, { numero: 79, quando: em(0, 15) }).vinculado, D.orcarPedido(v6Orc.lista, v6Orc.chave, r1, { numero: 80, quando: em(0, 16) }).lista.length].join('|'),
      'Preciso de 40 chaveiros com a logo da loja, para sexta|4|false|4');
    igual('orçar pedido: restaurar backup não repete o pedido que já virou orçamento', D.juntarRegistros(v6Orc.lista, [v6Ped], 5000).length + '|' + D.juntarRegistros([v6Ped], v6Orc.lista, 5000).length, '3|3');

    // chips por etapa e filtros
    var v6Todos = [D.lerRegistro(v6Ped), D.lerRegistro(mkReg(30, 2, { total: 100 })), D.lerRegistro(mkReg(31, 12, { total: 80, validadeAte: '2026-11-05' })), v6.venda(32, 5, 90, { status: 'aprovado' }), v6.venda(33, 20, 90, { status: 'producao' }),
      v6.venda(34, 40, 70, { status: 'embalagem' }), v6.venda(35, 1, 60, { status: 'pronto' }), v6.venda(36, 3, 60, { status: 'entregue' }), v6.venda(37, 60, 60, { status: 'entregue' }), mkReg(38, 4, { status: 'recusado', statusEm: v6.iso(3) }), v6.venda(39, 2, 50, { status: 'cancelado' })];
    var v6Cont = D.contarEtapas(v6Todos, hojeH);
    igual('chips: contagem por etapa (Vencido separado de Orçado)', ['pedido', 'enviado', 'vencido', 'aprovado', 'producao', 'embalagem', 'pronto', 'entregue', 'recusado', 'cancelado'].map(function (e) { return v6Cont[e]; }).join(','), '1,1,1,1,1,1,1,2,1,1');
    var v6Ids = function (f) { return v6.ns(D.filtrarRegistros(v6Todos, Object.assign({ hoje: hojeH }, f))); };
    igual('chips: Pedido, Pronto, Produção e Embalagem são filas e ignoram o período', [v6Ids({ situacao: 'pedido', periodo: 'hoje' }), v6Ids({ situacao: 'pronto', periodo: 'hoje' }), v6Ids({ situacao: 'producao', periodo: 'hoje' }), v6Ids({ situacao: 'embalagem', periodo: 'hoje' })].join('|'), '0|35|33|34');
    igual('chips: Entregue e Cancelado usam a data da venda no período', [v6Ids({ situacao: 'entregue', periodo: '7' }), v6Ids({ situacao: 'entregue', periodo: 'tudo' }), v6Ids({ situacao: 'cancelado', periodo: '7' })].join('|'), '36|36,37|39');
    igual('chips: filtro por vence em e por prazo vencido', [v6Ids({ situacao: 'vencido', venceEm: '2026-11-05' }), D.filtrarRegistros([mkReg(1, 0, { validadeAte: '2026-11-14' }), mkReg(2, 0, { validadeAte: '2026-11-15' })], { situacao: 'enviado', venceEm: '2026-11-14', hoje: hojeH }).length,
      v6.ns(D.filtrarRegistros([mkReg(1, 0, { prazoDesejado: '2026-11-10' }), mkReg(2, 0, { prazoDesejado: '2026-11-20' }), mkReg(3, 0, { prazoDesejado: '2026-11-10', status: 'entregue' })], { prazoVencido: true, periodo: 'tudo', hoje: hojeH }))].join('|'), '31|1|1');

    // pagamentos
    var v6S = function (extra) { return D.lerRegistro(v6.venda(60, 2, 186, extra)); };
    var v6Ch = D.chaveRegistro(v6S());
    var v6P0 = D.situacaoPagamento(v6S());
    igual('pagamento: sem recebimento é Pendente com a falta', [v6P0.estado, v6P0.rotulo, v6P0.falta, v6P0.texto].join('|'), 'pendente|Pendente|186|Falta R$ 186,00');
    var v6Ent = D.definirCondicao([v6S()], v6Ch, { condicao: 'entrada' });
    igual('pagamento: entrada sugerida é 50% do total', [v6Ent[0].pagamento.condicao, v6Ent[0].pagamento.entradaPrevista, D.entradaSugerida(186), D.entradaSugerida(0.05), D.entradaSugerida(100.01)].join('|'), 'entrada|93|93|0.03|50.01');
    igual('pagamento: entrada em % ou em R$, sempre entre 1 centavo e o total', [D.definirCondicao([v6S()], v6Ch, { condicao: 'entrada', entradaPct: 30 })[0].pagamento.entradaPrevista, D.definirCondicao([v6S()], v6Ch, { condicao: 'entrada', entradaValor: 40.5 })[0].pagamento.entradaPrevista,
      D.definirCondicao([v6S()], v6Ch, { condicao: 'entrada', entradaValor: 999 })[0].pagamento.entradaPrevista, D.definirCondicao([v6S()], v6Ch, { condicao: 'entrada', entradaValor: 0 })[0].pagamento.entradaPrevista].join('|'), '55.8|40.5|186|0.01');
    igual('pagamento: chave inexistente não muda nada', JSON.stringify(D.definirCondicao([v6S()], 'x', { condicao: 'entrada' })) === JSON.stringify([v6S()]), true);
    var v6Rec = D.registrarRecebimento(v6Ent, v6Ch, { valor: 93, em: em(1, 10), forma: 'pix' });
    var v6Pp = D.situacaoPagamento(v6Rec[0]);
    igual('pagamento: entrada recebida deixa Parcial, com o texto da entrada', [v6Pp.estado, v6Pp.recebido, v6Pp.falta, v6Pp.texto].join('|'), 'parcial|93|93|Entrada R$ 93,00 · falta R$ 93,00');
    var v6Pg = D.situacaoPagamento(D.registrarRecebimento(v6Rec, v6Ch, { valor: 93, em: em(0, 10), forma: 'dinheiro' })[0]);
    igual('pagamento: o restante deixa Pago', [v6Pg.estado, v6Pg.rotulo, v6Pg.falta, v6Pg.texto].join('|'), 'pago|Pago|0|Pago');
    var v6C3 = D.lerRegistro(v6.venda(61, 1, 0.3)), v6K3 = D.chaveRegistro(v6C3);
    igual('pagamento: soma em centavos inteiros (0,10 + 0,20 = 0,30)', D.situacaoPagamento(D.registrarRecebimento(D.registrarRecebimento([v6C3], v6K3, { valor: 0.1 }), v6K3, { valor: 0.2 })[0]).estado, 'pago');
    igual('pagamento: valor zero, negativo ou lixo não grava; forma desconhecida vira Outro', [D.registrarRecebimento(v6Ent, v6Ch, { valor: 0 })[0].pagamento.recebimentos.length, D.registrarRecebimento(v6Ent, v6Ch, { valor: -5 })[0].pagamento.recebimentos.length, D.registrarRecebimento(v6Ent, v6Ch, { valor: 'abc' })[0].pagamento.recebimentos.length,
      D.registrarRecebimento(v6Ent, v6Ch, { valor: 5, forma: 'cheque' })[0].pagamento.recebimentos[0].forma].join('|'), '0|0|0|outro');
    var v6Orcado = D.lerRegistro(mkReg(62, 0, { total: 10 }));
    igual('pagamento: Pedido e Orçado não recebem nem têm etiqueta; sem condição escolhida vale "entrega"', [D.registrarRecebimento([v6Orcado], D.chaveRegistro(v6Orcado), { valor: 5 })[0].pagamento === undefined,
      D.registrarRecebimento([v6S()], v6Ch, { valor: 5 })[0].pagamento.condicao, D.situacaoPagamento(v6Orcado).estado, D.situacaoPagamento(v6Ped).rotulo === ''].join('|'), 'true|entrega||true');
    igual('pagamento: excluir um recebimento volta a etiqueta; índice inexistente não muda', D.situacaoPagamento(D.excluirRecebimento(v6Rec, v6Ch, 0)[0]).estado + '|' + D.excluirRecebimento(v6Rec, v6Ch, 5)[0].pagamento.recebimentos.length, 'pendente|1');
    var v6K63 = D.chaveRegistro(D.lerRegistro(mkReg(63, 3, { total: 120 })));
    var v6Ja = D.aprovarComCondicao([D.lerRegistro(mkReg(63, 3, { total: 120 }))], v6K63, { condicao: 'pago' }, em(1, 9))[0];
    igual('pagamento: "Já pago" aprova e registra o total, com a data da aprovação', [v6Ja.status, v6Ja.pagamento.condicao, v6Ja.pagamento.recebimentos.length, v6Ja.pagamento.recebimentos[0].valor, v6Ja.pagamento.recebimentos[0].em === v6.iso(1, 9), D.situacaoPagamento(v6Ja).estado].join('|'), 'aprovado|pago|1|120|true|pago');
    igual('pagamento: mudar para "Já pago" depois só registra o que falta; repetir não duplica', (function () {
      var a = D.definirCondicao(v6Rec, v6Ch, { condicao: 'pago' }), b = D.definirCondicao(a, v6Ch, { condicao: 'pago' });
      return [a[0].pagamento.recebimentos.map(function (x) { return x.valor; }).join('+'), b[0].pagamento.recebimentos.length].join('|');
    })(), '93+93|2');
    var v6Cn1 = D.cancelarPedido(v6Rec, v6Ch, true, em(0, 12))[0], v6Cn2 = D.cancelarPedido(v6Rec, v6Ch, false, em(0, 12))[0];
    igual('cancelar com entrada: "Devolvi" grava o estorno; "Ficou com você" mantém', [v6Cn1.status, D.situacaoPagamento(v6Cn1).recebido, v6Cn1.pagamento.recebimentos[1].valor, v6Cn1.pagamento.recebimentos[1].forma, v6Cn2.pagamento.recebimentos.length, D.situacaoPagamento(v6Cn2).recebido, 'aprovadoEm' in v6Cn1].join('|'), 'cancelado|0|-93|estorno|1|93|false');
    igual('cancelar sem nada recebido não inventa estorno; cancelado não tem etiqueta de pagamento', D.cancelarPedido([v6S()], v6Ch, true, em(0))[0].pagamento === undefined && D.situacaoPagamento(v6Cn2).estado === null, true);
    var v6Rs = [D.lerRegistro(v6.venda(70, 5, 100)), D.lerRegistro(v6.venda(71, 5, 200, { status: 'pronto' })), D.lerRegistro(v6.venda(72, 5, 50, { status: 'entregue' })), v6Cn2, D.lerRegistro(mkReg(73, 2, { total: 999 })), v6Ped];
    v6Rs = D.registrarRecebimento(v6Rs, D.chaveRegistro(v6Rs[1]), { valor: 120, em: em(0, 9), forma: 'pix' });
    v6Rs = D.registrarRecebimento(v6Rs, D.chaveRegistro(v6Rs[2]), { valor: 50, em: em(10, 9), forma: 'pix' });
    igual('a receber: soma só o que falta nas vendas (cancelado, orçado e pedido ficam fora)', JSON.stringify(D.aReceber(v6Rs)), '{"qtd":2,"total":180}');
    igual('a receber: lista vazia', JSON.stringify(D.aReceber([])) + JSON.stringify(D.aReceber(null)), '{"qtd":0,"total":0}{"qtd":0,"total":0}');
    var v6Es = [D.cancelarPedido(v6Rec, v6Ch, true, em(0, 12))[0]].concat(v6Rs.slice(0, 3));
    igual('recebido no período: pela data de cada recebimento (hoje, 7, 30 dias, tudo)', [D.recebidoNoPeriodo(v6Rs, 'hoje', hojeH).total, D.recebidoNoPeriodo(v6Rs, '7', hojeH).total, D.recebidoNoPeriodo(v6Rs, '30', hojeH).total, D.recebidoNoPeriodo(v6Rs, 'tudo', hojeH).total].join('|'), '120|213|263|263');
    igual('recebido no período: o estorno desconta na data em que foi feito', [D.recebidoNoPeriodo(v6Es, 'hoje', hojeH).total, D.recebidoNoPeriodo(v6Es, 'tudo', hojeH).total, D.recebidoNoPeriodo(v6Es, 'tudo', hojeH).qtd].join('|'), '27|170|3');
    igual('filtro por pagamento: Pendente, Parcial e Pago (sem período)', ['pendente', 'parcial', 'pago'].map(function (p) { return v6.ns(D.filtrarRegistros(v6Rs, { pagamento: p, hoje: hojeH })); }).join('|'), '70|71|72');
    igual('chips de pagamento: contagem', JSON.stringify(D.contarEtapas(v6Rs, hojeH).pagamento), '{"pendente":1,"parcial":1,"pago":1}');

    // limite de registros
    igual('limite: 4.499 ainda sem aviso, 4.500 perto, 5.000 cheio', [D.estadoLimite(4499), D.estadoLimite(4500), D.estadoLimite(5000)].map(function (e) { return e.perto + '/' + e.cheio; }).join(','), 'false/false,true/false,true/true');
    igual('limite: textos de aviso', [D.estadoLimite(10).texto === '', D.estadoLimite(4600).texto, D.estadoLimite(5000).texto].join('|'), 'true|Perto do limite de registros: faça um backup e exclua pedidos antigos que não precisa|Limite de registros atingido: exclua pedidos antigos antes de anotar outro');
    igual('limite: aceita lista no lugar do número', D.estadoLimite(new Array(4500).fill(1)).perto + '|' + D.estadoLimite(null).qtd, 'true|0');
    var v6Gr = []; for (var v6I = 0; v6I < 5000; v6I++) v6Gr.push(mkReg(v6I + 1, v6I % 40, { status: v6I % 3 ? 'aprovado' : 'enviado', statusEm: v6.iso(v6I % 40), total: 10 + (v6I % 5) }));
    var v6T0 = Date.now(), v6Rg = D.resumoVendas(D.migrarAprovadoEm(v6Gr), 'tudo', hojeH); D.tarefasHoje(v6Gr, hojeH, null); D.contarEtapas(v6Gr, hojeH);
    igual('limite: 5.000 registros no painel, nas tarefas e nos chips em menos de 1 segundo', v6Rg.qtd + '|' + (Date.now() - v6T0 < 1000), '3333|true');
    igual('limite: juntar e restaurar aceitam até 5.000, sem descartar', D.juntarRegistros(v6Gr.slice(0, 3000), v6Gr.slice(2000), D.MAX_REGISTROS).length + '|' + D.restaurarDados({ registros: v6Gr.slice(0, 3000) }, { registros: v6Gr.slice(2000) }).registros.length, '5000|5000');

    // cobrar resposta
    var v6Cob = D.lerRegistro(mkReg(42, 9, { cliente: 'Ana', descricao: 'Suporte de headset', total: 186, custoTotal: 123.45, lucro: 62.55 }));
    igual('cobrança: mensagem completa', D.mensagemCobranca(v6Cob), 'Oi, Ana! Tudo bem? Passando para saber se você viu o orçamento Nº 0042 (Suporte de headset, R$ 186,00). Se quiser, ajusto a quantidade ou o prazo.');
    igual('cobrança: sem cliente e sem descrição', D.mensagemCobranca(Object.assign({}, v6Cob, { cliente: '' })) + '|' + D.mensagemCobranca(Object.assign({}, v6Cob, { descricao: '' })),
      'Oi! Tudo bem? Passando para saber se você viu o orçamento Nº 0042 (Suporte de headset, R$ 186,00). Se quiser, ajusto a quantidade ou o prazo.|Oi, Ana! Tudo bem? Passando para saber se você viu o orçamento Nº 0042 (R$ 186,00). Se quiser, ajusto a quantidade ou o prazo.');
    igual('cobrança: nunca mostra custo, margem nem lucro', /123,45|62,55|custo|lucro|margem/i.test(D.mensagemCobranca(v6Cob)), false);
    var v6Cr = D.registrarCobranca([v6Cob, D.lerRegistro(mkReg(43, 1))], D.chaveRegistro(v6Cob), em(0, 10));
    var v6Cr2 = D.registrarCobranca(v6Cr, D.chaveRegistro(v6Cob), em(0, 11));
    igual('cobrança: grava cobradoEm e soma 1 em cobrancas; os outros não mudam', [v6Cr[0].cobradoEm === v6.iso(0, 10), v6Cr[0].cobrancas, v6Cr2[0].cobradoEm === v6.iso(0, 11), v6Cr2[0].cobrancas, 'cobrancas' in v6Cr[1], 'cobrancas' in v6Cob].join('|'), 'true|1|true|2|false|false');

    // pra fazer hoje
    var v6Mais = [];   // monta o dia com um de cada situação
    v6Mais.push(D.lerRegistro(mkReg(101, 2, { total: 100, validadeAte: '2026-11-14' })), D.lerRegistro(mkReg(102, 1, { total: 154, validadeAte: '2026-11-14' })));       // 2 vencem hoje (R$ 254)
    v6Mais.push(D.novoPedido({ cliente: 'Zeca', texto: 'quero chaveiros' }, em(2, 9)), D.novoPedido({ texto: 'outro' }, em(0, 9)), D.novoPedido({ texto: 'mais um' }, em(1, 9)));    // 3 pedidos, o mais antigo há 2 dias
    v6Mais.push(D.lerRegistro(mkReg(42, 9, { cliente: 'Ana', total: 186 })), D.lerRegistro(mkReg(43, 8, { total: 50 })), D.lerRegistro(mkReg(44, 10, { cliente: 'Bruno', total: 70, cobradoEm: v6.iso(1) })), D.lerRegistro(mkReg(45, 6, { total: 70 })));   // cobrar: 42 e 43
    v6Mais.push(D.lerRegistro(v6.venda(50, 2, 640, { cliente: 'Carlos', pagamento: { condicao: 'entrada', entradaPrevista: 320, recebimentos: [] } })));    // receber entrada
    v6Mais.push(D.lerRegistro(v6.venda(51, 4, 100, { cliente: 'Bia', status: 'pronto', pagamento: { condicao: 'pago', recebimentos: [{ valor: 100, em: v6.iso(4), forma: 'pix' }] } })),
      D.lerRegistro(v6.venda(52, 4, 100, { cliente: 'Loja Exemplo', status: 'pronto', pagamento: { condicao: 'pago', recebimentos: [{ valor: 100, em: v6.iso(4), forma: 'pix' }] } })));     // 2 prontos
    v6Mais.push(D.lerRegistro(v6.venda(53, 6, 200, { cliente: 'Davi', status: 'entregue', pagamento: { condicao: 'entrada', entradaPrevista: 100, recebimentos: [{ valor: 100, em: v6.iso(6), forma: 'pix' }] } })));     // receber restante
    v6Mais.push(D.lerRegistro(v6.venda(54, 5, 90, { prazoDesejado: '2026-11-10', pagamento: { condicao: 'pago', recebimentos: [{ valor: 90, em: v6.iso(5), forma: 'pix' }] } })));    // prazo vencido
    v6Mais.push(D.lerRegistro(mkReg(55, 12, { total: 100, validadeAte: '2026-11-01' })), D.lerRegistro(mkReg(56, 12, { total: 366.2, validadeAte: '2026-11-05' })));       // 2 vencidos
    var v6Ok = { em: v6.iso(0, 8) };   // backup de hoje cedo: sem lembrete
    var v6Tf = D.tarefasHoje(v6Mais, hojeH, v6Ok);
    igual('tarefas: ordem de prioridade', v6.tipos(v6Tf), 'vencem-hoje,pedidos,cobrar,cobrar,receber-entrada,prontos,receber-restante,prazo-vencido,vencidos');
    igual('tarefas: vencem hoje (agrupado, com a soma e o filtro)', [v6Tf[0].texto, v6Tf[0].valor, v6Tf[0].acao, v6Tf[0].alvo.tela, JSON.stringify(v6Tf[0].alvo.filtro)].join('|'), '2 orçamentos vencem hoje|254|Ver|pedidos|{"situacao":"enviado","venceEm":"2026-11-14"}');
    igual('tarefas: pedidos para orçar (o mais antigo)', v6Tf[1].texto + '|' + v6Tf[1].alvo.filtro.situacao, '3 pedidos para orçar · o mais antigo há 2 dias|pedido');
    igual('tarefas: cobrar resposta, um por orçamento, do mais antigo (7 dias ou mais; cobrado há 1 dia sai)', [v6Tf[2].texto, v6Tf[2].valor, v6Tf[2].acao, v6Tf[2].chave === D.chaveRegistro(v6Mais[5]), v6Tf[3].texto, v6Tf[3].valor].join('|'), 'Ana: sem resposta há 9 dias · Nº 0042|186|Cobrar|true|Nº 0043: sem resposta há 8 dias|50');
    igual('tarefas: receber entrada', [v6Tf[4].texto, v6Tf[4].valor, v6Tf[4].acao, v6Tf[4].alvo.tela].join('|'), 'Receber entrada do Carlos|320|Recebi|recebimento');
    igual('tarefas: prontos para entregar com os nomes', v6Tf[5].texto + '|' + v6Tf[5].alvo.filtro.situacao, '2 prontos para entregar · Bia e Loja Exemplo|pronto');
    igual('tarefas: receber restante', [v6Tf[6].texto, v6Tf[6].valor].join('|'), 'Receber restante de Davi|100');
    igual('tarefas: prazo vencido e vencidos', [v6Tf[7].texto, v6Tf[8].texto, v6Tf[8].valor, v6Tf[8].alvo.filtro.situacao].join('|'), '1 pedido com prazo vencido|2 orçamentos vencidos|466.2|vencido');
    igual('tarefas: cobrado há 2 dias ainda some; há 3 dias volta; cobrado hoje some', [2, 3, 0].map(function (d) { return D.tarefasHoje([Object.assign({}, v6Mais[5], { cobradoEm: v6.iso(d) })], hojeH, v6Ok).length; }).join('|'), '0|1|0');
    igual('tarefas: com 7 dias exatos cobra; com 6 não; vencido não cobra, vira vencidos', [D.tarefasHoje([mkReg(1, 7)], hojeH, v6Ok).length, D.tarefasHoje([mkReg(1, 6)], hojeH, v6Ok).length, v6.tipos(D.tarefasHoje([mkReg(1, 9, { validadeAte: '2026-11-10' })], hojeH, v6Ok))].join('|'), '1|0|vencidos');
    igual('tarefas: singular de vence hoje e de pedido para orçar', [D.tarefasHoje([mkReg(1, 1, { validadeAte: '2026-11-14', total: 80 })], hojeH, v6Ok)[0].texto, D.tarefasHoje([v6Mais[2]], hojeH, v6Ok)[0].texto, D.tarefasHoje([D.novoPedido({ texto: 'a' }, em(0, 8))], hojeH, v6Ok)[0].texto].join('|'),
      '1 orçamento vence hoje|1 pedido para orçar · há 2 dias|1 pedido para orçar · chegou hoje');
    var v6Pr = D.lerRegistro(v6.venda(80, 1, 100, { cliente: 'Eva', status: 'pronto', pagamento: { condicao: 'entrada', entradaPrevista: 50, recebimentos: [] } }));
    igual('tarefas: pronto sem entrada recebida pede a entrada e não repete como restante', v6.tipos(D.tarefasHoje([v6Pr], hojeH, v6Ok)), 'receber-entrada,prontos');
    igual('tarefas: pronto com pagamento "na entrega" pede o valor inteiro', (function () {
      var t = D.tarefasHoje([D.lerRegistro(v6.venda(81, 1, 100, { cliente: 'Fábio', status: 'pronto' }))], hojeH, v6Ok);
      return v6.tipos(t) + '|' + t[1].texto + '|' + t[1].valor;
    })(), 'prontos,receber-restante|Receber de Fábio|100');
    igual('tarefas: sem cliente usa o número', D.tarefasHoje([D.lerRegistro(v6.venda(82, 1, 100, { status: 'entregue' }))], hojeH, v6Ok)[0].texto, 'Receber · Nº 0082');
    igual('tarefas: dia em dia dá lista vazia ("Tudo em dia")', D.tarefasHoje([mkReg(1, 1), v6.venda(2, 1, 50, { status: 'entregue', pagamento: { condicao: 'pago', recebimentos: [{ valor: 50, em: v6.iso(1), forma: 'pix' }] } })], hojeH, v6Ok).length + '|' + D.tarefasHoje([], hojeH, null).length + '|' + D.tarefasHoje(null, hojeH, null).length, '0|0|0');
    var v6Vinte = []; for (var v6J = 0; v6J < 20; v6J++) v6Vinte.push(mkReg(300 + v6J, 1));
    igual('tarefas: backup com 20 registros desde o último', [D.tarefasHoje(v6Vinte, hojeH, null)[0].tipo, D.tarefasHoje(v6Vinte, hojeH, null)[0].texto, D.tarefasHoje(v6Vinte, hojeH, null)[0].acao, D.tarefasHoje(v6Vinte.slice(1), hojeH, null).length, D.tarefasHoje(v6Vinte, hojeH, { em: v6.iso(0, 9) }).length].join('|'), 'backup|Fazer backup · 20 orçamentos sem backup|Fazer|0|0');
    var v6Cheio = v6Gr.slice(0, 4500).map(function (r) { return Object.assign({}, r, { status: 'recusado' }); });
    igual('tarefas: perto do limite de registros (4.500) leva ao backup', (function () {
      var t = D.tarefasHoje(v6Cheio, hojeH, { em: hojeH.toISOString() });
      return t.length + '|' + t[0].tipo + '|' + t[0].alvo.tela;
    })(), '1|limite|config-backup');
    igual('tarefas: backup e limite ficam por último', v6.tipos(D.tarefasHoje(v6Mais.concat(v6Cheio), hojeH, null).slice(-2)), 'backup,limite');

    // primeiro uso
    igual('primeiro uso: sem registros e sem configuração', JSON.stringify(D.primeiroUso([], null)), '{"primeiroUso":true,"itens":[{"chave":"filamento","texto":"Preço do seu filamento","feito":false,"alvo":"config-filamentos"},{"chave":"negocio","texto":"Meu negócio","feito":false,"alvo":"config-negocio"}]}');
    igual('primeiro uso: ✓ quando já salvou Configurações e quando o negócio tem nome', [D.primeiroUso([], { perdaPct: 5 }).itens[0].feito, D.primeiroUso([], { perdaPct: 5 }).itens[1].feito, D.primeiroUso([], { negocio: { nome: ' Mundo 3DI ' } }).itens[1].feito, D.primeiroUso([], { negocio: { nome: ' ' } }).itens[1].feito, D.primeiroUso([], {}).itens[0].feito].join('|'), 'true|false|true|false|false');
    igual('primeiro uso: some depois do primeiro orçamento ou pedido', D.primeiroUso([mkReg(1, 0)], null).primeiroUso + '|' + D.primeiroUso([v6Ped], null).primeiroUso + '|' + D.primeiroUso(null, null).primeiroUso, 'false|false|true');

    // backup formato 2, formato 1 e planilha
    var v6Dados = { config: { perdaPct: 5 }, contador: 80, registros: [v6Ped, v6Orc.lista[1], v6Of, v6Cn1], catalogo: [], materialAtual: 'PLA' };
    var v6Bk = D.montarBackup(v6Dados, { ambiente: 'teste', versaoApp: '0.6.0-teste.1', criadoEm: em(0, 18) });
    var v6Lido = D.lerBackup(JSON.stringify(v6Bk));
    igual('backup v2: formato 2 e ida e volta com pedidos, etapas e pagamentos', [v6Bk.formato, v6Lido.ok, JSON.stringify(v6Lido.backup.dados.registros) === JSON.stringify(D.montarDados(v6Dados).registros), v6Lido.backup.dados.registros[3].pagamento.recebimentos.length].join('|'), '2|true|true|2');
    var v6Bk1 = JSON.stringify({ app: 'mundo3di', formato: 1, ambiente: 'producao', versaoApp: '0.5.3', criadoEm: em(1).toISOString(), dados: { config: {}, contador: 5, registros: [mkReg(1, 5, { status: 'aprovado', statusEm: v6.iso(2) }), mkReg(2, 5)], catalogo: [] } });
    var v6L1 = D.lerBackup(v6Bk1);
    igual('backup v1: a 0.6.0 ainda restaura e migra aprovadoEm', [v6L1.ok, v6L1.backup.formato, v6L1.backup.dados.registros[0].aprovadoEm === v6.iso(2), 'aprovadoEm' in v6L1.backup.dados.registros[1]].join('|'), 'true|1|true|false');
    igual('backup v1: restaurar junta sem repetir e as vendas continuam nos mesmos dias', D.resumoVendas(D.restaurarDados({ registros: [] }, v6L1.backup.dados).registros, 'tudo', hojeH).vendas, 10);
    igual('backup: formato 3 (futuro) pede atualizar o app', D.lerBackup('{"app":"mundo3di","formato":3,"dados":{}}').erro, 'novo');
    var v6Re = D.resumoBackup(v6Lido.backup);
    igual('backup: pedido sem número não conta como orçamento nem entra na faixa de números', [v6Re.orcamentos, v6Re.pedidos, v6Re.numMin, v6Re.numMax, D.descreverOrcamentos(v6Re)].join('|'), '3|1|20|77|3 orçamentos (Nº 0020 a 0077) e 1 pedido ainda sem orçamento');
    igual('backup: só pedidos', D.descreverOrcamentos({ orcamentos: 0, pedidos: 2 }) + '|' + D.descreverOrcamentos({ orcamentos: 0, pedidos: 0 }), '2 pedidos ainda sem orçamento|Nenhum orçamento');
    var v6Csv = D.gerarCSV([v6Ped, D.lerRegistro(v6.venda(90, 2, 186, { cliente: 'Ana', status: 'producao', pagamento: { condicao: 'entrada', entradaPrevista: 93, recebimentos: [{ valor: 93, em: v6.iso(2), forma: 'pix' }] } })), D.lerRegistro(mkReg(91, 0, { total: 10 }))], hojeH).split('\r\n');
    igual('planilha v6: cabeçalho com as colunas novas no fim', v6Csv[0].replace('﻿', '').split(';').slice(-6).join(';'), 'Etapa;Data da aprovação;Data da etapa atual;Condição;Recebido;Falta');
    igual('planilha v6: pedido sem número', v6Csv[2].split(';')[0] + '|' + v6Csv[2].split(';')[12] + '|' + v6Csv[2].split(';').slice(14).join(';'), 'Pedido|Pedido|Pedido;;;;;');
    igual('planilha v6: venda em produção com entrada paga', v6Csv[1].split(';').slice(12).join(';'), 'Produção;0;Produção;12/11/2026;12/11/2026;Entrada + restante;93,00;93,00');
    igual('planilha v6: orçado sem pagamento e mesmo número de colunas em todas as linhas', v6Csv[3].split(';').slice(12).join(';') + '|' + v6Csv.slice(0, 4).map(function (l) { return l.split(';').length; }).join(','), 'Orçado;0;Orçado;;;;;|20,20,20,20');


    // 0.6.0-teste.12: orçamento registrado sem enviar (informado pessoalmente, por telefone ou outro meio)
    var seReg = D.novoRegistro(r1, { numero: 95, formato: 'sem-envio', informado: 'telefone', quando: em(0, 8, 20), cliente: 'Diana', validadeAte: '2026-11-25' });
    igual('sem envio: formato, informado, etapa Orçado e validade', [seReg.formato, seReg.informado, seReg.status, seReg.validadeAte, seReg.total === Math.round(r1.valorCobrar * 100) / 100].join('|'), 'sem-envio|telefone|enviado|2026-11-25|true');
    igual('sem envio: "informado" inválido sai; em texto/imagem não é gravado', ['informado' in D.novoRegistro(r1, { numero: 1, formato: 'sem-envio', informado: 'fax' }), 'informado' in D.novoRegistro(r1, { numero: 1, formato: 'texto', informado: 'telefone' }), D.novoRegistro(r1, { numero: 1, formato: 'sem-envio' }).formato].join('|'), 'false|false|sem-envio');
    var seLido = D.lerRegistro(JSON.parse(JSON.stringify(seReg)));
    igual('sem envio: lido de volta (backup) mantém formato e informado', seLido.formato + '|' + seLido.informado, 'sem-envio|telefone');
    igual('sem envio: descrição no detalhe', [D.descreverEnvio(seReg, hojeH), D.descreverEnvio(Object.assign({}, seReg, { informado: 'presencial' }), hojeH), D.descreverEnvio(Object.assign({}, seReg, { informado: 'outro' }), hojeH), D.descreverEnvio(D.novoRegistro(r1, { numero: 2, formato: 'sem-envio', quando: em(1, 9) }), hojeH)].join(' / '),
      'Registrado hoje às 08:20 · informado por telefone / Registrado hoje às 08:20 · informado pessoalmente / Registrado hoje às 08:20 · informado por outro meio / Registrado ontem às 09:00 · sem envio');
    igual('sem envio: rótulo curto na lista', [D.rotuloFormato(seReg), D.rotuloFormato(Object.assign({}, seReg, { informado: 'presencial' })), D.rotuloFormato(D.novoRegistro(r1, { numero: 2, formato: 'sem-envio' })), D.rotuloFormato(regNovo), D.rotuloFormato(mkReg(3, 0))].join('|'), 'Telefone|Pessoalmente|Sem envio|Imagem|Texto');
    var seEnv = D.atualizarRegistro([seReg], D.chaveRegistro(seReg), { formato: 'imagem' })[0];
    igual('sem envio: enviar depois troca o formato, apaga "informado" e mantém Nº e data', [seEnv.formato, 'informado' in seEnv, seEnv.n, seEnv.ts === seReg.ts, D.atualizarRegistro([seReg], D.chaveRegistro(seReg), { formato: 'lixo' })[0].formato].join('|'), 'imagem|false|95|true|sem-envio');
    igual('sem envio: aparece como Orçado na fila e vence pela validade', [D.filtrarRegistros([seReg], { situacao: 'enviado', hoje: hojeH }).length, D.situacao(seReg, new Date(2026, 10, 26))].join('|'), '1|vencido');
    var seOrc = D.orcarPedido([v6Ped], D.chaveRegistro(v6Ped), r1, { numero: 96, formato: 'sem-envio', informado: 'presencial', quando: em(0, 10) });
    igual('sem envio: orçar um pedido anotado sem enviar (mesmo registro, mantém o canal do pedido)', [seOrc.vinculado, seOrc.lista.length, seOrc.lista[0].formato, seOrc.lista[0].informado, seOrc.lista[0].canal, seOrc.lista[0].n].join('|'), 'true|1|sem-envio|presencial|whatsapp|96');
    var seCsv = D.gerarCSV([seReg], hojeH).split('\r\n');
    igual('sem envio: planilha mostra "Sem envio (telefone)" na coluna Formato', seCsv[1].split(';')[3], 'Sem envio (telefone)');
    return resultados;
  }

  var Testes3DI = { executar: executar };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Testes3DI; }
  root.Testes3DI = Testes3DI;
})(typeof window !== 'undefined' ? window : globalThis);
