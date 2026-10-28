// Mentores (línea 14-oct, docs/USUARIOS.md §3, §5 y §6): textos y reglas del lado de la UI que comparten Buscar → Mentores
// (sections/discover: la búsqueda y la hoja de contratación con su post-compra) y Familia → Mentorías (sections/parent).
// La verdad la tiene el server (server/src/teachersFake.ts: valida el plan, el beneficiario, los días y que el
// beneficiario no tenga esa hora ocupada); acá solo se arman las hojas y se escriben las cosas. Sin UI.
// weekday del contrato: 0 = lunes … 6 = domingo. Fechas en hora DE PARED de la ZONA HORARIA DE LA FAMILIA (tanda B2, la
// misma cuenta que el Calendario —sections/calendar/lib/calendar.ts, tanda B1— y que el server, que ancla las clases en esa
// zona): "miércoles 17:00" es el reloj de la familia aunque el navegador esté en otra parte del mundo. Sin zona (null =
// Automática, el default) o con una que este navegador no conoce, la hora LOCAL del navegador, como antes.
import type { MentorPlan, TakenSlot, Teacher, TeacherSlot } from '../../api/types';
import { isValidTimeZone, wallClock, wallDate } from './zonedClock';

/** Zona IANA de la familia (`tz` de GET /api/schedules: la que eligió el adulto en Familia → Límites); null = la del navegador. */
export type Tz = string | null;

export const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
export const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
const DAYS_PL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'] as const;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;
/** Horas que ofrece la agenda (en punto): el mismo rango que acepta el server (9 a 19; la última termina a las 20). */
export const HOURS: readonly number[] = Array.from({ length: 11 }, (_, i) => 9 + i);
/** Los planes: clases (de una hora) por semana. */
export const PLANS: readonly MentorPlan[] = [1, 2, 3];
/** Clases de cada día que aparecen por delante en el calendario (ScheduleResult.eventsAdded = CLASSES × días). */
export const CLASSES = 4;

