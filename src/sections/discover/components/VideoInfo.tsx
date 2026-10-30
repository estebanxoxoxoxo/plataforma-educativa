import type { Video } from '../../../api/types';
import { IcBookmark, IcHeadphones, IcPlusList } from '../../../shared/components/icons';

// Íconos de la fila de acciones de YouTube (Material, 24px)
const IcVerified = () => (
  <svg viewBox="0 0 24 24" aria-label="Verificado"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM9.8 17.3l-4.2-4.1L7 11.8l2.8 2.7L17 7.4l1.4 1.4-8.6 8.5z" /></svg>
);

/** Avatar + nombre + suscriptores del canal. Dentro del chip-botón van como <span> (un botón solo admite contenido de
 *  frase); fuera, como siempre. */
const Owner = ({ v, Tag }: { v: Video; Tag: 'div' | 'span' }) => (
  <>
    {v.channelThumb
      ? <img className="yt-av" src={v.channelThumb} alt="" referrerPolicy="no-referrer" />
      : <span className="yt-av">{v.channel[0]}</span>}
    <Tag className="yt-ch">
      <Tag className="yt-name">{v.channel}{v.verified && <IcVerified />}</Tag>
      {v.subscribers && <Tag className="yt-subs">{v.subscribers}</Tag>}
    </Tag>
  </>
);

/** Título + fila del canal (formato YouTube) + acciones REALES de Mi espacio:
 *  Suscribirse (canal → MyTube), Fondo (audio de fondo), Guardar (Drive) y ＋Lista.
 *  `onChannel` (solo si el video trae su canal): el chip avatar+nombre abre el canal en MyTube; sin él, no es botón. */
export const VideoInfo = ({ v, followed, onFollow, onChannel, onBg, onSave, onList }: {
  v: Video; followed: boolean;
  onFollow: () => void; onChannel?: () => void; onBg: () => void; onSave: () => void; onList: () => void;
}) => (
  <div className="pinfo">
    <h3>{v.title}</h3>
    <div className="yt-row">
      <div className="yt-owner">
        {onChannel
          ? <button type="button" className="yt-chip" onClick={onChannel} title="Ver el canal" aria-label={`Ver el canal ${v.channel}`}><Owner v={v} Tag="span" /></button>
          : <Owner v={v} Tag="div" />}
        <button className={`yt-sub${followed ? ' on' : ''}`} onClick={onFollow}>{followed ? 'Suscripto ✓' : 'Suscribirse'}</button>
      </div>
      <div className="yt-actions">
        {/* Sin Me gusta / No me gusta (pedido de Esteban, 30-oct): eran decorativos, acá no se vota. */}
        <button className="yt-btn" onClick={onBg} title="El audio sigue sonando mientras navegás"><IcHeadphones />Escuchar de fondo</button>
        <button className="yt-btn" onClick={onSave}><IcBookmark />Guardar</button>
        <button className="yt-btn" onClick={onList} aria-label="Agregar a una lista"><IcPlusList />Lista</button>
      </div>
    </div>
  </div>
);
