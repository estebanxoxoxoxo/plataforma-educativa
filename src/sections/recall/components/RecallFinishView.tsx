import type { RecallFinish } from '../../../api/types';
import { IcArrowRight, IcCheck } from '../../../shared/components/icons';
import { finishMessage, plural } from '../lib/levels';
import { LevelBadge } from './LevelBadge';

/** Resumen al terminar el mazo: aciertos, cuántas cartas subieron de nivel, lo ganado y cómo quedó cada una.
 *  `upIds` = cartas que el chico vio subir de nivel en esta pantalla (para marcarlas con ▲). */
export function RecallFinishView({ finish, extra, coinOn, upIds, onBack }: {
  finish: RecallFinish; extra: boolean; coinOn: boolean; upIds: Set<number>; onBack: () => void;
}) {
  const perfect = finish.total > 0 && finish.correct === finish.total;
  return (
    <article className="rc-fin" aria-labelledby="rc-fin-t">
      <header className="rc-fin-head">
        <span className={`rc-fin-badge${perfect ? ' rc-fin-badge--gold' : ''}`} aria-hidden="true"><IcCheck /></span>
        <span className="rc-kicker">{extra ? 'Sesión extra' : 'La sesión de hoy'}</span>
        <h2 className="rc-fin-title" id="rc-fin-t">¡Repaso terminado!</h2>
        <p className="rc-fin-msg">{finishMessage(finish.correct, finish.total)}</p>
      </header>

      <dl className="rc-fin-stats">
        <div><dt>Aciertos</dt><dd>{finish.correct}<small>/{finish.total}</small></dd></div>
        <div><dt>Subieron de nivel</dt><dd>{finish.improved}</dd></div>
        {!extra && (
          <div className="rc-fin-prize"><dt>{coinOn ? 'Ganaste' : 'Sumaste'}</dt><dd>+{finish.xpSession}<small>{coinOn ? ' ⚡' : ' XP'}</small></dd></div>
        )}
      </dl>
      {extra && <p className="rc-fin-note">Las sesiones extra no suman {coinOn ? '⚡' : 'puntos'}: son para practicar de más.</p>}

      <h3 className="rc-fin-sub">Cómo quedaron tus cartas</h3>
      <ul className="rc-fin-list">
        {finish.facts.map((f) => (
          <li key={f.id} className="rc-fin-row">
            <span className={`rc-fin-mark${upIds.has(f.id) ? ' on' : ''}`} aria-label={upIds.has(f.id) ? 'Subió de nivel' : undefined}>{upIds.has(f.id) ? '▲' : ''}</span>
            <div className="rc-fin-txt"><b>{f.statement}</b><small>{f.course}</small></div>
            <LevelBadge level={f.level} />
          </li>
        ))}
      </ul>

      <footer className="rc-fin-act">
        <span>{plural(finish.total, 'carta repasada', 'cartas repasadas')}</span>
        <button className="rc-start" onClick={onBack}>Volver a Repasar<IcArrowRight /></button>
      </footer>
    </article>
  );
}
