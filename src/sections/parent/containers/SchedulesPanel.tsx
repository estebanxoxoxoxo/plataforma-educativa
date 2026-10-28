import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { DaySchedule, FeatureSchedule, SectionKey } from '../../../api/types';
import type { RowStatus } from '../cards/FeatureRow';
import { PanelState } from '../components/PanelState';
import { parentCall, rejectedReason } from '../lib/adultGate';
import { DEFAULT_DAY, SCHEDULABLE, normalizeSchedule, parseHHMM } from '../lib/scheduleRules';
import { adoptSchedules } from '../lib/schedules';
import { TimezoneControl } from './TimezoneControl';

type Draft = Record<SectionKey, FeatureSchedule>;
/** Orden de visualización Lun→Dom; se guarda por getDay() (week[0] = domingo), como el DIAS del POC. */
const DIAS: { d: number; label: string; long: string }[] = [
  { d: 1, label: 'Lun', long: 'lunes' }, { d: 2, label: 'Mar', long: 'martes' }, { d: 3, label: 'Mié', long: 'miércoles' },
  { d: 4, label: 'Jue', long: 'jueves' }, { d: 5, label: 'Vie', long: 'viernes' }, { d: 6, label: 'Sáb', long: 'sábado' },
  { d: 0, label: 'Dom', long: 'domingo' },
];
const toDraft = (s: Partial<Record<SectionKey, FeatureSchedule>>): Draft =>
  Object.fromEntries(SCHEDULABLE.map(({ key }) => [key, normalizeSchedule(s[key])])) as Draft;
const same = (a: FeatureSchedule, b: FeatureSchedule) => JSON.stringify(a) === JSON.stringify(b);
const validTime = (t: string) => parseHHMM(t) !== null;

/** «Horarios por sección» (porte Smarty W7: el HorariosEditor de Ajustes del POC + su guardado). Por sección, "Restringir
 *  {sección} por horario"; tildado, los 7 días de lunes a domingo con abierto/cerrado y la franja desde–hasta. Un solo
 *  "Guardar" manda al server SOLO las secciones tocadas (un POST con el patch) y el chico lo ve en el acto: el menú y las
 *  rutas (esta pestaña y las otras del navegador, adoptSchedules); otro dispositivo, en el próximo tick (≤ 30 s). El server
 *  además lo hace cumplir: fuera de franja, la API de esa sección responde 403.
 *  Única validación (el POC no tenía): un día ABIERTO de una sección restringida necesita sus dos horas, porque el server
 *  exige HH:MM (en el POC una hora vacía dejaba ese día abierto entero, fail-open). En días cerrados o secciones sin
 *  restringir una hora vacía vuelve al default, que es lo que el editor del POC mostraba al reabrir.
 *  U3: los horarios son del integrante `member` (GET /api/schedules?member y POST schedules?member; la respuesta dice de
 *  quién son y adoptSchedules solo la aplica donde ese chico es el usuario activo). La zona horaria de arriba es de la
 *  FAMILIA (TimezoneControl): el selector de integrante no la cambia. */
