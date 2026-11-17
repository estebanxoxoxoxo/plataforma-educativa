// Video de FLUJO DE USUARIO «Apollo 11» (pedido 14-nov): carátula → Feed: aceptar al amigo → chat con el amigo → Feed: lectura
// Apolo 11 → leer → guardarla en una carpeta NUEVA → chat IA: canal de YouTube → player: suscribirse + guardar en la carpeta →
// /crear → Aprender: primer hito completo → salir → carátula.
// UN solo guion para los dos idiomas: LANG=es|en (FLOW_LANG pisa a LANG, que en la shell suele ser «es_AR.UTF-8»).
// Molde técnico: flow-gcd-en.mjs (cursor falso, tipeo humano 45 ms, tira de sincronía, cortes ≥1,5 s, DSF, sin subtítulos).
// NO toca código de la app; sólo usa la UI y, para limpiar, la API de la app desde la página con los headers de Ian.
//
// Variables: LANG/FLOW_LANG=es|en · DSF (2 ensayos, 3 tomas) · MODE=full|rehearsal (sólo cambia el nombre del cuts-*.json)
//   START=<escena> STOP=<escena> (rango de escenas; ver SCENES) · VIDEO=<id> (START=player|form sin chat IA)
//   NORETRY=1 (sin cards de video al primer pedido → aborta) · BASE · CLEAN=all (limpia todo aunque el rango no lo cree)
//   CHAT_ES2=1 usa la frase alternativa del chat IA en castellano.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const RAW_LANG = process.env.FLOW_LANG || process.env.LANG || '';
if (!['es', 'en'].includes(RAW_LANG)) { console.error(`LANG tiene que ser exactamente «es» o «en» (vino «${RAW_LANG}»): usá LANG=es o FLOW_LANG=es`); process.exit(2); }
const LANG = RAW_LANG;
const BASE = process.env.BASE || 'http://localhost:5173';
const HERE = new URL('./', import.meta.url).pathname;
const DIR = HERE + 'rec/';
const MODE = process.env.MODE || 'full';
const REPO = '/Users/esteban-andres-altamura-kit-digital/Desktop/plataforma-educativa';

/* ---------------- textos y selectores por idioma ---------------- */
const T = {
  es: {
    navOk: ['Aprender', 'Tienda'],
    learn: 'Aprender', chat: 'Chat',
    accept: (nick) => `Aceptar a ${nick}`,
    closeChat: (nick) => `Cerrar la conversación con ${nick}`,
    friendMsgs: ['¡Hola! ¿Cómo andás?', '¿Qué estás aprendiendo esta semana?'],
    apolloCard: 'Apolo 11: el viaje a la Luna',
    root: 'Mis carpetas',
    folder: 'Apolo 11',
    aiAsk: process.env.CHAT_ES2 ? 'Recomendame un canal de YouTube que cuente cómo fue el viaje a la Luna del Apolo 11' : 'Recomendame un canal de YouTube sobre el viaje del Apolo 11 a la Luna',
    videoId: 'h-Z1bTGi5Qs', videoTitle: 'Así fue el viaje a la Luna del Apolo 11', channel: 'Date un Vlog',
    subscribed: /Suscripto/, saveBtn: /^\s*Guardar\s*$/,
    play: 'Reproducir', pause: 'Pausar',
    title: 'Apolo 11', category: 'Ciencias Naturales', typeLabel: 'opción múltiple',
    mod1Url: 'Módulo 1: URL del contenido', mod1Type: 'Módulo 1: tipo de actividad',
    watchVideo: 'Ver video', manyHint: /varias/i, none: /^Ninguna$/, finish: /Terminar/i,
    backToRoutes: 'Volver a rutas',
  },
  en: {
    navOk: ['Learn', 'Store'],
    learn: 'Learn', chat: 'Chat',
    accept: (nick) => `Accept ${nick}`,
    closeChat: (nick) => `Close the chat with ${nick}`,
    friendMsgs: ["Hi! How's it going?", 'What are you learning this week?'],
    apolloCard: 'Apollo 11: the journey to the Moon',
    root: 'My folders',
    folder: 'Apollo 11',
    aiAsk: 'Recommend a YouTube channel about Apollo 11',
    videoId: 'E7uGvsT_nnM', videoTitle: 'Why Apollo Astronauts Trained in Nuclear Bomb Craters', channel: 'Veritasium',
    subscribed: /Subscribed/, saveBtn: /^\s*Save\s*$/,
    play: 'Play', pause: 'Pause',
    title: 'Apollo 11', category: 'Natural Sciences', typeLabel: 'multiple choice',
    mod1Url: 'Module 1: content URL', mod1Type: 'Module 1: activity type',
    watchVideo: 'Watch video', manyHint: /more than one/i, none: /^None$/, finish: /Finish/i,
    backToRoutes: 'Back to routes',
  },
}[LANG];
const H = { 'X-Innerith-User': 'ian', 'X-Smarty-Lang': LANG };
const FOLDER_NAMES = ['Apolo 11', 'Apollo 11']; // nombres de carpeta de las tomas (los dos idiomas)

