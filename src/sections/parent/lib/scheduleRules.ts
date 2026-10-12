// Horarios por sección (porte Smarty W7): las reglas PURAS, port de lib/featureSchedule.ts del POC. Son el ESPEJO de
// server/src/schedule.ts (isOpenIn / nextOpenLabelIn): el server decide y enforcea (403); el cliente las usa para pintar
// el menú y la pantalla "cerrado" sin esperar un 403. Si cambia una, cambia la otra (tests: __tests__/schedules.test.ts).
import type { DaySchedule, FeatureSchedule, SectionKey } from '../../../api/types';

/** Las secciones con horario, en el orden del editor del padre, con su ruta del menú (el Feed no está: nunca se cierra). */
export const SCHEDULABLE: { key: SectionKey; label: string; route: string }[] = [
  { key: 'chat', label: 'Chat', route: '/chat' },
  { key: 'buscar', label: 'Buscar', route: '/buscar' },
  { key: 'mytube', label: 'MyTube', route: '/mytube' },
  { key: 'aprender', label: 'Aprender', route: '/aprender' },
  { key: 'tienda', label: 'Tienda', route: '/tienda' },
  { key: 'calendario', label: 'Calendario', route: '/calendario' },
  { key: 'espacio', label: 'Mi espacio', route: '/espacio/carpetas' },
  { key: 'afterday', label: 'After Day', route: '/afterday' },
];
export const SECTION_KEYS: SectionKey[] = SCHEDULABLE.map((s) => s.key);

/** El día por defecto del editor (defaultSchedule del POC): abierto de 08:00 a 20:00. */
export const DEFAULT_DAY: DaySchedule = { open: true, from: '08:00', to: '20:00' };
/** Horario por defecto: 7 días abiertos, restricción OFF (= siempre abierta). */
export function defaultSchedule(): FeatureSchedule {
  return { restrictionActive: false, week: Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY })) };
}

/** Lo que muestra el editor (el normalizado del Ajustes del POC): POR DÍA, lo que falta o vino vacío se completa con el
 *  default → los inputs nunca quedan sin valor. */
export function normalizeSchedule(s: FeatureSchedule | undefined): FeatureSchedule {
  const raw = s?.week as unknown as Record<number, Partial<DaySchedule> | undefined> | undefined; // array u objeto {0..6}
  const week = Array.from({ length: 7 }, (_, d): DaySchedule => {
    const sd = raw?.[d];
    return {
      open: typeof sd?.open === 'boolean' ? sd.open : DEFAULT_DAY.open,
      from: typeof sd?.from === 'string' && sd.from ? sd.from : DEFAULT_DAY.from,
      to: typeof sd?.to === 'string' && sd.to ? sd.to : DEFAULT_DAY.to,
    };
  });
  return { restrictionActive: !!s?.restrictionActive, week };
}

export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? '').trim());
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** ¿Abierta en `now`? (isFeatureOpen del POC) Fail-safe: sin restricción o con datos incompletos/inválidos ⇒ abierta
 *  (nunca se encierra al chico por un horario mal cargado; cerrar es siempre EXPLÍCITO). to < from cruza la medianoche;
 *  from == to = las 24 h; día con open:false = cerrada todo el día. week se indexa con getDay() (0 = domingo). */
export function isOpenAt(sched: FeatureSchedule | undefined, now: Date): boolean {
  try {
    if (!sched || !sched.restrictionActive) return true;
    const week = sched.week;
    if (!week || typeof week !== 'object') return true;
    const day = (week as Record<number, DaySchedule | undefined>)[now.getDay()];
    if (!day) return true;
    if (!day.open) return false;
    const from = parseHHMM(day.from), to = parseHHMM(day.to);
    if (from == null || to == null) return true;
    const cur = now.getHours() * 60 + now.getMinutes();
    if (to <= from) return cur >= from || cur < to;
    return cur >= from && cur < to;
  } catch {
    return true;
  }
}

/** "Se abre de nuevo a las HH:MM" si HOY abre más tarde; null si no se puede precisar (v1 del POC: no mira mañana). */
export function nextOpenLabelAt(sched: FeatureSchedule | undefined, now: Date): string | null {
  try {
    if (!sched || !sched.restrictionActive) return null;
    const day = (sched.week as Record<number, DaySchedule | undefined> | undefined)?.[now.getDay()];
    if (day?.open) {
      const from = parseHHMM(day.from);
      const cur = now.getHours() * 60 + now.getMinutes();
      if (from != null && cur < from) return day.from;
    }
    return null;
  } catch {
    return null;
  }
}

/** La sección con horario a la que pertenece una RUTA del chico (null = ninguna: siempre se muestra). Como el
 *  featureForPath del POC, pero con las rutas de Innerith:
 *  · buscar = solo /buscar (los resultados). El lector (/buscar/articulo/:id) y el reproductor (/buscar/video/:id) NO:
 *    en el POC son overlays del shell que siguen andando con la sección cerrada (los abren el Feed, MyTube, el chat…).
 *  · aprender = /aprender y /crear (Crear vive dentro de Aprender).
 *  · espacio = /espacio, /espacio/carpetas*, /espacio/papelera (las demás /espacio/* son redirecciones viejas a MyTube). */
export function sectionForPath(path: string): SectionKey | null {
  const p = path.replace(/\/+$/, '') || '/';
  const under = (pre: string) => p === pre || p.startsWith(pre + '/');
  if (under('/chat')) return 'chat';
  if (p === '/buscar') return 'buscar';
  if (under('/mytube')) return 'mytube';
  if (under('/aprender') || under('/crear')) return 'aprender';
  if (under('/tienda')) return 'tienda';
  if (under('/calendario')) return 'calendario';
  if (p === '/espacio' || under('/espacio/carpetas') || under('/espacio/papelera')) return 'espacio';
  if (under('/afterday')) return 'afterday';
  return null;
}
