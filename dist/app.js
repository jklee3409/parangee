import { ParangBreathing } from './parang-breathing.js';

const model = new ParangBreathing(document.getElementById('parang'));
window.addEventListener('pagehide', () => model.pause());
window.addEventListener('pageshow', () => model.start());
