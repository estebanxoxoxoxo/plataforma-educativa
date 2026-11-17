// Video de FLUJO DE USUARIO (espec de Esteban, 4-nov): chat MCD → artículo → video → crear ruta → aprender → resultado.
// Cursor falso, tipeo humano, y las esperas largas (LLM / route-lab) se cortan después con ffmpeg (cuts.json).
// Modos: MODE=rehearsal (1 mensaje de chat: el del video, + 1 generación) · MODE=full (toma completa).
// NO toca código de la app; sólo usa la UI y, para limpiar, /api/learn-routes (+ /delete) desde la página.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

// OJO (4-nov): el 5173 puede estar ocupado por OTRO proyecto de Esteban (seguimiento-mama). 5188 es el puerto alternativo
// de grabación (vite «smarty-web» de plataforma-educativa, mismo proxy /api → 8787). Se puede pisar con BASE=… por env.
const BASE = process.env.BASE || 'http://localhost:5173';
const HERE = new URL('./', import.meta.url).pathname;
const DIR = HERE + 'rec/';
const MODE = process.env.MODE || 'full';
const TITLE = 'Greatest common divisor';
// Limpieza: títulos de tomas previas (v1–v8 usaban «denominador») + el actual.
const CLEAN_TITLES = ['Greatest common divisor'];
const log = (...a) => console.log(`[flow ${((Date.now() - (globalThis.T0 || Date.now())) / 1000).toFixed(1)}s]`, ...a);

// HiDPI real (4-nov): deviceScaleFactor:2 SOLO no alcanza (el screencast sale a 1440×900 con banda gris); con además
// --force-device-scale-factor=2 el screencast sale a 2880×1800 reales y el layout sigue siendo 1440×900 CSS (verificado).
const Z = 1; // coordenadas de Playwright = CSS (sin zoom)
// v12 (4K): escala parametrizable por env DSF (default 3 → 4320×2700). Layout siempre 1440×900 CSS.
const DSF = +(process.env.DSF || 3);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--lang=en-US', '--window-size=1440,900', `--force-device-scale-factor=${DSF}`, '--autoplay-policy=no-user-gesture-required'] });
// HiDPI (pedido 4-nov): layout 1440×900 CSS, frames a 2× → 2880×1800 nítido.
// EN: navegador en inglés (sin esto YouTube traduce el título del video y su UI al castellano del sistema).
const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF, recordVideo: { dir: DIR, size: { width: Math.round(1440 * DSF), height: Math.round(900 * DSF) } } });
const page = await ctx.newPage();
const T0 = Date.now(); globalThis.T0 = T0;
const rel = (t = Date.now()) => (t - T0) / 1000;
page.setDefaultTimeout(10000);
const wait = (ms) => page.waitForTimeout(ms);
const cuts = [];
const events = [];
const ev = (name) => { events.push({ name, t: rel() }); log('EV', name); };

const COVER_CSS = `
    #vcover{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;
      background:rgba(6,9,17,.9);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
      transition:opacity .45s ease}
    #vcover .vc{text-align:center;color:#fff;font-family:'Baloo 2','Trebuchet MS',sans-serif}
    #vcover b{font-size:92px;font-weight:800;letter-spacing:.01em}`;
const COVER_HTML = '<div class="vc"><b>SMARTY</b></div>';

// SYNC: tira de 16 celdas 8×8 (abajo a la izquierda, se recorta en el post) con el tiempo del guion en
// unidades de 40 ms, en binario. El screencast de Playwright DERIVA respecto del reloj real (medido: +9 %),
// así que los cortes se ubican leyendo esta tira cuadro por cuadro, no por segundos.
const SYNC_JS = `(() => {
  if (window.top !== window) return;
  const T0 = ${T0};
  const mk = () => {
    if (!document.documentElement) return requestAnimationFrame(mk);
    if (document.getElementById('vsync')) return;
    const w = document.createElement('div'); w.id = 'vsync';
    w.style.cssText = 'position:fixed;left:0;bottom:0;width:128px;height:8px;z-index:2147483647;pointer-events:none;display:flex;background:#000';
    const cells = [];
    for (let i = 0; i < 16; i++) { const c = document.createElement('i'); c.style.cssText = 'display:block;width:8px;height:8px'; w.appendChild(c); cells.push(c); }
    document.documentElement.appendChild(w);
    let last = -1;
    const tick = () => {
      const v = Math.floor((Date.now() - T0) / 40);
      if (v !== last) { last = v; for (let i = 0; i < 16; i++) cells[i].style.background = (v >> (15 - i)) & 1 ? '#fff' : '#000'; }
      requestAnimationFrame(tick);
    };
    tick();
  };
  mk();
})();`;
await page.addInitScript(SYNC_JS);
// EN: idioma de la app + route-lab nuevo (genera en inglés). try: en about:blank localStorage puede tirar.
await page.addInitScript(() => { try { localStorage.setItem('innerith.lang', 'en'); localStorage.setItem('innerith.routeLabUrl', 'http://localhost:5204'); } catch {} });

