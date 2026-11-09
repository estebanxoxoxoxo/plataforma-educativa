import { useEffect, useId, useRef, type CSSProperties } from 'react';
import type { FamilyCloseResult } from '../../../api/types';
import { IcCoin, IcArrowRight, IcClose } from '../../../shared/components/icons';
import { closesLabel } from '../lib/cycle';
import { familyCloseCopy } from '../lib/familyWeek';
import { L } from '../../../shared/lib/lang';

/** Las chispas del festejo (los mismos colores del aviso del cierre de liga). */
const SPARKS = ['#F2A81D', '#3A5BD9', '#13A39A', '#E5487A', '#8A5CF5', '#F26B3A', '#FFC23D', '#18A957'];

/** U5 (§2.6): el aviso que ve el ADULTO que apretó "Simular cierre de la semana de la familia" (patrón de CloseBanner: arriba
 *  del hero, festejo chico y de una sola vez, foco al título). Cuenta la copa, las marcas alcanzables de cada uno, la línea
 *  cooperativa, el premio (a quién le toca: lo ve en Familia → Premios para darlo) y una línea de SU liga pública, que cerró
 *  con la de todos (el closeCopy de siempre). Sin puestos ni "último". Puro: todo sale de `r` (lo que devolvió el server).
 *  `coins` = la Tienda está prendida para quien mira (si no, las Energy Coins no se nombran). */
export function FamilyCloseBanner({ r, meId, coins, onDismiss, onFeed }: {
  r: FamilyCloseResult; meId?: string; coins: boolean; onDismiss: () => void; onFeed: () => void;
}) {
  const c = familyCloseCopy(r, meId);
  const won = r.closed.rows.some((x) => x.marks.includes('gano'));
  const prizeWon = !!r.closed.prize?.winners.length;
  const id = useId();
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [r]);
  const days = r.mine.next.closesInDays;
  return (
    <section className="lgx" data-cup={won || undefined} aria-labelledby={id}>
      <div className="lgx-art" aria-hidden="true">
        <span className="lgx-cup">{won ? '🏆' : '🤝'}</span>
        {won && <span className="lgx-burst">{SPARKS.map((col, i) => <i key={col} style={{ '--c': col, '--a': `${i * 45}deg` } as CSSProperties} />)}</span>}
      </div>
      <div className="lgx-body">
        <h3 className="lgx-t" id={id} ref={head} tabIndex={-1}>{c.title}</h3>
        {c.cup && <p className="lgx-p">{c.cup}</p>}
        {c.marks.length > 0 && (
          <ul className="lgx-marks" aria-label={L('Lo que logró cada uno', 'What each person achieved')}>
            {c.marks.map((m) => <li key={m.id}><b>{m.name}</b> {m.text}</li>)}
          </ul>
        )}
        <p className="lgx-total">{c.total}</p>
        {c.prize && (
          <p className="lgx-prize">
            {c.prize}
            {prizeWon && <span className="lgx-prize-n">{L(' · Lo ves en Familia → Premios para marcarlo cuando se lo des.', ' · You’ll find it in Family → Prizes to mark it once you give it.')}</span>}
          </p>
        )}
        <p className="lgx-note">
          {c.mine} {L('Arrancó la semana nueva: la XP de todos vuelve a 0', 'A new week started: everyone’s XP goes back to 0')}{coins && <> {L('y las', 'and the')} <IcCoin className="ec-coin" aria-hidden="true" />{' '}Energy Coins {L('siguen en cada billetera', 'stay in each wallet')}</>}. {closesLabel(days)}{days > 0 && '.'}
        </p>
        {r.mine.feedAdded > 0 && <button type="button" className="lgx-go" onClick={onFeed}>{L('Ver las novedades del cierre en el Feed', 'See the week’s results in the Feed')}<IcArrowRight /></button>}
      </div>
      <button type="button" className="lgx-x" onClick={onDismiss} aria-label={L('Cerrar el aviso del cierre de la familia', 'Close the family week-end notice')}><IcClose /></button>
    </section>
  );
}
