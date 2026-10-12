import { useSyncExternalStore } from 'react';
import { api } from '../../../api';
import type { ActivityResultRow } from '../../../api/types';
import { registerImportedDefinitions } from '../../../learn/definitions';
import type { DefinitionRecipe } from '../../../learn/registry';
import { resultRowOf, type LearnRoute } from './learn';

/* Datos de Learn del lado del cliente: lo que en el POC son las lecturas EN VIVO de Dexie (useLiveQuery sobre
   activityResults y learnRoutes) y el único escritor recordResult. En Innerith viven en NUESTRO server (desvío forzado (b)
   del mapa: IndexedDB → server, mismas formas) y acá queda un store de módulo (useSyncExternalStore, patrón de
   shared/audio/bgAudio): cualquier vista suscripta se re-dibuja cuando se graba un resultado, como el liveQuery del POC.
     · loadLearn(): al ENTRAR a la sección — las rutas del catálogo (lista + cada ruta completa: el mosaico necesita sus
       postas y su primer contenido), la HIDRATACIÓN del motor (TODAS las definiciones → registerImportedDefinitions, el
       hydrateImportedDefinitions del POC) y las filas de resultados.
     · recordResult(): POST fire-and-forget (los errores van a la consola, como las escrituras `void` del POC) → la fila
       nueva entra al toque y se re-piden todas (el server es la verdad).
   Trampa 16 del informe 02 (en frío el botón raíz podía no aparecer porque las definiciones hidrataban async): acá la
   hidratación se ESPERA — `hydrated` avisa cuándo el catálogo en memoria ya las tiene. Trampa 15 (fiel): el catálogo en
   memoria no se purga — las definiciones de una ruta borrada siguen registradas hasta recargar la página. */

export type LearnData = {
  /** Rutas del catálogo, en el orden de su clave (el toArray() del POC). null = todavía no llegaron. */
  routes: LearnRoute[] | null;
  /** Todas las filas de resultados (append-only). null = todavía no llegaron. */
  rows: ActivityResultRow[] | null;
  /** El catálogo de definiciones en memoria ya tiene las importadas del server. */
  hydrated: boolean;
  /** Sube con cada hidratación (lo que depende del catálogo en memoria se recalcula). */
  defsRev: number;
  /** No se pudieron traer las rutas y no hay nada para mostrar. */
  failed: boolean;
};

let data: LearnData = { routes: null, rows: null, hydrated: false, defsRev: 0, failed: false };
const listeners = new Set<() => void>();
function emit(next: Partial<LearnData>) {
  data = { ...data, ...next };
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
const snapshot = () => data;

export function useLearnData(): LearnData {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/* Las filas: una sola fuente, la última respuesta PEDIDA gana (dos grabaciones seguidas —el hijo de un multi y su
   agregado— disparan dos lecturas que pueden volver cruzadas). */
let rowsSeq = 0;
async function fetchRows(): Promise<void> {
  const my = ++rowsSeq;
  try {
    const r = await api.learnResults();
    if (my === rowsSeq) emit({ rows: r.rows });
  } catch (e) {
    console.error('[learn] no pude traer los resultados:', e);
  }
}

let loadSeq = 0;
/** Entrar a Learn: rutas + hidratación del motor + filas (en paralelo). */
export async function loadLearn(): Promise<void> {
  const my = ++loadSeq;
  const [list, defs] = await Promise.allSettled([api.learnRoutes(), api.learnDefinitions(), fetchRows()]);
  if (my !== loadSeq) return;
  if (defs.status === 'fulfilled') {
    registerImportedDefinitions(defs.value.definitions as DefinitionRecipe[]);
    emit({ hydrated: true, defsRev: data.defsRev + 1 });
  } else {
    console.error('[learn] no pude hidratar las definiciones:', defs.reason);
  }
  if (list.status !== 'fulfilled') {
    console.error('[learn] no pude traer las rutas:', list.reason);
    emit({ failed: data.routes == null });
    return;
  }
  const full = await Promise.allSettled(list.value.routes.map((it) => api.learnRoute(it.id)));
  if (my !== loadSeq) return;
  emit({ routes: full.flatMap((r) => (r.status === 'fulfilled' ? [r.value.route] : [])), failed: false });
}

/** El recordResult del POC: graba UNA partida terminada atribuida a su target. Fire-and-forget (`void`): nunca tira;
 *  devuelve los ⚡/XP acreditados si los hubo (economía Innerith: la primera vez que ese target se completa). */
export function recordResult(input: Parameters<typeof resultRowOf>[0]): Promise<{ ec: number; xp: number } | undefined> {
  return api.recordLearnResult(resultRowOf(input)).then(
    (r) => {
      // la fila nueva entra al toque (el camino se actualiza como con el liveQuery del POC) y se re-piden todas
      if (data.rows && !data.rows.some((x) => x.id === r.row.id)) emit({ rows: [...data.rows, r.row] });
      void fetchRows();
      return r.awarded;
    },
    (e) => {
      console.error('[learn] no pude grabar el resultado:', e);
      return undefined;
    },
  );
}