// Cursor falso + velo negro de arranque (sólo hasta el primer fundido). Sobrevive navegaciones vía sessionStorage.
await page.addInitScript(() => {
  if (location.href === 'about:blank') return;
  if (window.top !== window) return; // NO dentro de iframes (el velo negro tapaba el video de YouTube)
  const add = () => {
    try {
      if (!document.documentElement) throw 0;
      if (document.getElementById('vcursor')) return;
      const st = document.createElement('style');
      st.textContent = `#vcursor{position:fixed;z-index:999998;pointer-events:none;width:16px;height:16px;border-radius:50%;
        background:rgba(255,255,255,.95);border:3px solid rgba(20,24,40,.72);box-shadow:0 2px 8px rgba(0,0,0,.35);
        transform:translate(-50%,-50%) scale(1);transition:left .5s cubic-bezier(.4,0,.2,1),top .5s cubic-bezier(.4,0,.2,1),transform .14s ease}
        #vcursor.down{transform:translate(-50%,-50%) scale(.62)}
        #vfade{position:fixed;inset:0;z-index:999997;background:#070a12;transition:opacity .5s ease;pointer-events:none}`;
      const c = document.createElement('div');
      c.id = 'vcursor';
      let p = { x: 760, y: 470 };
      try { p = JSON.parse(sessionStorage.getItem('vcur') || 'null') || p; } catch {}
      c.style.left = p.x + 'px'; c.style.top = p.y + 'px';
      document.documentElement.append(st, c);
      let faded = false;
      try { faded = sessionStorage.getItem('vfaded') === '1'; } catch {}
      if (!faded) { const f = document.createElement('div'); f.id = 'vfade'; document.documentElement.append(f); }
    } catch { requestAnimationFrame(add); }
  };
  add();
});

// Frame 0: negro.
await page.setContent('<style>html,body{margin:0;background:#070a12;height:100%}</style><script>' + SYNC_JS + '</script>');
await wait(300);

/* ---------------- recuadro de mensajes (pedido de Esteban, 4-nov v3) ---------------- */
// Verde de los botones «Canjear» de la Tienda (--st-green #2B8420) con opacidad; letras blancas Baloo 2 800.
await page.addInitScript(() => {
  if (location.href === 'about:blank' || window.top !== window) return;
  const add = () => {
    try {
      if (!document.documentElement) throw 0;
      if (document.getElementById('vmsg')) return;
      const st = document.createElement('style');
      st.textContent = `#vmsg{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:999990;pointer-events:none;
        max-width:680px;padding:10px 18px;border-radius:8px;background:linear-gradient(135deg,rgba(138,92,245,.76),rgba(91,51,189,.78));color:#fff;border:2px solid #B026FF;text-shadow:0 1px 2px rgba(30,10,60,.55);
        font:700 16px/1.35 'Baloo 2','Trebuchet MS',sans-serif;letter-spacing:.01em;text-align:center;
        box-shadow:0 0 10px rgba(176,38,255,.5),0 10px 28px -10px rgba(30,12,60,.55);opacity:0;transition:opacity .35s ease;width:max-content;text-wrap:balance;text-transform:uppercase}
        #vmsg.on{opacity:1}`;
      const m = document.createElement('div'); m.id = 'vmsg';
      document.documentElement.append(st, m);
    } catch { requestAnimationFrame(add); }
  };
  add();
});
const MSG = {
  chat: 'Interaction filtered by allowlisted topics',
  articulo: '100% moderated article, from an allowlisted source',
  player: 'No ads and no YouTube recommendations',
  ruta: 'Content kids care about becomes a learning route',
  crear: 'Extracts the facts from the source and generates the route',
  tienda: 'In the Store, kids trade the Energy Coins they earn for what they like',
  canjes: 'Some prizes are fulfilled by parents, others are redeemed right on the platform',
};
/** Muestra el recuadro con `text`. Si había otro mensaje, primero lo apaga con fade (nunca cambia el texto en seco). */
async function msg(text) {
  await page.evaluate(async (text) => {
    const m = document.getElementById('vmsg');
    if (!m) return;
    if (m.classList.contains('on') && m.textContent === text) return;
    if (m.classList.contains('on')) { m.classList.remove('on'); m.dataset.off = String(Date.now()); }
    const left = 400 - (Date.now() - Number(m.dataset.off || 0)); // que el fade-out anterior termine antes de cambiar el texto
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    m.textContent = text;
    void m.offsetWidth;
    m.classList.add('on');
  }, text);
  ev('msg:' + text.slice(0, 24));
}
/** Apaga el recuadro (fade .35 s; no bloquea: el fade corre mientras sigue la acción). */
async function msgOff() {
  await page.evaluate(() => { const m = document.getElementById('vmsg'); if (m && m.classList.contains('on')) { m.classList.remove('on'); m.dataset.off = String(Date.now()); } });
  ev('msgOff');
}

