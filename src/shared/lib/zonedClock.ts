/* Hora "de pared" de un instante en una ZONA HORARIA IANA (tanda "Deudas técnicas", 14-oct: la zona horaria de la familia).
   Pura (solo Intl, sin estado de app): la usan el SERVER (server/src/schedule.ts: franjas por sección y "se abre a las…";
   server/src/feedFake.ts: la franja del Feed) y el CLIENTE (sections/parent/lib/scheduleRules.ts, el espejo de los
   horarios) — el mismo código en los dos lados, como el núcleo del registry de Learn.
   Sin zona (null/undefined) = el reloj LOCAL del proceso (getDay/getHours: lo de siempre); una zona que este motor no conoce
   también cae a la local (nunca tira: los horarios son fail-open). */

export type WallClock = {
  /** Día de la semana como getDay(): 0 = domingo … 6 = sábado. */ day: number;
  hour: number; minute: number;
  /** hour * 60 + minute */ minutes: number;
};

const fmts = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string): Intl.DateTimeFormat {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
    fmts.set(tz, f);
  }
  return f;
}
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** ¿Es una zona IANA que este motor conoce? (construir el formateador ES la prueba, como pide el contrato). */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz.trim() || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Fecha de pared: año, mes (0 = enero), día del mes y día de la semana (0 = domingo, como getDay()). */
export type WallDate = { y: number; m: number; d: number; wd: number };
const ymdFmts = new Map<string, Intl.DateTimeFormat>();
/** La fecha que marca el reloj de pared de `tz` en el instante `t`; sin zona (o desconocida), la local (como wallClock). */
export function wallDate(t: number, tz?: string | null): WallDate {
  const at = new Date(t);
  if (tz) {
    try {
      let f = ymdFmts.get(tz);
      if (!f) {
        f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' });
        ymdFmts.set(tz, f);
      }
      const parts = f.formatToParts(at);
      const get = (k: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === k)?.value);
      const y = get('year'), m = get('month') - 1, d = get('day');
      if (Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d)) return { y, m, d, wd: new Date(Date.UTC(y, m, d)).getUTCDay() };
    } catch { /* zona que este motor no conoce: la local, como wallClock */ }
  }
  return { y: at.getFullYear(), m: at.getMonth(), d: at.getDate(), wd: at.getDay() };
}

/** Día (0 = domingo) y hora/minutos de `at` en la zona `tz`; sin zona (o desconocida), en la local del proceso. */
export function wallClock(at: Date, tz?: string | null): WallClock {
  if (tz) {
    try {
      const parts = fmtFor(tz).formatToParts(at);
      const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
      const day = WEEKDAY[get('weekday')];
      const hour = Number(get('hour')) % 24; // algún motor escribe "24" a la medianoche
      const minute = Number(get('minute'));
      if (day !== undefined && Number.isFinite(hour) && Number.isFinite(minute)) return { day, hour, minute, minutes: hour * 60 + minute };
    } catch { /* zona desconocida: la local */ }
  }
  const hour = at.getHours(), minute = at.getMinutes();
  return { day: at.getDay(), hour, minute, minutes: hour * 60 + minute };
}
