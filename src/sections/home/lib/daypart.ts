// Subtítulo del Feed v6 debajo del saludo: "Lunes a la tarde · lo más nuevo primero". Mismos cortes que la edición del
// server (server/src/feedFake.ts: mañana desde las 6, tarde desde las 13, noche desde las 20; la madrugada todavía es la
// noche del día anterior), así el subtítulo y el "Tu tarde de lunes" del resumen dicen lo mismo. Día y hora se leen en
// la ZONA DE LA FAMILIA (wallClock, el mismo motor que usa el server para armar la edición): sin tz, el reloj local.
import { wallClock } from '../../../shared/lib/zonedClock';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function daypartLine(d = new Date(), tz?: string | null): string {
  const { day, hour: h } = wallClock(d, tz);
  const part = h >= 6 && h < 13 ? 'a la mañana' : h >= 13 && h < 20 ? 'a la tarde' : 'a la noche';
  return `${DAYS[(day + (h < 6 ? 6 : 0)) % 7]} ${part}`;
}