/* ---------------- helpers ---------------- */
async function moveTo(x, y, settle = 600) {
  await page.evaluate(([x, y]) => {
    const c = document.getElementById('vcursor');
    if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; }
    try { sessionStorage.setItem('vcur', JSON.stringify({ x, y })); } catch {}
  }, [x / Z, y / Z]); // el cursor vive dentro del <html> con zoom: coordenadas CSS
  await page.mouse.move(x, y);
  await wait(settle);
}
async function center(loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('sin boundingBox');
  return [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)];
}
async function click(loc, what = '') {
  const [x, y] = await center(loc);
  await moveTo(x, y, 600);
  await page.evaluate(() => document.getElementById('vcursor')?.classList.add('down'));
  await wait(130);
  await page.mouse.click(x, y);
  await page.evaluate(() => document.getElementById('vcursor')?.classList.remove('down'));
  if (what) log('click', what);
}
async function typeInto(loc, text, delay = 45) {
  await click(loc);
  await page.keyboard.type(text, { delay });
}
function addCut(a, b, label) {
  if (b - a > 1.5) { cuts.push({ from: +a.toFixed(2), to: +b.toFixed(2), label }); log('CUT', label, a.toFixed(2), '→', b.toFixed(2)); }
  else log('cut descartado (corto)', label, (b - a).toFixed(2));
}
/** EN: apaga los subtítulos automáticos de YouTube (IFrame API) en los iframes de `sel`: ahora y a los `later` ms
 *  (los reintentos corren en la página con setTimeout: no agregan esperas al guion). */
async function noCaps(sel, later = []) {
  await page.evaluate(({ sel, later }) => {
    const send = () => {
      for (const f of document.querySelectorAll(sel)) {
        try {
          const w = f.contentWindow;
          w.postMessage(JSON.stringify({ event: 'command', func: 'unloadModule', args: ['captions'] }), '*');
          w.postMessage(JSON.stringify({ event: 'command', func: 'unloadModule', args: ['cc'] }), '*');
          w.postMessage(JSON.stringify({ event: 'command', func: 'setOption', args: ['captions', 'track', {}] }), '*');
        } catch {}
      }
    };
    send();
    for (const ms of later) setTimeout(send, ms);
  }, { sel, later });
}
const nav = (txt) => page.locator('.nav-item', { hasText: txt }).first();

async function animScroll(sel, frac = 0.5, ms = 1000) {
  await page.evaluate(async ({ sel, frac, ms }) => {
    const v = document.querySelector(sel);
    if (!v) return;
    const from = v.scrollTop, delta = v.clientHeight * frac, start = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        v.scrollTop = from + delta * (t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
        t < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }, { sel, frac, ms });
}

/** Mensaje de chat: tipea, Enter, corta la espera. `until` = función que espera el contenido (devuelve cuando apareció). */
async function chat(text, label, until) {
  const ta = page.locator('form.cx-comp textarea');
  await typeInto(ta, text);
  await wait(350);
  await page.keyboard.press('Enter');
  const tStart = rel();
  ev('enviado:' + label);
  const ok = await until();
  const tContent = rel();
  addCut(tStart + 3.0, tContent - 0.8, label);
  return ok;
}
/** Espera a que termine una respuesta de texto: el .cx-think se va y el texto de la última burbuja deja de crecer. */
async function untilTextDone() {
  await page.waitForSelector('.cx-think', { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.cx-think'), null, { timeout: 90000, polling: 100 });
  return true;
}
async function waitRevealDone() {
  // el texto se revela 18 ms/palabra: esperar a que la última burbuja de IA no crezca durante 700 ms
  let last = -1, stable = 0;
  for (let i = 0; i < 120; i++) {
    const n = await page.evaluate(() => { const a = [...document.querySelectorAll('.cx-ai')]; return a.length ? a[a.length - 1].textContent.length : 0; });
    if (n === last) { if (++stable >= 7) break; } else stable = 0;
    last = n;
    await wait(100);
  }
}
async function untilCards(sel, timeout) {
  const before = await page.locator(sel).count();
  try {
    // Gana el primero: llegan cards nuevas, o la respuesta terminó (sin .cx-think) hace 3 s y no trajo cards
    // (el LLM a veces dice «te encontré un artículo» sin adjuntarlo: toma v2-1, 4-nov).
    const h = await page.waitForFunction(({ sel, before }) => {
      if (document.querySelectorAll(sel).length > before) return 'cards';
      const w = window;
      if (document.querySelector('.cx-think')) { w.__vThinkSeen = true; w.__vNoThinkAt = 0; return false; }
      if (!w.__vThinkSeen) return false;
      w.__vNoThinkAt = w.__vNoThinkAt || Date.now();
      return Date.now() - w.__vNoThinkAt > 3000 ? 'sin-cards' : false;
    }, { sel, before }, { timeout, polling: 150 });
    const r = await h.jsonValue();
    await page.evaluate(() => { window.__vThinkSeen = false; window.__vNoThinkAt = 0; });
    return r === 'cards';
  } catch { await page.evaluate(() => { window.__vThinkSeen = false; window.__vNoThinkAt = 0; }); return false; }
}

async function cleanup() {
  const r = await page.evaluate(async (title) => {
    const H = { 'X-Innerith-User': 'ian', 'X-Smarty-Lang': 'en' };
    const list = await (await fetch('/api/learn-routes', { headers: H })).json();
    const del = list.routes.filter((x) => title.includes(x.title));
    for (const x of del) {
      await fetch('/api/learn-routes/delete', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: x.id }) });
    }
    const after = await (await fetch('/api/learn-routes', { headers: H })).json();
    return { deleted: del.map((x) => x.id), remaining: after.routes.map((x) => x.title) };
  }, CLEAN_TITLES);
  log('LIMPIEZA', JSON.stringify(r));
}

