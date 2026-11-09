import type { CSSProperties } from 'react';
import type { Mentor, MentorContract } from '../../../api/types';
import { IcClock } from '../../../shared/components/icons';
import {
  familyIds, forWho, ratingLabel, slotsEvery, teachesWho, usd, type People,
} from '../../../shared/lib/mentors';
import { L } from '../../../shared/lib/lang';

/** Un mentor en Buscar → Mentores (solo el adulto): el emoji de su materia sobre su color, nombre, materia y calificación,
 *  la línea de quién es, el precio por hora bien visible y, por cada contrato de la familia, su estado con el nombre del
 *  beneficiario — "Da clases a Ian · los miércoles a las 17:00" o "Pagado para vos · falta elegir los días" (con
 *  "Elegir los días", que reabre la agenda del post-compra). "Contratar" abre la hoja; si ya hay contrato para toda la
 *  familia no hay nada que contratar. Pura: las acciones las resuelve el contenedor (data-smn-act / data-smn-agenda: ahí
 *  vuelve el foco al cerrar la hoja). */
export function MentorCard({ m, me, people, onHire, onSchedule }: {
  m: Mentor;
  /** El adulto activo. */ me: string;
  people: People;
  onHire: () => void;
  onSchedule: (c: MentorContract) => void;
}) {
  const family = familyIds(me, people);
  const free = family.some((id) => !m.contracts.some((c) => c.beneficiary === id));
  // Los contratos en el orden de la familia (primero el adulto, después sus dependientes).
  const lines = [...m.contracts].sort((a, b) => family.indexOf(a.beneficiary) - family.indexOf(b.beneficiary));
  return (
    <li className={`smn-card${lines.length ? ' is-hired' : ''}`} data-mentor={m.id}>
      <span className="smn-emo" style={{ '--mc': m.color } as CSSProperties} aria-hidden="true">{m.emoji}</span>
      <div className="smn-main">
        <h3 className="smn-name">{m.name}</h3>
        <p className="smn-sub">
          <span>{m.subject}</span>
          <span className="smn-rate">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.9l2.45 5.1 5.6.75-4.08 3.9 1 5.55L10 14.55 5.03 17.2l1-5.55-4.08-3.9 5.6-.75z" fill="currentColor" /></svg>
            <span aria-hidden="true">{ratingLabel(m.rating)}</span>
            <span className="smn-sr">{L(`Calificación ${ratingLabel(m.rating)} de 5`, `Rated ${ratingLabel(m.rating)} out of 5`)}</span>
          </span>
        </p>
        <p className="smn-bio">{m.bio}</p>
        {lines.length > 0 && (
          <ul className="smn-states">
            {lines.map((c) => (
              <li key={c.id} className={`smn-state is-${c.status}`} data-contract={c.id} data-status={c.status}>
                {c.status === 'active' ? (
                  <>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l2.9 2.9 6.1-6.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span>{teachesWho(c.beneficiary, me, people)} · {slotsEvery(c.slots)}</span>
                  </>
                ) : (
                  <>
                    <IcClock />
                    <span>{L(`Pagado ${forWho(c.beneficiary, me, people)} · falta elegir los días`, `Paid ${forWho(c.beneficiary, me, people)} · days still to pick`)}</span>
                    <button type="button" className="smn-btn smn-btn--ghost smn-btn--sm" data-smn-agenda
                      aria-label={L(`Elegir los días de ${m.subject} ${forWho(c.beneficiary, me, people)}`, `Pick the days for ${m.subject} ${forWho(c.beneficiary, me, people)}`)} onClick={() => onSchedule(c)}>{L('Elegir los días', 'Pick the days')}</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="smn-side">
        <p className="smn-price"><b>{usd(m.pricePerHour)}</b> {L('la hora', 'per hour')}</p>
        {free ? (
          <button type="button" className="smn-btn" data-smn-act aria-label={L(`Contratar a ${m.name}`, `Hire ${m.name}`)} onClick={onHire}>{L('Contratar', 'Hire')}</button>
        ) : (
          <span className="smn-full">{L('Ya contratado para toda tu familia', 'Already hired for your whole family')}</span>
        )}
      </div>
    </li>
  );
}
