import type { Channel } from '../../../api/types';

/** Tarjeta de canal (MyTube): cover + nombre + cantidad de videos aprobados + Seguir. */
export function ChannelCard({ c, onOpen, onFollow }: { c: Channel; onOpen: () => void; onFollow: () => void }) {
  return (
    <div className="chcard" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="chcover"><img src={c.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /></span>
      <div className="chrow">
        <span className="chav">{c.name[0]}</span>
        <div className="chmeta">
          <b>{c.name}</b>
          <small>{c.videos.toLocaleString('es-AR')} videos aprobados</small>
        </div>
        <button className={`chfollow${c.followed ? ' on' : ''}`} onClick={(e) => { e.stopPropagation(); onFollow(); }}>
          {c.followed ? 'Siguiendo ✓' : 'Seguir'}
        </button>
      </div>
    </div>
  );
}
