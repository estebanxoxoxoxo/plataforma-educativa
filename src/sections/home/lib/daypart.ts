// Subtítulo del Feed v6 debajo del saludo: "Lunes a la tarde · lo más nuevo primero". Mismos cortes que la edición del
// server (server/src/feedFake.ts: mañana desde las 6, tarde desde las 13, noche desde las 20; la madrugada todavía es la
// noche del día anterior), así el subtítulo y el "Tu tarde de lunes" del resumen dicen lo mismo. Día y hora se leen en
// la ZONA DE LA FAMILIA (wallClock, el mismo motor que usa el server para armar la edición): sin tz, el reloj local.
import { wallClock } from '../../../shared/lib/zonedClock';
import { isEn } from '../../../shared/lib/lang';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function daypartLine(d = new Date(), tz?: string | null): string {
  const { day, hour: h } = wallClock(d, tz);
  const slot = h >= 6 && h < 13 ? 0 : h >= 13 && h < 20 ? 1 : 2;
  const d7 = (day + (h < 6 ? 6 : 0)) % 7;
  // Inglés (i18n 9-nov): "Monday afternoon". Se resuelve al llamar (no al importar): sigue al idioma actual.
  if (isEn()) return `${DAYS_EN[d7]} ${['morning', 'afternoon', 'night'][slot]}`;
  return `${DAYS[d7]} ${['a la mañana', 'a la tarde', 'a la noche'][slot]}`;
}
