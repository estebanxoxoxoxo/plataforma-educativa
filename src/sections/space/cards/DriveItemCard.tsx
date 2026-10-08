import type { DriveItem } from '../../../api/types';
import { IcResImg, IcResLect, IcResVideo } from '../../../shared/components/icons';
import { DotMenu } from '../components/DotMenu';

const KIND = {
  video: { label: 'Video', Icon: IcResVideo },
  articulo: { label: 'Lectura', Icon: IcResLect },
  imagen: { label: 'Imagen', Icon: IcResImg },
} as const;

/** Tarjeta de un contenido guardado en Drive (video / lectura / imagen). */
export function DriveItemCard({ it, onOpen, onMove, onTrash }: {
  it: DriveItem; onOpen: () => void; onMove: () => void; onTrash?: () => void;
}) {
  const k = KIND[it.type];
  return (
    <div className="spcard" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className={`sthumb t-${it.type}`}>
        {it.img ? <img src={it.img} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <k.Icon />}
        <i className="skind"><k.Icon />{k.label}</i>
      </span>
      <b className="stitle">{it.title}</b>
      {it.subtitle && <small className="ssub">{it.subtitle}</small>}
      {onTrash && <DotMenu actions={[
        { label: 'Mover a…', onClick: onMove },
        { label: 'Mandar a la papelera', danger: true, onClick: onTrash },
      ]} />}
    </div>
  );
}
