import type { VideoResult } from '../../../api/types';
import { imgSrc } from '../../../shared/lib/img';
import { LnPlay } from '../components/icons';

/** Tarjeta de un video aprobado en un grupo de videos (el chat y Buscar → Todo): miniatura 16:9 con ▶ y duración, «YouTube»
 *  chiquito y el título en hasta 2 renglones (la VideoCard del POC). Abre el reproductor moderado. */
export function ShareCard({ v, onOpen }: { v: VideoResult; onOpen: (v: VideoResult) => void }) {
  return (
    <button type="button" className="mg-vid" onClick={() => onOpen(v)} title={v.title}>
      <span className="mg-vth">
        <img className="ph-img" src={imgSrc(v.img)} alt="" loading="lazy" />
        <span className="mg-play"><LnPlay /></span>
        {v.duration && <span className="mg-dur">{v.duration}</span>}
      </span>
      <span className="mg-vtx"><small>YouTube</small><b>{v.title}</b></span>
    </button>
  );
}
