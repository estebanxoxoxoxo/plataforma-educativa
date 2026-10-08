import { useEffect, useRef, useState } from 'react';
import { FeatureRow, type RowStatus } from '../cards/FeatureRow';
import { refreshFeatures, saveFeature, useFeaturesStatus, type FeatureKey } from '../lib/features';

/** Los cuatro grandes on-off, con UNA línea de descripción cada uno (audio 66: "configurar hoy es un
 *  infierno: tienen que ser grandes on-off"). */
const COPY: { key: FeatureKey; label: string; desc: string }[] = [
  { key: 'tienda', label: 'Tienda y Energy Coins', desc: 'Energy Coins y premios para canjear.' },
  { key: 'ligas', label: 'Ligas', desc: 'Competencia semanal con chicos de su nivel.' },
  { key: 'amigos', label: 'Amigos', desc: 'Lista de amigos y mensajes directos.' },
  { key: 'chat', label: 'Chat', desc: 'Preguntas y búsquedas conversando con el asistente de IA.' },
];

/** Panel "Funcionalidades": cada cambio se guarda al instante (POST) y el menú del chico cambia en el
 *  acto (ver lib/features.ts). El switch muestra enseguida el valor elegido mientras se guarda; si el
 *  server falla, vuelve al valor real y lo avisa. */
export function FeaturesPanel({ kid }: { kid: string }) {
  const { features, failed } = useFeaturesStatus();
  const [pending, setPending] = useState<Partial<Record<FeatureKey, boolean>>>({});
  const [status, setStatus] = useState<Partial<Record<FeatureKey, RowStatus>>>({});
  const timers = useRef<Partial<Record<FeatureKey, ReturnType<typeof setTimeout>>>>({});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const t = timers.current;
    return () => { alive.current = false; Object.values(t).forEach((x) => clearTimeout(x)); };
  }, []);

  const toggle = async (key: FeatureKey, on: boolean) => {
    clearTimeout(timers.current[key]);
    setStatus((s) => ({ ...s, [key]: null }));
    setPending((p) => ({ ...p, [key]: on }));
    try {
      await saveFeature(key, on);
      if (!alive.current) return;
      setStatus((s) => ({ ...s, [key]: { kind: 'saved', text: on ? `Guardado: ya está en el menú de ${kid}.` : `Guardado: ya no está en el menú de ${kid}.` } }));
      timers.current[key] = setTimeout(() => { if (alive.current) setStatus((s) => ({ ...s, [key]: null })); }, 4000);
    } catch {
      if (!alive.current) return;
      setStatus((s) => ({ ...s, [key]: { kind: 'error', text: 'No se pudo guardar. Probá de nuevo.' } }));
    } finally {
      if (alive.current) setPending((p) => { const n = { ...p }; delete n[key]; return n; });
    }
  };

  return (
    <section className="pz-panel" aria-labelledby="pz-feat-h">
      <header className="pz-panel-head">
        <h3 id="pz-feat-h">Funcionalidades</h3>
        <p>Prendé o apagá partes enteras de Innerith. Lo que está apagado no existe para {kid}: desaparece de su menú y no se puede abrir.</p>
      </header>
      {!features && failed && (
        <div className="pz-fail" role="alert">
          <p>No pude leer la configuración actual.</p>
          <button type="button" className="pz-btn pz-btn--ghost" onClick={() => void refreshFeatures()}>Reintentar</button>
        </div>
      )}
      <ul className="pz-feats">
        {COPY.map((f) => (
          <FeatureRow key={f.key} id={f.key} label={f.label} desc={f.desc}
            on={features ? features[f.key] : undefined} pending={pending[f.key] ?? null} status={status[f.key] ?? null}
            onToggle={(on) => void toggle(f.key, on)} />
        ))}
      </ul>
      <p className="pz-note">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="6.2" r="1.1" fill="currentColor" /></svg>
        Los cambios se aplican al instante en la cuenta de {kid}.
      </p>
    </section>
  );
}
