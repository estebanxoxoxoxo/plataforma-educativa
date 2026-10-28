// Calendario del chico: fechas en castellano y armado de la pantalla (próxima clase + TODAS las que vienen, agrupadas
// por día en un solo listado que scrollea — pedido 11-oct: sin tira semanal) a partir de api.calendar(). Sin UI.
// Todo en hora DE PARED de la ZONA HORARIA DE LA FAMILIA (tanda B1: `tz` de GET /api/schedules, la que eligió el adulto en
// Familia → Límites; el server ancla las clases en esa misma zona): "miércoles 17:00" se ve 17:00 aunque el navegador esté
// en otra parte del mundo, igual que el reloj de la barra superior. Sin zona (null = Automática) o con una que este
// navegador no conoce, la local del navegador, como antes (wallClock del helper compartido hace lo mismo, así la hora y
// la fecha nunca se contradicen). Los días se cuentan por FECHA de pared, no por milisegundos: con el cambio de horario de
// verano "mañana" sigue siendo mañana.
import type { CalendarEvent } from '../../../api/types';
import { wallClock, wallDate } from '../../../shared/lib/zonedClock';

/** Zona IANA de la familia; null = la del navegador. */
export type Tz = string | null;

const DAY_MS = 86_400_000;
const WD = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const; // orden de Date.getDay()
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/* ---------- fechas de pared (wallDate vive en shared/lib/zonedClock, compartido con mentors.ts) ---------- */
/** El día de pared como número (medianoche UTC de esa fecha): dos instantes del mismo día dan lo mismo. */
const dayKey = (t: number, tz: Tz) => { const w = wallDate(t, tz); return Date.UTC(w.y, w.m, w.d); };

export const endOf = (e: CalendarEvent) => e.start + e.durationMin * 60_000;
export const isLive = (e: CalendarEvent, now: number) => e.start <= now && now < endOf(e);
/** Días de calendario de `from` a `to` en la pared de `tz` (hoy → mañana = 1). Exacto: cuenta fechas, no horas. */
export const daysBetween = (from: number, to: number, tz: Tz = null) => Math.round((dayKey(to, tz) - dayKey(from, tz)) / DAY_MS);
/** "17:00" · "9:30" (en la pared de `tz`). */
export const hm = (t: number, tz: Tz = null) => { const w = wallClock(new Date(t), tz); return `${w.hour}:${String(w.minute).padStart(2, '0')}`; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "miércoles 14" · "martes 3 de noviembre" (el mes solo si no es el de hoy; el año, solo si no es este). */
function dateName(t: number, now: number, tz: Tz): string {
  const d = wallDate(t, tz), n = wallDate(now, tz);
  const month = d.m !== n.m || d.y !== n.y ? ` de ${MONTHS[d.m]}` : '';
  const year = d.y !== n.y ? ` de ${d.y}` : '';
  return `${WD[d.wd]} ${d.d}${month}${year}`;
}
/** "Hoy" · "Mañana" · "Miércoles 14" · "Martes 3 de noviembre". */
export function dayTitle(t: number, now: number, tz: Tz = null): string {
  const n = daysBetween(now, t, tz);
  return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : cap(dateName(t, now, tz));
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
export type DayGroup = {
  /** El día (medianoche UTC de su fecha de pared): la key del grupo. */ date: number;
  title: string; /** "domingo 11" cuando el título es Hoy/Mañana */ sub: string; events: CalendarEvent[];
};
export type CalendarView = { hero: Hero | null; groups: DayGroup[] };

function heroOf(e: CalendarEvent, now: number, tz: Tz): Hero {
  const d = wallDate(e.start, tz);
  const n = daysBetween(now, e.start, tz);
  const leaf = { month: MONTHS_SHORT[d.m], day: d.d, weekday: n === 0 ? 'hoy' : n === 1 ? 'mañana' : WD[d.wd] };
  if (isLive(e, now)) {
    return { event: e, live: true, kicker: 'Ahora mismo', when: `Empezó a las ${hm(e.start, tz)} y termina a las ${hm(endOf(e), tz)}`, countdown: '¡Es ahora!', leaf };
  }
  const when = `${dayTitle(e.start, now, tz)} a las ${hm(e.start, tz)}`;
  const countdown = n === 0 ? inTime(Math.ceil((e.start - now) / 60_000)) : n === 1 ? '¡Es mañana!' : `Faltan ${n} días`;
  return { event: e, live: false, kicker: 'Tu próxima clase', when, countdown, leaf };
}

function groupByDay(events: CalendarEvent[], now: number, tz: Tz): DayGroup[] {
  const out: DayGroup[] = [];
  for (const e of events) {
    const date = dayKey(e.start, tz);
    let g = out[out.length - 1];
    if (!g || g.date !== date) {
      const n = daysBetween(now, e.start, tz);
      g = { date, title: dayTitle(e.start, now, tz), sub: n === 0 || n === 1 ? dateName(e.start, now, tz) : '', events: [] };
      out.push(g);
    }
    g.events.push(e);
  }
  return out;
}

/** La pantalla entera a partir de las clases del server, la hora actual (se vuelve a armar con cada minuto que pasa) y la
 *  zona de la familia (null = la del navegador).
 *  - hero: la primera clase que todavía no terminó (puede estar en curso).
 *  - groups: TODAS las que vienen (la próxima incluida), agrupadas por día, para un solo listado que scrollea. */
export function buildCalendar(events: readonly CalendarEvent[], now: number, tz: Tz = null): CalendarView {
  const upcoming = events.filter((e) => endOf(e) > now).sort((a, b) => a.start - b.start || a.id - b.id);
  const next = upcoming[0];
  if (!next) return { hero: null, groups: [] };
  return { hero: heroOf(next, now, tz), groups: groupByDay(upcoming, now, tz) };
}
