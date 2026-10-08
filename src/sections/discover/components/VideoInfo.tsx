import type { Video } from '../../../api/types';
import { IcBookmark, IcHeadphones, IcPlusList } from '../../../shared/components/icons';

// Íconos de la fila de acciones de YouTube (Material, 24px)
const IcVerified = () => (
  <svg viewBox="0 0 24 24" aria-label="Verificado"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM9.8 17.3l-4.2-4.1L7 11.8l2.8 2.7L17 7.4l1.4 1.4-8.6 8.5z" /></svg>
);
const IcLike = () => (
  <svg viewBox="0 0 24 24"><path d="M18.77 11h-4.23l1.52-4.94C16.38 5.03 15.54 4 14.38 4c-.58 0-1.14.24-1.52.65L7 11H3v10h14.43c1.06 0 1.98-.67 2.3-1.68l1.26-4.04C21.28 14.04 20.17 11 18.77 11zM7 20H4v-8h3v8zm12.98-6.83-1.34 4.31c-.23.9-.78 1.52-1.21 1.52H8v-8.61l5.6-6.06c.19-.21.48-.33.78-.33.26 0 .5.11.63.3.07.1.15.26.09.47l-1.52 4.94-.4 1.29h5.58c.41 0 .8.17 1.03.46.13.15.26.4.19.71z" /></svg>
);

/** Título + fila del canal (formato YouTube) + acciones REALES de Mi espacio:
 *  Suscribirse (canal → MyTube), Fondo (audio de fondo), Guardar (Drive) y ＋Lista. */
export const VideoInfo = ({ v, followed, onFollow, onBg, onSave, onList }: {
  v: Video; followed: boolean;
  onFollow: () => void; onBg: () => void; onSave: () => void; onList: () => void;
}) => (
  <div className="pinfo">
    <h3>{v.title}</h3>
    <div className="yt-row">
      <div className="yt-owner">
        {v.channelThumb
          ? <img className="yt-av" src={v.channelThumb} alt="" referrerPolicy="no-referrer" />
          : <span className="yt-av">{v.channel[0]}</span>}
        <div className="yt-ch">
          <div className="yt-name">{v.channel}{v.verified && <IcVerified />}</div>
          {v.subscribers && <div className="yt-subs">{v.subscribers}</div>}
        </div>
        <button className={`yt-sub${followed ? ' on' : ''}`} onClick={onFollow}>{followed ? 'Suscripto ✓' : 'Suscribirse'}</button>
      </div>
      <div className="yt-actions">
        <div className="yt-seg">
          <button className={`yt-btn${v.likes ? '' : ' icon'}`} aria-label="Me gusta"><IcLike />{v.likes}</button>
          <span className="yt-div" />
          <button className="yt-btn icon" aria-label="No me gusta"><span className="yt-flip"><IcLike /></span></button>
        </div>
        <button className="yt-btn" onClick={onBg} title="El audio sigue sonando mientras navegás"><IcHeadphones />Escuchar de fondo</button>
        <button className="yt-btn" onClick={onSave}><IcBookmark />Guardar</button>
        <button className="yt-btn" onClick={onList} aria-label="Agregar a una lista"><IcPlusList />Lista</button>
      </div>
    </div>
  </div>
);
