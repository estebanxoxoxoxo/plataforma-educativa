import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import type { CycleRange, CycleResponse } from '../../../api/types';
import { minuteOfDay, hhmm } from '../../../shared/lib/cycleRules';
import type { RowStatus } from '../cards/FeatureRow';
import { CycleRangeCard } from '../components/CycleRangeCard';
import { PanelState } from '../components/PanelState';
import { parentCall, rejectedReason } from '../lib/adultGate';
import { adoptCycle, effectiveTz, onMemberCycle } from '../lib/cycle';
import { MAX_RANGES, type RangeDraft, coversNow, isDirty, newRange, toDrafts, toRequest, toggleSection } from '../lib/cycleDraft';
import { famTo } from '../lib/member';

/** «Ciclo del día» (tanda F2, 28-oct; docs/USUARIOS.md §11 — pedido del dueño: "rangos horarios y qué puntos de menú
 *  están disponibles en cada rango"). POR INTEGRANTE (`member`, el del selector de Familia; ParentZone remonta el panel al
 *  cambiarlo, así el borrador de uno nunca va al otro). Reemplaza a los "Horarios por sección" (porte W7, que vivían en
 *  Límites). Editor de hasta 8 rangos: nombre, desde/hasta y las secciones disponibles en cada uno; agregar, editar,
 *  borrar. "Guardar" manda la lista ENTERA (POST /api/parent/cycle?member {ranges}) y el server la valida: un 400 se
 *  muestra con SU motivo tal cual («Tarde»: las horas tienen que ser HH:MM…; rejectedReason). Lo guardado rige YA para ese
 *  chico (adoptCycle: menú y rutas donde él es el usuario activo, en esta pestaña o en otras; otro dispositivo, en el próximo
 *  tick) y el selector de demo de la barra lateral toma los rangos nuevos. Nada optimista: lo que queda es lo que respondió
 *  el server. La hora es la de la ZONA HORARIA DE LA FAMILIA (vive en Límites: se linkea). */
