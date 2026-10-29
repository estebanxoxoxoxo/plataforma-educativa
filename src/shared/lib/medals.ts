// Las medallas de la plataforma en el CLIENTE (U5-D; spec docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §5.5, docs/USUARIOS.md §12.D):
// los textos que se repiten (chip del perfil, hoja "Tus medallas", Familia → Actividad) y el evento que hace re-pedir la
// cantidad del perfil. PURO: sin fetch ni estado (lo usan ProfileCard, MedalsSheet, el Feed y ActivityPanel).
// Las cinco reglas de §5.1 viven en el server (el catálogo no viaja nunca): acá no hay total, ni "N de 13", ni "te falta".
import type { EarnedMedal } from '../../api/types';
import { wallDate } from './zonedClock';

/** Evento de ventana "puede haber medallas nuevas": lo dispara el Feed cuando le llega una noticia de medalla (al cargar o
 *  por la píldora) y lo escucha el chip del perfil para volver a pedir GET /api/medals sin F5. */
export const MEDALS_CHANGED = 'innerith:medals-changed';
export const medalsChanged = () => { window.dispatchEvent(new Event(MEDALS_CHANGED)); };

/** ¿Trae alguna noticia de medalla? (el Feed decide con esto si avisa al chip) */
export const hasMedalNews = (items: readonly { kind: string }[]) => items.some((it) => it.kind === 'medal');

/** aria-label del chip: "Tus medallas: 5" · "Tus medallas: 5, 1 nueva" · "Tus medallas: 6, 2 nuevas". */
export function chipLabel(count: number, unseen: number): string {
  const fresh = unseen > 0 ? `, ${unseen} ${unseen === 1 ? 'nueva' : 'nuevas'}` : '';
  return `Tus medallas: ${count}${fresh}`;
}

const DAY_MONTH = { day: 'numeric', month: 'long' } as const;
const DAY_MONTH_YEAR = { day: 'numeric', month: 'long', year: 'numeric' } as const;
const fmts = new Map<string, Intl.DateTimeFormat>();
function inTz(withYear: boolean, tz?: string | null): Intl.DateTimeFormat {
  const key = `${withYear ? 'dmy' : 'dm'}|${tz ?? ''}`;
  let f = fmts.get(key);
  if (!f) {
    const opts = withYear ? DAY_MONTH_YEAR : DAY_MONTH;
    try { f = new Intl.DateTimeFormat('es-AR', tz ? { ...opts, timeZone: tz } : opts); } catch { f = new Intl.DateTimeFormat('es-AR', opts); }
    fmts.set(key, f);
  }
  return f;
}
/** "Desde el 23 de octubre" (del año en curso) · "Desde el 23 de octubre de 2025" · null = sin fecha (las del seed que salen
 *  de hechos sin fecha: racha, semanas, copa, amigos; spec §5.4: "en la pila no se muestra fecha").
 *  EN LA ZONA DE LA FAMILIA (QA-U5-E): `tz` = useCycle().tz (la de la familia o, en Automática, la del server), la misma
 *  pared que la barra superior; sin zona —o una que este navegador no conoce— la local (como wallClock). */
export function sinceText(at: number | null | undefined, now: Date = new Date(), tz?: string | null): string | null {
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  return `Desde el ${inTz(wallDate(at, tz).y !== wallDate(now.getTime(), tz).y, tz).format(at)}`;
}

/** "×3": solo las repetibles que se ganaron 2 o más veces (el server manda `times` solo así); si no, null. */
export const timesText = (times: number | undefined): string | null =>
  typeof times === 'number' && times >= 2 ? `×${Math.floor(times)}` : null;

/** La nota de Familia → Actividad para una medalla que el integrante NO ve por un candado (el adulto ve todas):
 *  "(Ligas apagadas: Luna no la ve)" · "(Amigos apagado: Ian no la ve)" (los nombres de los on-off, como en Familia). */
export function hiddenNote(hidden: 'ligas' | 'amigos', kid: string): string {
  return `(${hidden === 'ligas' ? 'Ligas apagadas' : 'Amigos apagado'}: ${kid} no la ve)`;
}

/** Título de la noticia del Feed: "Ganaste la medalla «Primera posta»". */
export const newsTitle = (m: Pick<EarnedMedal, 'title'>) => `Ganaste la medalla «${m.title}»`;