// Recuadro violeta (#vmsg), uno por pantalla (pedido del dueño, 14-nov: «como en el primer video»). Textos exactos; el CSS
// los pone en mayúsculas. NOMSG=1 graba sin recuadros (tabla vacía).
const MSG = process.env.NOMSG ? {} : {
  es: {
    feed: 'El feed combina contenido aprobado con las novedades de sus amigos',
    friendChat: 'Los mensajes entre amigos se moderan antes de llegar',
    why: 'Cada tarjeta explica por qué se la recomienda',
    articulo: 'Artículo 100% moderado, de una fuente de lista blanca',
    carpeta: 'Guarda lo que encuentra en sus propias carpetas',
    chat: 'Interacción filtrada por temas de lista blanca',
    player: 'No recibe publicidad ni recomendaciones de YouTube',
    suscripcion: 'Solo puede seguir canales del catálogo aprobado',
    ruta: 'El contenido que le interesa lo convierte en una ruta de aprendizaje',
    crear: 'Extrae los facts de la fuente y genera la ruta',
    aprender: 'Cada paso de la ruta suma Energy Coins',
    hito: 'Primero mira el video, después responde sobre lo que vio',
    preguntas: 'Las preguntas salen de los facts de la fuente',
  },
  en: {
    feed: 'The feed mixes approved content with news from friends',
    friendChat: 'Messages between friends are moderated before they arrive',
    why: 'Every card explains why it is recommended',
    articulo: '100% moderated article, from an allowlisted source',
    carpeta: 'Kids save what they find in their own folders',
    chat: 'Interaction filtered by allowlisted topics',
    player: 'No ads and no YouTube recommendations',
    suscripcion: 'Kids can only follow channels from the approved catalog',
    ruta: 'Content kids care about becomes a learning route',
    crear: 'Extracts the facts from the source and generates the route',
    aprender: 'Every step of the route earns Energy Coins',
    hito: 'First they watch the video, then they answer questions about it',
    preguntas: 'Questions come from the facts in the source',
  },
}[LANG];
// Cada recuadro queda al menos MSG_MIN ms (3 s enteros + el fundido de entrada de .35 s) antes de cambiarlo o apagarlo:
// msg()/msgOff() esperan lo que falte (alarga la escena lo justo).
const MSG_MIN = 3500;
let msgOnAt = 0;
async function msgHold() { if (msgOnAt) { const left = MSG_MIN - (Date.now() - msgOnAt); if (left > 0) await page.waitForTimeout(left); } }

// Escenas en orden; START/STOP eligen un tramo (ensayos baratos).
const SCENES = ['caratula-inicio', 'amigo', 'chat-amigo', 'apolo-feed', 'articulo', 'carpeta', 'chat-ia', 'player', 'form', 'generar',
  'guardar-ruta', 'aprender', 'hito-video', 'lobby', 'preguntas', 'resultado', 'salir', 'caratula-fin'];
const iStart = process.env.START ? SCENES.indexOf(process.env.START) : 0;
const iStop = process.env.STOP ? SCENES.indexOf(process.env.STOP) : SCENES.length - 1;
if (iStart < 0 || iStop < 0) { console.error('START/STOP desconocido; escenas: ' + SCENES.join(' ')); process.exit(2); }
const inRange = (name) => { const i = SCENES.indexOf(name); return i >= iStart && i <= iStop; };

const log = (...a) => console.log(`[flow ${((Date.now() - (globalThis.T0 || Date.now())) / 1000).toFixed(1)}s]`, ...a);
const Z = 1;
const DSF = +(process.env.DSF || 3);
const launchArgs = ['--window-size=1440,900', `--force-device-scale-factor=${DSF}`, '--autoplay-policy=no-user-gesture-required'];
if (LANG === 'en') launchArgs.unshift('--lang=en-US');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: launchArgs });
const ctx = await browser.newContext({ ...(LANG === 'en' ? { locale: 'en-US' } : {}), viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF, recordVideo: { dir: DIR, size: { width: Math.round(1440 * DSF), height: Math.round(900 * DSF) } } });
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

// SYNC: tira de 16 celdas 8×8 abajo a la izquierda con el tiempo del guion (unidades de 40 ms) en binario (cut.mjs la lee y la recorta).
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
// Idioma de la app (+ route-lab inglés en 5204). En ES: 'es' explícito (= el default de la app) y route-lab por defecto.
await page.addInitScript(({ lang }) => {
  try {
    localStorage.setItem('innerith.lang', lang);
    if (lang === 'en') localStorage.setItem('innerith.routeLabUrl', 'http://localhost:5204');
    else localStorage.removeItem('innerith.routeLabUrl');
  } catch {}
}, { lang: LANG });

// Cursor falso + CARÁTULA de arranque (en vez del velo negro del molde: la misma carátula del cierre, visible hasta el primer
// fundido). Sobrevive navegaciones vía sessionStorage.
await page.addInitScript(({ css, html }) => {
  if (location.href === 'about:blank') return;
  if (window.top !== window) return; // NO dentro de iframes
  const add = () => {
    try {
      if (!document.documentElement) throw 0;
      if (document.getElementById('vcursor')) return;
      const st = document.createElement('style');
      st.textContent = `#vcursor{position:fixed;z-index:999998;pointer-events:none;width:16px;height:16px;border-radius:50%;
        background:rgba(255,255,255,.95);border:3px solid rgba(20,24,40,.72);box-shadow:0 2px 8px rgba(0,0,0,.35);
        transform:translate(-50%,-50%) scale(1);transition:left .5s cubic-bezier(.4,0,.2,1),top .5s cubic-bezier(.4,0,.2,1),transform .14s ease}
        #vcursor.down{transform:translate(-50%,-50%) scale(.62)}` + css;
      const c = document.createElement('div');
      c.id = 'vcursor';
      let p = { x: 760, y: 470 };
      try { p = JSON.parse(sessionStorage.getItem('vcur') || 'null') || p; } catch {}
      c.style.left = p.x + 'px'; c.style.top = p.y + 'px';
      document.documentElement.append(st, c);
      let faded = false;
      try { faded = sessionStorage.getItem('vfaded') === '1'; } catch {}
      if (!faded) { const f = document.createElement('div'); f.id = 'vcover'; f.innerHTML = html; document.documentElement.append(f); }
    } catch { requestAnimationFrame(add); }
  };
  add();
}, { css: COVER_CSS, html: COVER_HTML });

