// Ruido ambiente SINTETIZADO con Web Audio (sin archivos): blanco / marrón / rosa. Para concentrarse.
// Port de smarty-poc/app/src/lib/ambientNoise.ts. Cada ambiente = un AudioBufferSourceNode (loop de
// ~10 s de ruido) → GainNode → destino; se mezclan en paralelo entre sí y con la música de YouTube.
// El AudioContext arranca suspendido hasta un GESTO de usuario (lo dispara el toggle del MiniPlayer).

export type AmbientKey = 'blanco' | 'marron' | 'rosa';
export const AMBIENTS: { key: AmbientKey; label: string; emoji: string }[] = [
  { key: 'blanco', label: 'Ruido blanco', emoji: '🌫️' },
  { key: 'marron', label: 'Ruido marrón', emoji: '🌧️' },
  { key: 'rosa', label: 'Ruido rosa', emoji: '🌸' },
];

let ctx: AudioContext | null = null;
const nodes: Partial<Record<AmbientKey, { src: AudioBufferSourceNode; gain: GainNode }>> = {};
const buffers: Partial<Record<AmbientKey, AudioBuffer>> = {};

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/* Genera un buffer de ~10 s del ruido pedido (loop largo → costura inaudible). */
function makeBuffer(c: AudioContext, key: AmbientKey): AudioBuffer {
  const len = Math.floor(c.sampleRate * 10);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  if (key === 'blanco') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (key === 'marron') {
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  } else { // rosa — algoritmo de Paul Kellet
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

const vol01 = (v: number) => Math.max(0, Math.min(1, v / 100));

export function ambientStart(key: AmbientKey, volume: number) {
  if (nodes[key]) return;
  const c = getCtx();
  if (!buffers[key]) buffers[key] = makeBuffer(c, key);
  const src = c.createBufferSource(); src.buffer = buffers[key]!; src.loop = true;
  const gain = c.createGain(); gain.gain.value = vol01(volume);
  src.connect(gain); gain.connect(c.destination); src.start();
  nodes[key] = { src, gain };
}
export function ambientStop(key: AmbientKey) {
  const n = nodes[key]; if (!n) return;
  try { n.src.stop(); } catch { /* ya parado */ }
  n.src.disconnect(); n.gain.disconnect();
  delete nodes[key];
}
export function ambientSetVolume(key: AmbientKey, volume: number) {
  const n = nodes[key]; if (n) n.gain.gain.value = vol01(volume);
}
export function ambientStopAll() { for (const k of Object.keys(nodes) as AmbientKey[]) ambientStop(k); }
