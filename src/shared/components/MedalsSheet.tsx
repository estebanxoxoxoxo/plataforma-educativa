import { useId, useRef } from 'react';
import type { EarnedMedal } from '../../api/types';
import { useCycle } from '../../sections/parent/lib/cycle';
import { useSheetKeys, useVeil } from '../../sections/store/lib/sheet';
import { sinceText, timesText } from '../lib/medals';
import { IcClose } from './icons';
import { L } from '../lib/lang';

/** La pila "Tus medallas" (U5, spec §5.5b; audio 1016: "la pila como quien muestra un diploma"), sobre el chasis global
 *  `.shov/.shcard`. Una grilla de tarjetas: el emoji en un disco con cinta (CSS, sin assets), el título en la display, el
 *  texto informativo (lo que hiciste, nunca un elogio a la persona), "Desde el 23 de octubre" si el hecho trae fecha, "×3"
 *  si se repitió y la etiqueta "Nueva" en las que todavía no vio. Las cinco reglas de §5.1: SOLO las ganadas, en el orden en
 *  que llegan del server (las más nuevas primero, las sin fecha al final): sin total, sin "faltan", sin siluetas.
 *  `medals`: null = todavía no llegaron (o no se pudieron leer: `failed`). Teclado como las hojas de la casa
 *  (store/lib/sheet: Esc cierra, Tab queda adentro); el fondo también cierra. El contenedor (ProfileCard) la abre, marca
 *  "vistas" y devuelve el foco. El "Desde el…", en la ZONA DE LA FAMILIA (useCycle().tz, la pared de la barra superior;
 *  QA-U5-E: antes, la del navegador). Estilos: medals.css (mdl-). */
export function MedalsSheet({ medals, failed, onRetry, onClose }: {
  medals: EarnedMedal[] | null; failed: boolean; onRetry: () => void; onClose: () => void;
}) {
  const uid = useId();
  const tz = useCycle().tz;
  const card = useRef<HTMLDivElement>(null);
  useSheetKeys(card, medals ? 'list' : failed ? 'failed' : 'loading', false, onClose);
  const veil = useVeil(onClose);
  return (
    <div className="shov mdl-ov" onMouseDown={veil}>
      <div className="shcard mdl-sheet" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`}>
        <div className="mdl-top">
          <div className="mdl-head">
            <h3 className="mdl-title" id={`${uid}-t`}>{L('Tus medallas', 'Your medals')}</h3>
            <p className="mdl-sub" id={`${uid}-d`}>{L('Las que fuiste ganando en Smarty.', "The ones you've earned on Smarty.")}</p>
          </div>
          <button type="button" className="mdl-x" aria-label={L('Cerrar', 'Close')} onClick={onClose}><IcClose /></button>
        </div>
        {medals && medals.length === 0 ? (
          // la lista llegó vacía (p. ej. el candado se apagó con la noticia en pantalla): se dice, sin "0" ni "faltan"
          <p className="mdl-note">{L('Todavía no hay medallas para mostrar.', 'No medals to show yet.')}</p>
        ) : medals ? (
          <ul className="mdl-grid">
            {medals.map((m) => {
              const since = sinceText(m.at, undefined, tz);
              const times = timesText(m.times);
              return (
                <li key={m.id} className={`mdl-card${m.fresh ? ' is-new' : ''}`} data-medal={m.id}>
                  {m.fresh && <span className="mdl-new">{L('Nueva', 'New')}</span>}
                  <span className="mdl-medal" aria-hidden="true"><span className="mdl-disc">{m.emoji}</span></span>
                  <h4 className="mdl-t">
                    {m.title}
                    {times && <span className="mdl-times"><span aria-hidden="true">{times}</span><span className="mdl-sr">{L(`, ${m.times} veces`, `, ${m.times} times`)}</span></span>}
                  </h4>
                  <p className="mdl-tx">{m.text}</p>
                  {since && <p className="mdl-since">{since}</p>}
                </li>
              );
            })}
          </ul>
        ) : failed ? (
          <p className="mdl-note">
            {L('No pude traer tus medallas ahora. ', "I couldn't load your medals right now. ")}<button type="button" className="mdl-link" onClick={onRetry}>{L('Probar de nuevo', 'Try again')}</button>
          </p>
        ) : (
          <p className="mdl-note" role="status">{L('Buscando tus medallas…', 'Looking for your medals…')}</p>
        )}
      </div>
    </div>
  );
}
