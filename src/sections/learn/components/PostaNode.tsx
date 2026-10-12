import type { CSSProperties } from 'react';
import { definitionFor } from '../../../learn/definitions';
import type { Posta, PostaView } from '../lib/learn';
import type { ModuleColor } from '../lib/moduleColors';
import {
  IcBookOpen, IcCheck, IcCircle, IcCircleCheckBig, IcDice3, IcListChecks, IcMonitorPlay, IcRefreshCw, IcShapes, IcStar, IcWalletCards,
  type LearnIcon,
} from './LearnIcons';

/* Nodo del camino de una ruta (PostaNode + Stars de RutaView del POC, mismas reglas y textos; estética de Innerith).
   El estado —lograda/disponible/bloqueada— se comunica por color y titileo, no por el ícono. */

/* Ícono por TIPO de actividad (el estado —lograda/disponible/bloqueada— se comunica por color y
   titileo, no por el ícono). Se resuelve por la Definición de la posta; fallback Circle. */
const ACTIVITY_ICON: Record<string, LearnIcon> = {
  flashcards: IcWalletCards,
  quiz: IcListChecks,
  multiplechoice: IcCircleCheckBig,
  domino: IcDice3,
  multi: IcShapes,
};
function activityIcon(posta: Posta): LearnIcon {
  // El CONTENIDO manda: una posta con lectura/video se ve como su contenido (mirá / leé),
  // no como la actividad de comprensión que lo valida (que hoy es flashcards).
  if (posta.reading?.kind === 'video') return IcMonitorPlay;
  if (posta.reading) return IcBookOpen;
  const typeId = posta.definitionId ? definitionFor(posta.definitionId)?.typeId : undefined;
  return (typeId && ACTIVITY_ICON[typeId]) || IcCircle;
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="ln-stars" aria-label={`${n} de 3 estrellas`}>
      {[0, 1, 2].map((i) => (
        <IcStar key={i} className={i < n ? 'on' : undefined} fill={i < n ? 'currentColor' : 'none'} strokeWidth={1.75} />
      ))}
    </span>
  );
}

/** `index` = posición GLOBAL de la posta en la ruta (el zig-zag alterna por ella); `color` = el del módulo (sin módulo,
 *  el acento del tema). */
export function PostaNode({ view, index, onPlay, color }: { view: PostaView; index: number; onPlay: (p: Posta) => void; color?: ModuleColor }) {
  const { posta, state, stars } = view;
  const offset = index % 2 === 0 ? 'is-l' : 'is-r';
  const locked = state === 'locked';
  const done = state === 'done';

  // Posta de repaso (active recall): nodo distinto (no se "logra"), siempre rejugable.
  if (posta.kind === 'recall') {
    const rStyle: CSSProperties = !locked && color ? { background: color.strong, color: '#fff', boxShadow: `0 0 0 4px ${color.soft}` } : {};
    const rCls = locked ? 'is-locked' : color ? 'is-shadow' : 'is-flat-recall';
    return (
      <div className={`ln-node ${offset}${locked ? ' is-locked' : ''}`} data-state={state} data-kind="recall">
        <button type="button" disabled={locked} onClick={() => onPlay(posta)} aria-label={posta.title} className={`ln-sq ${rCls}`} style={rStyle}>
          <IcRefreshCw strokeWidth={2} />
        </button>
        <span className="ln-nlabel">
          <b className="is-recall">{posta.title}</b>
          {!locked && <small>repaso</small>}
        </span>
      </div>
    );
  }

  // Nodo de actividad, pintado con el color del módulo (o el tema --accent si la posta no tiene módulo).
  let circle = 'is-shadow';
  let circleStyle: CSSProperties = {};
  if (locked) circle = 'is-locked';
  else if (color) {
    if (done) circleStyle = { background: color.strong, color: '#fff' };
    else { circle = 'ln-pulse'; circleStyle = { background: color.band, color: color.ink, boxShadow: `0 0 0 5px ${color.soft}` }; }
  } else {
    circle = done ? 'is-flat-done' : 'is-flat-avail ln-pulse';
  }
  const TypeIcon = activityIcon(posta);
  // Rótulo: una posta de CONTENIDO se anuncia por lo que hay que hacer ("Ver video" / "Lectura"),
  // no por su título de comprensión. Las demás mantienen su título.
  const label = posta.reading ? (posta.reading.kind === 'video' ? 'Ver video' : 'Lectura') : posta.title;
  return (
    <div className={`ln-node ${offset}${locked ? ' is-locked' : ''}`} data-state={state}>
      <button type="button" disabled={locked} onClick={() => onPlay(posta)} aria-label={label} className={`ln-dot ${circle}`} style={circleStyle}>
        <TypeIcon className="ln-ti" strokeWidth={1.9} />
        {done && (
          <span className="ln-check" aria-hidden="true">
            <IcCheck strokeWidth={3} />
          </span>
        )}
      </button>
      <span className="ln-nlabel">
        <b>{label}</b>
        {done && <Stars n={stars} />}
      </span>
    </div>
  );
}
