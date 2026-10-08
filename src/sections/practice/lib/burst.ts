import type { NodeType } from '../../../api/types';
import { TYPES } from './exerciseTypes';

/** Destello de partículas al completar un paso, centrado en `node` y dibujado dentro de `track`
 *  (que debe ser position:relative). Usa rects (no offsets) y compensa escalas (modo stage). */
export function burst(track: HTMLElement, node: HTMLElement, type: NodeType) {
  const t = TYPES[type] ?? TYPES.trophy;
  const cols = [t.c, '#FFC23D', t.d, '#13A39A'];
  const tr = track.getBoundingClientRect(), nr = node.getBoundingClientRect();
  const scale = tr.width / (track.offsetWidth || 1);
  const cx = (nr.left + nr.width / 2 - tr.left) / scale, cy = (nr.top + nr.height / 2 - tr.top) / scale;
  for (let k = 0; k < 16; k++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.style.left = `${cx}px`; s.style.top = `${cy}px`; s.style.background = cols[k % 4];
    track.appendChild(s);
    const a = (k / 16) * Math.PI * 2, d = 48 + Math.random() * 30;
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.3)`, opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => s.remove();
  }
}
