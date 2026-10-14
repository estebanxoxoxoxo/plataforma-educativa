import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { RowStatus } from '../cards/FeatureRow';
import { parentCall } from '../lib/adultGate';
import { adoptSchedules } from '../lib/schedules';

/** Las zonas que ofrece el selector (pedido 14-oct): Automática = la del servidor (null). */
const OPTIONS: { tz: string | null; label: string }[] = [
  { tz: null, label: 'Automática' },
  { tz: 'America/Argentina/Buenos_Aires', label: 'Argentina' },
  { tz: 'America/New_York', label: 'Este EE.UU.' },
  { tz: 'America/Chicago', label: 'Centro' },
  { tz: 'America/Denver', label: 'Montaña' },
  { tz: 'America/Los_Angeles', label: 'Pacífico' },
  { tz: 'Europe/Madrid', label: 'España' },
];
const AUTO = '';
const labelOf = (tz: string | null) => OPTIONS.find((o) => o.tz === tz)?.label ?? tz ?? 'Automática';
/** "miércoles 07:12" en esa zona (o en la del navegador si es Automática). */
function nowIn(tz: string | null): string {
  try {
    return new Intl.DateTimeFormat('es-AR', { timeZone: tz ?? undefined, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  } catch {
    return '';
  }
}

/** "Zona horaria de la familia" (deuda 14-oct; Familia → Límites, arriba de los horarios). Patrón del dial del Feed
 *  (FeedMotionControl): se lee de la config (api.parentConfig), se guarda al toque en el server (api.parentTz → parent.json)
 *  y rige ya: las franjas por sección y la franja del día del Feed se calculan en esa zona. Después de guardar se relee
 *  GET /api/schedules y se adopta (adoptSchedules), así el menú y las pantallas del chico cambian en el acto —en esta pestaña
 *  y en las otras del navegador—; otro dispositivo, en el próximo tick (≤ 30 s). */
export function TimezoneControl({ kid }: { kid: string }) {
  const [value, setValue] = useState<string | null | undefined>(undefined); // undefined = cargando
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<RowStatus>(null);
  const [failed, setFailed] = useState(false);
  const [, tick] = useState(0);
  const alive = useRef(true);
  const clear = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const c = await parentCall(api.parentConfig());
      if (alive.current) setValue(c.tz ?? null);
    } catch { if (alive.current) setFailed(true); }
  }, []);
  useEffect(() => {
    alive.current = true;
    void load();
    const t = setInterval(() => tick((n) => n + 1), 30_000); // la hora de muestra no se queda vieja
    return () => { alive.current = false; clearTimeout(clear.current); clearInterval(t); };
  }, [load]);

  const choose = async (raw: string) => {
    const tz = raw === AUTO ? null : raw;
    if (pending || tz === value) return;
    setPending(true);
    setStatus(null);
    clearTimeout(clear.current);
    try {
      const r = await parentCall(api.parentTz(tz));
      if (!alive.current) return;
      setValue(r.tz);
      try { adoptSchedules(await parentCall(api.schedules())); } catch { /* el tick del chico lo trae igual */ }
      if (!alive.current) return;
      setStatus({ kind: 'saved', text: `Guardado: los horarios de ${kid} se calculan con la hora de «${labelOf(r.tz)}».` });
      clear.current = setTimeout(() => { if (alive.current) setStatus(null); }, 6000);
    } catch {
      if (alive.current) setStatus({ kind: 'error', text: 'No se pudo guardar. Probá de nuevo.' });
    }
    if (alive.current) setPending(false);
  };

  const known = value === undefined || OPTIONS.some((o) => o.tz === value);
  return (
    <section className="pz-block pz-tz" aria-labelledby="pz-tz-h">
      <h4 className="pz-block-h" id="pz-tz-h">Zona horaria de la familia</h4>
      <p className="pz-help" id="pz-tz-d">Los horarios de abajo (y la franja del día del Feed de {kid}) se calculan con esta hora. Automática = la hora del servidor.</p>
      {failed ? (
        <div className="pz-fail"><p>No pude leer la zona horaria.</p><button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" onClick={() => void load()}>Reintentar</button></div>
      ) : (
        <div className="pz-tz-row">
          <select className="pz-input pz-tz-sel" aria-describedby="pz-tz-d" aria-label="Zona horaria de la familia" aria-busy={pending}
            value={value === undefined ? AUTO : value ?? AUTO} disabled={value === undefined || pending} onChange={(e) => void choose(e.target.value)}>
            {OPTIONS.map((o) => <option key={o.label} value={o.tz ?? AUTO}>{o.label}</option>)}
            {!known && value && <option value={value}>Otra: {value}</option>}
          </select>
          {value !== undefined && <span className="pz-tz-now">Ahora: {nowIn(value)}</span>}
        </div>
      )}
      <p className={`pz-lim-msg${status?.kind === 'error' ? ' is-err' : ''}`} role="status">{status?.text ?? ''}</p>
    </section>
  );
}
