// Calendario del chico: fechas en castellano y armado de la pantalla (próxima clase + TODAS las que vienen, agrupadas
// por día en un solo listado que scrollea — pedido 11-oct: sin tira semanal) a partir de api.calendar(). Sin UI.
// Todo en hora LOCAL (la misma del server en el demo) y sumando días de calendario, no milisegundos: con el cambio de
// horario de verano "mañana" sigue siendo mañana.
import type { CalendarEvent } from '../../../api/types';

const DAY_MS = 86_400_000;
const WD = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const; // orden de Date.getDay()
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/* ---------- fechas ---------- */
export const endOf = (e: CalendarEvent) => e.start + e.durationMin * 60_000;
export const isLive = (e: CalendarEvent, now: number) => e.start <= now && now < endOf(e);
const dayStart = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
/** Días de calendario de `from` a `to` (hoy → mañana = 1). Redondea: los días de 23 o 25 h no lo corren. */
export const daysBetween = (from: number, to: number) => Math.round((dayStart(to) - dayStart(from)) / DAY_MS);
/** "17:00" · "9:30" */
export const hm = (t: number) => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "miércoles 14" · "martes 3 de noviembre" (el mes solo si no es el de hoy; el año, solo si no es este). */
function dateName(t: number, now: number): string {
  const d = new Date(t), n = new Date(now);
  const month = d.getMonth() !== n.getMonth() || d.getFullYear() !== n.getFullYear() ? ` de ${MONTHS[d.getMonth()]}` : '';
  const year = d.getFullYear() !== n.getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${WD[d.getDay()]} ${d.getDate()}${month}${year}`;
}
/** "Hoy" · "Mañana" · "Miércoles 14" · "Martes 3 de noviembre". */
export function dayTitle(t: number, now: number): string {
  const n = daysBetween(now, t);
  return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : cap(dateName(t, now));
}
/** Cuánto falta para una clase de HOY, como lo diría un chico: "Empieza en 20 minutos" · "Falta una hora y media". */
function inTime(mins: number): string {
  if (mins <= 1) return '¡Empieza ya!';
  if (mins < 60) return `Empieza en ${mins} minutos`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (m >= 45) return `Faltan ${h + 1} horas`;
  const half = m >= 15 ? ' y media' : '';
  return h === 1 ? `Falta una hora${half}` : `Faltan ${h} horas${half}`;
}

/* ---------- armado de la pantalla ---------- */
export type Hero = {
  event: CalendarEvent;
  /** Está pasando ahora mismo. */ live: boolean;
  /** "Tu próxima clase" · "Ahora mismo" */ kicker: string;
  /** "Miércoles 14 a las 17:00" · "Hoy a las 17:00" · "Empezó a las 17:00 y termina a las 18:00" */ when: string;
  /** "Faltan 3 días" · "¡Es mañana!" · "Faltan 2 horas" · "¡Es ahora!" */ countdown: string;
  /** Hoja de almanaque: mes corto, número y "hoy" / "mañana" / día de la semana. */ leaf: { month: string; day: number; weekday: string };
};
export type DayGroup = { date: number; title: string; /** "domingo 11" cuando el título es Hoy/Mañana */ sub: string; events: CalendarEvent[] };
export type CalendarView = { hero: Hero | null; groups: DayGroup[] };

function heroOf(e: CalendarEvent, now: number): Hero {
  const d = new Date(e.start);
  const n = daysBetween(now, e.start);
  const leaf = { month: MONTHS_SHORT[d.getMonth()], day: d.getDate(), weekday: n === 0 ? 'hoy' : n === 1 ? 'mañana' : WD[d.getDay()] };
  if (isLive(e, now)) {
    return { event: e, live: true, kicker: 'Ahora mismo', when: `Empezó a las ${hm(e.start)} y termina a las ${hm(endOf(e))}`, countdown: '¡Es ahora!', leaf };
  }
  const when = `${dayTitle(e.start, now)} a las ${hm(e.start)}`;
  const countdown = n === 0 ? inTime(Math.ceil((e.start - now) / 60_000)) : n === 1 ? '¡Es mañana!' : `Faltan ${n} días`;
  return { event: e, live: false, kicker: 'Tu próxima clase', when, countdown, leaf };
}

function groupByDay(events: CalendarEvent[], now: number): DayGroup[] {
  const out: DayGroup[] = [];
  for (const e of events) {
    const date = dayStart(e.start);
    let g = out[out.length - 1];
    if (!g || g.date !== date) {
      const n = daysBetween(now, date);
      g = { date, title: dayTitle(date, now), sub: n === 0 || n === 1 ? dateName(date, now) : '', events: [] };
      out.push(g);
    }
    g.events.push(e);
  }
  return out;
}

/** La pantalla entera a partir de las clases del server y la hora actual (se vuelve a armar con cada minuto que pasa).
 *  - hero: la primera clase que todavía no terminó (puede estar en curso).
 *  - groups: TODAS las que vienen (la próxima incluida), agrupadas por día, para un solo listado que scrollea. */
export function buildCalendar(events: readonly CalendarEvent[], now: number): CalendarView {
  const upcoming = events.filter((e) => endOf(e) > now).sort((a, b) => a.start - b.start || a.id - b.id);
  const next = upcoming[0];
  if (!next) return { hero: null, groups: [] };
  return { hero: heroOf(next, now), groups: groupByDay(upcoming, now) };
}
