# designbynero

Portfólio de Gabriel Nero (Design by Nero). Site estático (Preact + Vite), publicado na Vercel.

## Rodar no computador

```bash
npm install
npm run dev
```

`npm run build` gera a versão final em `dist/`; `npm run preview` serve essa versão em http://localhost:4173.

## De onde vem o site

O site é desenhado no canvas de design do Claude ("Nero — Sistema de Formas", página Protótipo). O arquivo do
canvas fica em `design/Prototipo.dc.html` e é a fonte de tudo: textos, layout, animações e dados dos projetos.

O canvas usa um formato próprio (campos `{{...}}`, laços `<sc-for>`, condicionais `<sc-if>` e uma classe
`Component extends DCLogic`). O script `scripts/dc2site.mjs` converte esse arquivo em código Preact, em `src/generated/`
(não versionado: é gerado a cada `npm run dev` e `npm run build`). O `src/runtime.js` faz o papel do runtime do canvas.

As imagens do canvas são endereços `/_blob/<id>`. Aqui elas ficam em `public/blob/<id>.<ext>`, e o conversor troca
os endereços na hora de gerar. Se o build reclamar de uma imagem que falta, baixe-a do canvas para `public/blob/`
com o mesmo id no nome.

### Atualizar depois de mudar algo no canvas

1. Baixe o `Prototipo.dc.html` mais recente do canvas e substitua `design/Prototipo.dc.html`.
2. Se entrou imagem nova no canvas, coloque o arquivo dela em `public/blob/`.
3. Rode `npm run build` para conferir que converte e compila.
4. Faça commit e push. A Vercel publica sozinha a cada push na `main`.

## Estrutura

```
design/Prototipo.dc.html  fonte: arquivo exportado do canvas
scripts/dc2site.mjs       conversor do formato do canvas para Preact
src/runtime.js            DCLogic: o componente do canvas como componente Preact
src/main.js               monta o site em #app
src/generated/            gerado pelo conversor (view.js, component.js, styles.css)
public/blob/              imagens do site (capas, galerias, logos, foto)
public/favicon.png        ícone da aba
index.html                página, título, metatags e fontes
vercel.json               build na Vercel (Vite, saída em dist/)
```

## Publicar na Vercel

Na Vercel: Add New → Project → importe o repositório `designbynero` do GitHub. O `vercel.json` já define o build
(`npm run build`) e a pasta de saída (`dist`). Depois disso, todo push na `main` gera um novo deploy.
