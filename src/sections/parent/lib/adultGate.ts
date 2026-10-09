// Portón de la Zona de padres: el PIN de la familia (6 dígitos) lo valida el SERVER (POST
// /api/parent/unlock; en server/data/parent.json va solo su hash). Pasarlo vale por la SESIÓN DE PÁGINA:
// es estado en memoria, así que una carga nueva —que además resetea la demo— lo vuelve a pedir; los
// deep links (/padres/premios…) también pasan primero por acá. "Cerrar zona de padres" lo vuelve a trabar.
// El PIN de la demo es el default público que eligió Esteban (ver server/src/parent.ts).
// TODO (versión futura): cambiar el PIN desde el panel.
import { useSyncExternalStore } from 'react';

let unlocked = false;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const get = () => unlocked;
const set = (v: boolean) => { if (unlocked === v) return; unlocked = v; listeners.forEach((l) => l()); };

export const useAdultUnlocked = () => useSyncExternalStore(subscribe, get, get);
export const unlockAdult = () => set(true);
export const lockAdult = () => set(false);

export type UnlockResult = { ok: boolean; /** demasiados intentos: cuánto falta para poder probar de nuevo */ waitSeconds?: number };

/** POST /api/parent/unlock. Va acá y no en src/api porque el cliente congelado todavía no tiene el método
 *  (pendiente del coordinador) y porque su http() LOGUEA el cuerpo en la consola: el PIN no se loguea nunca. */
export async function unlockWithPin(pin: string): Promise<UnlockResult> {
  console.debug('%c[api] → POST /api/parent/unlock (backend)', 'color:#C24B1F;font-weight:bold', '{ pin: ****** }');
  const r = await fetch('/api/parent/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = (await r.json()) as { ok?: unknown; waitSeconds?: unknown };
  const res: UnlockResult = { ok: d.ok === true, ...(typeof d.waitSeconds === 'number' && d.waitSeconds > 0 ? { waitSeconds: d.waitSeconds } : {}) };
  console.debug('%c[api] ← POST /api/parent/unlock', 'color:#3A5BD9', res);
  return res;
}
