import type { ReactNode } from 'react';
import { ContactRequestCard } from '../cards/ContactRequestCard';
import type { Highlight } from '../lib/highlights';

/** Zona PINNEADA del Feed (tanda F2): la franja de notificaciones destacadas que va ARRIBA del stream, fija mientras haya
 *  algo que responder. Una lista pensada para crecer (lib/highlights.ts): cada destacado dibuja su tarjeta según su
 *  `kind`. Cada uno se pliega al irse y, cuando se van todos, se pliega la zona entera (el contenedor la desmonta al
 *  terminar: sin destacados no hay caja). `hero` (pedido 14-oct): el "Fijado · tu siguiente paso" del feed vive ACÁ
 *  ADENTRO como primer destacado — con hero la zona nunca se pliega. Pura por props. */
export function PinnedZone({ hero, items, onAccept, onDecline }: {
  /** La tarjeta "tu siguiente paso" del feed (FeedNextCard), ya armada por el contenedor. */
  hero?: ReactNode;
  items: Highlight[]; onAccept: (h: Highlight) => void; onDecline: (h: Highlight) => void;
}) {
  const leaving = !hero && items.length > 0 && items.every((h) => h.phase === 'out');
  const live = items.filter((h) => h.phase !== 'out').length + (hero ? 1 : 0);
  return (
    <section className={`fpin${leaving ? ' out' : ''}`} aria-label="Destacados">
      <div className="fpin-clip">
        <div className="fpin-box">
          <h3 className="fpin-head"><span aria-hidden="true">📌</span>{live > 1 ? 'Destacados' : 'Destacado'}</h3>
          <ul className="fpin-list">
            {hero && (
              <li className="fpin-item">
                <div className="fpin-iclip">{hero}</div>
              </li>
            )}
            {items.map((h) => (
              <li key={h.key} className={`fpin-item${h.phase === 'out' ? ' out' : ''}`}>
                <div className="fpin-iclip">
                  {h.kind === 'contact' && (
                    <ContactRequestCard r={h.req} phase={h.phase} accepted={h.accepted} onAccept={() => onAccept(h)} onDecline={() => onDecline(h)} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
