import type { ImageResult } from '../../../api/types';
import { imgSrc } from '../../../shared/lib/img';

export const ImageItem = ({ m }: { m: ImageResult }) => (
  <>
    <span className="gimg"><img className="ph-img" src={imgSrc(m.img)} alt={m.caption} /></span>
    <div className="gicap">{m.caption}</div>
    <div className="gisrc"><i style={{ background: m.source.color }}>{m.source.name[0]}</i>{m.source.name}</div>
  </>
);
