import type { ReactNode } from 'react';
import type { ParentAlert } from '../../../api/types';
import { ALERT_TITLE, capFirst, fmtFull, fmtWhen, isoOf } from '../lib/format';

const ICON: Record<ParentAlert['kind'], ReactNode> = {
  crisis: <svg viewBox="0 0 20 20"><path d="M10 2.8l7.6 13.4H2.4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M10 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="14.3" r="1" fill="currentColor" /></svg>,
  contacto: <svg viewBox="0 0 20 20"><path d="M8.2 11.8l3.6-3.6M7 9.4l-1.6 1.6a2.6 2.6 0 0 0 3.6 3.6L10.6 13M13 10.6l1.6-1.6A2.6 2.6 0 0 0 11 5.4L9.4 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>,
  bloqueos: <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M5.2 14.8l9.6-9.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>,
};

/** Un aviso para el padre: qué pasó (el texto ya viene armado por el server; en una crisis trae lo que escribió el chico,
 *  textual —decisión 11-oct—), dónde y cuándo, y "Marcar como visto". `who` (U3: la vista "Toda la familia") = sobre qué
 *  integrante es. Pura. */
export function AlertRow({ a, who, busy, onSeen }: { a: ParentAlert; who: string | null; busy: boolean; onSeen: () => void }) {
  return (
    <li className={`pz-alert pz-alert--${a.kind}${a.seen ? ' is-seen' : ''}`} data-alert={a.id} data-kind={a.kind} data-child={a.childId}>
      <span className="pz-alert-ic" aria-hidden="true">{ICON[a.kind]}</span>
      <div className="pz-alert-main">
        <p className="pz-alert-t">
          {ALERT_TITLE[a.kind]}
          {who && <span className="pz-alert-who">Sobre {who}</span>}
          {!a.seen && <span className="pz-alert-new">Nuevo</span>}
        </p>
        <p className="pz-alert-text">{a.text}</p>
        <p className="pz-alert-meta">{capFirst(a.source)} · <time dateTime={isoOf(a.ts)} title={fmtFull(a.ts)}>{fmtWhen(a.ts)}</time></p>
      </div>
      <div className="pz-alert-act">
        {a.seen ? <span className="pz-alert-seen">Visto</span> : (
          <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={busy} onClick={onSeen}>Marcar como visto</button>
        )}
      </div>
    </li>
  );
}
