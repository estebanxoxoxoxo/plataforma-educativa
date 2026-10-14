// Mentores (línea 14-oct, docs/USUARIOS.md §3, §5 y §6): textos y reglas del lado de la UI que comparten Buscar → Mentores
// (sections/discover: la búsqueda y la hoja de contratación con su post-compra) y Familia → Mentorías (sections/parent).
// La verdad la tiene el server (server/src/teachersFake.ts: valida el plan, el beneficiario, los días y que el
// beneficiario no tenga esa hora ocupada); acá solo se arman las hojas y se escriben las cosas. Sin UI.
// weekday del contrato: 0 = lunes … 6 = domingo. Fechas en hora LOCAL, como el resto del demo.
import type { MentorPlan, TakenSlot, Teacher, TeacherSlot } from '../../api/types';

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
/** "martes 13 de octubre a las 10:00" */
export function dateLong(ts: number): string {
  const d = new Date(ts);
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MONTHS[d.getMonth()]} a las ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
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
 *  misma cuenta que hace el server al agendar: hora local, sumando días). Para cuando el calendario del beneficiario no se
 *  puede leer desde acá (es el de OTRO usuario: /api/calendar trae solo el del activo). */
export function firstClass(slots: readonly TeacherSlot[], now = Date.now()): number | null {
  const d = new Date(now);
  const today = (d.getDay() + 6) % 7;
  let best: number | null = null;
  for (const s of slots) {
    const delta = (s.weekday - today + 7) % 7;
    let t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta, s.hour).getTime();
    if (t <= now) t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta + 7, s.hour).getTime();
    if (best === null || t < best) best = t;
  }
  return best;
}
