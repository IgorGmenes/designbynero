// Converte o arquivo do canvas (design/Prototipo.dc.html) no site estático.
//
// O canvas guarda o site num formato próprio: um template HTML com campos {{a.b}}, laços <sc-for>,
// condicionais <sc-if> e uma classe `Component extends DCLogic` com renderVals(). Este script lê
// esse arquivo e gera, em src/generated/:
//   view.js       o template como função htm (Preact)
//   component.js  a classe, importando o DCLogic do nosso runtime, e os valores padrão dos Tweaks
//   styles.css    o CSS que estava no <helmet>
// Rodado automaticamente por `npm run dev` e `npm run build`.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'htmlparser2';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'design', 'Prototipo.dc.html');
const BLOBS = join(root, 'public', 'blob');
const OUT = join(root, 'src', 'generated');

let file = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');

// ---------- imagens ----------
// No canvas as imagens são endereços /_blob/<id>; aqui elas ficam em public/blob/<id>.<ext>.
// Endereços fixos viram o arquivo local. O único endereço montado em tempo de execução
// ('/_blob/' + id, na galeria dos projetos) passa a consultar o mapa __BLOB.
const blobFiles = {};
for (const f of readdirSync(BLOBS)) {
  const m = f.match(/^([0-9a-f]{32})\.[a-z0-9]+$/);
  if (m) blobFiles[m[1]] = '/blob/' + f;
}
file = file.replace(/'\/_blob\/' \+ ([\w$.[\]]+)/g, '__BLOB[$1]');
const missing = new Set();
file = file.replace(/\/_blob\/([0-9a-f]{32})/g, (all, id) => {
  if (!blobFiles[id]) missing.add(id);
  return blobFiles[id] || all;
});
if (missing.size) throw new Error('imagens que faltam em public/blob: ' + [...missing].join(', '));
if (file.includes('/_blob/')) throw new Error('sobrou um endereço /_blob/ que o conversor não entendeu');

// ---------- partes do arquivo ----------
const xdc = file.match(/<x-dc>([\s\S]*?)<\/x-dc>/);
if (!xdc) throw new Error('design/Prototipo.dc.html: <x-dc> não encontrado');
let template = xdc[1];
const helmet = template.match(/<helmet>([\s\S]*?)<\/helmet>/);
template = template.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
const css = helmet ? (helmet[1].match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1] : '';

const script = file.match(/<script type="text\/x-dc"([^>]*)>([\s\S]*?)<\/script>/);
if (!script) throw new Error('design/Prototipo.dc.html: script do componente não encontrado');
const propsAttr = script[1].match(/data-props='([^']*)'/);
const propsDecl = propsAttr ? JSON.parse(propsAttr[1]) : {};
const props = {};
for (const [k, d] of Object.entries(propsDecl)) {
  if (k.startsWith('$')) continue;
  if (d && Object.prototype.hasOwnProperty.call(d, 'default')) props[k] = d.default;
}
const classCode = script[2].trim();
if (!/class Component extends DCLogic/.test(classCode)) throw new Error('classe Component não encontrada');

// ---------- template → htm ----------
const HOLE = /\{\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\}\}/g;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// caminho a.b.c → a?.b?.c (variável do laço) ou v.a?.b?.c (valores do renderVals)
const expr = (path, scope) => {
  const parts = path.split('.');
  const head = scope.has(parts[0]) ? parts[0] : 'v.' + parts[0];
  return parts.length > 1 ? head + '?.' + parts.slice(1).join('?.') : head;
};
// texto estático dentro de um template literal do htm
const escTpl = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const escText = (s) => escTpl(s).replace(/</g, "${'<'}");

const textWithHoles = (s, scope) => {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(HOLE)) {
    out += escText(s.slice(last, m.index)) + '${T(' + expr(m[1], scope) + ')}';
    last = m.index + m[0].length;
  }
  return out + escText(s.slice(last));
};

const attr = (name, value, scope) => {
  const holes = [...value.matchAll(HOLE)];
  if (!holes.length) {
    return /["`<]|\$\{/.test(value) ? `${name}=\${${JSON.stringify(value)}}` : `${name}="${value}"`;
  }
  if (holes.length === 1 && holes[0][0] === value.trim()) return `${name}=\${${expr(holes[0][1], scope)}}`;
  let lit = '';
  let last = 0;
  for (const m of holes) {
    lit += escTpl(value.slice(last, m.index)) + '${T(' + expr(m[1], scope) + ')}';
    last = m.index + m[0].length;
  }
  lit += escTpl(value.slice(last));
  return `${name}=\${\`${lit}\`}`;
};

const holeOf = (value, what) => {
  const m = [...(value || '').matchAll(HOLE)];
  if (m.length !== 1) throw new Error(`${what}: esperado um campo {{...}}, veio "${value}"`);
  return m[0][1];
};

function emit(nodes, scope) {
  return nodes.map((n) => node(n, scope)).join('');
}

function node(n, scope) {
  if (n.type === 'text') return textWithHoles(n.data, scope);
  if (n.type === 'comment' || n.type === 'directive') return '';
  if (n.type !== 'tag' && n.type !== 'script' && n.type !== 'style') return '';
  const name = n.name;
  const a = n.attribs || {};
  if (name === 'sc-for') {
    const list = expr(holeOf(a.list, 'sc-for list'), scope);
    const as = a.as;
    const inner = new Set(scope);
    inner.add(as);
    return '${(' + list + ' || []).map((' + as + ') => html`' + emit(n.children, inner) + '`)}';
  }
  if (name === 'sc-if') {
    const cond = expr(holeOf(a.value, 'sc-if value'), scope);
    return '${' + cond + ' ? html`' + emit(n.children, scope) + '` : null}';
  }
  const attrs = Object.entries(a)
    .filter(([k]) => !k.startsWith('hint-'))
    .map(([k, val]) => ' ' + attr(k, val, scope))
    .join('');
  if (VOID.has(name.toLowerCase()) || !n.children.length) return `<${name}${attrs} />`;
  return `<${name}${attrs}>${emit(n.children, scope)}</${name}>`;
}

const doc = parseDocument(template, {
  lowerCaseTags: false,
  lowerCaseAttributeNames: false,
  recognizeSelfClosing: true,
  decodeEntities: true
});
const body = emit(doc.children, new Set());

const header = '// Gerado por scripts/dc2site.mjs a partir de design/Prototipo.dc.html. Não editar à mão.\n';
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'view.js'), header + 'export default function view(v, html, T) {\n  return html`' + body + '`;\n}\n');
writeFileSync(
  join(OUT, 'component.js'),
  header + "import { DCLogic } from '../runtime.js';\n\nexport const PROPS = " + JSON.stringify(props, null, 2) + ';\n\n' +
    '// imagens da galeria: id → arquivo em public/blob\nconst __BLOB = ' + JSON.stringify(blobFiles) + ';\n\n' +
    classCode + '\n\nexport default Component;\n'
);
writeFileSync(join(OUT, 'styles.css'), '/* Gerado por scripts/dc2site.mjs a partir do <helmet> de design/Prototipo.dc.html. Não editar à mão. */\n' + css.trim() + '\n');
console.log('dc2site: view.js, component.js e styles.css gerados a partir de design/Prototipo.dc.html (' + Object.keys(blobFiles).length + ' imagens)');
