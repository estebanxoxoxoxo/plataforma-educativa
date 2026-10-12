import { IcUpLine } from './feedIcons';

/** Píldora "N novedades ↑" (mock v6): el server avisó que hay cosas nuevas y NO entran solas — entran arriba cuando el
 *  chico la toca. `count` null = genérica ("Novedades ↑", tras el cierre de liga). Pura. */
export const NewsPill = ({ count, busy, onClick }: { count: number | null; busy: boolean; onClick: () => void }) => (
  <button type="button" className="hf-pill" disabled={busy} onClick={onClick}
    aria-label={`${count === null ? 'Hay novedades' : `${count} ${count === 1 ? 'novedad' : 'novedades'}`}: tocá para verlas arriba`}>
    {count === null ? 'Novedades' : `${count} ${count === 1 ? 'novedad' : 'novedades'}`}
    <IcUpLine />
  </button>
);
