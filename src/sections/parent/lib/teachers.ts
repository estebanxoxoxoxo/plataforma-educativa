// Profesores (marketplace de la Zona de padres): textos y reglas del lado de la UI. La verdad la tiene el server
// (server/src/teachersFake.ts: valida el horario, que el profe no esté contratado y que el chico no tenga esa hora
// ocupada); acá solo se arma la hoja de reserva y se escriben las cosas. weekday del contrato: 0 = lunes … 6 = domingo.
import type { Teacher, TeacherSlot } from '../../../api/types';

export const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
export const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
const DAYS_PL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'] as const;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;
/** Horas que ofrece la hoja (en punto): el mismo rango que acepta el server (9 a 19; la última termina a las 20). */
export const HOURS: readonly number[] = Array.from({ length: 11 }, (_, i) => 9 + i);
/** Todas las clases duran una hora (CalendarEvent.durationMin = 60 en el demo). */
export const CLASS_MINUTES = 60;
/** Cuántas clases agenda una contratación de entrada (HireResult.eventsAdded del demo). */
export const CLASSES_PER_HIRE = 4;

export const hourLabel = (h: number) => `${h}:00`;
/** "miércoles 17:00" */
export const slotLabel = (s: TeacherSlot) => `${DAYS[s.weekday]} ${hourLabel(s.hour)}`;
/** "los miércoles" · "los sábados" */
export const everyDay = (weekday: number) => `los ${DAYS_PL[weekday]}`;
/** "los miércoles a las 17:00" */
export const slotEvery = (s: TeacherSlot) => `${everyDay(s.weekday)} a las ${hourLabel(s.hour)}`;
const slotKey = (weekday: number, hour: number) => `${weekday}-${hour}`;
/** Como lo llama el chico (y como figura en el título de la clase): el primer nombre. */
export const firstName = (name: string) => name.split(' ')[0];
/** "USD 40" */
export const usd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`;
/** 4.9 → "4,9" */
export const ratingLabel = (r: number) => r.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** "martes 13 de octubre a las 10:00" (hora local, como el resto del demo). */
export function dateLong(ts: number): string {
  const d = new Date(ts);
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MONTHS[d.getMonth()]} a las ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Horarios que el chico ya tiene con OTRO profe: no se pueden elegir (el server también lo rechaza). */
export type TakenSlots = ReadonlyMap<string, Teacher>;
export function takenSlots(list: readonly Teacher[], exceptId: string): TakenSlots {
  const m = new Map<string, Teacher>();
  for (const t of list) if (t.hired && t.slot && t.id !== exceptId) m.set(slotKey(t.slot.weekday, t.slot.hour), t);
  return m;
}
export const takenBy = (taken: TakenSlots, weekday: number, hour: number) => taken.get(slotKey(weekday, hour));
