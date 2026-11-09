import type { ReactNode } from 'react';
import { IcSpark } from '../../../shared/components/icons';
import { L } from '../../../shared/lib/lang';

/** Cabecera del Feed v6 (adaptación nuestra del mock): el saludo de Smarty, debajo la franja del día ("Lunes a la tarde
 *  · lo más nuevo primero") y a la derecha la racha SIN presión (✨ N) y el chip de demo (regla 9). Pura. */
export function FeedHead({ name, day, streak, demo }: { name: string; day: string; streak: number | null; demo?: ReactNode }) {
  return (
    <header className="hf-head">
      <div className="hf-head-txt">
        <h2 className="h2">{L('Hola', 'Hi')}, {name} 👋</h2>
        <p className="hf-day">{day} · {L('lo más nuevo primero', 'newest first')}</p>
      </div>
      <div className="hf-head-side">
        {streak !== null && streak > 0 && (
          <span className="hf-streak" title={L('Tu racha, sin presión', 'Your streak, no pressure')}>
            <IcSpark aria-hidden="true" />
            <span aria-hidden="true">{streak}</span>
            <span className="hf-sr">{L(`Tu racha: ${streak} ${streak === 1 ? 'día' : 'días'}, sin presión`, `Your streak: ${streak} ${streak === 1 ? 'day' : 'days'}, no pressure`)}</span>
          </span>
        )}
        {demo}
      </div>
    </header>
  );
}
