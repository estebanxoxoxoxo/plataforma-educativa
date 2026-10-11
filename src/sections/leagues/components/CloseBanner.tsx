import { useEffect, useId, useRef, type CSSProperties } from 'react';
import type { CloseWeekResult } from '../../../api/types';
import { IcArrowRight, IcClose, IcDownSm, IcUpSm } from '../../../shared/components/icons';
import { MEDAL_INFO, closeCopy, closesLabel } from '../lib/cycle';
import { LeagueIcon } from './LeagueIcon';

/** Las chispas del festejo (colores de la paleta de la app). */
const SPARKS = ['#F2A81D', '#3A5BD9', '#13A39A', '#E5487A', '#8A5CF5', '#F26B3A', '#FFC23D', '#18A957'];

/** Aviso del cierre de semana, arriba del hero de Ligas: el resultado congelado, la liga de la semana nueva y que la XP
 *  vuelve a 0. Con medalla, un festejo chico y de una sola vez (la medalla salta y salen ocho chispas); sin medalla,
 *  honesto y con ánimo. Puro: todo sale de `r` (lo que devolvió el server). `coins` = la Tienda está prendida (si la
 *  familia la apagó, las Energy Coins no existen y no se nombran). Al aparecer toma el foco (el botón quedó abajo). */
export function CloseBanner({ r, coins, onDismiss, onFeed }: { r: CloseWeekResult; coins: boolean; onDismiss: () => void; onFeed: () => void }) {
  const c = closeCopy(r);
  const medal = r.closed.medal;
  const move = r.next.movement;
  const id = useId();
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [r]);
  const days = r.next.closesInDays;
  return (
    <section className="lwk" data-medal={medal ?? undefined} aria-labelledby={id}>
      <div className="lwk-art" aria-hidden>
        {medal ? (
          <>
            <span className="lwk-medal">{MEDAL_INFO[medal].emoji}</span>
            <span className="lwk-burst">{SPARKS.map((col, i) => <i key={col} style={{ '--c': col, '--a': `${i * 45}deg` } as CSSProperties} />)}</span>
          </>
        ) : <LeagueIcon color={r.next.league.color} />}
      </div>
      <div className="lwk-body">
        <h3 className="lwk-t" id={id} ref={head} tabIndex={-1}>{c.title}</h3>
        <p className="lwk-p">{c.result}</p>
        <p className="lwk-row">
          <span className="lwk-move" data-move={move}>{move === 'sube' ? <IcUpSm /> : move === 'baja' ? <IcDownSm /> : null}{c.move}</span>
          {c.cheer && <span className="lwk-cheer">{c.cheer}</span>}
        </p>
        <p className="lwk-note">
          Arrancó la semana nueva: tu XP vuelve a 0{coins && <> y tus <span aria-hidden>⚡</span>{'\u00A0'}Energy Coins siguen en tu billetera</>}. {closesLabel(days)}{days > 0 && '.'}
        </p>
        {r.feedAdded > 0 && <button className="lwk-go" onClick={onFeed}>Ver las novedades del cierre en Home<IcArrowRight /></button>}
      </div>
      <button className="lwk-x" onClick={onDismiss} aria-label="Cerrar el aviso del cierre"><IcClose /></button>
    </section>
  );
}
