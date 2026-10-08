import type { CSSProperties } from 'react';
import type { Journey, JourneyItem } from '../../../api/types';
import { IcArrowRight, IcMedal } from '../../../shared/components/icons';
import { TYPES } from '../lib/exerciseTypes';

type Node = Extract<JourneyItem, { kind: 'node' }>;

/** Panel lateral: avance de la unidad, el próximo paso y la referencia de los tipos de práctica. */
export function ProgressPanel({ j, done, onOpen }: { j: Journey; done: number; onOpen: (n: Node) => void }) {
  const nodes = j.items.filter((it): it is Node => it.kind === 'node');
  const total = nodes.length, pct = Math.round((Math.min(done, total) / total) * 100);
  const badges = nodes.filter((n) => n.type === 'trophy'), won = badges.filter((n) => n.n < done).length;
  const xp = nodes.filter((n) => n.n < done).reduce((s, n) => s + n.xp, 0);
  const next = nodes.find((n) => n.n === done);
  const R = 34, C = 2 * Math.PI * R;
  return (
    <aside className="ppanel">
      <section className="pcard">
        <h4>Tu unidad</h4>
        <div className="pring">
          <svg viewBox="0 0 84 84" aria-hidden>
            <circle cx="42" cy="42" r={R} className="rbg" />
            <circle cx="42" cy="42" r={R} className="rfg" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
          </svg>
          <b>{pct}%</b>
        </div>
        <dl className="pstats">
          <div><dt>Pasos</dt><dd>{Math.min(done, total)}/{total}</dd></div>
          <div><dt>XP</dt><dd>{xp}</dd></div>
          <div><dt>Insignias</dt><dd>{won}/{badges.length}</dd></div>
        </dl>
      </section>

      {next && (
        <section className="pcard pnext" style={{ '--c': TYPES[next.type].c, '--soft': TYPES[next.type].soft ?? '#FFF6E0' } as CSSProperties}>
          <h4>Te toca</h4>
          <div className="pnrow">
            <span className="sico">{next.type === 'trophy' ? <IcMedal /> : (() => { const G = TYPES[next.type].G; return <G />; })()}</span>
            <span><small>{next.type === 'trophy' ? 'Insignia' : TYPES[next.type].l}</small><b>{next.type === 'trophy' ? next.badge : next.prompt}</b></span>
          </div>
          <button className="pgo" onClick={() => onOpen(next)}>{next.type === 'trophy' ? 'Reclamar' : 'Empezar'}<IcArrowRight /></button>
        </section>
      )}

      <section className="pcard">
        <h4>Tipos de práctica</h4>
        <ul className="plegend">
          {(['open', 'mc', 'vf'] as const).map((k) => {
            const T = TYPES[k];
            return <li key={k} style={{ '--c': T.c, '--soft': T.soft } as CSSProperties}><span className="sico"><T.G /></span><span><b>{T.l}</b><small>{T.s}</small></span></li>;
          })}
        </ul>
      </section>
    </aside>
  );
}
