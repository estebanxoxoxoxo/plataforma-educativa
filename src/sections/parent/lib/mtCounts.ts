// Familia → MyTube (tanda F2): el "N videos" de cada tarjeta de canal de la grilla del padre. GET /api/mytube/admin/channels
// no trae conteos (contrato congelado) y GET /api/mytube/channel dispara el enriquecimiento on-demand (YouTube + resumen IA)
// de cada canal —no se puede abrir así a los ~150 del catálogo—, así que el número sale del total de
// GET /api/mytube/channel/videos?id=&limit=1 (= el "Videos (N)" que ve el chico adentro del canal: aprobados, sin duplicados
// ni palabras bloqueadas). Cuesta ~200 ms de server por canal: se pide A DEMANDA (la tarjeta lo pide al entrar en pantalla),
// de a 3 en paralelo, y queda en memoria de la pestaña hasta que algo lo cambia (agregar, eliminar, reingestar, completar o
// quitar duplicados → forgetCounts). Singleton de módulo + useSyncExternalStore.
import { useSyncExternalStore } from 'react';
import { api } from '../../../api';

const PARALLEL = 3;
const counts = new Map<string, number>();
const queue: string[] = [];
const queued = new Set<string>();
let active = 0;
let gen = 0; // sube con forgetCounts: una respuesta de antes ya no cuenta
let snapshot: ReadonlyMap<string, number> = new Map();
const listeners = new Set<() => void>();
const emit = () => { snapshot = new Map(counts); listeners.forEach((l) => l()); };

function pump() {
  while (active < PARALLEL && queue.length) {
    const id = queue.shift()!;
    const my = gen;
    active++;
    api.mtChannelVideos(id, 0, 1).then(
      (r) => { if (my === gen && typeof r.total === 'number') counts.set(id, r.total); },
      () => { /* sin número: la tarjeta lo vuelve a pedir la próxima vez que entre en pantalla */ },
    ).finally(() => {
      active--;
      if (my === gen) { queued.delete(id); emit(); }
      pump();
    });
  }
}

/** La tarjeta de `id` está en pantalla: que se pida su número (si no se sabe ni está en camino). */
export function wantCount(id: string) {
  if (counts.has(id) || queued.has(id)) return;
  queued.add(id);
  queue.push(id);
  pump();
}

/** Algo cambió el catálogo de la familia: se olvidan los números (las tarjetas a la vista los vuelven a pedir). */
export function forgetCounts() {
  gen++;
  counts.clear();
  queue.length = 0;
  queued.clear();
  emit();
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const get = () => snapshot;
/** Los números conocidos (re-renderiza cuando llega uno). */
export const useChannelCounts = (): ReadonlyMap<string, number> => useSyncExternalStore(subscribe, get, get);