export const hourLabel = (h: number) => `${h}:00`;
/** "los miércoles" · "los sábados" */
export const everyDay = (weekday: number) => `los ${DAYS_PL[weekday]}`;
/** "los miércoles a las 17:00" */
export const slotEvery = (s: TeacherSlot) => `${everyDay(s.weekday)} a las ${hourLabel(s.hour)}`;
/** "a, b y c" */
export const listEs = (xs: readonly string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
/** "los martes a las 10:00 y los jueves a las 10:00" (en el orden de la semana). */
export const slotsEvery = (slots: readonly TeacherSlot[]) =>
  listEs([...slots].sort((a, b) => a.weekday - b.weekday || a.hour - b.hour).map(slotEvery));
/** Como lo llama el chico (y como figura en el título de la clase): el primer nombre. */
export const firstName = (name: string) => name.split(' ')[0];
/** "USD 40" */
export const usd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`;
/** 4.9 → "4,9" */
export const ratingLabel = (r: number) => r.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* ---------- fechas de pared (wallDate vive en shared/lib/zonedClock, compartido con sections/calendar) ---------- */
/** El instante en que el reloj de pared de `tz` marca esa fecha (el día del mes puede pasarse, como en new Date) a esa hora
 *  en punto. Sin zona (o desconocida): new Date(año, mes, día, hora), la local de siempre. Con zona: se lee la fecha y la
 *  hora como si fueran UTC y se corrige lo que se corre la pared de la zona; con un cambio de horario de verano en el medio
 *  alcanza una vuelta más (las clases van de 9 a 19: nunca caen en la hora que se saltea el cambio, que es de madrugada). */
function wallInstant(y: number, m: number, d: number, hour: number, tz: Tz): number {
  if (!tz || !isValidTimeZone(tz)) return new Date(y, m, d, hour).getTime();
  const want = Date.UTC(y, m, d, hour);
  let t = want;
  for (let i = 0; i < 3; i++) {
    const day = wallDate(t, tz), clock = wallClock(new Date(t), tz);
    const off = Date.UTC(day.y, day.m, day.d, clock.hour, clock.minute) - want;
    if (off === 0) break;
    t -= off;
  }
  return t;
}

/** "martes 13 de octubre a las 10:00", en la pared de `tz` (la zona de la familia; null = la del navegador). */
export function dateLong(ts: number, tz: Tz = null): string {
  const d = wallDate(ts, tz), w = wallClock(new Date(ts), tz);
  return `${DAYS[(d.wd + 6) % 7]} ${d.d} de ${MONTHS[d.m]} a las ${w.hour}:${String(w.minute).padStart(2, '0')}`;
}

/* ---------- plan y precio ---------- */
/** Precio semanal de un plan: cada clase dura una hora, así que es plan × precio por hora. */
export const weeklyPrice = (rate: number, plan: MentorPlan) => rate * plan;
/** "1 clase por semana" · "2 clases por semana" */
export const planLabel = (plan: MentorPlan) => `${plan} ${plan === 1 ? 'clase' : 'clases'} por semana`;
/** "1 clase de 1 h" · "3 clases de 1 h" */
export const planClasses = (plan: MentorPlan) => `${plan} ${plan === 1 ? 'clase' : 'clases'} de 1 h`;

/* ---------- horas ocupadas (MentorsResponse.taken del beneficiario) ---------- */
/** Con quién tiene ocupada esa hora el beneficiario, o undefined si la tiene libre. */
export const takenBy = (taken: readonly TakenSlot[], weekday: number, hour: number) =>
  taken.find((t) => t.weekday === weekday && t.hour === hour);

/* ---------- rótulos del beneficiario ----------
   `me` = el adulto activo (el que contrata); `people` = MentorsResponse.people (él y sus dependientes: id → nombre). */
export type People = Readonly<Record<string, string>>;
/** "vos" si es el adulto mismo; si no, su nombre ("Ian"). */
export const whoName = (id: string, me: string, people: People) => (id === me ? 'vos' : people[id] ?? 'alguien de tu familia');
/** "para vos" · "para Ian" */
export const forWho = (id: string, me: string, people: People) => `para ${whoName(id, me, people)}`;
/** El radio de "¿Para quién?": "Para mí" · "Para Ian" */
export const pickWho = (id: string, me: string, people: People) => (id === me ? 'Para mí' : `Para ${whoName(id, me, people)}`);
/** "Te da clases" · "Da clases a Ian" */
export const teachesWho = (id: string, me: string, people: People) => (id === me ? 'Te da clases' : `Da clases a ${whoName(id, me, people)}`);
/** "tu calendario" · "el calendario de Ian" */
export const calendarOf = (id: string, me: string, people: People) => (id === me ? 'tu calendario' : `el calendario de ${whoName(id, me, people)}`);
/** Con "de" adelante y la contracción bien hecha: "de tu calendario" · "del calendario de Ian" (nunca "de el"). */
export const fromCalendarOf = (id: string, me: string, people: People) => (id === me ? 'de tu calendario' : `del calendario de ${whoName(id, me, people)}`);
/** La familia en orden: el adulto primero y después sus dependientes. */
export const familyIds = (me: string, people: People) => [me, ...Object.keys(people).filter((id) => id !== me)];

/* ---------- Buscar → Mentores ---------- */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** ¿El mentor entra en la búsqueda? Por nombre, materia o bio, sin acentos ni mayúsculas: cada palabra tiene que estar.
 *  Sin palabras, entran todos (la solapa sin búsqueda muestra el catálogo entero). Filtro LOCAL: sin red extra. */
export function mentorMatches(t: Teacher, q: string): boolean {
  const words = fold(q).split(/\s+/).filter(Boolean);
  const hay = fold(`${t.name} ${t.subject} ${t.bio}`);
  return words.every((w) => hay.includes(w));
}

/** La primera clase de una serie recién agendada: la próxima ocurrencia ESTRICTAMENTE futura de alguno de sus días (la
 *  misma cuenta que hace el server al agendar —nextStart de server/src/teachersFake.ts—: el día y la hora de PARED en `tz`,
 *  la zona de la familia, sumando días de calendario; null = la local del navegador). Para cuando el calendario del
 *  beneficiario no se puede leer desde acá (es el de OTRO usuario: /api/calendar trae solo el del activo). */
export function firstClass(slots: readonly TeacherSlot[], now = Date.now(), tz: Tz = null): number | null {
  const n = wallDate(now, tz);
  const today = (n.wd + 6) % 7;
  let best: number | null = null;
  for (const s of slots) {
    const delta = (s.weekday - today + 7) % 7;
    let t = wallInstant(n.y, n.m, n.d + delta, s.hour, tz);
    if (t <= now) t = wallInstant(n.y, n.m, n.d + delta + 7, s.hour, tz);
    if (best === null || t < best) best = t;
  }
  return best;
}