/* ---------------- escenas ---------------- */
const report = { mode: MODE };
async function scene(name, fn) {
  if (process.env.SHOP && !['1-nav-chat', '18-tienda', '19-cierre'].includes(name)) return; // ensayo sólo de la Tienda
  ev('escena:' + name);
  try { await fn(); log('OK', name); }
  catch (e) {
    log('FALLÓ', name, String(e).split('\n')[0]);
    await page.screenshot({ path: HERE + `fail-${name}.png` }).catch(() => {});
    throw e;
  }
}

try {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  // EN: la app tiene que estar en inglés (menú con «Learn» y «Store»); si no, la toma no sirve.
  await page.waitForSelector('.nav-item', { timeout: 20000 });
  report.navLabels = await page.locator('.nav-item').allTextContents();
  if (!(await nav('Learn').count()) || !(await nav('Store').count())) throw new Error('ABORT-IDIOMA: la app no está en inglés: ' + JSON.stringify(report.navLabels));
  await cleanup();
  await page.waitForSelector('.hf-thread .hf-slot', { timeout: 20000 }).catch(() => log('feed sin slots (sigo)'));
  // La carga de página dispara POST /api/demo/reset (resetMarket + resetProgress del activo): canjes vacíos y ⚡ al seed.
  // Lo VERIFICO (no lo asumo): si quedó algún canje, la toma no sirve.
  report.marketAtStart = await page.evaluate(async () => {
    const H = { 'X-Innerith-User': 'ian', 'X-Smarty-Lang': 'en' };
    for (let i = 0; i < 20; i++) {
      const r = await (await fetch('/api/market/redemptions', { headers: H })).json();
      if (!r.redemptions.length) return { redemptions: 0, tries: i + 1 };
      await new Promise((ok) => setTimeout(ok, 250));
    }
    const r = await (await fetch('/api/market/redemptions', { headers: H })).json();
    return { redemptions: r.redemptions.length };
  });
  log('MERCADO AL ARRANCAR', JSON.stringify(report.marketAtStart));
  if (report.marketAtStart.redemptions) throw new Error('quedaron canjes de antes: la toma no sirve');
  await wait(400);
  // fundido de negro a la app
  cuts.push({ from: 0.35, to: +(rel() - 0.05).toFixed(2), label: 'arranque (carga detrás del negro)' }); // siempre (aunque sea corto): el crudo arranca antes que el reloj
  await page.evaluate(() => {
    try { sessionStorage.setItem('vfaded', '1'); } catch {}
    const f = document.getElementById('vfade'); if (f) { f.style.opacity = '0'; setTimeout(() => f.remove(), 600); }
  });
  await wait(1500);

  await scene('1-nav-chat', async () => {
    await click(nav('Chat'), 'nav Chat');
    await page.waitForSelector('section#v-chat form.cx-comp textarea');
    await msg(MSG.chat);
    await wait(700);
  });

  if (MODE === 'full') {
    await scene('2-mcd', async () => {
      await chat('Explain the greatest common divisor', 'chat1', untilTextDone);
      await waitRevealDone(); await wait(1700); // v10: pausa post-respuesta corta (antes 4 s)
    });
    await scene('3-divisor', async () => {
      await chat('And how is it different from the least common multiple?', 'chat2', untilTextDone);
      await waitRevealDone(); await wait(1700); // v10: pausa post-respuesta corta (antes 4 s)
    });
    await scene('4-articulo', async () => {
      let ok = await chat('Give me an article about it', 'chat3-art', () => untilCards('section.mg.mg--articles button.mg-art', 90000));
      // El LLM a veces dice «te dejé un artículo» sin llamar a show_articles (server/src/chat.ts): reintentos naturales.
      // v11: con NORETRY=1 una toma que necesitaría reintento se ABORTA (antes de /crear: no gasta generación).
      if (!ok && process.env.NORETRY) throw new Error('ABORT-REINTENTO: artículos sin cards al primer pedido');
      const retries = ['Show them to me, please', 'Show me articles about the greatest common divisor'];
      report.articleRetries = 0;
      for (const [i, q] of retries.entries()) {
        if (ok) break;
        report.articleRetries++; log('respuesta sin cards de artículos → reintento', i + 1);
        await wait(1500);
        ok = await chat(q, `chat3${'bc'[i]}-art`, () => untilCards('section.mg.mg--articles button.mg-art', 90000));
      }
      if (!ok) throw new Error('no llegaron cards de artículos (3 intentos)');
      await page.locator('section.mg.mg--articles').last().scrollIntoViewIfNeeded();
      await wait(2000);
    });
    await scene('5-lector', async () => {
      const cards = page.locator('section.mg.mg--articles').last().locator('button.mg-art');
      // EN: preferir la card «Greatest Common Factor» (mathsisfun); si no hay, la primera.
      const cardTexts = await cards.allTextContents();
      report.articleCards = cardTexts.map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 120));
      let pick = cardTexts.findIndex((t) => /Greatest Common Factor/i.test(t));
      if (pick < 0) pick = 0;
      report.articlePick = pick;
      await click(cards.nth(pick), 'artículo ' + (pick + 1));
      await msgOff();
      await page.waitForURL(/\/buscar\/articulo\//);
      await wait(600);
      await page.waitForFunction(() => !document.querySelector('.modov.show') || document.querySelector('.modov.show.block'), null, { timeout: 60000 });
      if (await page.locator('.modov.show.block').count()) {
        report.articleBlocked = true; log('ARTÍCULO 1 BLOQUEADO por moderación → uso la segunda');
        await page.goBack(); await page.waitForSelector('section.mg.mg--articles button.mg-art');
        await click(page.locator('section.mg.mg--articles').last().locator('button.mg-art').nth(1), 'artículo 2');
        await page.waitForURL(/\/buscar\/articulo\//);
        await page.waitForFunction(() => !document.querySelector('.modov.show'), null, { timeout: 60000 });
      }
      await page.waitForFunction(() => (document.querySelector('.aview .ascroll')?.textContent || '').trim().length > 200, null, { timeout: 30000 });
      report.articleUrl = page.url();
      // EN: el artículo tiene que ser largo (≥1500 caracteres) y en inglés; si no, abortar ANTES de generar.
      const art = await page.evaluate(() => ({ text: (document.querySelector('.aview .ascroll')?.textContent || '').replace(/\s+/g, ' ').trim(), h: document.querySelector('.aview h1, .aview h2, .aview .atitle')?.textContent || document.title }));
      const words = art.text.toLowerCase().split(/[^a-záéíóúñ]+/);
      const en = words.filter((w) => ['the', 'and', 'of', 'is', 'to', 'that', 'with', 'are'].includes(w)).length;
      const es = words.filter((w) => ['el', 'la', 'los', 'las', 'que', 'es', 'del', 'con', 'una'].includes(w)).length;
      report.article = { title: art.h, url: page.url(), chars: art.text.length, enWords: en, esWords: es };
      log('ARTÍCULO', JSON.stringify(report.article));
      if (art.text.length < 1500 || en <= es) throw new Error('ABORT-ARTICULO: corto o no en inglés ' + JSON.stringify(report.article));
      await msg(MSG.articulo);
      await wait(1200);
      await moveTo(760 * Z, 520 * Z, 400);
      await animScroll('.aview .ascroll', 0.5, 1000); await wait(1200);
      await animScroll('.aview .ascroll', 0.5, 1000); await wait(1200);
    });
    await scene('6-volver-chat', async () => {
      await click(nav('Chat'), 'nav Chat');
      await msgOff();
      await page.waitForSelector('section#v-chat form.cx-comp textarea');
      await msg(MSG.chat);
      await wait(900);
    });
  }

  if (process.env.DRY) { await page.goto(BASE + '/crear?video=dQw4w9WgXcQ'); await page.locator('input[aria-label="Module 1: content URL"]').waitFor(); report.prefilled = await page.locator('input[aria-label="Module 1: content URL"]').inputValue(); } else {
  if (!process.env.VIDEO) await scene('7-video', async () => {
    let ok = await chat('Show me a video that explains the greatest common divisor', 'chat4-vid', () => untilCards('section.mg.mg--videos button.mg-vid', 45000));
    if (!ok && process.env.NORETRY) throw new Error('ABORT-REINTENTO: videos sin cards al primer pedido');
    if (!ok) {
      report.videoRetry = true; log('sin videos en 45 s → segundo intento');
      ok = await chat('Show me videos about the greatest common divisor', 'chat5-vid', () => untilCards('section.mg.mg--videos button.mg-vid', 60000));
    }
    if (!ok) throw new Error('no llegaron cards de video');
    await page.locator('section.mg.mg--videos').last().scrollIntoViewIfNeeded();
    await wait(2000);
  });

  await scene('8-player', async () => {
    if (process.env.VIDEO) await page.goto(BASE + '/buscar/video/' + process.env.VIDEO);
    else {
      await click(page.locator('section.mg.mg--videos').last().locator('button.mg-vid').first(), 'video 1');
      await msgOff();
      await page.waitForURL(/\/buscar\/video\//);
    }
    report.videoUrl = page.url();
    if (!/\/buscar\/video\/ui5yjN1riQA/.test(page.url())) throw new Error('ABORT-VIDEO: no es el de Eddie Woo (ui5yjN1riQA): ' + page.url());
    await page.waitForSelector('.player iframe', { state: 'visible' });
    await noCaps('.player iframe', [500, 1500]);
    await msg(MSG.player);
    await wait(1200);
    // El player de la app embebe YouTube con autoplay=1: al llegar desde un click ya arranca solo.
    // .pcover sólo existe en pausa; si ya está reproduciendo, el cursor va al video sin clickear (no pausarlo).
    const cover = page.locator('.pcover');
    const playBtn = page.locator('.prow button[aria-label="Play"]');
    if (await cover.isVisible().catch(() => false)) { await click(cover.first(), 'play (.pcover)'); report.play = 'pcover'; }
    else if (await playBtn.count() && !(await page.locator('.prow button[aria-label="Pause"]').count())) { await click(playBtn.first(), 'play (.prow)'); report.play = 'prow'; }
    else { const [x, y] = await center(page.locator('.player').first()); await moveTo(x, y + 40 * Z, 600); report.play = 'autoplay (sin click)'; log('autoplay: sin click de play'); }
    // v8 (HiDPI): YouTube a veces tarda en arrancar (toma 1: 10 s en negro a 0:00). Esperar a que el reloj avance
    // (máx. 25 s) y cortar esa espera, después sí los 5.5 s de reproducción.
    const tWait = rel();
    const started = await page.waitForFunction(() => { const t = document.querySelector('.prow span')?.textContent || ''; return /^0:0[1-9]|^0:[1-5]\d|^[1-9]/.test(t.trim()); }, null, { timeout: 25000, polling: 200 }).then(() => true).catch(() => false);
    report.playerStarted = started; report.playerWaitS = +(rel() - tWait).toFixed(1);
    log('player arrancó:', started, report.playerWaitS, 's');
    await noCaps('.player iframe', [1000, 2500]);
    addCut(tWait + 1.0, rel() - 0.3, 'arranque del player');
    await wait(5500);
  });

  if (process.env.STOP === 'player') throw new Error('STOP=player');
  await scene('9-crear-ruta', async () => {
    // Agregado 1 (Esteban): el cursor se posa ENCIMA del botón y se queda 2 s quieto; recién después, el click.
    const btn = page.locator('.phead .pcreate').first();
    const [hx, hy] = await center(btn);
    await moveTo(hx, hy, 600);
    ev('hover-crear-ruta');
    await msg(MSG.ruta); // v4: al llegar al botón, fade out (YouTube) → fade in (ruta)
    await wait(2000);
    await click(btn, '+ Crear ruta');
    await page.waitForURL(/\/crear/);
    const url = page.locator('input[aria-label="Module 1: content URL"]');
    await url.waitFor();
    await msg(MSG.crear); // v4: el form de /crear lleva recuadro hasta el click en APRENDER
    report.crearUrl = page.url();
    report.prefilled = await url.inputValue();
    log('URL prellenada:', report.prefilled);
    await wait(900);
  });

  }

  await scene('10-form', async () => {
    await typeInto(page.locator('input.cr-title-in'), TITLE);
    await wait(400);
    await typeInto(page.locator('input#cr-cat'), 'Math');
    await page.keyboard.press('Escape').catch(() => {});
    await wait(400);
    await click(page.locator('.cr-types[aria-label="Module 1: activity type"] button.cr-type', { hasText: 'multiple choice' }).first(), 'tipo opción múltiple');
    await wait(500);
    const age = page.locator('.cr-gen input.cr-num[type=number]').first();
    await click(age, 'edad');
    await age.selectText();
    await page.keyboard.type('13', { delay: 90 });
    await wait(500);
    const sel = page.locator('.cr-gen select.cr-select').first();
    const [sx, sy] = await center(sel);
    await moveTo(sx, sy, 600);
    await page.evaluate(() => document.getElementById('vcursor')?.classList.add('down')); await wait(130);
    await page.evaluate(() => document.getElementById('vcursor')?.classList.remove('down'));
    await sel.selectOption('avanzado');
    await wait(900);
    report.form = await page.evaluate(() => ({
      title: document.querySelector('input.cr-title-in')?.value,
      cat: document.querySelector('input#cr-cat')?.value,
      type: document.querySelector('.cr-types[aria-label="Module 1: activity type"] .is-on')?.textContent,
      age: document.querySelector('.cr-gen input.cr-num[type=number]')?.value,
      level: document.querySelector('.cr-gen select.cr-select')?.value,
    }));
    log('form', JSON.stringify(report.form));
  });

  if (process.env.STOP === 'form') throw new Error('STOP=form');

  await scene('11-generar', async () => {
    await click(page.locator('button.cr-go').first(), 'Generar módulo');
    const tStart = rel();
    ev('generando');
    const winner = await Promise.race([
      page.waitForSelector('.cr-mod .cr-mc-q', { state: 'visible', timeout: 300000 }).then(() => 'ok'),
      page.waitForSelector('p.cr-err[role=alert]', { timeout: 300000 }).then(() => 'err'),
    ]);
    const tContent = rel();
    if (winner === 'err') {
      report.genError = await page.locator('p.cr-err[role=alert]').first().textContent();
      throw new Error('generación falló: ' + report.genError);
    }
    report.genSeconds = +(tContent - tStart).toFixed(1);
    report.firstQuestion = ((await page.locator('.cr-mod .cr-mc-q').first().textContent()) || '').replace(/\s+/g, ' ').trim();
    log('PRIMERA PREGUNTA', report.firstQuestion);
    addCut(tStart + 3.0, tContent - 0.8, 'generación');
    await page.locator('.cr-mod .cr-mc-q').first().scrollIntoViewIfNeeded();
    await moveTo(900 * Z, 560 * Z, 300);
    await wait(3000);
  });

  await scene('12-guardar', async () => {
    await click(page.locator('.cr-save button.cr-btn--lg').first(), 'Guardar ruta');
    await page.waitForSelector('p.cr-msg.is-ok', { timeout: 30000 });
    report.savedMsg = await page.locator('p.cr-msg.is-ok').first().textContent();
    // EN: verificar (solo lectura) que la ruta quedó en inglés en server/data/learn-routes.json.
    const LR = '/Users/esteban-andres-altamura-kit-digital/Desktop/plataforma-educativa/server/data/learn-routes.json';
    let row = null;
    for (let i = 0; i < 20 && !row; i++) {
      try { row = JSON.parse(fs.readFileSync(LR, 'utf8')).routes.filter((x) => x.route?.title === TITLE).pop() || null; } catch {}
      if (!row) await wait(250);
    }
    if (!row) throw new Error('ABORT-RUTA: no encuentro la ruta guardada en learn-routes.json');
    report.savedRoute = { id: row.id, lang: row.lang, postas: (row.route.postas || []).map((p) => p.title) };
    log('RUTA GUARDADA', JSON.stringify(report.savedRoute));
    if (row.lang !== 'en') throw new Error('ABORT-RUTA-ES: la ruta no quedó con lang=en (¿pegó al 5203?) ' + JSON.stringify(report.savedRoute));
    await wait(2000);
  });

  await scene('13-aprender', async () => {
    await click(nav('Learn'), 'nav Aprender');
    await msgOff();
    const card = page.locator(`button.ln-card:has-text("${TITLE}")`).first();
    await card.waitFor({ timeout: 20000 });
    report.cardsWithTitle = await page.locator(`button.ln-card:has-text("${TITLE}")`).count();
    await wait(900);
    await click(card, 'card del curso');
    await page.waitForSelector('#v-ruta');
    await wait(1500);
    report.route = await page.evaluate(async (title) => {
      const l = await (await fetch('/api/learn-routes', { headers: { 'X-Innerith-User': 'ian', 'X-Smarty-Lang': 'en' } })).json();
      return l.routes.filter((x) => x.title === title);
    }, TITLE);
  });

  await scene('14-hito-video', async () => {
    await click(page.locator('.ln-node').first().locator('button.ln-dot[aria-label="Watch video"]'), 'hito Ver video');
    await page.waitForSelector('.ln-ov.ln-vid');
    await noCaps('.ln-ov.ln-vid iframe', [500, 1500, 2500, 4000]);
    await wait(5500);
    await click(page.locator('.ln-vid-foot .ln-btn-go').first(), 'Empezar preguntas');
  });

  await scene('15-lobby', async () => {
    await page.waitForSelector('.ln-lobby');
    await wait(1000);
    await click(page.locator('.ln-lobby .ln-btn-go').first(), 'Empezar');
    await page.waitForSelector('.lrn-mc', { timeout: 15000 });
  });

  await scene('16-preguntas', async () => {
    const answered = [];
    for (let q = 0; q < 30; q++) {
      await page.waitForSelector('.lrn-mc');
      const count = (await page.locator('.lrn-count').first().textContent().catch(() => '')) || '';
      await wait(1200);
      const flips = page.locator('.lrn-mc-flip');
      const n = await flips.count();
      const correct = [];
      for (let i = 0; i < n; i++) if (await flips.nth(i).locator('.lrn-mc-back.lrn-v-missed').count()) correct.push(i);
      const hint = (await page.locator('.lrn-mc-modehint').first().textContent().catch(() => '')) || '';
      if (!correct.length && /more than one/i.test(hint)) {
        await click(page.locator('.lrn-mc-shortcuts').locator('button', { hasText: /^None$/ }).first(), 'Ninguna');
      } else {
        for (const i of correct) { await click(flips.nth(i), `opción ${i}`); await wait(250); }
      }
      await wait(400);
      await click(page.locator('button.lrn-cta').first(), 'Comprobar');
      await wait(1600);
      const green = await page.evaluate(() => ({
        hit: document.querySelectorAll('.lrn-mc-back.lrn-v-hit').length,
        bad: document.querySelectorAll('.lrn-mc-back.lrn-v-wrongpick, .lrn-mc-back.lrn-v-missed').length,
      }));
      const cta = page.locator('button.lrn-cta').first();
      const ctaTxt = (await cta.textContent()) || '';
      answered.push({ count: count.trim(), correct, hint: hint.trim(), green, cta: ctaTxt.trim() });
      log('pregunta', count.trim(), 'correctas', correct, JSON.stringify(green), ctaTxt.trim());
      await click(cta, ctaTxt.trim());
      if (/Finish/i.test(ctaTxt)) break;
      await wait(500);
      if (await page.locator('.ln-result').count()) break;
    }
    report.answered = answered;
  });

  await scene('17-resultado', async () => {
    await page.waitForSelector('.ln-result', { timeout: 20000 });
    report.result = (await page.locator('.ln-result').first().textContent()).replace(/\s+/g, ' ').slice(0, 200);
    await moveTo(1300 * Z, 820 * Z, 300);
    await wait(2500);
  });

  // Agregado 2 (Esteban): Cerrar → mapa de la ruta → TIENDA → canjear la hora extra → Tus canjes.
  await scene('18-tienda', async () => {
    if (await page.locator('.ln-result-acts .ln-btn-quiet').count()) await click(page.locator('.ln-result-acts .ln-btn-quiet').first(), 'Cerrar');
    await page.waitForSelector('.ln-result', { state: 'detached', timeout: 10000 }).catch(() => {});
    await wait(1000);
    await click(nav('Store'), 'nav Tienda');
    const card = page.locator('article.st-card', { has: page.locator('h4.st-name', { hasText: /^1 extra hour of gaming on Saturday$/ }) }).first();
    await card.waitFor({ timeout: 15000 });
    await msg(MSG.tienda);
    await card.scrollIntoViewIfNeeded();
    await wait(600);
    const [cx, cy] = await center(card.locator('h4.st-name'));
    await moveTo(cx, cy, 600);
    ev('card-hora-extra');
    await wait(900);
    await click(card.locator('button.st-btn', { hasText: 'Redeem' }), 'Canjear (card)');
    const sheet = page.locator('.st-sheet[role=dialog]');
    await sheet.locator('.st-sheet-q').waitFor();
    report.sheet = (await sheet.locator('.st-sheet-q').textContent()) + ' | ' + (await sheet.locator('.st-sheet-sub').textContent());
    ev('hoja-confirmacion');
    await wait(1200);
    await click(sheet.locator('.st-sheet-btns button.st-btn:not(.st-btn--ghost)', { hasText: 'Redeem' }), 'Canjear (hoja)');
    await sheet.locator('.st-done').waitFor({ timeout: 20000 });
    report.done = (await sheet.locator('.st-done').textContent()).replace(/\s+/g, ' ');
    ev('canjeado');
    await wait(1500);
    // La hoja de «Canjeado ✓» tapa la billetera: «Listo» la cierra y se ve el saldo nuevo.
    await click(sheet.locator('button.st-btn', { hasText: 'Done' }), 'Listo');
    await sheet.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    ev('saldo-nuevo');
    await wait(1500);
    await click(page.locator('a[href="/tienda?vista=canjes"]').first(), 'Tus canjes');
    await msgOff();
    await page.waitForSelector('.st-page h2:has-text("Your redemptions")', { timeout: 10000 });
    await msg(MSG.canjes);
    await wait(500);
    report.canjes = await page.evaluate(async () => {
      const r = await (await fetch('/api/market/redemptions', { headers: { 'X-Innerith-User': 'ian', 'X-Smarty-Lang': 'en' } })).json();
      return r.redemptions.map((x) => ({ id: x.id, title: x.title ?? x.item?.title, status: x.status }));
    });
    report.canjesText = (await page.locator('.st-page').first().textContent()).replace(/\s+/g, ' ').slice(0, 300);
    ev('tus-canjes');
    await moveTo(1250 * Z, 780 * Z, 400);
    await wait(4500); // v11: 2 s más mirando «Tus canjes» antes de la carátula
  });

  await scene('19-cierre', async () => {
    await msgOff();
    await page.evaluate(({ css, html }) => {
      document.getElementById('vcursor')?.remove();
      const st = document.createElement('style'); st.textContent = css;
      const el = document.createElement('div'); el.id = 'vcover'; el.innerHTML = html; el.style.opacity = '0';
      document.documentElement.append(st, el);
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));
    }, { css: COVER_CSS, html: COVER_HTML });
    await wait(2650);
  });
  report.ok = true;
} catch (e) {
  report.ok = false; report.error = String(e).split('\n')[0];
}

ev('fin');
report.cuts = cuts; report.events = events; report.end = rel();
await ctx.close();
const video = await page.video().path();
await browser.close();
report.video = video;
fs.writeFileSync(HERE + `cuts-${MODE}.json`, JSON.stringify(report, null, 2));
if (MODE === 'full' && report.ok) fs.writeFileSync(HERE + 'cuts.json', JSON.stringify(report, null, 2));
log('REPORT', JSON.stringify({ ok: report.ok, error: report.error, video, cuts }));
