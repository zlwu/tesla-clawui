import '../styles/main.css';

import { TeslaOpenClawApp } from './app.js';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root element');
}

void new TeslaOpenClawApp(root).start();
