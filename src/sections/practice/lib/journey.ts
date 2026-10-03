import type { JourneyItem } from '../../../api/types';

export type Placed = JourneyItem & { y: number; x?: number };
/** Posiciones del zigzag: igual que buildJourney() del prototipo (x relativo al centro). */
export function layoutJourney(items: JourneyItem[]): { placed: Placed[]; height: number } {
  let y = 170;
  const placed = items.map((it): Placed => {
    if (it.kind === 'div') { const p = { ...it, y }; y += 150; return p; }
    const p = { ...it, y, x: -Math.sin(it.n * 0.8) * 100 }; y += 112; return p;
  });
  return { placed, height: y + 160 };
}