// Frame 0: la carátula sobre negro (casi idéntica a la carátula sobre el Feed: el fondo es 90 % opaco).
await page.setContent('<style>html,body{margin:0;background:#070a12;height:100%}' + COVER_CSS + '</style><div id="vcover">' + COVER_HTML + '</div><script>' + SYNC_JS + '</script>');
await wait(300);

/* ---------------- recuadro de mensajes (#vmsg) ---------------- */
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
/** Muestra el recuadro con el texto de MSG[key] (si la tabla no lo tiene, no hace nada). Nunca cambia el texto en seco. */
async function msg(key) {
  const text = MSG[key];
  if (!text) return;
  await msgHold();
  await page.evaluate(async (text) => {
    const m = document.getElementById('vmsg');
    if (!m) return;
    if (m.classList.contains('on') && m.textContent === text) return;
    if (m.classList.contains('on')) { m.classList.remove('on'); m.dataset.off = String(Date.now()); }
    const left = 400 - (Date.now() - Number(m.dataset.off || 0));
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    m.textContent = text;
    void m.offsetWidth;
    m.classList.add('on');
  }, text);
  msgOnAt = Date.now();
  ev('msg:' + key);
}
async function msgOff() {
  if (!msgOnAt) return;
  await msgHold();
  await page.evaluate(() => { const m = document.getElementById('vmsg'); if (m && m.classList.contains('on')) { m.classList.remove('on'); m.dataset.off = String(Date.now()); } });
  msgOnAt = 0;
  ev('msgOff');
}

