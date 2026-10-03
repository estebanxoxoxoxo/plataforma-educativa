import type { RelatedChip } from '../../../api/types';
import { imgSrc } from '../../../shared/lib/img';

export const RelatedChips = ({ chips, onPick }: { chips: RelatedChip[]; onPick: (label: string) => void }) => (
  <div className="ichips">
    {chips.map((c) => <button key={c.label} className="ichip" onClick={() => onPick(c.label)}><img className="ph-img" src={imgSrc(c.img)} alt="" />{c.label}</button>)}
  </div>
);
