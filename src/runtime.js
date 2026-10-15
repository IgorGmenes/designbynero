// Runtime mínimo para o componente exportado do canvas: o canvas roda a classe sobre o próprio runtime
// (DCLogic); aqui ela vira um componente Preact que desenha o template gerado com os valores de renderVals().
import { Component, h } from 'preact';
import htm from 'htm';
import view from './generated/view.js';

const html = htm.bind(h);
// Campos vazios não aparecem como "undefined" no texto
const T = (x) => (x == null || x === false ? '' : x);

export class DCLogic extends Component {
  render() {
    return view(this.renderVals(), html, T);
  }
}
