import type { VideoResult } from '../../../api/types';
import { imgSrc } from '../../../shared/lib/img';

export const VideoItem = ({ v, onOpen }: { v: VideoResult; onOpen: () => void }) => (
  <>
    <div className="g-url">www.youtube.com › watch<span className="g-dots">⋮</span></div>
    <h3 className="g-title" role="link" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>{v.title}</h3>
    <div className="g-vrow">
      <span className="gthumb" onClick={onOpen}>
        <img className="ph-img" src={imgSrc(v.img)} alt="" />
        <span className="gplay"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" fill="#fff" /></svg></span>
        <span className="gdur">{v.duration}</span>
      </span>
      <div className="g-vtxt">
        <div className="g-snip">{v.subtitle}. Un video para aprender sobre el tema, pensado para chicos ...</div>
        <div className="g-meta">YouTube · {v.channel} · {v.date}</div>
      </div>
    </div>
  </>
);
