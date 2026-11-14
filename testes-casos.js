/* Casos de teste das regras de cálculo.
   Usado por teste-calculo.js (node) e por testes.html (ambiente de teste, no celular). */
(function (root) {
  'use strict';

  function executar(C) {
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
    igual('texto 1 peça', C.textoOrcamento(r1).replace(NB, ' '), '*Orçamento — Mundo 3DI*\nPeça impressa em 3D\n*Valor: R$ 2,36*');
    igual('texto 3 peças', C.textoOrcamento(r3).replace(NB, ' '),
      '*Orçamento — Mundo 3DI*\n3 peças impressas em 3D\nValor por peça: R$ 2,36\n*Total: R$ 7,09*');

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
    igual('texto sem material (opção desligada)', C.textoOrcamento(r1, { material: '' }).replace(NB, ' '), '*Orçamento — Mundo 3DI*\nPeça impressa em 3D\n*Valor: R$ 2,36*');
    igual('texto com material (1 peça)', C.textoOrcamento(r1, { material: 'PETG' }).replace(NB, ' '),
      '*Orçamento — Mundo 3DI*\nPeça impressa em 3D\nMaterial: PETG\n*Valor: R$ 2,36*');
    igual('texto com material (3 peças)', C.textoOrcamento(r3, { material: 'PETG' }).replace(NB, ' '),
      '*Orçamento — Mundo 3DI*\n3 peças impressas em 3D\nMaterial: PETG\nValor por peça: R$ 2,36\n*Total: R$ 7,09*');
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
    igual('dados: nome padrão Mundo 3DI', d1.negocioNome, 'Mundo 3DI');
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
    igual('texto com nº: título', C.textoOrcamento(r1, { numero: 7 }).replace(NB, ' '), '*Orçamento Nº 0007 — Mundo 3DI*\nPeça impressa em 3D\n*Valor: R$ 2,36*');
    igual('texto com nome do negócio', C.textoOrcamento(r3, { numero: 12, negocio: 'Oficina X', material: 'PETG' }).replace(NB, ' '),
      '*Orçamento Nº 0012 — Oficina X*\n3 peças impressas em 3D\nMaterial: PETG\nValor por peça: R$ 2,36\n*Total: R$ 7,09*');
    igual('texto sem nº continua igual à v2', C.textoOrcamento(r1).replace(NB, ' '), '*Orçamento — Mundo 3DI*\nPeça impressa em 3D\n*Valor: R$ 2,36*');
    var reg = C.novoRegistro(re, { numero: 9, formato: 'imagem', quando: new Date(Date.UTC(2026, 10, 14, 18, 30)), material: 'PLA', cliente: 'Ana', descricao: 'Vaso' });
    igual('registro: nº, formato e data/hora', reg.n + ' ' + reg.formato + ' ' + reg.ts, '9 imagem 2026-11-14T18:30:00.000Z');
    igual('registro: valores (qtd 2, extras R$ 1,50)', [reg.qtd, reg.valorPeca, reg.total, reg.custoTotal, reg.lucro].join('/'), '2/4.18/8.36/4.18/4.18');
    igual('registro: cliente, material e peça', reg.cliente + '|' + reg.material + '|' + reg.descricao, 'Ana|PLA|Vaso');
    igual('registro: formato desconhecido vira texto', C.novoRegistro(r1, { numero: 1, formato: 'x' }).formato, 'texto');
    var lista = [];
    for (var j = 1; j <= 5; j++) lista = C.adicionarRegistro(lista, { n: j }, 3);
    igual('registros: mantém os 3 mais recentes', lista.map(function (x) { return x.n; }).join(','), '3,4,5');
    igual('registros: lista inválida começa do zero', C.adicionarRegistro(null, { n: 1 }).length, 1);

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
    igual('texto mostra o valor arredondado', txtArr, '*Orçamento Nº 0001 — Mundo 3DI*\n3 peças impressas em 3D\nValor por peça: R$ 2,50\n*Total: R$ 7,50*');
    igual('texto não cita arredondamento', /arredond/.test(txtArr.toLowerCase()), false);
    igual('imagem: total e valor por peça arredondados', (function () { var d = C.dadosOrcamento(r3a, { numero: 1 }); return d.valorPeca.replace(NB, ' ') + ' / ' + d.total.replace(NB, ' '); })(), 'R$ 2,50 / R$ 7,50');
    igual('dados da imagem não citam arredondamento', /arredond/.test(JSON.stringify(C.dadosOrcamento(r3a, { numero: 1 })).toLowerCase()), false);

    return resultados;
  }

  var Testes3DI = { executar: executar };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Testes3DI; }
  root.Testes3DI = Testes3DI;
})(typeof window !== 'undefined' ? window : globalThis);
