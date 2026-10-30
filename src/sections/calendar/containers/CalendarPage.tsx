import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../api';
import type { CalendarEvent } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { useCycle } from '../../parent/lib/cycle';
import { CalendarEmpty, CalendarFail, CalendarSkeleton } from '../components/CalendarStates';
import { NextClassHero } from '../components/NextClassHero';
import { UpcomingList } from '../components/UpcomingList';
import { buildCalendar, endOf } from '../lib/calendar';

/** Cada cuánto se rearma la pantalla con la hora nueva ("faltan 2 horas", la clase que pasa a "Ahora mismo"). */
const TICK_MS = 30_000;

/** Calendario (/calendario): las clases del usuario ACTIVO con sus mentores (tanda U2: las contrata el adulto en Buscar →
 *  Mentores, para él o para un dependiente; cada uno ve SOLO las suyas — api.calendar(): sin precios ni nada que
 *  gestionar). Arriba la próxima clase y después UN SOLO listado con todas las que vienen, agrupadas por día, que scrollea
 *  con la página (pedido 11-oct: sin tira semanal). Se mantiene al día solo: relee al volver a la pestaña (el adulto
 *  puede haber contratado o cancelado en otra) y cuando termina una clase (el server corre la serie y agrega la que sigue).
 *  Las horas y los días se pintan en la ZONA HORARIA DE LA FAMILIA (tanda B1): la `tz` de GET /api/schedules que ya lee el
 *  store de horarios (el mismo que usa el reloj de la barra superior; null = la del navegador). Hasta que esa lectura
 *  vuelve (o falla) se muestra el esqueleto, para no pintar un instante con la hora del navegador y saltar después. */
export function CalendarPage() {
  const adult = useUser()?.kind === 'adult';
  const sched = useCycle();
  const tz = sched.tz;
  const tzReady = sched.syncedAt > 0 || sched.failed;
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true);
  const seq = useRef(0);
  const fetchedAt = useRef(0);

  /** Las recargas no tapan lo que ya se ve (nada de esqueleto de nuevo); solo cuenta la respuesta de la última. */
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const r = await api.calendar();
      if (!alive.current || my !== seq.current) return;
      fetchedAt.current = Date.now();
      setEvents(r.events);
      setFailed(false);
      setNow(Date.now());
    } catch {
      if (alive.current && my === seq.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive.current = false;
      clearInterval(tick);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [load]);

  // Terminó una clase desde la última lectura → se relee (la serie corre y aparece la que sigue). Solo las que terminaron
  // DESPUÉS de leer: si el reloj de la compu y el del server no coinciden, no queda releyendo en cada minuto.
  useEffect(() => {
    if (events?.some((e) => endOf(e) <= now && endOf(e) > fetchedAt.current)) void load();
  }, [events, now, load]);

  const view = useMemo(() => (events && tzReady ? buildCalendar(events, now, tz) : null), [events, now, tz, tzReady]);

  // La hojita del título (pedido de Esteban, 30-oct: el título con un ícono «de esos que incluyen la fecha del mes, como
  // el de Apple»): el DÍA DE HOY en la zona de la familia. Recién cuando la tz llegó (tzReady), como el resto: nada se
  // pinta un instante con la hora del navegador. tz inválida → la del navegador, como wallClock.
  const leaf = useMemo(() => {
    if (!tzReady) return null;
    const d = new Date(now);
    const opts = { timeZone: tz || undefined } as const;
    try {
      return { w: d.toLocaleDateString('es-AR', { weekday: 'short', ...opts }).replace('.', ''), d: d.toLocaleDateString('es-AR', { day: 'numeric', ...opts }) };
    } catch {
      return { w: d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''), d: String(d.getDate()) };
    }
  }, [now, tz, tzReady]);

  return (
    <section className="view cal-view" id="v-calendar">
      <header className="cal-head">
        {leaf && <span className="cal-tleaf" aria-hidden="true"><small>{leaf.w}</small><b>{leaf.d}</b></span>}
        {/* Sin lede (pedido de Esteban, 30-oct: quitar «Tus clases con los mentores…»). */}
        <h2 className="h2">Calendario</h2>
      </header>

      {!view ? (failed ? <CalendarFail onRetry={() => void load()} /> : <CalendarSkeleton />)
        : !view.hero ? <CalendarEmpty adult={adult} /> : (
          /* La próxima clase va en una columna lateral DERECHA y sticky en el escritorio (pedido de Esteban, 30-oct): se
             sigue viendo mientras se baja por el listado. Primero en el DOM: en tablet y teléfono queda arriba, como antes. */
          <div className="cal-layout">
            <div className="cal-aside"><NextClassHero hero={view.hero} /></div>
            <UpcomingList groups={view.groups} nextId={view.hero.event.id} now={now} tz={tz} />
          </div>
        )}
    </section>
  );
}
