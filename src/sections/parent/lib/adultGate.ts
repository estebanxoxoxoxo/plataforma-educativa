// Portón de la Zona de padres + SESIÓN DE API. El PIN de la familia (6 dígitos) lo valida el SERVER (POST
// /api/parent/unlock; en server/data/parent.json va solo su hash) y, si es correcto, devuelve un TOKEN de sesión:
// todas las rutas /api/parent/* lo piden (cabecera X-Parent-Token, la pone api/index.ts tras setParentToken) menos
// las dos públicas que lee la UI del chico (GET features y GET limits). Vale 15 minutos DESLIZANTES en el server
// (cada pedido la estira); acá se espeja: 15 minutos sin ningún pedido del padre → la zona se cierra sola.
// Tanto el desbloqueo como el token son estado en MEMORIA: una carga nueva —que además resetea la demo— vuelve a
// pedir el PIN; los deep links (/padres/temas…) también pasan primero por acá. "Cerrar zona de padres" lo vuelve a
// trabar y cierra la sesión también en el server. Un 401 en cualquier pedido del panel (sesión vencida o inválida)
// vuelve al portón con el motivo (parentCall).
// El PIN de la demo es el default público que eligió Esteban (ver server/src/parent.ts).
// TODO (versión futura): cambiar el PIN desde el panel.
import { useSyncExternalStore } from 'react';
import { ApiError, setParentToken } from '../../../api';

type Snap = { unlocked: boolean; /** por qué se cerró sola (sesión vencida); null = nada que avisar */ notice: string | null };
let snap: Snap = { unlocked: false, notice: null };
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const emit = (next: Snap) => { if (next.unlocked === snap.unlocked && next.notice === snap.notice) return; snap = next; listeners.forEach((l) => l()); };
const getUnlocked = () => snap.unlocked;
const getNotice = () => snap.notice;

/** El token vive acá (para poder cerrarlo en el server) y en api/index.ts (para mandarlo). Nunca se loguea. */
let token: string | null = null;
const SESSION_MS = 15 * 60_000;
let lastUse = 0;
let idle: ReturnType<typeof setInterval> | null = null;

export const useAdultUnlocked = () => useSyncExternalStore(subscribe, getUnlocked, getUnlocked);
/** Motivo por el que la zona se cerró sola (para mostrarlo en el portón). */
export const useAdultNotice = () => useSyncExternalStore(subscribe, getNotice, getNotice);

export function unlockAdult() {
  if (!token) return; // sin sesión del server no se abre nada (fail-closed)
  emit({ unlocked: true, notice: null });
  if (!idle) idle = setInterval(() => { if (Date.now() - lastUse > SESSION_MS) expireAdult(); }, 20_000);
}
function drop(notice: string | null) {
  token = null;
  setParentToken(null);
  if (idle) { clearInterval(idle); idle = null; }
  emit({ unlocked: false, notice });
}
/** "Cerrar zona de padres": traba la UI y cierra la sesión también en el server (si no responde, vence sola). */
export function lockAdult() {
  const t = token;
  drop(null);
  if (t) void fetch('/api/parent/lock', { method: 'POST', headers: { 'X-Parent-Token': t } }).catch(() => {});
}
/** La sesión venció (401 del server o 15 minutos sin uso): vuelta al portón con el motivo. */
export function expireAdult() {
  if (!snap.unlocked && !token) return;
  drop('Por seguridad, la Zona de padres se cerró sola después de un rato sin uso. Ingresá el PIN de nuevo.');
}

/** Todo pedido del panel pasa por acá: un 401 (sesión vencida o inválida) cierra la zona y vuelve al portón; un pedido
 *  que sale bien cuenta como uso (la sesión del server también se estiró con él). */
export async function parentCall<T>(p: Promise<T>): Promise<T> {
  try {
    const r = await p;
    lastUse = Date.now();
    return r;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) expireAdult();
    throw e;
  }
}

export type UnlockResult = { ok: boolean; /** demasiados intentos: cuánto falta para poder probar de nuevo */ waitSeconds?: number };

/** POST /api/parent/unlock. Va acá y no por http() de src/api porque http() LOGUEA el cuerpo en la consola: el PIN
 *  (y el token de la respuesta) no se loguean nunca. Si es correcto, deja la sesión puesta (setParentToken). */
export async function unlockWithPin(pin: string): Promise<UnlockResult> {
  console.debug('%c[api] → POST /api/parent/unlock (backend)', 'color:#C24B1F;font-weight:bold', '{ pin: ****** }');
  const r = await fetch('/api/parent/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = (await r.json()) as { ok?: unknown; token?: unknown; waitSeconds?: unknown };
  const tok = d.ok === true && typeof d.token === 'string' && d.token.length >= 20 ? d.token : null;
  const res: UnlockResult = { ok: tok !== null, ...(typeof d.waitSeconds === 'number' && d.waitSeconds > 0 ? { waitSeconds: d.waitSeconds } : {}) };
  if (tok) {
    token = tok;
    setParentToken(tok);
    lastUse = Date.now();
  }
  console.debug('%c[api] ← POST /api/parent/unlock', 'color:#3A5BD9', res); // sin el token
  return res;
}
