import type { NodeType } from '../../../api/types';
import { TYPES } from './exerciseTypes';

/** Explosión de partículas al completar un nodo. */
export function burst(track: HTMLElement, node: HTMLElement, type: NodeType) {
  const t = TYPES[type] ?? TYPES.trophy;
  const cols = [t.c, '#FFC23D', t.d, '#18A957'];
  const cx = node.offsetLeft + node.offsetWidth / 2, cy = node.offsetTop + node.offsetHeight / 2;
  for (let k = 0; k < 14; k++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.style.left = `${cx}px`; s.style.top = `${cy}px`; s.style.background = cols[k % 4];
    track.appendChild(s);
    const a = (k / 14) * Math.PI * 2, d = 72 + Math.random() * 26;
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.4)`, opacity: 0 }], { duration: 750, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => s.remove();
  }
}
