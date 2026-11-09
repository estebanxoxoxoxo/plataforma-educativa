import { useEffect, useRef, useState } from 'react';
import { FeatureRow, type RowStatus } from '../cards/FeatureRow';
import { rejectedReason } from '../lib/adultGate';
import { saveFeature, type FeatureKey } from '../lib/features';
import { savedTouchingPreset, useMemberConfig } from '../lib/memberConfig';
import { L } from '../../../shared/lib/lang';

/** Los cuatro grandes on-off, con UNA línea de descripción cada uno (audio 66: "configurar hoy es un
 *  infierno: tienen que ser grandes on-off"). */
// i18n: función (no constante de módulo) para que L() resuelva con el idioma actual.
const COPY = (): { key: FeatureKey; label: string; desc: string }[] => [
  { key: 'tienda', label: L('Tienda y Energy Coins', 'Store and Energy Coins'), desc: L('Energy Coins y premios para canjear.', 'Energy Coins and rewards to redeem.') },
  { key: 'ligas', label: L('Ligas', 'Leagues'), desc: L('Competencia semanal con chicos de su nivel.', 'A weekly competition with kids at their level.') },
  { key: 'amigos', label: L('Amigos', 'Friends'), desc: L('Mensajes con amigos, solicitudes y búsqueda de personas.', 'Messages with friends, requests and people search.') },
  { key: 'chat', label: L('Chat', 'Chat'), desc: L('Preguntas y búsquedas conversando con el asistente de IA.', 'Questions and searches by talking with the AI assistant.') },
];

/** Panel "Funcionalidades" del integrante `member` (U3: los on-off de SU config, de lib/memberConfig.ts): cada cambio se
 *  guarda al instante (POST ?member) y su menú cambia en el acto (ver lib/features.ts). El switch muestra enseguida el valor
 *  elegido mientras se guarda; si el server falla, vuelve al valor real y lo avisa. */
export function FeaturesPanel({ kid, member }: { kid: string; member: string }) {
  const { cfg, failed, reload } = useMemberConfig(member);
  const features = cfg?.features ?? null;
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
      const f = await saveFeature(key, on, member);
      savedTouchingPreset(member, { features: f }); // lo que guardó el server (y Presets se entera si el preset dejó de regir)
      if (!alive.current) return;
      setStatus((s) => ({ ...s, [key]: { kind: 'saved', text: on ? L(`Guardado: ya está en el menú de ${kid}.`, `Saved: it’s now in ${kid}’s menu.`) : L(`Guardado: ya no está en el menú de ${kid}.`, `Saved: it’s no longer in ${kid}’s menu.`) } }));
      timers.current[key] = setTimeout(() => { if (alive.current) setStatus((s) => ({ ...s, [key]: null })); }, 4000);
    } catch (e) {
      if (!alive.current) return;
      setStatus((s) => ({ ...s, [key]: { kind: 'error', text: rejectedReason(e) ?? L('No se pudo guardar. Probá de nuevo.', 'Couldn’t save. Try again.') } }));
    } finally {
      if (alive.current) setPending((p) => { const n = { ...p }; delete n[key]; return n; });
    }
  };

  return (
    <section className="pz-panel" aria-labelledby="pz-feat-h">
      <header className="pz-panel-head">
        <h3 id="pz-feat-h">{L('Funcionalidades', 'Features')}</h3>
        <p>{L(`Prendé o apagá partes enteras de Smarty. Lo que está apagado no existe para ${kid}: desaparece de su menú y no se puede abrir.`, `Turn whole parts of Smarty on or off. Whatever is off doesn’t exist for ${kid}: it disappears from their menu and can’t be opened.`)}</p>
      </header>
      {!features && failed && (
        <div className="pz-fail" role="alert">
          <p>{L('No pude leer la configuración actual.', 'I couldn’t read the current settings.')}</p>
          <button type="button" className="pz-btn pz-btn--ghost" onClick={() => void reload()}>{L('Reintentar', 'Retry')}</button>
        </div>
      )}
      <ul className="pz-feats">
        {COPY().map((f) => (
          <FeatureRow key={f.key} id={f.key} label={f.label} desc={f.desc}
            on={features ? features[f.key] : undefined} pending={pending[f.key] ?? null} status={status[f.key] ?? null}
            onToggle={(on) => void toggle(f.key, on)} />
        ))}
      </ul>
      <p className="pz-note">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="6.2" r="1.1" fill="currentColor" /></svg>
        {L(`Los cambios se aplican al instante en la cuenta de ${kid}; no tocan la de los demás integrantes.`, `Changes apply instantly to ${kid}’s account; they don’t affect the other members.`)}
      </p>
    </section>
  );
}
