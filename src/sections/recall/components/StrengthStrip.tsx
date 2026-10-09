import type { RecallLevel } from '../../../api/types';
import { LEVEL, plural } from '../lib/levels';

/** Tira de estado: cuántas cartas hay flojas / mejorando / firmes, la proporción en una barra y la racha de repaso. */
export function StrengthStrip({ weak, improving, firm, total, streak }: { weak: number; improving: number; firm: number; total: number; streak: number }) {
  const rows: [RecallLevel, number][] = [['floja', weak], ['mejorando', improving], ['firme', firm]];
  return (
    <section className="rc-strip" aria-label="Cómo vienen tus cartas">
      {rows.map(([lv, n]) => (
        <div key={lv} className={`rc-stat rc-stat--${lv}`}>
          <b>{n}</b>
          <span><i aria-hidden="true" />{LEVEL[lv].many}</span>
          <small>{LEVEL[lv].hint}</small>
        </div>
      ))}
      <div className="rc-stat rc-stat--streak">
        <b><span aria-hidden="true">🔥</span>{streak}</b>
        <span>{streak === 1 ? 'Día de racha' : 'Días de racha'}</span>
        <small>{streak > 0 ? 'repasando seguido' : 'arrancá hoy'}</small>
      </div>
      {total > 0 && (
        <div className="rc-dist" role="img" aria-label={`${plural(total, 'dato', 'datos')}: ${weak} flojas, ${improving} mejorando y ${firm} firmes`}>
          <div className="rc-dist-bar">
            {rows.map(([lv, n]) => n > 0 && <i key={lv} className={`rc-dist--${lv}`} style={{ flexGrow: n }} />)}
          </div>
          <small>{plural(total, 'dato', 'datos')} que estás afianzando</small>
        </div>
      )}
    </section>
  );
}