/* ---------------- helpers ---------------- */
async function moveTo(x, y, settle = 600) {
  await page.evaluate(([x, y]) => {
    const c = document.getElementById('vcursor');
    if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; }
    try { sessionStorage.setItem('vcur', JSON.stringify({ x, y })); } catch {}
  }, [x / Z, y / Z]);
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
/** Apaga los subtítulos automáticos de YouTube (IFrame API) en los iframes de `sel`: ahora y a los `later` ms. */
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
/** Scroll animado del contenedor `sel` hasta que el elemento marcado con data-vtarget quede con su centro a `at` del alto. */
async function animScrollToTarget(sel, at = 0.45, ms = 1600) {
  await page.evaluate(async ({ sel, at, ms }) => {
    const v = document.querySelector(sel);
    const el = document.querySelector('[data-vtarget]');
    if (!v || !el) return;
    const vr = v.getBoundingClientRect(), er = el.getBoundingClientRect();
    const from = v.scrollTop;
    const to = Math.max(0, Math.min(v.scrollHeight - v.clientHeight, from + (er.top + er.height / 2) - (vr.top + v.clientHeight * at)));
    const delta = to - from, start = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        v.scrollTop = from + delta * (t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
        t < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }, { sel, at, ms });
}

/* ---- chat IA ---- */
// lead 1,8 s (molde: 3 s): la respuesta del chat IA tarda ~5 s y con 3 s el corte quedaba <1,5 s (se veían 4-5 s de «Pensando…»).
async function chat(text, label, until, lead = 1.8) {
  const ta = page.locator('form.cx-comp textarea');
  await typeInto(ta, text);
  await wait(350);
  await page.keyboard.press('Enter');
  const tStart = rel();
  ev('enviado:' + label);
  const ok = await until();
  const tContent = rel();
  addCut(tStart + lead, tContent - 0.8, label);
  return ok;
}
async function untilCards(sel, timeout) {
  const before = await page.locator(sel).count();
  try {
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

/* ---- dock del amigo ---- */
const themSel = '.fthread .fm.them:not(.ftyping)';
async function themCount(win) { return win.locator(themSel).count(); }
/** Espera a que el amigo mande un mensaje más que `before` y a que deje de «escribir». Devuelve el texto nuevo. */
async function untilFriendReply(win, before, timeout) {
  await win.locator(themSel).nth(before).waitFor({ timeout });
  // si sigue escribiendo (dos burbujas seguidas), esperarlo un poco (máx. 12 s)
  await page.waitForFunction((id) => !document.querySelector(`section.fdk-win[data-friend="${id}"] .ftyping`), await win.getAttribute('data-friend'), { timeout: 12000, polling: 150 }).catch(() => {});
  const all = await win.locator(themSel).allTextContents();
  return all.slice(before).join(' / ');
}

/* ---- limpieza (sólo lo que el guion crea; títulos/nombres EXACTOS) ---- */
async function cleanup(what) {
  const r = await page.evaluate(async ({ H, what, title, names, videoId }) => {
    const out = {};
    const J = { ...H, 'Content-Type': 'application/json' };
    if (what.route) {
      const list = await (await fetch('/api/learn-routes', { headers: H })).json();
      const del = list.routes.filter((x) => x.title === title);
      for (const x of del) await fetch('/api/learn-routes/delete', { method: 'POST', headers: J, body: JSON.stringify({ id: x.id }) });
      out.routesDeleted = del.map((x) => x.id);
    }
    if (what.folder) {
      const t = await (await fetch('/api/space/folders', { headers: H })).json();
      // 14-nov: las carpetas RAÍZ de los DOS idiomas (una toma no puede mostrar la carpeta que dejó la toma del otro idioma)
      const del = t.folders.filter((f) => (f.parentId || 0) === 0 && names.includes(f.name));
      out.foldersPurged = [];
      for (const f of del) {
        await fetch('/api/space/drive/folder/trash', { method: 'POST', headers: J, body: JSON.stringify({ id: f.id }) });
        const p = await (await fetch('/api/space/drive/purge', { method: 'POST', headers: J, body: JSON.stringify({ kind: 'folder', id: f.id }) })).json();
        out.foldersPurged.push({ id: f.id, ok: p.ok });
      }
    }
    if (what.follow) {
      const v = await (await fetch('/api/video?id=' + encodeURIComponent(videoId), { headers: H })).json();
      out.channel = { id: v.channelId, name: v.channel, followedBefore: v.followed };
      if (v.followed && v.channelId) {
        const f = await (await fetch('/api/space/follow', { method: 'POST', headers: J, body: JSON.stringify({ channelId: v.channelId, value: false }) })).json();
        out.channel.followedAfter = f.followed;
      }
    }
    return out;
  }, { H, what, title: T.title, names: FOLDER_NAMES, videoId: process.env.VIDEO || T.videoId });
  log('LIMPIEZA', JSON.stringify(r));
  return r;
}

/* ---------------- escenas ---------------- */
const report = { mode: MODE, lang: LANG, start: SCENES[iStart], stop: SCENES[iStop] };
async function scene(name, fn) {
  if (!inRange(name)) return;
  ev('escena:' + name);
  try { await fn(); log('OK', name); }
  catch (e) {
    log('FALLÓ', name, String(e).split('\n')[0]);
    await page.screenshot({ path: HERE + `fail-${LANG}-${name}.png` }).catch(() => {});
    throw e;
  }
  if (SCENES.indexOf(name) === iStop && iStop < SCENES.length - 1) throw new Error('STOP=' + name);
}
let friend = null; // { id, nick }
const winOf = () => page.locator(`section.fdk-win[data-friend="${friend.id}"]`);

try {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForSelector('.nav-item', { timeout: 20000 });
  report.navLabels = (await page.locator('.nav-item').allTextContents()).map((s) => s.trim());
  for (const n of T.navOk) if (!(await nav(n).count())) throw new Error(`ABORT-IDIOMA: la app no está en ${LANG}: ` + JSON.stringify(report.navLabels));
  const clean = process.env.CLEAN === 'all'
    ? { route: true, folder: true, follow: true }
    : { route: inRange('guardar-ruta'), folder: inRange('carpeta'), follow: inRange('player') };
  report.cleanup = await cleanup(clean);
  // 14-nov (toma 3 inglesa): el Feed ya pintado conservaba el destacado «Review Apollo 11» de la ruta de la toma anterior
  // (borrada por la limpieza DESPUÉS de cargar). Recargar para que Feed y destacados se pinten ya limpios (la recarga vuelve
  // a disparar el reset de demo). Todo esto pasa detrás de la carátula y queda fuera del recorte.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.nav-item', { timeout: 20000 });
  const needFeed = inRange('caratula-inicio') || inRange('amigo') || inRange('apolo-feed');
  if (needFeed) await page.waitForSelector('.hf-thread .hf-slot', { timeout: 20000 });
  if (needFeed) {
    // Los destacados (section.fpin) no pueden nombrar la ruta de la toma (la tarjeta de LECTURA del hilo sí, y está bien).
    await page.waitForSelector('section.fpin', { timeout: 20000 }).catch(() => {});
    await wait(800);
    report.pinnedText = ((await page.locator('section.fpin').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    log('DESTACADOS', report.pinnedText);
    // sólo cuando la toma borra la ruta (toma completa o CLEAN=all); un ensayo parcial deja la ruta y el destacado a propósito
    if (clean.route && report.pinnedText.includes(T.title)) throw new Error('ABORT-DESTACADO: los destacados nombran la ruta de la toma: ' + report.pinnedText);
  }
  if (inRange('amigo')) {
    // La carga de página dispara /api/demo/reset (amigos de Ian incluidos): la solicitud tiene que estar.
    const ok = await page.waitForSelector('button.fpin-ok', { state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
    if (!ok) throw new Error('ABORT-SOLICITUD: no hay solicitud de amistad en Destacados');
    const card = page.locator('.fpin-card[data-kind="contact"]').first();
    const nick = ((await card.locator('.fpin-line b').first().textContent()) || '').trim();
    friend = { nick };
    report.friendRequest = { nick, note: ((await card.locator('.fpin-note').first().textContent().catch(() => '')) || '').trim() };
    log('SOLICITUD', JSON.stringify(report.friendRequest));
  }
  if (inRange('apolo-feed')) {
    const has = await page.locator('.hf-thread .hf-slot', { hasText: T.apolloCard }).count();
    report.apolloSlot = await page.evaluate((t) => [...document.querySelectorAll('.hf-thread .hf-slot')].findIndex((s) => s.textContent.includes(t)), T.apolloCard);
    if (!has) throw new Error('ABORT-FEED: la tarjeta de Apollo 11 no está en el feed');
  }
  if (inRange('player') && !inRange('chat-ia') && !process.env.VIDEO) throw new Error('START=player necesita VIDEO=<id>');
  if (inRange('player') && !inRange('carpeta')) {
    const has = await page.evaluate(async ({ H, folder }) => (await (await fetch('/api/space/folders', { headers: H })).json()).folders.some((f) => (f.parentId || 0) === 0 && f.name === folder), { H, folder: T.folder });
    if (!has) throw new Error(`la carpeta «${T.folder}» no existe: corré antes el tramo de la carpeta`);
  }
  if (clean.folder) {
    // Chequeo con aborto: entre las carpetas raíz de Ian no puede quedar ninguna de las tomas (ni la del otro idioma).
    const left = await page.evaluate(async ({ H, names }) => (await (await fetch('/api/space/folders', { headers: H })).json()).folders
      .filter((f) => (f.parentId || 0) === 0 && names.includes(f.name)).map((f) => `${f.id}:${f.name}`), { H, names: FOLDER_NAMES });
    report.rootFoldersLeft = left;
    if (left.length) throw new Error('ABORT-CARPETAS: quedaron carpetas raíz de las tomas: ' + left.join(', '));
  }
  await wait(400);
  // Todo lo de arriba pasó detrás de la carátula: se corta (el crudo arranca antes que el reloj).
  cuts.push({ from: 0.35, to: +(rel() - 0.05).toFixed(2), label: 'arranque (carga detrás de la carátula)' });

  await scene('caratula-inicio', async () => {
    await moveTo(760, 470, 0);
    await wait(2200);
    await page.evaluate(() => {
      try { sessionStorage.setItem('vfaded', '1'); } catch {}
      const f = document.getElementById('vcover'); if (f) { f.style.transition = 'opacity .6s ease'; f.style.opacity = '0'; setTimeout(() => f.remove(), 700); }
    });
    await wait(650);
    await msg('feed');
    await wait(450);
  });
  // fuera del rango: sacar la carátula sin fundido
  if (!inRange('caratula-inicio')) await page.evaluate(() => { try { sessionStorage.setItem('vfaded', '1'); } catch {} document.getElementById('vcover')?.remove(); });

  await scene('amigo', async () => {
    const label = await page.locator('button.fpin-ok').first().getAttribute('aria-label');
    if (label !== T.accept(friend.nick)) throw new Error('aria-label inesperado en Aceptar: ' + label);
    const [x, y] = await center(page.locator('button.fpin-ok').first());
    await moveTo(x, y, 700);
    await wait(500);
    await msgHold(); // «feed» entero ≥3 s antes del click
    await click(page.locator('button.fpin-ok').first(), 'Aceptar');
    const tAccept = rel();
    ev('aceptado');
    // el dock abre SOLO la conversación con el amigo nuevo
    const win = page.locator('section.fdk-win[data-friend]:not([hidden])').last();
    await win.waitFor({ timeout: 20000 });
    await msg('friendChat');
    friend.id = await win.getAttribute('data-friend');
    const wn = (await win.locator('.fdk-nm b').first().textContent() || '').trim();
    report.friend = { id: friend.id, nick: friend.nick, dockNick: wn };
    log('DOCK', JSON.stringify(report.friend));
    // saludo del amigo (con «escribiendo…»): se corta la espera dejando ~3 s
    let ok = true;
    const greet = await untilFriendReply(winOf(), 0, 60000).catch(() => { ok = false; return ''; });
    if (!ok) throw new Error('ABORT-AMIGO: el amigo no saludó en 60 s');
    const tGreet = rel();
    report.greeting = greet;
    log('SALUDO', greet);
    addCut(tAccept + 2.4, tGreet - 0.8, 'saludo del amigo');
    await wait(1800);
  });

  await scene('chat-amigo', async () => {
    const win = winOf();
    report.friendChat = [];
    for (const [i, text] of T.friendMsgs.entries()) {
      const before = await themCount(win);
      await typeInto(win.locator('form.fin input'), text);
      await wait(350);
      await click(win.locator('form.fin button.send'), 'enviar');
      const tSend = rel();
      ev('amigo-enviado-' + (i + 1));
      let ok = true;
      const reply = await untilFriendReply(win, before, 90000).catch(() => { ok = false; return ''; });
      if (!ok) throw new Error('ABORT-AMIGO: sin respuesta en 90 s al mensaje ' + (i + 1));
      const tReply = rel();
      report.friendChat.push({ me: text, them: reply, secs: +(tReply - tSend).toFixed(1) });
      log('RESPUESTA', reply);
      addCut(tSend + 3.0, tReply - 0.8, 'respuesta del amigo ' + (i + 1));
      await wait(i === T.friendMsgs.length - 1 ? 2400 : 1600);
    }
    report.threadText = (await win.locator('.fthread').textContent() || '').replace(/\s+/g, ' ').slice(0, 800);
    await click(win.locator(`button[aria-label="${T.closeChat(friend.nick)}"]`), 'cerrar conversación');
    await msgOff();
    await wait(900);
  });

  await scene('apolo-feed', async () => {
    const slot = page.locator('.hf-thread .hf-slot', { hasText: T.apolloCard }).first();
    await slot.evaluate((el) => el.setAttribute('data-vtarget', '1'));
    await moveTo(640, 520, 300);
    await msg('why');
    await animScrollToTarget('#v-feed', 0.5, 1800);
    await slot.evaluate((el) => el.removeAttribute('data-vtarget'));
    await wait(500);
    const titleLoc = slot.locator('.hf-title, h3, h4').first();
    const target = (await titleLoc.count()) ? titleLoc : slot;
    const b = await target.boundingBox();
    await moveTo(Math.round(b.x + Math.min(b.width / 2, 160)), Math.round(b.y + b.height / 2), 600);
    await wait(1000);
    await msgHold();
    await click(slot.locator('button.hf-cta').first(), 'Leer Apolo 11');
    await msgOff();
  });

  await scene('articulo', async () => {
    await page.waitForURL(/\/buscar\/articulo\//);
    await wait(600);
    await page.waitForFunction(() => !document.querySelector('.modov.show') || document.querySelector('.modov.show.block'), null, { timeout: 60000 });
    if (await page.locator('.modov.show.block').count()) throw new Error('ABORT-ARTICULO: bloqueado por moderación');
    await page.waitForFunction(() => (document.querySelector('.aview .ascroll')?.textContent || '').trim().length > 200, null, { timeout: 30000 });
    const art = await page.evaluate(() => ({ text: (document.querySelector('.aview .ascroll')?.textContent || '').replace(/\s+/g, ' ').trim(), h: document.querySelector('.aview h1, .aview h2')?.textContent || document.title }));
    const words = art.text.toLowerCase().split(/[^a-záéíóúñü]+/);
    const en = words.filter((w) => ['the', 'and', 'of', 'is', 'to', 'that', 'with', 'are'].includes(w)).length;
    const es = words.filter((w) => ['el', 'la', 'los', 'las', 'que', 'es', 'del', 'con', 'una'].includes(w)).length;
    report.article = { title: art.h, url: page.url(), chars: art.text.length, enWords: en, esWords: es };
    log('ARTÍCULO', JSON.stringify(report.article));
    const okLang = LANG === 'en' ? en > es : es > en;
    if (art.text.length < 1500 || !okLang) throw new Error('ABORT-ARTICULO: corto o en otro idioma ' + JSON.stringify(report.article));
    await msg('articulo');
    await wait(1400);
    await moveTo(760 * Z, 520 * Z, 400);
    for (let i = 0; i < 3; i++) { await animScroll('.aview .ascroll', 0.55, 1100); await wait(i === 2 ? 1800 : 1600); }
  });

  await scene('carpeta', async () => {
    await page.evaluate(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('innerith.lastFolder')) localStorage.removeItem(k); } catch {} });
    await msgHold();
    await click(page.locator('button.asave'), 'Guardar (artículo)');
    await msg('carpeta');
    const card = page.locator('.shov.show .shcard');
    await card.waitFor();
    await wait(700);
    const on = ((await card.locator('.shcrumb .crumb.on').textContent()) || '').trim();
    if (on !== T.root) throw new Error('la hoja no arrancó en la raíz: ' + on);
    await click(card.locator('.shadd'), '+ Carpeta nueva');
    const inp = card.locator('.shnew input');
    await inp.waitFor();
    await wait(300);
    await typeInto(inp, T.folder);
    await wait(400);
    await click(card.locator('.shnew .sbtn:not(.ghost)'), 'Crear');
    await page.waitForFunction((n) => (document.querySelector('.shov.show .shcrumb .crumb.on')?.textContent || '').trim() === n, T.folder, { timeout: 10000 });
    await wait(900);
    const cta = card.locator('.shbtns.end .sbtn:not(.ghost)');
    report.folderCta = ((await cta.textContent()) || '').trim();
    await click(cta, 'Guardar acá');
    await page.locator('.shdone').waitFor({ timeout: 10000 });
    report.articleSaved = ((await page.locator('.shdone').textContent()) || '').trim();
    log('GUARDADO', report.articleSaved);
    await page.locator('.shov.show').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await msgOff();
    await wait(1100);
  });

  await scene('chat-ia', async () => {
    await click(nav(T.chat), 'nav Chat');
    await page.waitForSelector('section#v-chat form.cx-comp textarea');
    await msg('chat');
    await wait(800);
    const sel = 'section.mg.mg--videos button.mg-vid';
    const ok = await chat(T.aiAsk, 'chat-ia', () => untilCards(sel, 90000));
    if (!ok) throw new Error('ABORT-VIDEO: el chat no trajo cards de video');
    const cards = page.locator('section.mg.mg--videos').last().locator('button.mg-vid');
    const titles = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('title') || ''));
    report.aiText = ((await page.locator('.cx-ai').last().locator('.cx-md').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 400);
    report.videoCards = titles;
    log('CARDS', JSON.stringify(titles));
    const pick = titles.findIndex((t) => t.includes(T.videoTitle));
    if (pick < 0) throw new Error('ABORT-VIDEO: la tarjeta objetivo no está: ' + JSON.stringify(titles));
    report.videoPick = pick;
    await page.locator('section.mg.mg--videos').last().scrollIntoViewIfNeeded();
    await wait(2000);
    await click(cards.nth(pick), 'video objetivo');
    await msgOff();
  });

  await scene('player', async () => {
    if (!inRange('chat-ia')) await page.goto(BASE + '/buscar/video/' + (process.env.VIDEO || T.videoId));
    else await page.waitForURL(/\/buscar\/video\//);
    report.videoUrl = page.url();
    const vid = process.env.VIDEO || T.videoId;
    if (!page.url().includes('/buscar/video/' + vid)) throw new Error('ABORT-VIDEO: no es el video objetivo: ' + page.url());
    await page.waitForSelector('.player iframe', { state: 'visible' });
    await noCaps('.player iframe', [500, 1500]);
    await msg('player');
    await wait(1200);
    const cover = page.locator('.pcover');
    const playBtn = page.locator(`.prow button[aria-label="${T.play}"]`);
    if (await cover.isVisible().catch(() => false)) { await click(cover.first(), 'play (.pcover)'); report.play = 'pcover'; }
    else if (await playBtn.count() && !(await page.locator(`.prow button[aria-label="${T.pause}"]`).count())) { await click(playBtn.first(), 'play (.prow)'); report.play = 'prow'; }
    else { const [x, y] = await center(page.locator('.player').first()); await moveTo(x, y + 40 * Z, 600); report.play = 'autoplay (sin click)'; }
    const tWait = rel();
    const started = await page.waitForFunction(() => { const t = document.querySelector('.prow span')?.textContent || ''; return /^0:0[1-9]|^0:[1-5]\d|^[1-9]/.test(t.trim()); }, null, { timeout: 25000, polling: 200 }).then(() => true).catch(() => false);
    report.playerStarted = started; report.playerWaitS = +(rel() - tWait).toFixed(1);
    log('player arrancó:', started, report.playerWaitS, 's');
    // 14-nov (toma 2 inglesa): si YouTube no arranca en 25 s, la toma no sirve (antes seguía con el video congelado en 0:00).
    if (!started) throw new Error('ABORT-PLAYER: el reproductor no arrancó en 25 s');
    await noCaps('.player iframe', [1000, 2500]);
    addCut(tWait + 1.0, rel() - 0.3, 'arranque del player');
    await wait(5000);
    report.videoInfo = await page.evaluate(() => ({ title: document.querySelector('.yt-title, h1')?.textContent?.trim(), channel: document.querySelector('.yt-ch b, .yt-chname, .yt-channel')?.textContent?.trim() }));
    // Suscribirse
    const sub = page.locator('button.yt-sub').first();
    await msgHold();
    await click(sub, 'Suscribirse');
    await msg('suscripcion');
    await page.waitForFunction((re) => new RegExp(re).test(document.querySelector('button.yt-sub')?.textContent || ''), T.subscribed.source, { timeout: 10000 });
    report.subscribed = ((await sub.textContent()) || '').trim();
    await wait(1100);
    // Guardar en la carpeta (la hoja arranca en la raíz: se borra la «última carpeta» que dejó el guardado del artículo)
    await page.evaluate(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('innerith.lastFolder')) localStorage.removeItem(k); } catch {} });
    await click(page.locator('button.yt-btn').filter({ hasText: T.saveBtn }).first(), 'Guardar (video)');
    const card = page.locator('.shov.show .shcard');
    await card.waitFor();
    await wait(800);
    await click(card.locator('.shfolder').filter({ has: page.locator('b', { hasText: new RegExp('^' + T.folder + '$') }) }).first(), 'carpeta ' + T.folder);
    await page.waitForFunction((n) => (document.querySelector('.shov.show .shcrumb .crumb.on')?.textContent || '').trim() === n, T.folder, { timeout: 10000 });
    await wait(800);
    await click(card.locator('.shbtns.end .sbtn:not(.ghost)'), 'Guardar acá');
    await page.locator('.shdone').waitFor({ timeout: 10000 });
    report.videoSaved = ((await page.locator('.shdone').textContent()) || '').trim();
    log('GUARDADO', report.videoSaved);
    await wait(1500);
    // + Crear ruta: el cursor se posa 2 s y click
    const btn = page.locator('.phead .pcreate').first();
    const [hx, hy] = await center(btn);
    await moveTo(hx, hy, 600);
    await msg('ruta');
    await wait(2000);
    await msgHold(); // «ruta» entero ≥3 s con el cursor quieto sobre el botón
    await click(btn, '+ Crear ruta');
  });

  await scene('form', async () => {
    if (!inRange('player')) await page.goto(BASE + '/crear?video=' + (process.env.VIDEO || T.videoId));
    await page.waitForURL(/\/crear/);
    const url = page.locator(`input[aria-label="${T.mod1Url}"]`);
    await url.waitFor();
    report.prefilled = await url.inputValue();
    await msg('crear');
    await wait(900);
    await typeInto(page.locator('input.cr-title-in'), T.title);
    await wait(400);
    await typeInto(page.locator('input#cr-cat'), T.category);
    await page.keyboard.press('Escape').catch(() => {});
    await wait(400);
    await click(page.locator(`.cr-types[aria-label="${T.mod1Type}"] button.cr-type`, { hasText: T.typeLabel }).first(), 'tipo opción múltiple');
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
    report.form = await page.evaluate((lbl) => ({
      title: document.querySelector('input.cr-title-in')?.value,
      cat: document.querySelector('input#cr-cat')?.value,
      type: document.querySelector(`.cr-types[aria-label="${lbl}"] .is-on`)?.textContent,
      age: document.querySelector('.cr-gen input.cr-num[type=number]')?.value,
      level: document.querySelector('.cr-gen select.cr-select')?.value,
    }), T.mod1Type);
    log('form', JSON.stringify(report.form));
  });

  await scene('generar', async () => {
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

  await scene('guardar-ruta', async () => {
    await click(page.locator('.cr-save button.cr-btn--lg').first(), 'Guardar ruta');
    await page.waitForSelector('p.cr-msg.is-ok', { timeout: 30000 });
    report.savedMsg = await page.locator('p.cr-msg.is-ok').first().textContent();
    const LR = REPO + '/server/data/learn-routes.json';
    let row = null;
    for (let i = 0; i < 20 && !row; i++) {
      try { row = JSON.parse(fs.readFileSync(LR, 'utf8')).routes.filter((x) => x.route?.title === T.title && (LANG === 'en' ? x.lang === 'en' : x.lang !== 'en')).pop() || null; } catch {}
      if (!row) await wait(250);
    }
    if (!row) throw new Error('ABORT-RUTA: no encuentro la ruta guardada en learn-routes.json');
    const body = JSON.stringify(row.route).toLowerCase().split(/[^a-záéíóúñü]+/);
    const en = body.filter((w) => ['the', 'and', 'of', 'is', 'to', 'that', 'with', 'are', 'what', 'which'].includes(w)).length;
    const es = body.filter((w) => ['el', 'la', 'los', 'las', 'que', 'es', 'del', 'con', 'una', 'qué', 'cuál'].includes(w)).length;
    report.savedRoute = { id: row.id, lang: row.lang ?? null, postas: (row.route.postas || []).map((p) => p.title), enWords: en, esWords: es };
    log('RUTA GUARDADA', JSON.stringify(report.savedRoute));
    if (LANG === 'en' && (row.lang !== 'en' || en <= es)) throw new Error('ABORT-RUTA-IDIOMA: ' + JSON.stringify(report.savedRoute));
    if (LANG === 'es' && (row.lang || es <= en)) throw new Error('ABORT-RUTA-IDIOMA: ' + JSON.stringify(report.savedRoute));
    await wait(2000);
  });

  await scene('aprender', async () => {
    await click(nav(T.learn), 'nav Aprender');
    await msgOff();
    const card = page.locator('button.ln-card').filter({ hasText: T.title }).first();
    await card.waitFor({ timeout: 20000 });
    await msg('aprender');
    report.cardsWithTitle = await page.locator('button.ln-card').filter({ hasText: T.title }).count();
    await wait(900);
    await msgHold(); // «aprender» entero ≥3 s en la lista
    await click(card, 'card de la ruta');
    await page.waitForSelector('#v-ruta');
    await wait(1500);
  });

  await scene('hito-video', async () => {
    // Arranque del video del hito: el iframe (enablejsapi=1; la app ya se suscribe) manda infoDelivery con currentTime por
    // postMessage. Lo escucho desde la página; si no avanza en 25 s, ABORTA (no se graba un video congelado).
    await page.evaluate(() => {
      window.__vYt = { t: 0 };
      if (window.__vYtOn) return;
      window.__vYtOn = true;
      addEventListener('message', (e) => {
        try {
          const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          const i = d && d.info;
          if (i && typeof i.currentTime === 'number') window.__vYt.t = Math.max(window.__vYt.t, i.currentTime);
        } catch {}
      });
    });
    await click(page.locator('.ln-node').first().locator(`button.ln-dot[aria-label="${T.watchVideo}"]`), 'hito Ver video');
    await page.waitForSelector('.ln-ov.ln-vid');
    await noCaps('.ln-ov.ln-vid iframe', [500, 1500, 2500, 4000]);
    await msg('hito');
    const tWait = rel();
    // Gana lo primero: el infoDelivery del iframe o el <video> de adentro del iframe de YouTube avanzando (Playwright entra
    // a iframes de otro origen). En el ensayo castellano el video corría pero no llegó ningún infoDelivery.
    let started = false;
    for (const t0 = Date.now(); Date.now() - t0 < 25000 && !started;) {
      if (await page.evaluate(() => window.__vYt.t > 0.3).catch(() => false)) { started = true; break; }
      for (const f of page.frames()) {
        if (!/youtube/.test(f.url())) continue;
        const ct = await f.evaluate(() => document.querySelector('video')?.currentTime || 0).catch(() => 0);
        if (ct > 0.3) { started = true; break; }
      }
      if (!started) await wait(250);
    }
    report.hitoVideoStarted = started; report.hitoVideoWaitS = +(rel() - tWait).toFixed(1);
    log('video del hito arrancó:', started, report.hitoVideoWaitS, 's');
    if (!started) throw new Error('ABORT-PLAYER: el video del hito no arrancó en 25 s');
    await noCaps('.ln-ov.ln-vid iframe', [1000, 2500]);
    addCut(tWait + 1.0, rel() - 0.3, 'arranque del video del hito');
    await wait(5000);
    await click(page.locator('.ln-vid-foot .ln-btn-go').first(), 'Empezar preguntas');
  });

  await scene('lobby', async () => {
    await page.waitForSelector('.ln-lobby');
    await wait(1000);
    await click(page.locator('.ln-lobby .ln-btn-go').first(), 'Empezar');
    await page.waitForSelector('.lrn-mc', { timeout: 15000 });
  });

  await scene('preguntas', async () => {
    const answered = [];
    for (let q = 0; q < 30; q++) {
      await page.waitForSelector('.lrn-mc');
      if (q === 0) await msg('preguntas'); else if (q === 1) await msgOff();
      const count = (await page.locator('.lrn-count').first().textContent().catch(() => '')) || '';
      await wait(1200);
      const flips = page.locator('.lrn-mc-flip');
      const n = await flips.count();
      const correct = [];
      for (let i = 0; i < n; i++) if (await flips.nth(i).locator('.lrn-mc-back.lrn-v-missed').count()) correct.push(i);
      const hint = (await page.locator('.lrn-mc-modehint').first().textContent().catch(() => '')) || '';
      if (!correct.length && T.manyHint.test(hint)) {
        await click(page.locator('.lrn-mc-shortcuts').locator('button', { hasText: T.none }).first(), 'Ninguna');
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
      const prompt = ((await page.locator('.lrn-mc-prompt').first().textContent().catch(() => '')) || '').trim();
      answered.push({ count: count.trim(), prompt, correct, hint: hint.trim(), green, cta: ctaTxt.trim() });
      log('pregunta', count.trim(), 'correctas', correct, JSON.stringify(green), ctaTxt.trim());
      await click(cta, ctaTxt.trim());
      if (T.finish.test(ctaTxt)) break;
      await wait(500);
      if (await page.locator('.ln-result').count()) break;
    }
    report.answered = answered;
    if (answered.some((a) => a.green.bad)) log('OJO: alguna respuesta no quedó toda verde');
  });

  await scene('resultado', async () => {
    await page.waitForSelector('.ln-result', { timeout: 20000 });
    report.result = (await page.locator('.ln-result').first().textContent()).replace(/\s+/g, ' ').slice(0, 200);
    await moveTo(1300 * Z, 820 * Z, 300);
    await wait(2500);
  });

  await scene('salir', async () => {
    await click(page.locator('.ln-result-acts .ln-btn-quiet').first(), 'Cerrar resultado');
    await page.waitForSelector('.ln-result', { state: 'detached', timeout: 10000 }).catch(() => {});
    await page.waitForSelector('#v-ruta');
    await wait(1500);
    await click(page.locator(`#v-ruta button.ln-back[aria-label="${T.backToRoutes}"]`).first(), 'Volver a rutas');
    await page.locator('button.ln-card').first().waitFor({ timeout: 10000 });
    await moveTo(1250 * Z, 780 * Z, 400);
    await wait(1500);
  });

  await scene('caratula-fin', async () => {
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
const tag = `${LANG}-${MODE}-${SCENES[iStart]}-${SCENES[iStop]}`;
fs.writeFileSync(HERE + `cuts-${tag}.json`, JSON.stringify(report, null, 2));
if (MODE === 'full' && report.ok && iStart === 0 && iStop === SCENES.length - 1) fs.writeFileSync(HERE + `cuts-${LANG}.json`, JSON.stringify(report, null, 2));
log('REPORT', JSON.stringify({ ok: report.ok, error: report.error, video, cuts }));