export function SchedulesPanel({ kid, member }: { kid: string; member: string }) {
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<RowStatus>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await parentCall(api.schedules(member));
      if (!alive.current) return;
      if (r.member && r.member !== member) throw new Error('horarios de otro integrante'); // fail-closed: no se pinta lo ajeno
      const d = toDraft(r.schedules);
      setSaved(d); setDraft(d);
    } catch { if (alive.current) setFailed(true); }
  }, [member]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  const update = (key: SectionKey, fn: (s: FeatureSchedule) => FeatureSchedule) => {
    setDraft((d) => (d ? { ...d, [key]: fn(d[key]) } : d));
    setStatus(null);
  };
  const setDay = (key: SectionKey, d: number, patch: Partial<DaySchedule>) =>
    update(key, (s) => ({ ...s, week: s.week.map((day, i) => (i === d ? { ...day, ...patch } : day)) }));

  const save = async () => {
    if (!draft || !saved || busy) return;
    const touched = SCHEDULABLE.filter(({ key }) => !same(draft[key], saved[key]));
    for (const { key, label } of touched) {
      const s = draft[key];
      if (!s.restrictionActive) continue;
      const bad = DIAS.find(({ d }) => s.week[d].open && (!validTime(s.week[d].from) || !validTime(s.week[d].to)));
      if (bad) { setStatus({ kind: 'error', text: `Completá las dos horas de ${label} el ${bad.long} (o marcá ese día como cerrado).` }); return; }
    }
    const patch = Object.fromEntries(touched.map(({ key }) => {
      const s = draft[key];
      const week = s.week.map((day) => ({
        open: day.open,
        from: validTime(day.from) ? day.from : DEFAULT_DAY.from,
        to: validTime(day.to) ? day.to : DEFAULT_DAY.to,
      }));
      return [key, { restrictionActive: s.restrictionActive, week }];
    })) as Partial<Record<SectionKey, FeatureSchedule>>;
    setBusy(true); setStatus(null);
    try {
      const r = await parentCall(api.parentSchedules(patch, member));
      adoptSchedules(r); // rige ya para ese chico: menú y rutas, donde él es el usuario activo (esta pestaña o las otras)
      if (!alive.current) return;
      const d = toDraft(r.schedules);
      setSaved(d); setDraft(d);
      setStatus({ kind: 'saved', text: '✓ Guardado' });
    } catch (e) {
      if (alive.current) setStatus({ kind: 'error', text: rejectedReason(e) ?? 'No se pudo guardar. Probá de nuevo.' });
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <section className="pz-panel" aria-labelledby="pz-sch-h">
      <header className="pz-panel-head">
        <h3 id="pz-sch-h">Horarios por sección</h3>
        <p>Cada sección de {kid} puede limitarse a una franja por día. Fuera de horario se oculta de su menú y se bloquea el acceso. Sin restringir = siempre disponible.</p>
      </header>
      {/* la zona horaria con la que se calculan las franjas (deuda 14-oct): ARRIBA de los horarios; es de la FAMILIA */}
      <TimezoneControl member={member} />
      {!draft ? <PanelState failed={failed} onRetry={() => void load()} /> : (
        <>
          <fieldset className="pz-sch-set" disabled={busy}>
            <legend className="pz-sr">Horarios de cada sección de {kid}</legend>
            <ul className="pz-sch-list">
              {SCHEDULABLE.map(({ key, label }) => {
                const sch = draft[key];
                return (
                  <li key={key} className={`pz-sch${sch.restrictionActive ? ' is-on' : ''}`} data-sec={key}>
                    <label className="pz-sch-toggle">
                      <input type="checkbox" checked={sch.restrictionActive}
                        onChange={(e) => update(key, (s) => ({ ...s, restrictionActive: e.target.checked }))} />
                      Restringir {label} por horario
                    </label>
                    {sch.restrictionActive && (
                      <div className="pz-sch-week" role="group" aria-label={`Franja de ${label} por día`}>
                        {DIAS.map(({ d, label: dl }) => {
                          const day = sch.week[d] ?? DEFAULT_DAY;
                          return (
                            <div key={d} className={`pz-sch-day${day.open ? '' : ' is-closed'}`} data-day={d}>
                              <span className="pz-sch-dl">{dl}</span>
                              <label className="pz-sch-open">
                                <input type="checkbox" checked={day.open} aria-label={`${label} ${dl} abierto`}
                                  onChange={(e) => setDay(key, d, { open: e.target.checked })} />
                                <span>{day.open ? 'abierto' : 'cerrado'}</span>
                              </label>
                              <input type="time" className="pz-input pz-sch-time" value={day.from || ''} disabled={!day.open}
                                aria-label={`${label} ${dl} desde`} onChange={(e) => setDay(key, d, { from: e.target.value })} />
                              <span className="pz-sch-a">a</span>
                              <input type="time" className="pz-input pz-sch-time" value={day.to || ''} disabled={!day.open}
                                aria-label={`${label} ${dl} hasta`} onChange={(e) => setDay(key, d, { to: e.target.value })} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <div className="pz-sch-foot">
            <button type="button" className="pz-btn" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar horarios'}</button>
            <p className={`pz-sch-msg${status?.kind === 'error' ? ' is-err' : ''}`} role="status">{status?.text ?? ''}</p>
          </div>
          <p className="pz-foot">El Feed no tiene horario: siempre está abierto. Si una franja se cierra mientras suena música de fondo, la música sigue hasta que {kid} la pare.</p>
        </>
      )}
    </section>
  );
}
