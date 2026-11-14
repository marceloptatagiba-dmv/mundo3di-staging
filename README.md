# Orçamentador Mundo 3DI

App web instalável (PWA) para montar e enviar orçamentos de peças impressas em 3D. Funciona no iPhone e no Android, sem loja de aplicativos. Depois do primeiro acesso, funciona também sem internet.

## Como o preço é calculado

| Etapa | Fórmula |
|---|---|
| Material | peso (g) × preço do rolo (R$/kg) ÷ 1000 |
| Impressão | tempo (min) × valor da hora (R$/h) ÷ 60 — o tempo aceita `2h35`, `2:35`, `2h` ou só minutos (`155`) |
| Custo base | Material + Impressão |
| Perda/Refugo | Custo base × perda % (padrão 5%) |
| Extras | extras por peça × quantidade de peças (embalagem, acabamento, insumos, frete; sem perda) |
| Custo total | Custo base + Perda/Refugo + Extras |
| Valor a cobrar | Custo total × (1 + margem %) — padrão 100%. Nunca fica abaixo do **preço mínimo por pedido** (0 = desligado) |
| Lucro | Valor a cobrar − Custo total |
| Valor por peça | Valor a cobrar ÷ peças na mesa |

Peso e tempo são os da **mesa inteira** (como o fatiador informa); "Peças na mesa" divide o valor para dar o preço de cada peça. O botão **Enviar orçamento** abre o compartilhamento do celular (WhatsApp etc.) com um texto pronto, sem mostrar custo nem margem.

Padrões das configurações: rolo R$ 150,00/kg, hora R$ 2,25/h, perda 5%, preço mínimo R$ 0,00. Cada celular guarda as próprias configurações.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Telas e visual |
| `calc.js` | Regras de cálculo, leitura de tempo e texto do orçamento |
| `app.js` | Funcionamento das telas, configurações salvas, botão copiar, envio do orçamento |
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
