import type { ImageResult } from '../../../api/types';
import { IcBookmark } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';
import { L } from '../../../shared/lib/lang';

export const ImageItem = ({ m, onSave }: { m: ImageResult; onSave?: () => void }) => (
  <>
    <span className="gimg">
      <img className="ph-img" src={imgSrc(m.img)} alt={m.caption} />
      {onSave && <button className="gsave" aria-label={L('Guardar la imagen', 'Save the image')} title={L('Guardar en una carpeta', 'Save to a folder')}
        onClick={(e) => { e.stopPropagation(); onSave(); }}><IcBookmark /></button>}
    </span>
    <div className="gicap">{m.caption}</div>
    <div className="gisrc"><i style={{ background: m.source.color }}>{m.source.name[0]}</i>{m.source.name}</div>
  </>
);
