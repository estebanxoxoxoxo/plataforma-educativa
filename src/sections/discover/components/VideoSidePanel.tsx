import type { VideoResult } from '../../../api/types';
import { IcPlay } from '../../../shared/components/icons';

/** Panel del reproductor, como el VideoPlayer del POC: reproduciendo una LISTA (cola de más de un video) muestra la lista
 *  con la pista actual marcada ("En la lista": "Reproduciendo" / "Pista N"; tocar otra salta a esa pista y sigue la cola);
 *  si no, los "Relacionados" del server (hasta 12: mismo canal y después similares por tema; tocar uno sale del modo cola).
 *  Sin videos no se dibuja. Apaisado (≥ 720 px de ancho y más ancho que alto) va al costado; si no, debajo del video. */
export function VideoSidePanel({ mode, videos, current, onPick }: {
  mode: 'list' | 'related'; videos: VideoResult[]; current: number; onPick: (i: number) => void;
}) {
  if (!videos.length) return null;
  const enLista = mode === 'list';
  return (
    <aside className="prel" aria-label={enLista ? 'En la lista' : 'Relacionados'}>
      <h4 className="prel-h">{enLista ? 'En la lista' : 'Relacionados'}</h4>
      <div className="prel-list">
        {videos.map((v, i) => {
          const on = enLista && i === current;
          return (
            <button key={enLista ? `q${i}` : v.id} type="button" className={`prel-item${on ? ' on' : ''}`}
              aria-current={on ? 'true' : undefined} onClick={() => { if (!on) onPick(i); }}>
              <span className="prel-th">
                <img src={v.img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                {v.duration && <span className="prel-dur">{v.duration}</span>}
                {on && <span className="prel-now"><IcPlay /></span>}
              </span>
              <span className="prel-tx">
                <b>{v.title}</b>
                {enLista ? <small>{on ? 'Reproduciendo' : `Pista ${i + 1}`}</small> : v.channel && <small>{v.channel}</small>}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
