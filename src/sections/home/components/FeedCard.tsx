import type { ReactNode } from 'react';
import { LessButton, WhyChip } from './FeedBits';

/** La familia de la card: da el acento del ícono del eyebrow y de la miniatura (paleta de secciones de Innerith). */
export type Family = 'video' | 'lectura' | 'ruta' | 'amigos';

/** Card ESTÁNDAR del hilo (estilo A del mock v6): eyebrow (CHIP de la familia con su ícono y su color + "hace X" + ✕ "ver
 *  menos") → cuerpo (media + título + meta) → pie (UNA acción + el "por qué" abajo a la derecha, FEED-3). `link` = la acción se estira a toda la card (se
 *  toca en cualquier lado; el ✕, el "por qué" y las reacciones quedan por encima). Borde fino, radio generoso y una sombra
 *  apenas (tanda V2 "la media manda"). `extra` = lo que la card suma debajo del meta (el copete de una lectura, el avance de
 *  una ruta): la card estándar no sabe de cada tipo. El DOM es el mismo para todas: cómo se acomoda (la media en columna
 *  en escritorio, apilada en el teléfono) lo decide home.css por familia. Pura. */
export function FeedCard({ family, icon, label, time, reason, whyIcon, thumb, title, meta, extra, action, link, onLess }: {
  family: Family; icon: ReactNode; label: string; time: string;
  reason?: string; whyIcon?: ReactNode;
  thumb: ReactNode; title: ReactNode; meta?: ReactNode; extra?: ReactNode;
  action?: ReactNode; link?: boolean; onLess?: () => void;
}) {
  return (
    <article className={`hf-card${link ? ' is-link' : ''}`} data-fam={family}>
      <div className="hf-eb">
        <span className="hf-eb-chip">
          <span className="hf-eb-ic" aria-hidden="true">{icon}</span>
          <span className="hf-eb-fam">{label}</span>
        </span>
        <span className="hf-eb-time">{time}</span>
        <span className="hf-sp" />
        {onLess && <LessButton onClick={onLess} />}
      </div>
      <div className="hf-bd">
        {thumb}
        <div className="hf-txt">
          <h3 className="hf-ti">{title}</h3>
          {meta && <p className="hf-mt">{meta}</p>}
          {extra}
        </div>
      </div>
      {/* FEED-3: la acción a la izquierda y el «por qué» SIEMPRE abajo a la derecha (home.css lo empuja con margin-left
          auto: si el pie no entra en un renglón, baja solo y sigue a la derecha) */}
      <div className="hf-ft">
        {action}
        {reason && <WhyChip reason={reason} icon={whyIcon} />}
      </div>
    </article>
  );
}
