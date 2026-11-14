# Orçamentador Mundo 3DI

App web instalável (PWA) para montar e enviar orçamentos de peças impressas em 3D. Funciona no iPhone e no Android, sem loja de aplicativos. Depois do primeiro acesso, funciona também sem internet.

## Como o preço é calculado

| Etapa | Fórmula |
|---|---|
| Material | peso (g) × preço do rolo ÷ peso do rolo (g) — do filamento escolhido na tela (PLA, PETG, TPU…) |
| Impressão | tempo (min) × valor da hora (R$/h) ÷ 60 — o tempo aceita `2h35`, `2:35`, `2h` ou só minutos (`155`). No modo **Detalhado** do custo da hora, vira **Energia** + **Desgaste da impressora** (veja abaixo) |
| Custo base | Material + Impressão |
| Perda/Refugo | Custo base × perda % (padrão 5%) |
| Extras | extras por peça × quantidade de peças (embalagem, acabamento, insumos, frete; sem perda) |
| Custo total | Custo base + Perda/Refugo + Extras |
| Valor a cobrar | Custo total × (1 + margem %) — padrão 100%. Nunca fica abaixo do **preço mínimo por pedido** (0 = desligado) |
| Lucro | Valor a cobrar − Custo total |
| Valor por peça | Valor a cobrar ÷ peças na mesa |

Peso e tempo são os da **mesa inteira** (como o fatiador informa); "Peças na mesa" divide o valor para dar o preço de cada peça. O botão **Enviar orçamento** abre o compartilhamento do celular (WhatsApp etc.) com um texto pronto, sem mostrar custo nem margem.

**Filamentos:** em Configurações há uma lista de filamentos (nome, preço do rolo e peso do rolo — padrão 1000 g). Um deles é o padrão; na tela de orçamento o seletor ao lado de "Peso da mesa" troca o filamento, e o app lembra o último usado. Quem vinha da v2 ganha o filamento "PLA" com o preço do rolo que já estava salvo. O nome do filamento só aparece no orçamento enviado se a opção "Mostrar o filamento no orçamento" estiver ligada (vem desligada). "Restaurar padrões" volta hora, perda e preço mínimo, sem mexer na lista de filamentos.

**Custo da hora (Simples ou Detalhado):** em Configurações > Custos, o **Simples** é o campo único de sempre (R$ 2,25/h, que já cobre manutenção, depreciação e luz). O **Detalhado** separa energia e desgaste: potência média (W, medida com tomada medidora), tarifa (R$/kWh = total da conta ÷ kWh, com impostos e bandeira), preço da impressora, valor de revenda, vida útil (h), manutenção por ano (R$) e horas impressas por ano. Energia/h = potência ÷ 1000 × tarifa. Desgaste/h = (preço − revenda) ÷ vida útil + manutenção por ano ÷ horas por ano. Hora = energia + desgaste. O app mostra o valor por hora ao vivo e avisa se ficar abaixo do valor do modo Simples. Alternar o modo não apaga nenhum campo, e o modo escolhido vale para todos os orçamentos. No "Ver cálculo", a linha "Impressão" vira "Energia" e "Desgaste da impressora". "Restaurar padrões" não mexe no modo nem nos dados da impressora.

**Orçamento em imagem e numeração:** o botão **Enviar orçamento** abre um painel com **Texto** (envio na hora) e **Imagem**. A imagem é um JPG de 1080 px com logo, dados do negócio, nº do orçamento, data, validade, cliente, descrição da peça, material (só se a opção estiver ligada), quantidade, valor por peça, total, prazo, pagamento e observações. **Nunca mostra custo, margem, perda nem lucro.** Cliente, descrição e prazo são opcionais (o prazo já vem do padrão). Em Configurações > **Meu negócio** ficam logo (reduzido a 400 px no próprio aparelho; sem logo, usa o logo 3Di), nome, WhatsApp, Instagram/site, cidade, CNPJ (opcional), validade (padrão 7 dias; 0 não mostra), prazo, formas de pagamento e observação padrão. A imagem é enviada pelo compartilhamento do celular (Android/Chrome e iPhone com iOS 15 ou mais); sem esse recurso, o JPG é baixado. Funciona sem internet. O número é sequencial **por aparelho** (Nº 0001, 0002…), aparece também no texto do WhatsApp e só avança quando o envio acontece (cancelar o compartilhamento não gasta número). Cada envio grava um **registro local com data e hora** (formato, quantidade, valor por peça, total, custo total e lucro — uso interno, nunca enviados — material, cliente e descrição). Os registros ficam só no aparelho: trocar de celular ou limpar os dados do navegador apaga tudo (guarda os últimos 2.000).

