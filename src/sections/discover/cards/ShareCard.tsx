import type { VideoResult } from '../../../api/types';
import { IcPlayDark, IcShieldOkBold } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';

/** Tarjeta de un video aprobado que el chat comparte. */
export function ShareCard({ v, onOpen }: { v: VideoResult; onOpen: (v: VideoResult) => void }) {
  return (
    <div className="share it in" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => onOpen(v)} onKeyDown={(e) => e.key === 'Enter' && onOpen(v)}>
      <span className="vthumb"><img className="ph-img" src={imgSrc(v.img)} alt="" /><span className="play"><IcPlayDark /></span></span>
      <div className="vtxt"><h4>{v.title}</h4><p>{['Video', v.duration, v.channel].filter(Boolean).join(' · ')}</p><span className="ok"><IcShieldOkBold />Revisado para chicos</span></div>
    </div>
  );
}
