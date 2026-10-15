import { h, render } from 'preact';
import './generated/styles.css';
import Site, { PROPS } from './generated/component.js';

render(h(Site, PROPS), document.getElementById('app'));
