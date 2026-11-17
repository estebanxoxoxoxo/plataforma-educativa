// Post-proceso: aplica los cortes de un cuts*.json al webm crudo → webm final (VP8).
// El ffmpeg de Playwright es mínimo (sin concat/select/setpts, sin png/raw decodificable): cada segmento se
// re-encodea a su propio webm VP8 (-ss/-to, 25 fps) y después se UNEN a nivel Matroska acá (clusters con el
// Timecode desplazado), y un remux final -c copy deja duración/cues correctas.
// Uso: FF=<ffmpeg> node cut.mjs <cuts.json> <salida.webm>
import { spawnSync } from 'child_process';
import fs from 'fs';
import zlib from 'zlib';
const FF = process.env.FF;
const [, , cutsFile, out] = process.argv;
const rep = JSON.parse(fs.readFileSync(cutsFile, 'utf8'));
const src = rep.video;
const cuts = [...rep.cuts].sort((a, b) => a.from - b.from);
const tmp = out + '.parts/';
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp + 'sync', { recursive: true });

// Resolución del crudo: 1440×900 (K=1) o HiDPI 2880×1800 (K=2). La tira mide 8 px CSS → 8·K px de video.
const probe = spawnSync(FF, ['-hide_banner', '-i', src], { encoding: 'utf8' }).stderr;
const [, W0, H0] = probe.match(/, (\d{3,5})x(\d{3,5})/);
const W = +W0, H = +H0, K = W / 1440; // puede ser 2, 2.5, 3…
console.log(`crudo ${W}×${H} (K=${K})`);
/* ---- SYNC: leer la tira binaria (128×8 abajo a la izquierda) de cada cuadro → tiempo del guion ---- */
{
  const r = spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-i', src, '-r', '25', '-vf', `crop=${Math.round(128 * K)}:${Math.round(8 * K)}:0:${H - Math.round(8 * K)}`, '-f', 'image2', tmp + 'sync/%06d.png'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg sync');
}
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px, stride };
}
const syncFiles = fs.readdirSync(tmp + 'sync').filter((f) => f.endsWith('.png')).sort();
const vals = [];
let prev = 0; // arranca en 0: un primer cuadro basura (p.ej. todo blanco = 65535) no puede envenenar la lectura
for (const f of syncFiles) {
  const { px, stride, bpp } = decodePng(fs.readFileSync(tmp + 'sync/' + f));
  let v = 0;
  for (let i = 0; i < 16; i++) { const o = Math.round(4 * K - 1) * stride + Math.round((i * 8 + 4) * K) * bpp; const lum = (px[o] + px[o + 1] + px[o + 2]) / 3; v = v * 2 + (lum > 128 ? 1 : 0); }
  if (v < prev || v > prev + 150) v = prev; // glitch de compresión: me quedo con el anterior
  vals.push(v); prev = v;
}
const nFrames = vals.length;
{ // fluidez: cuántos cuadros repiten valor (congelados) y cuántos saltan >1 (cuadros perdidos), en la parte con reloj
  const h = {}; let frozen = 0, jumps = 0, n = 0;
  for (let i = 1; i < vals.length; i++) { if (!vals[i - 1]) continue; const d = vals[i] - vals[i - 1]; n++; h[d] = (h[d] || 0) + 1; if (d === 0) frozen++; if (d > 2) jumps++; }
  console.log(`fluidez: ${n} pares · Δ histograma ${JSON.stringify(h)} · congelados ${(100 * frozen / n).toFixed(1)}% · saltos>2 ${(100 * jumps / n).toFixed(1)}%`);
  if (process.env.SYNC_ONLY) process.exit(0);
}
const toVideo = (scriptSec) => { const u = scriptSec / 0.04; const i = vals.findIndex((v) => v >= u); return (i < 0 ? nFrames : i) / 25; };
console.log(`sync: ${nFrames} cuadros, guion ${(vals[nFrames - 1] * 0.04).toFixed(1)} s ↔ video ${(nFrames / 25).toFixed(1)} s; primer valor ${vals.find((v) => v > 0)}`);
const vcuts = cuts.map((c) => ({ ...c, vfrom: toVideo(c.from), vto: toVideo(c.to) }));
// El arranque: el video empieza antes que el reloj del guion (about:blank) → dejar sólo 0.3 s de negro.
// KEEP_HEAD (flow-apollo): segundos de crudo que se conservan al principio (0 = arranca directo en la carátula, sin el
// primer cuadro con la banda gris del screencast).
const KEEP_HEAD = process.env.KEEP_HEAD === undefined ? 0.3 : +process.env.KEEP_HEAD;
for (const c of vcuts) if (/^arranque \(carga/.test(c.label)) c.vfrom = Math.min(c.vfrom, KEEP_HEAD);
for (const c of vcuts) console.log(`corte ${c.label}: guion ${c.from}→${c.to}  ⇒ video ${c.vfrom.toFixed(2)}→${c.vto.toFixed(2)}`);
const END = nFrames / 25;
const segs = [];
let t = 0;
for (const c of vcuts) { if (c.vfrom > t) segs.push([t, c.vfrom]); t = Math.max(t, c.vto); }
segs.push([t, END]);
fs.writeFileSync(out + '.cuts-applied.json', JSON.stringify({ cuts: vcuts, segs }, null, 2));
console.log('segmentos', segs.map(([a, b]) => `${a.toFixed(2)}-${b.toFixed(2)}`).join(' '));
const OUT_W = +(process.env.OUT_W || W), OUT_H = +(process.env.OUT_H || H);
const BITRATE = process.env.BITRATE || (K === 2 ? '12M' : '6M');
// El ffmpeg de Playwright ≥1.5x (build 1013) ya no trae libvpx (VP8), sólo libvpx-vp9: usar VP8 si está, si no VP9.
const ENC = spawnSync(FF, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout;
const VCODEC = process.env.VCODEC || (/^\s*V\S*\s+libvpx\s/m.test(ENC) ? 'libvpx' : 'libvpx-vp9');
const EXTRA = VCODEC === 'libvpx-vp9' ? ['-row-mt', '1'] : [];
console.log(`salida ${OUT_W}×${OUT_H} @ ${BITRATE} · ${VCODEC}`);
const files = segs.map(([a, b], i) => {
  const f = `${tmp}seg${i}.webm`;
  const r = spawnSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-ss', a.toFixed(3), '-to', b.toFixed(3), '-r', '25', '-vf', `crop=${W}:${H - Math.round(8 * K)}:0:0,scale=${OUT_W}:${OUT_H}:flags=lanczos`,
    '-aspect', '16:10', '-c:v', VCODEC, ...EXTRA, '-b:v', BITRATE, '-crf', '6', '-qmin', '4', '-qmax', '24', '-deadline', 'good', '-cpu-used', '2', '-auto-alt-ref', '0', '-g', '250', f], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg seg ' + i);
  process.stdout.write('.');
  return f;
});

/* ---- EBML mínimo ---- */
function readVint(b, p, keepMarker) {
  const first = b[p]; let len = 1, mask = 0x80;
  while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
  let v = keepMarker ? first : first & (mask - 1);
  let allOnes = (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < len; i++) { v = v * 256 + b[p + i]; if (b[p + i] !== 0xff) allOnes = false; }
  return { v, len, unknown: !keepMarker && allOnes };
}
function elements(b, start, end) {
  const out = []; let p = start;
  while (p < end) {
    const id = readVint(b, p, true); const sz = readVint(b, p + id.len, false);
    const dataStart = p + id.len + sz.len;
    const dataEnd = sz.unknown ? end : dataStart + sz.v;
    out.push({ id: id.v, start: p, dataStart, dataEnd, unknown: sz.unknown });
    p = dataEnd;
  }
  return out;
}
const idBytes = (id) => { const a = []; while (id > 0) { a.unshift(id & 0xff); id = Math.floor(id / 256); } return Buffer.from(a); };
const size8 = (n) => { const a = Buffer.alloc(8); a[0] = 0x01; let x = n; for (let i = 7; i >= 1; i--) { a[i] = x % 256; x = Math.floor(x / 256); } return a; };
const el = (id, data) => Buffer.concat([idBytes(id), size8(data.length), data]);
const uintBytes = (n) => { const a = Buffer.alloc(8); let x = n; for (let i = 7; i >= 0; i--) { a[i] = x % 256; x = Math.floor(x / 256); } return a; };
const readUint = (b, s, e) => { let v = 0; for (let i = s; i < e; i++) v = v * 256 + b[i]; return v; };

const EBML = 0x1A45DFA3, SEGMENT = 0x18538067, INFO = 0x1549A966, TRACKS = 0x1654AE6B, CLUSTER = 0x1F43B675,
  TIMECODE = 0xE7, SIMPLEBLOCK = 0xA3, BLOCKGROUP = 0xA0, BLOCK = 0xA1, DURATION = 0x4489;
const parts = [];
let offset = 0; // ms
let header = null;
for (const f of files) {
  const b = fs.readFileSync(f);
  const top = elements(b, 0, b.length);
  const seg = top.find((e) => e.id === SEGMENT);
  const kids = elements(b, seg.dataStart, seg.dataEnd);
  if (!header) {
    const ebml = top.find((e) => e.id === EBML);
    const info = kids.find((e) => e.id === INFO);
    const infoKids = elements(b, info.dataStart, info.dataEnd).filter((e) => e.id !== DURATION).map((e) => b.subarray(e.start, e.dataEnd));
    const tracks = kids.find((e) => e.id === TRACKS);
    header = Buffer.concat([b.subarray(ebml.start, ebml.dataEnd), idBytes(SEGMENT), Buffer.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
      el(INFO, Buffer.concat(infoKids)), b.subarray(tracks.start, tracks.dataEnd)]);
  }
  let first = null, last = 0;
  for (const c of kids.filter((e) => e.id === CLUSTER)) {
    const ck = elements(b, c.dataStart, c.dataEnd);
    const tcEl = ck.find((e) => e.id === TIMECODE);
    const tc = readUint(b, tcEl.dataStart, tcEl.dataEnd);
    if (first === null) first = tc;
    for (const k of ck) {
      let blk = null;
      if (k.id === SIMPLEBLOCK) blk = k.dataStart;
      if (k.id === BLOCKGROUP) { const bb = elements(b, k.dataStart, k.dataEnd).find((e) => e.id === BLOCK); if (bb) blk = bb.dataStart; }
      if (blk !== null) { const tn = readVint(b, blk, false); const rel = b.readInt16BE(blk + tn.len); last = Math.max(last, tc + rel); }
    }
    const rest = ck.filter((e) => e.id !== TIMECODE).map((e) => b.subarray(e.start, e.dataEnd));
    parts.push(el(CLUSTER, Buffer.concat([el(TIMECODE, uintBytes(tc - first + offset)), ...rest])));
  }
  offset += last - first + 40;
}
const joined = out + '.joined.webm';
fs.writeFileSync(joined, Buffer.concat([header, ...parts]));
const r = spawnSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-i', joined, '-c', 'copy', out], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('remux');
fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(joined);
console.log('\nlisto', out, 'duración esperada', (offset / 1000).toFixed(2), 's');
