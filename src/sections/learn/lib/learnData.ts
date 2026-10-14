import { useSyncExternalStore } from 'react';
import { ApiError, api } from '../../../api';
import type { ActivityResultInput, ActivityResultRow } from '../../../api/types';
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
     · recordResult(): POST fire-and-forget → la fila nueva entra al toque y se re-piden todas (el server es la verdad). Si el
       guardado falla, va a una COLA con reintentos (ver "guardado de resultados" abajo; deuda 14-oct): antes se perdía
       con un console.error.
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
/** El mismo dato fuera de React (tests y depuración). */
export const getLearnData = (): LearnData => data;

/* Las filas: una sola fuente, la última respuesta PEDIDA gana (dos grabaciones seguidas —el hijo de un multi y su
   agregado— disparan dos lecturas que pueden volver cruzadas). */
let rowsSeq = 0;
async function fetchRows(): Promise<void> {
  const my = ++rowsSeq;
  try {
    const r = await api.learnResults();
    // las filas OPTIMISTAS de la cola de guardado (todavía no están en el server) siguen al final, en su orden
    if (my === rowsSeq) emit({ rows: [...r.rows, ...pendingRows()] });
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

/* ---------- guardado de resultados: COLA con reintento (tanda "Deudas técnicas", 14-oct) ----------
   El recordResult del POC escribe en Dexie (local: no falla) y el liveQuery mueve el camino al toque. Acá el guardado va
   al server y puede fallar (red, server reiniciándose); antes la fila se perdía con un console.error. Ahora:
     · COLA en RAM, FIFO y de a uno: si un guardado falla, los que vienen detrás ESPERAN su turno — el server recibe las
       filas en el orden en que se jugaron (la economía paga la PRIMERA `completed` de cada objetivo y el recall mira la
       última);
     · reintentos a los 2 s, 8 s y 30 s (tres); si el último también falla, console.error como antes y sigue la próxima;
     · se reintenta lo que puede andar más tarde (sin red, 5xx, 408, 429); otro 4xx es un rechazo (p. ej. 403: Aprender
       cerró por horario) y no se reintenta;
     · mientras espera, la fila queda OPTIMISTA en el camino — se agrega UNA sola vez por resultado (id provisorio
       negativo), sobrevive a las relecturas y al guardarse se REEMPLAZA en su lugar por la del server; si muere, se
       quita (no quedó guardada, como antes).
   Límite conocido: si un POST llegó al server pero se perdió la respuesta, el reintento la graba dos veces (evitarlo pide
   una clave de idempotencia en el contrato). */
type Awarded = { ec: number; xp: number };
type SaveJob = { input: ActivityResultInput; row: ActivityResultRow; tries: number; optimistic: boolean; resolve: (a: Awarded | undefined) => void };
export const RETRY_DELAYS_MS = [2000, 8000, 30000] as const;
const queue: SaveJob[] = [];
let draining = false;
let tempIds = 0;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const retryable = (e: unknown) => !(e instanceof ApiError) || e.status >= 500 || e.status === 408 || e.status === 429;
/** Las filas optimistas de la cola, en su orden. */
function pendingRows(): ActivityResultRow[] {
  return queue.filter((j) => j.optimistic).map((j) => j.row);
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const job = queue[0];
      try {
        const r = await api.recordLearnResult(job.input);
        queue.shift();
        // la fila nueva entra al toque (como el liveQuery del POC): en el LUGAR de su optimista, o al final; nunca dos veces
        if (data.rows) {
          const rows = data.rows.filter((x) => x.id !== r.row.id);
          const at = rows.findIndex((x) => x.id === job.row.id);
          if (at >= 0) rows[at] = r.row; else rows.push(r.row);
          emit({ rows });
        }
        void fetchRows(); // y se re-piden todas (el server es la verdad)
        job.resolve(r.awarded);
      } catch (e) {
        if (!retryable(e) || job.tries >= RETRY_DELAYS_MS.length) {
          queue.shift();
          if (job.optimistic && data.rows) emit({ rows: data.rows.filter((x) => x.id !== job.row.id) });
          console.error('[learn] no pude grabar el resultado:', e);
          job.resolve(undefined);
          continue;
        }
        if (!job.optimistic) {
          job.optimistic = true; // UNA sola vez por resultado, aunque se reintente tres
          if (data.rows) emit({ rows: [...data.rows, job.row] });
        }
        await sleep(RETRY_DELAYS_MS[job.tries++]);
      }
    }
  } finally {
    draining = false;
  }
}

/** El recordResult del POC: graba UNA partida terminada atribuida a su target. Fire-and-forget (`void`): nunca tira;
 *  devuelve los ⚡/XP acreditados si los hubo (economía Innerith: la primera vez que ese target se completa) — si hubo que
 *  reintentar, cuando por fin se guardó (o undefined si no se pudo). */
export function recordResult(input: Parameters<typeof resultRowOf>[0]): Promise<Awarded | undefined> {
  const payload = resultRowOf(input);
  return new Promise((resolve) => {
    // la fila provisoria (solo se muestra si hay que reintentar): id negativo y la hora de ahora; el server pone los suyos
    queue.push({ input: payload, row: { ...payload, id: -++tempIds, finishedAt: Date.now() }, tries: 0, optimistic: false, resolve });
    void drain();
  });
}
