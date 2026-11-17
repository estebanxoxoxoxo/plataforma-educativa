// Hoja de contacto: node sheet.mjs <dirPNG> <outPrefix> <secPorCuadro> [cols=5] [rows=4] [titulo]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const [, , dir, outPrefix, step = '1', cols = '5', rows = '4', title = ''] = process.argv;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const per = +cols * +rows; const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1000 } });
const outs = [];
for (let s = 0; s * per < files.length; s++) {
  const chunk = files.slice(s * per, (s + 1) * per);
  const cells = chunk.map((f, i) => { const sec = (s * per + i) * +step; const mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, '0');
    return `<figure><img src="file://${path.resolve(dir, f)}"><figcaption>${mm}:${ss} (${sec}s)</figcaption></figure>`; }).join('');
  const html = `<style>body{margin:0;background:#111;color:#eee;font:14px system-ui;padding:12px}h1{font-size:16px;margin:0 0 8px}
    .g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px}figure{margin:0}img{width:100%;display:block;border:1px solid #333}
    figcaption{padding:3px 0;font-weight:600}</style><h1>${title} — hoja ${s + 1}</h1><div class="g">${cells}</div>`;
  const hf = path.resolve(outPrefix + '-tmp.html'); fs.writeFileSync(hf, html);
  await p.goto('file://' + hf, { waitUntil: 'load' }); fs.rmSync(hf);
  const o = `${outPrefix}-${String(s + 1).padStart(2, '0')}.png`;
  await p.screenshot({ path: o, fullPage: true }); outs.push(o);
}
await b.close(); console.log(outs.join('\n'));
