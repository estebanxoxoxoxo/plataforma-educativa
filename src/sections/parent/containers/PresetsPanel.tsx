import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { ParentConfig, ParentFeatures } from '../../../api/types';
import { PresetCard } from '../cards/PresetCard';
import { PanelState } from '../components/PanelState';
import { parentCall } from '../lib/adultGate';
import { adoptFeatures, useFeaturesStatus } from '../lib/features';
import { FEATURE_LABEL, FEATURE_ORDER, listEs, quoted } from '../lib/format';
import { publishLimits } from '../lib/limits';
import type { PresetView } from '../lib/types';

type Data = { presets: PresetView[]; current: string | null };
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const volText = (v: { maxMusic: number; maxNoise: number }) =>
  v.maxMusic >= 100 && v.maxNoise >= 100 ? 'sin topes' : `música hasta ${v.maxMusic} y ruidos hasta ${v.maxNoise}`;

/** Qué cambiaría al aplicar el preset `p` sobre la configuración actual, en palabras (para la confirmación). */
function changesFor(p: PresetView, f: ParentFeatures | null, c: ParentConfig | null): string[] {
  const s = p.spec;
  if (!s || !f || !c) return ['Reemplaza las funcionalidades, los temas, las palabras de la familia y los topes de volumen.'];
  const out: string[] = [];
  const on = FEATURE_ORDER.filter((k) => s.features[k] && !f[k]).map((k) => FEATURE_LABEL[k]);
  const off = FEATURE_ORDER.filter((k) => !s.features[k] && f[k]).map((k) => FEATURE_LABEL[k]);
  if (off.length) out.push(`Se apaga${off.length > 1 ? 'n' : ''}: ${listEs(off)}.`);
  if (on.length) out.push(`Se prende${on.length > 1 ? 'n' : ''}: ${listEs(on)}.`);
  for (const [k, label] of [['white', 'sugerencias'], ['black', 'temas que no tienen que aparecer']] as const) {
    if (sameSet(s.topics[k], c.topics[k])) continue;
    const gone = c.topics[k].filter((t) => !s.topics[k].includes(t));
    out.push(s.topics[k].length ? `${label[0].toUpperCase()}${label.slice(1)}: quedan ${quoted(s.topics[k])}${gone.length ? ` (salen ${quoted(gone)})` : ''}.`
      : `Se borran tus ${label}: ${quoted(gone)}.`);
  }
  if (!sameSet(s.words, c.words.extra)) {
    const gone = c.words.extra.filter((w) => !s.words.includes(w));
    out.push(s.words.length ? `Palabras de la familia: quedan ${quoted(s.words)}.` : `Se borran tus palabras bloqueadas: ${quoted(gone)}.`);
  }
  if (s.volume.maxMusic !== c.volume.maxMusic || s.volume.maxNoise !== c.volume.maxNoise) out.push(`Volumen: ${volText(s.volume)}.`);
  return out.length ? out : ['No cambia nada: la configuración ya es esta.'];
}

/** Presets (audios 56 y 66: "grandes presets, no mil detalles"): puntos de partida que dejan configurado de una vez lo
 *  que existe —on-off, temas, palabras de la familia y topes de volumen—. Aplicar reemplaza la configuración (se
 *  confirma diciendo qué cambia); después se ajusta lo que se quiera y el preset deja de figurar como aplicado. */
export function PresetsPanel({ kid }: { kid: string }) {
  const { features } = useFeaturesStatus(); // la config REAL del padre (useFeatures() es lo que rige para el adulto activo: todo prendido)
  const [data, setData] = useState<Data | null>(null);
  const [cfg, setCfg] = useState<ParentConfig | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; err?: boolean } | null>(null);
  const alive = useRef(true);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setFailed(false);
    try {
      const [p, c] = await Promise.all([parentCall(api.parentPresets()), parentCall(api.parentConfig())]);
      if (!alive.current || my !== seq.current) return;
      setData({ presets: p.presets as PresetView[], current: p.current });
      setCfg(c);
    } catch { if (alive.current && my === seq.current) setFailed(true); }
  }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Al montar y cada vez que cambian los on-off (el panel de abajo, otra pestaña): un cambio a mano deja el preset sin
  // aplicar, y la tarjeta tiene que decirlo.
  const fKey = features ? FEATURE_ORDER.map((k) => (features[k] ? 1 : 0)).join('') : '';
  useEffect(() => { void load(); }, [load, fKey]);
  useEffect(() => {
    if (!notice || notice.err) return;
    const t = setTimeout(() => setNotice((n) => (n === notice ? null : n)), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  const apply = async (p: PresetView) => {
    if (applying) return;
    setApplying(p.id);
    setNotice(null);
    try {
      const r = await parentCall(api.applyPreset(p.id));
      if (!r.ok) throw new Error('rechazado');
      adoptFeatures(r.features); // el menú del chico cambia ya (y en las otras pestañas)
      publishLimits(r.config.volume); // y lo que suena respeta los topes nuevos
      if (!alive.current) return;
      setCfg(r.config);
      setData((d) => (d ? { ...d, current: r.config.preset } : d));
      setConfirming(null);
      setNotice({ text: `Listo: «${p.name}» ya se aplica a ${kid}. Podés ajustar lo que quieras abajo y en las otras secciones.` });
    } catch {
      if (alive.current) setNotice({ text: 'No se pudo aplicar el preset. Probá de nuevo.', err: true });
    } finally {
      if (alive.current) setApplying(null);
    }
  };

  const current = data?.presets.find((p) => p.id === data.current) ?? null;
  return (
    <section className="pz-panel" aria-labelledby="pz-pre-h">
      <header className="pz-panel-head">
        <h3 id="pz-pre-h">Presets</h3>
        <p>Puntos de partida para no configurar todo a mano. Aplicar uno deja listas de una vez las funcionalidades, los temas, las palabras de la familia y los topes de volumen; después ajustás lo que quieras.</p>
      </header>
      <p className={`pz-notice${notice?.err ? ' is-err' : ''}${notice ? '' : ' is-empty'}`} role="status">{notice?.text}</p>
      {!data ? <PanelState failed={failed} onRetry={() => void load()} /> : (
        <>
          <p className="pz-preset-now">
            {current ? <>Ahora rige <b>{current.name}</b>.</> : <>Ahora rige una <b>configuración propia</b>: ningún preset aplicado (o se cambió algo a mano después).</>}
          </p>
          <ul className="pz-presets">
            {data.presets.map((p) => (
              <PresetCard key={p.id} p={p} applied={data.current === p.id} confirming={confirming === p.id} busy={applying === p.id}
                changes={confirming === p.id ? changesFor(p, features, cfg) : []}
                onApply={() => { setConfirming(p.id); setNotice(null); }} onConfirm={() => void apply(p)} onCancel={() => setConfirming(null)} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
