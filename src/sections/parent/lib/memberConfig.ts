// U3 · M2: la configuración de CADA integrante tal como la ven los paneles de Familia (GET /api/parent/config?member=<id>:
// temas, palabras, topes, preset, dial del Feed, sus on-off —`features`— y la zona horaria de la FAMILIA). Singleton de
// módulo + useSyncExternalStore (el patrón de features.ts), con UNA entrada por integrante: los paneles de una misma solapa
// comparten la lectura (antes eran cinco GET iguales) y al volver a un integrante se ve lo último conocido mientras se
// relee. NADA OPTIMISTA: solo entra lo que respondió el server (una lectura o la respuesta de un guardado: patch).
// Los stores públicos del chico (features.ts, limits.ts, cycle.ts) son OTRA cosa: lo que rige para el usuario ACTIVO.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '../../../api';
import type { ParentConfig } from '../../../api/types';
import { parentCall } from './adultGate';

type Entry = { cfg: ParentConfig | null; failed: boolean };
const EMPTY: Entry = Object.freeze({ cfg: null, failed: false });

const entries = new Map<string, Entry>();
/** Sube con cada dato MÁS NUEVO que una lectura (un guardado): una lectura que salió antes ya no lo pisa al volver. */
const versions = new Map<string, number>();
const inflight = new Map<string, { v: number; p: Promise<void> }>();
const listeners = new Set<() => void>();

const versionOf = (m: string) => versions.get(m) ?? 0;
const bump = (m: string) => { versions.set(m, versionOf(m) + 1); };
function put(m: string, e: Entry) {
  entries.set(m, e);
  listeners.forEach((l) => l());
}
const isConfig = (c: unknown, m: string): c is ParentConfig => {
  const x = c as ParentConfig | null;
  return !!x && typeof x === 'object' && !!x.topics && !!x.words && !!x.volume && (x.member === undefined || x.member === m);
};

/** Relee la config de `member` (una lectura en vuelo por integrante; si llegó un guardado después de que salió, sale otra). */
export function refreshMemberConfig(member: string): Promise<void> {
  const v = versionOf(member);
  const cur = inflight.get(member);
  if (cur && cur.v === v) return cur.p;
  const p: Promise<void> = parentCall(api.parentConfig(member)).then(
    (c) => {
      if (versionOf(member) !== v) return;
      if (isConfig(c, member)) put(member, { cfg: c, failed: false });
      else put(member, { ...(entries.get(member) ?? EMPTY), failed: true });
    },
    () => { if (versionOf(member) === v) put(member, { ...(entries.get(member) ?? EMPTY), failed: true }); },
  ).finally(() => { if (inflight.get(member)?.p === p) inflight.delete(member); });
  inflight.set(member, { v, p });
  return p;
}

/** Aplica lo que el server YA guardó para `member` (la respuesta de un guardado). Si todavía no había lectura, no inventa
 *  una config: la próxima lectura la trae entera. */
export function patchMemberConfig(member: string, partial: Partial<ParentConfig>) {
  bump(member);
  const cur = entries.get(member)?.cfg;
  if (cur) put(member, { cfg: { ...cur, ...partial }, failed: false });
}

/** Un guardado que puede haber tocado el PRESET (on-off, temas, palabras, topes: editar a mano lo deja sin aplicar en el
 *  server): se aplica la respuesta y se relee, así Presets dice "configuración propia" al toque. */
export function savedTouchingPreset(member: string, partial: Partial<ParentConfig>) {
  patchMemberConfig(member, partial);
  void refreshMemberConfig(member);
}

/** La zona horaria es de la FAMILIA: al guardarla se parchea en TODOS los integrantes conocidos. */
export function patchFamilyTz(tz: string | null) {
  for (const [m, e] of entries) {
    bump(m);
    if (e.cfg) entries.set(m, { cfg: { ...e.cfg, tz }, failed: false });
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** La config del integrante (null = todavía no se leyó) y si la última lectura falló. Cada montaje dispara una lectura
 *  (deduplicada): lo que se ve es lo último conocido y enseguida lo fresco. */
export function useMemberConfig(member: string): { cfg: ParentConfig | null; failed: boolean; reload: () => Promise<void> } {
  const get = useCallback(() => entries.get(member) ?? EMPTY, [member]);
  const e = useSyncExternalStore(subscribe, get, get);
  useEffect(() => { void refreshMemberConfig(member); }, [member]);
  const reload = useCallback(() => refreshMemberConfig(member), [member]);
  return { cfg: e.cfg, failed: e.failed, reload };
}
