import { useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { RowStatus } from '../cards/FeatureRow';
import { parentCall, rejectedReason } from '../lib/adultGate';
import { patchFamilyTz, useMemberConfig } from '../lib/memberConfig';
import { adoptFamilyTz } from '../lib/schedules';

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
/** El nombre canónico de una zona según este Intl (el mismo que usa el server para guardarla). */
function canon(tz: string): string {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone; } catch { return tz; }
}
/** La opción de esa zona aunque venga con otro nombre: el server guarda la forma canónica de Intl («America/Buenos_Aires»
 *  por America/Argentina/Buenos_Aires), así que se compara canonicalizando acá; si no, "Argentina" pasaba a "Otra: …". */
const optionOf = (tz: string | null) => OPTIONS.find((o) => o.tz === tz || (o.tz !== null && tz !== null && canon(o.tz) === canon(tz)));
const labelOf = (tz: string | null) => optionOf(tz)?.label ?? tz ?? 'Automática';
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
 *  y rige ya: las franjas por sección, la franja del día del Feed, el Calendario y las clases con mentores (Buscar →
 *  Mentores; tandas B1-B2) se calculan y se escriben en esa zona. Después de guardar se adopta la zona nueva
 *  (adoptFamilyTz), así el menú y las pantallas de cada chico cambian en el acto —en esta pestaña y en las otras del
 *  navegador, y también el reloj de la barra superior del adulto—; otro dispositivo, en el próximo tick (≤ 30 s).
 *  U3: es de la FAMILIA, no del integrante elegido (vive en Límites, entre los paneles de un integrante, y lo dice): se lee
 *  de la config de cualquiera (`member` = el elegido, solo para leer) y al guardar se parchea en todos (patchFamilyTz). */
export function TimezoneControl({ member }: { member: string }) {
  const { cfg, failed, reload } = useMemberConfig(member);
  const value: string | null | undefined = cfg ? cfg.tz ?? null : undefined; // undefined = cargando
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<RowStatus>(null);
  const [, tick] = useState(0);
  const alive = useRef(true);
  const clear = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    alive.current = true;
    const t = setInterval(() => tick((n) => n + 1), 30_000); // la hora de muestra no se queda vieja
    return () => { alive.current = false; clearTimeout(clear.current); clearInterval(t); };
  }, []);

  const choose = async (raw: string) => {
    const tz = raw === AUTO ? null : raw;
    if (pending || tz === value) return;
    setPending(true);
    setStatus(null);
    clearTimeout(clear.current);
    try {
      const r = await parentCall(api.parentTz(tz));
      patchFamilyTz(r.tz); // de toda la familia: la ven los paneles de cada integrante
      adoptFamilyTz(r.tz); // y rige ya en esta pestaña y en las otras del navegador
      if (!alive.current) return;
      setStatus({ kind: 'saved', text: `Guardado: los horarios de toda la familia, el Calendario y las clases con mentores van con la hora de «${labelOf(r.tz)}».` });
      clear.current = setTimeout(() => { if (alive.current) setStatus(null); }, 6000);
    } catch (e) {
      if (alive.current) setStatus({ kind: 'error', text: rejectedReason(e) ?? 'No se pudo guardar. Probá de nuevo.' });
    }
    if (alive.current) setPending(false);
  };

  const option = value === undefined ? undefined : optionOf(value);
  const known = value === undefined || !!option;
  return (
    <section className="pz-block pz-tz" aria-labelledby="pz-tz-h">
      <h4 className="pz-block-h" id="pz-tz-h">Zona horaria de la familia <span className="pz-mem-fam">Toda la familia</span></h4>
      <p className="pz-help" id="pz-tz-d">Vale para toda la familia, no solo para el integrante elegido: con esta hora se calculan los horarios de cada integrante (y la franja del día de su Feed), el Calendario y las clases con mentores. Automática = la hora del servidor.</p>
      {failed && value === undefined ? (
        <div className="pz-fail"><p>No pude leer la zona horaria.</p><button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" onClick={() => void reload()}>Reintentar</button></div>
      ) : (
        <div className="pz-tz-row">
          <select className="pz-input pz-tz-sel" aria-describedby="pz-tz-d" aria-label="Zona horaria de la familia" aria-busy={pending}
            value={value === undefined ? AUTO : (option ? option.tz : value) ?? AUTO} disabled={value === undefined || pending} onChange={(e) => void choose(e.target.value)}>
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