Padrões das configurações: PLA a R$ 150,00 o rolo de 1000 g, hora R$ 2,25/h, perda 5%, preço mínimo R$ 0,00. Cada celular guarda as próprias configurações.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Telas e visual |
| `calc.js` | Regras de cálculo, leitura de tempo e texto do orçamento |
| `orcamento-img.js` | Desenha o orçamento em imagem (JPG) com logo, em canvas, sem internet; reduz o logo enviado pelo cliente |
| `app.js` | Funcionamento das telas, configurações salvas, botão copiar, envio do orçamento (texto ou imagem), numeração e registro dos envios |
| `config-ambiente.js` | Nome do ambiente (produção ou teste), prefixo do cache e chave das configurações salvas |
| `manifest.webmanifest` | Nome, ícone e cores do app instalado |
| `sw.js` | Guarda os arquivos no celular para funcionar offline |
| `icons/`, `img/`, `fonts/` | Ícones, logo e fonte Montserrat (inclusa, sem depender da internet) |
| `teste-calculo.js`, `testes-casos.js` | Teste das fórmulas: `node teste-calculo.js` (os mesmos casos rodam no celular, na página `testes.html` do staging) |
| `ambientes/` | Arquivos que mudam entre produção e teste, e o script `montar.sh` |

## Publicar (precisa ser feito uma vez)

O app precisa estar num endereço **https** para poder ser instalado e funcionar offline. Duas opções gratuitas:

**Netlify Drop (mais simples)**
1. Acesse https://app.netlify.com/drop e entre com uma conta gratuita.
2. Arraste a pasta `calculadora-3di` inteira para a página.
3. Use o endereço gerado (dá para trocar o nome em *Site configuration*).

**GitHub Pages**
1. Crie um repositório no GitHub e envie o conteúdo desta pasta (os arquivos na raiz do repositório).
2. Em *Settings → Pages*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. O endereço fica `https://<usuario>.github.io/<repositorio>/`.

## Ambientes: teste (staging) e produção

Antes de ir para produção, toda versão passa pelo **staging**, um site de teste separado (repositório `orcamentador-3di-staging`, também no GitHub Pages). Os dois ambientes não interferem um no outro: cada um tem o seu cache offline e as suas configurações salvas, e o app de teste se instala com o nome **Orçamento 3DI (teste)**, faixa âmbar e a página `testes.html` (cálculo, offline, instalação, compartilhamento e teclado de tempo, direto no celular).

O que muda entre os dois fica só em `config-ambiente.js`, `manifest.webmanifest` e `testes.html` (versões de teste em `ambientes/staging/`). O resto dos arquivos é idêntico.

1. Monte o ambiente numa pasta limpa: `bash ambientes/montar.sh staging <pasta>` (ou `producao`).
2. Publique o conteúdo dessa pasta no repositório do ambiente (staging primeiro).
3. Teste no celular em `…/orcamentador-3di-staging/testes.html` e no orçamentador.
4. Aprovado, monte `producao` e publique no repositório `calculadora-3di`. Nunca copie o `config-ambiente.js` de um ambiente para o outro.

## Instalar no celular

- **iPhone:** abra o endereço no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**.
- **Android:** abra no **Chrome** → toque em **Instalar** no aviso do app, ou menu ⋮ → **Instalar app**.

Depois de instalado, abra uma vez com internet. A partir daí funciona em modo avião.

## Atualizar o app

1. Altere os arquivos.
2. Em `config-ambiente.js` do ambiente, aumente a `versaoCache` (`v2` → `v3`). Sem isso os celulares continuam com a versão antiga.
3. Publique de novo. Os celulares recebem a atualização na próxima vez que abrirem o app com internet (às vezes é preciso fechar e abrir de novo).

## Testar no computador

Na pasta do projeto: `python -m http.server 8000` e abra http://localhost:8000.
