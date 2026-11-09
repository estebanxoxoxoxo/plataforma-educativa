import { IcUpLine } from './feedIcons';
import { L } from '../../../shared/lib/lang';

/** Píldora "N novedades ↑" (mock v6): el server avisó que hay cosas nuevas y NO entran solas — entran arriba cuando el
 *  chico la toca. `count` null = genérica ("Novedades ↑", tras el cierre de liga). Pura. */
export const NewsPill = ({ count, busy, onClick }: { count: number | null; busy: boolean; onClick: () => void }) => (
  <button type="button" className="hf-pill" disabled={busy} onClick={onClick}
    aria-label={L(
      `${count === null ? 'Hay novedades' : `${count} ${count === 1 ? 'novedad' : 'novedades'}`}: tocá para verlas arriba`,
      `${count === null ? 'There’s news' : `${count} ${count === 1 ? 'new post' : 'new posts'}`}: tap to see them at the top`,
    )}>
    {count === null ? L('Novedades', 'News') : L(`${count} ${count === 1 ? 'novedad' : 'novedades'}`, `${count} ${count === 1 ? 'new post' : 'new posts'}`)}
    <IcUpLine />
  </button>
);
