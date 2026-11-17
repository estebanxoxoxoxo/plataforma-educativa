// Cuadros de un webm (VP8/VP9) con Chrome (el ffmpeg de Playwright no decodifica VP8): node frames.mjs <video> <dir> <paso_s>
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const [, , vid, dir, step = '1'] = process.argv; fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const hf = path.resolve(dir, '_v.html');
fs.writeFileSync(hf, `<style>html,body{margin:0;background:#000}video{width:960px;height:600px;display:block}</style><video muted preload="auto" src="file://${path.resolve(vid)}"></video>`);
await p.goto('file://' + hf); 
const dur = await p.evaluate(() => new Promise((ok) => { const v = document.querySelector('video'); if (v.readyState >= 1) ok(v.duration); v.onloadedmetadata = () => ok(v.duration); }));
let i = 0;
for (let t = 0; t < dur; t += +step) {
  await p.evaluate((t) => new Promise((ok) => { const v = document.querySelector('video'); v.onseeked = () => requestAnimationFrame(() => requestAnimationFrame(ok)); v.currentTime = t; }), Math.min(t + 0.02, dur - 0.05));
  await p.screenshot({ path: path.join(dir, String(++i).padStart(3, '0') + '.png') });
}
fs.rmSync(hf); await b.close(); console.log('duración', dur.toFixed(2), 's ·', i, 'cuadros');