export function CyclePanel({ kid, member }: { kid: string; member: string }) {
  const [saved, setSaved] = useState<CycleRange[] | null>(null);
  const [drafts, setDrafts] = useState<RangeDraft[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<RowStatus>(null);
  const [demoRange, setDemoRange] = useState<string | null>(null);
  const [clock, setClock] = useState<{ offset: number; tz: string | null } | null>(null);
  const [, tick] = useState(0);
  const alive = useRef(true);
  const live = useRef({ saved, drafts });
  live.current = { saved, drafts };

  const take = useCallback((r: Pick<CycleResponse, 'cycle' | 'demoRange' | 'serverNow' | 'tz' | 'serverTz'>, sentAt: number, gotAt: number) => {
    setSaved(r.cycle.ranges);
    setDrafts(toDrafts(r.cycle.ranges));
    setDemoRange(r.demoRange);
    setClock({ offset: r.serverNow - (sentAt + gotAt) / 2, tz: effectiveTz(r.tz, r.serverTz) }); // FS-BASE-B: Automática = la del server
  }, []);

  const load = useCallback(async () => {
    setFailed(false);
    const sentAt = Date.now();
    try {
      const r = await parentCall(api.parentCycle(member));
      if (!alive.current) return;
      if (r.member !== member) throw new Error('ciclo de otro integrante'); // fail-closed: no se pinta lo ajeno
      take(r, sentAt, Date.now());
    } catch { if (alive.current) setFailed(true); }
  }, [member, take]);

  useEffect(() => {
    alive.current = true;
    void load();
    const t = setInterval(() => tick((n) => n + 1), 30_000); // el "Ahora" no se queda viejo
    // Lo que el server confirme para este integrante desde otro lado (el selector de demo, otra pestaña): el "en la demo"
    // siempre; los rangos, solo si acá no hay cambios sin guardar.
    const off = onMemberCycle((c) => {
      if (!alive.current || c.member !== member) return;
      setDemoRange(c.demoRange);
      const { saved: s, drafts: d } = live.current;
      if (s && d && !isDirty(d, s)) { setSaved(c.ranges); setDrafts(toDrafts(c.ranges)); }
    });
    return () => { alive.current = false; clearInterval(t); off(); };
  }, [load, member]);

  const edit = (key: string, fn: (d: RangeDraft) => RangeDraft) => {
    setDrafts((ds) => ds && ds.map((d) => (d.key === key ? fn(d) : d)));
    setStatus(null);
  };
  const add = () => { setDrafts((ds) => (ds && ds.length < MAX_RANGES ? [...ds, newRange(ds)] : ds)); setStatus(null); };
  const remove = (key: string) => { setDrafts((ds) => ds && ds.filter((d) => d.key !== key)); setStatus(null); };
  const discard = () => { if (saved) setDrafts(toDrafts(saved)); setStatus(null); };

  const save = async () => {
    if (!drafts || busy) return;
    setBusy(true); setStatus(null);
    const sentAt = Date.now();
    try {
      const r = await parentCall(api.parentCycleSave(toRequest(drafts), member));
      adoptCycle(r); // rige ya para ese chico (donde es el usuario activo) y el selector de demo toma los rangos nuevos
      if (!alive.current) return;
      take(r, sentAt, Date.now());
      const n = r.cycle.ranges.length;
      setStatus({ kind: 'saved', text: n ? `✓ Guardado: ${n} ${n === 1 ? 'rango' : 'rangos'}. Ya rige para ${kid}.` : `✓ Guardado: ${kid} no tiene ciclo, todo el menú está disponible siempre.` });
    } catch (e) {
      if (alive.current) setStatus({ kind: 'error', text: rejectedReason(e) ?? 'No se pudo guardar. Probá de nuevo.' });
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const cur = clock ? minuteOfDay(new Date(Date.now() + clock.offset), clock.tz) : null;
  const dirty = !!drafts && !!saved && isDirty(drafts, saved);
  const limites = famTo('/familia/limites', member);

  return (
    <section className="pz-panel" aria-labelledby="pz-cy-h">
      <header className="pz-panel-head">
        <h3 id="pz-cy-h">Ciclo del día de {kid}</h3>
        <p>Armá los momentos del día de {kid} (la escuela, la tarde libre, la noche…) y elegí qué partes del menú tiene en cada uno. Los rangos rigen todos los días; lo que no está disponible se esconde del menú y se bloquea.</p>
      </header>
      <p className="pz-cy-rule"><b>Durante un rango, {kid} solo tiene lo que marcaste en ese rango</b> (si dos rangos se pisan, suma lo de los dos); fuera de todo rango, tiene lo que no está en ninguno. El Feed nunca se cierra.</p>
      <p className="pz-help pz-cy-tz">
        Se calcula con la hora de la familia{cur != null && <> (ahora son las <b>{hhmm(cur)}</b>)</>}: la zona horaria se elige en <Link className="pz-inline pz-inline--tight" to={limites}>Límites</Link>.
      </p>
      {!drafts ? <PanelState failed={failed} onRetry={() => void load()} /> : (
        <>
          {drafts.length === 0 ? (
            <p className="pz-muted pz-cy-empty">{kid} no tiene ciclo del día: todo el menú está disponible siempre. Agregá un rango para empezar.</p>
          ) : (
            <ul className="pz-cy-list">
              {drafts.map((d, i) => (
                <CycleRangeCard key={d.key} draft={d} index={i} kid={kid} disabled={busy}
                  now={cur != null && coversNow(d, cur)} demo={!!d.id && d.id === demoRange && !!saved?.some((s) => s.id === d.id)}
                  onChange={(p) => edit(d.key, (x) => ({ ...x, ...p }))}
                  onToggle={(k) => edit(d.key, (x) => ({ ...x, sections: toggleSection(x.sections, k) }))}
                  onRemove={() => remove(d.key)} />
              ))}
            </ul>
          )}
          <div className="pz-cy-foot">
            <button type="button" className="pz-btn pz-btn--ghost" disabled={busy || drafts.length >= MAX_RANGES} onClick={add}>
              + Agregar rango
            </button>
            {drafts.length >= MAX_RANGES && <span className="pz-yt-hint">Hasta {MAX_RANGES} rangos.</span>}
            <span className="pz-cy-gap" />
            {dirty && <button type="button" className="pz-link pz-link--quiet" disabled={busy} onClick={discard}>Descartar cambios</button>}
            <button type="button" className="pz-btn" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar ciclo'}</button>
          </div>
          <p className={`pz-cy-msg${status?.kind === 'error' ? ' is-err' : ''}`} role={status?.kind === 'error' ? 'alert' : 'status'}>
            {status?.text ?? (dirty ? 'Hay cambios sin guardar.' : '')}
          </p>
          <p className="pz-foot">Para la demo: con al menos un rango, el selector «Ciclo (demo)» del menú de la app elige en qué rango está {kid} (cada vez que {kid} recarga la página vuelve el reloj real).</p>
        </>
      )}
    </section>
  );
}
