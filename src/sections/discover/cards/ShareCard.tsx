import type { SharedCard } from '../../../api/types';
import { Skeleton } from '../../../shared/components/Skeleton';
import { IcPlayDark, IcShieldOkBold } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';

export function ShareCard({ share, onOpen }: { share: 'checking' | SharedCard; onOpen: (c: SharedCard) => void }) {
  if (share === 'checking') return <div className="share it sk pop"><Skeleton /></div>;
  return (
    <div className="share it in" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => onOpen(share)}>
      <span className="vthumb"><img className="ph-img" src={imgSrc(share.img)} alt="" /><span className="play"><IcPlayDark /></span></span>
      <div className="vtxt"><h4>{share.title}</h4><p>{share.meta}</p><span className="ok"><IcShieldOkBold />Revisado para chicos</span></div>
    </div>
  );
}
