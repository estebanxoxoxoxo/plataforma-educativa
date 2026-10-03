import type { Video } from '../../../api/types';

// Íconos de la fila de acciones de YouTube (Material, 24px)
const IcVerified = () => (
  <svg viewBox="0 0 24 24" aria-label="Verificado"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM9.8 17.3l-4.2-4.1L7 11.8l2.8 2.7L17 7.4l1.4 1.4-8.6 8.5z" /></svg>
);
const IcLike = () => (
  <svg viewBox="0 0 24 24"><path d="M18.77 11h-4.23l1.52-4.94C16.38 5.03 15.54 4 14.38 4c-.58 0-1.14.24-1.52.65L7 11H3v10h14.43c1.06 0 1.98-.67 2.3-1.68l1.26-4.04C21.28 14.04 20.17 11 18.77 11zM7 20H4v-8h3v8zm12.98-6.83-1.34 4.31c-.23.9-.78 1.52-1.21 1.52H8v-8.61l5.6-6.06c.19-.21.48-.33.78-.33.26 0 .5.11.63.3.07.1.15.26.09.47l-1.52 4.94-.4 1.29h5.58c.41 0 .8.17 1.03.46.13.15.26.4.19.71z" /></svg>
);
const IcShare = () => (
  <svg viewBox="0 0 24 24"><path d="M15 5.63 20.66 12 15 18.37V14h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 3v6C6.22 10.13 3.11 15.33 2 21c2.78-3.97 6.44-6 12-6v6l8-9-8-9z" /></svg>
);
const IcDownload = () => (
  <svg viewBox="0 0 24 24"><path d="M17 18v1H6v-1h11zm-.5-6.6-.7-.7-3.8 3.7V4h-1v10.4l-3.8-3.8-.7.7 5 5 5-4.9z" /></svg>
);
const IcMore = () => (
  <svg viewBox="0 0 24 24"><path d="M7.5 12c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm4.5-1.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm6 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" /></svg>
);

/** Título + fila del canal, con el formato de la página de video de YouTube. */
export const VideoInfo = ({ v }: { v: Video }) => (
  <div className="pinfo">
    <h3>{v.title}</h3>
    <div className="yt-row">
      <div className="yt-owner">
        <span className="yt-av">{v.channel[0]}</span>
        <div className="yt-ch">
          <div className="yt-name">{v.channel}{v.verified && <IcVerified />}</div>
          <div className="yt-subs">{v.subscribers}</div>
        </div>
        <button className="yt-sub">Suscribirse</button>
      </div>
      <div className="yt-actions">
        <div className="yt-seg">
          <button className="yt-btn" aria-label="Me gusta"><IcLike />{v.likes}</button>
          <span className="yt-div" />
          <button className="yt-btn icon" aria-label="No me gusta"><span className="yt-flip"><IcLike /></span></button>
        </div>
        <button className="yt-btn"><IcShare />Compartir</button>
        <button className="yt-btn"><IcDownload />Descargar</button>
        <button className="yt-btn icon" aria-label="Más acciones"><IcMore /></button>
      </div>
    </div>
  </div>
);
