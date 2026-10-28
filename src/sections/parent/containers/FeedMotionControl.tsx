import { useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { FeedMotion } from '../../../api/types';
import type { RowStatus } from '../cards/FeatureRow';
import { parentCall, rejectedReason } from '../lib/adultGate';
import { patchMemberConfig, useMemberConfig } from '../lib/memberConfig';

const OPTIONS: { id: FeedMotion; label: string; desc: string }[] = [
  { id: 'calmo', label: 'Calma', desc: 'Casi sin movimiento' },
  { id: 'normal', label: 'Normal', desc: 'Suave, como viene' },
  { id: 'vivo', label: 'Viva', desc: 'Con más vida' },
];

/** "Animación del Feed" (Feed v6; vive en Protecciones): el dial calma / normal / viva del feed del chico. Patrón de los
 *  topes de volumen: se lee de la config (api.parentConfig), se guarda al toque en el server (api.parentFeedMotion →
 *  parent.json) y rige en la próxima carga del feed (viaja en cada respuesta). Si el dispositivo del chico pide menos
 *  movimiento, el feed queda en calma igual.
 *  U3: el dial es del integrante `member` (su config, lib/memberConfig.ts; POST feed-motion?member). No toca el preset. */
export function FeedMotionControl({ kid, member }: { kid: string; member: string }) {
  const { cfg, failed, reload } = useMemberConfig(member);
  const value: FeedMotion | null = cfg ? cfg.feedMotion ?? 'normal' : null;
  const [pending, setPending] = useState<FeedMotion | null>(null);
  const [status, setStatus] = useState<RowStatus>(null);
  const alive = useRef(true);
  const clear = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; clearTimeout(clear.current); };
  }, []);

  const choose = async (m: FeedMotion) => {
    if (pending || m === value) return;
    setPending(m);
    setStatus(null);
    clearTimeout(clear.current);
    try {
      const r = await parentCall(api.parentFeedMotion(m, member));
      patchMemberConfig(member, { feedMotion: r.feedMotion });
      if (!alive.current) return;
      const label = OPTIONS.find((o) => o.id === r.feedMotion)?.label ?? r.feedMotion;
      setStatus({ kind: 'saved', text: `Guardado: el Feed de ${kid} pasa a «${label}» la próxima vez que lo abra.` });
      clear.current = setTimeout(() => { if (alive.current) setStatus(null); }, 5000);
    } catch (e) {
      if (alive.current) setStatus({ kind: 'error', text: rejectedReason(e) ?? 'No se pudo guardar. Probá de nuevo.' });
    }
    if (alive.current) setPending(null);
  };

  const shown = pending ?? value;
  return (
    <section className="pz-block pz-motion" aria-labelledby="pz-motion-h">
      <h4 className="pz-block-h" id="pz-motion-h">Animación del Feed</h4>
      <p className="pz-help" id="pz-motion-d">Cuánto se mueve el Feed de {kid} cuando aparecen cosas nuevas. Si su dispositivo pide menos movimiento, queda en Calma igual.</p>
      {failed && value === null ? (
        <div className="pz-fail"><p>No pude leer la animación del Feed.</p><button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" onClick={() => void reload()}>Reintentar</button></div>
      ) : (
        <fieldset className="pz-seg" aria-describedby="pz-motion-d" aria-busy={pending !== null} disabled={value === null}>
          <legend className="pz-sr">Animación del Feed</legend>
          {OPTIONS.map((o) => (
            <label key={o.id} className={`pz-seg-opt${shown === o.id ? ' is-on' : ''}`} data-motion={o.id}>
              <input type="radio" name="pz-feed-motion" value={o.id} checked={shown === o.id} disabled={pending !== null} onChange={() => void choose(o.id)} />
              <b>{o.label}</b>
              <small>{o.desc}</small>
            </label>
          ))}
        </fieldset>
      )}
      <p className={`pz-lim-msg${status?.kind === 'error' ? ' is-err' : ''}`} role="status">{status?.text ?? ''}</p>
    </section>
  );
}
