import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from '../../../api';
import type { ParentVolume } from '../../../api/types';
import type { RowStatus } from '../cards/FeatureRow';
import { PanelState } from '../components/PanelState';
import { VolumePreview } from '../components/VolumePreview';
import { parentCall, rejectedReason } from '../lib/adultGate';
import { publishLimits } from '../lib/limits';
import { savedTouchingPreset, useMemberConfig } from '../lib/memberConfig';

type Key = keyof ParentVolume;
const ROWS: { key: Key; name: string; what: 'la música' | 'los ruidos'; desc: (kid: string) => string }[] = [
  { key: 'maxMusic', name: 'Música de fondo', what: 'la música', desc: (kid) => `Lo que suena con «Escuchar de fondo» y las listas de ${kid}, aunque cambie de sección.` },
  { key: 'maxNoise', name: 'Ruidos para concentrarse', what: 'los ruidos', desc: () => 'Ruido blanco, marrón y rosa del reproductor de la barra lateral.' },
];
/** Espera desde el último movimiento del slider hasta guardar (no se manda un pedido por cada paso). */
const SAVE_MS = 450;

/** "Límites": topes de volumen de la música y los ruidos de fondo (settings.maxVol* de Smarty). Son techos: el chico
 *  elige su volumen por debajo; si lo que suena estaba más fuerte, baja en el acto (publishLimits → bgAudio).
 *  U3: los topes son del integrante `member` (su config, lib/memberConfig.ts; POST volume?member). Lo que quedó a medio
 *  guardar se guarda al desmontar CON EL INTEGRANTE DE ESTE MONTAJE: por eso ParentZone remonta los paneles al cambiar de
 *  integrante (<Routes key>); sin eso, el tope a medio guardar de uno iría al otro. */
export function LimitsPanel({ kid, member }: { kid: string; member: string }) {
  const { cfg, failed, reload } = useMemberConfig(member);
  const [saved, setSaved] = useState<ParentVolume | null>(null);
  const [draft, setDraft] = useState<ParentVolume | null>(null);
  const [status, setStatus] = useState<Partial<Record<Key, RowStatus>>>({});
  const timers = useRef<Partial<Record<Key, ReturnType<typeof setTimeout>>>>({});
  const clearers = useRef<Partial<Record<Key, ReturnType<typeof setTimeout>>>>({});
  /** Valores movidos que todavía esperan su guardado: si el padre se va de la sección (o elige a otro integrante) antes,
   *  se guardan igual. */
  const pending = useRef<Partial<Record<Key, number>>>({});
  /** Guardados en vuelo por tope: mientras tanto, una lectura vieja no le pisa al slider lo que el padre eligió. */
  const saving = useRef<Partial<Record<Key, number>>>({});
  const alive = useRef(true);

  // Lo que dice el server (la lectura del integrante o un guardado) entra al panel, salvo en el tope que el padre está
  // moviendo o guardando.
  const sv = cfg?.volume;
  useEffect(() => {
    if (!sv) return;
    setSaved(sv);
    setDraft((d) => {
      const next = { ...(d ?? sv) };
      for (const r of ROWS) if (pending.current[r.key] === undefined && !saving.current[r.key]) next[r.key] = sv[r.key];
      return next;
    });
  }, [sv]);

  const commit = async (key: Key, value: number) => {
    saving.current[key] = (saving.current[key] ?? 0) + 1;
    try {
      const r = await parentCall(api.parentVolume({ [key]: value } as Partial<ParentVolume>, member));
      saving.current[key] = Math.max(0, (saving.current[key] ?? 1) - 1);
      publishLimits(r, member); // rige ya donde ese chico es el usuario activo (esta pestaña y las otras del navegador)
      savedTouchingPreset(member, { volume: r, preset: null });
      if (!alive.current) return;
      setSaved(r);
      setDraft((d) => (d ? { ...d, [key]: r[key] } : r));
      const v = r[key];
      setStatus((s) => ({ ...s, [key]: { kind: 'saved', text: v >= 100 ? 'Guardado: sin tope.' : `Guardado: ya rige el tope de ${v}.` } }));
      clearTimeout(clearers.current[key]);
      clearers.current[key] = setTimeout(() => { if (alive.current) setStatus((s) => ({ ...s, [key]: null })); }, 4000);
    } catch (e) {
      saving.current[key] = Math.max(0, (saving.current[key] ?? 1) - 1);
      if (!alive.current) return;
      setDraft((d) => (d && saved ? { ...d, [key]: saved[key] } : d));
      setStatus((s) => ({ ...s, [key]: { kind: 'error', text: rejectedReason(e) ?? 'No se pudo guardar. Probá de nuevo.' } }));
    }
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    alive.current = true;
    const t = timers.current, c = clearers.current, p = pending.current;
    return () => {
      alive.current = false;
      Object.values(c).forEach((x) => clearTimeout(x));
      // commitRef.current es el de ESTE montaje: lleva su `member` (el remonte por integrante lo garantiza)
      for (const k of Object.keys(p) as Key[]) { clearTimeout(t[k]); void commitRef.current(k, p[k]!); delete p[k]; }
    };
  }, []);

  const change = (key: Key, value: number) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setStatus((s) => ({ ...s, [key]: null }));
    pending.current[key] = value;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => { delete pending.current[key]; void commit(key, value); }, SAVE_MS);
  };
  const reset = () => { for (const r of ROWS) if (draft && draft[r.key] !== 100) change(r.key, 100); };

  return (
    <section className="pz-panel" aria-labelledby="pz-lim-h">
      <header className="pz-panel-head pz-panel-head--act">
        <div>
          <h3 id="pz-lim-h">Límites de volumen</h3>
          <p>Hasta dónde puede subir {kid} el sonido de fondo. Es un techo: por debajo elige {kid}; si sonaba más fuerte, baja en el acto.</p>
        </div>
        {draft && (draft.maxMusic < 100 || draft.maxNoise < 100) && (
          <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" onClick={reset}>Quitar los topes</button>
        )}
      </header>
      {!draft ? <PanelState failed={failed} onRetry={() => void reload()} /> : (
        <ul className="pz-lims">
          {ROWS.map((r) => {
            const v = draft[r.key];
            const st = status[r.key] ?? null;
            return (
              <li key={r.key} className="pz-lim" data-limit={r.key}>
                <div className="pz-lim-top">
                  <label className="pz-lim-name" htmlFor={`pz-lim-${r.key}`}>{r.name}</label>
                  <output className="pz-lim-val" htmlFor={`pz-lim-${r.key}`}>{v >= 100 ? 'Sin tope' : `Hasta ${v}`}</output>
                </div>
                <p className="pz-lim-desc" id={`pz-lim-${r.key}-d`}>{r.desc(kid)}</p>
                <input id={`pz-lim-${r.key}`} className="pz-range" type="range" min={0} max={100} step={5} value={v}
                  style={{ '--pz-fill': `${v}%` } as CSSProperties}
                  aria-describedby={`pz-lim-${r.key}-d`} aria-valuetext={v >= 100 ? 'Sin tope' : `Hasta ${v} de 100`}
                  onChange={(e) => change(r.key, Number(e.target.value))} />
                <VolumePreview kid={kid} cap={v} what={r.what} />
                <p className={`pz-lim-msg${st?.kind === 'error' ? ' is-err' : ''}`} role="status">{st?.text ?? ''}</p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="pz-foot">El video que {kid} mira en pantalla completa sigue con su propio control de volumen.</p>
    </section>
  );
}
