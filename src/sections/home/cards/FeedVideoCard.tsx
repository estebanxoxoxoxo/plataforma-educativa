import type { FeedItem, VideoResult } from '../../../api/types';
import { IcPlayDark, IcResVideo } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';

type It = Extract<FeedItem, { kind: 'video' }>;

/** Video recomendado (del catálogo aprobado). Toda la tarjeta abre el reproductor. */
export const FeedVideoCard = ({ it, onOpen }: { it: It; onOpen: (v: VideoResult) => void }) => (
  <button className="fcard fvideo" onClick={() => onOpen(it.video)}>
    <span className="fthumb">
      <img src={imgSrc(it.video.img)} alt="" referrerPolicy="no-referrer" loading="lazy" />
      <span className="fplay"><IcPlayDark /></span>
      {it.video.duration && <b className="fdur">{it.video.duration}</b>}
    </span>
    <span className="fbody">
      <small className="ftag tvideo"><IcResVideo />Video · {it.reason}</small>
      <b className="ftitle">{it.video.title}</b>
      <span className="fmeta">{it.video.channel} · {it.time}</span>
    </span>
  </button>
);
