import { useState } from 'react';
import type { DriveItem } from '../../../api/types';
import { IcPlay, IcResImg, IcResLect, IcResVideo } from '../../../shared/components/icons';
import { DotMenu } from '../components/DotMenu';
import { readingSource, titleIfCut } from '../lib/drive';

const KIND = {
  video: { label: 'Video', Icon: IcResVideo },
  articulo: { label: 'Lectura', Icon: IcResLect },
  imagen: { label: 'Imagen', Icon: IcResImg },
} as const;

/** Tarjeta de un contenido guardado (video / lectura / imagen), como los «Archivos sugeridos» de Google Drive (pedido de
 *  Esteban, 30-oct): VISTA PREVIA arriba —el video, su miniatura; la imagen, la imagen; la lectura, su imagen si la tiene
 *  o un bloque editorial con el libro y el sitio (la lectura no trae foto y robarla sería mentir, como en el feed V2)— y
 *  abajo la fila con el ícono chico del tipo, el nombre en UN renglón (cortado con «…» y, si no entra, el nombre completo
 *  en el tooltip nativo) y el menú ⋯. Mismo contenido y mismas acciones que antes: abrir, Mover a…, papelera. Pura.
 *  Desde el 30-oct (pedido de Esteban: «todas las cards de video del mismo tamaño y la imagen sin padding») la previa va A
 *  SANGRE —contra los bordes de la tarjeta, 16:9 como las de Mis videos— en vez de recuadro con margen adentro. */
export function DriveItemCard({ it, onOpen, onMove, onTrash }: {
  it: DriveItem; onOpen: () => void; onMove: () => void; onTrash?: () => void;
}) {
  const k = KIND[it.type];
  // Si la miniatura no carga (video borrado, imagen caída), la previa pasa al bloque del tipo en lugar de un hueco roto.
  const [broken, setBroken] = useState(false);
  const img = it.img && !broken ? it.img : null;
  const src = it.type === 'articulo' ? readingSource(it) : null;
  return (
    <div className={`spf t-${it.type}`} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="spf-prev" aria-hidden="true">
        {img ? <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          : it.type === 'articulo' ? (
            <span className="spf-read"><IcResLect />{src && <small>{src}</small>}</span>
          ) : <span className="spf-ph"><k.Icon /></span>}
        {it.type === 'video' && img && <i className="spf-play"><IcPlay /></i>}
      </span>
      {/* El cuerpo con alto mínimo fijo (30-oct): así la tarjeta mide lo mismo con o sin la fuente debajo, y lo mismo que
          las tarjetas de video de Mis videos (misma grilla, misma previa 16:9 a sangre, mismo alto de cuerpo). */}
      <span className="spf-body">
        <span className="spf-row">
          <span className="spf-ico" title={k.label}><k.Icon /></span>
          <span className="sp-sr">{k.label}: </span>
          <b className="spf-name" onMouseEnter={titleIfCut(it.title)}>{it.title}</b>
          {onTrash && <DotMenu actions={[
            { label: 'Mover a…', onClick: onMove },
            { label: 'Mandar a la papelera', danger: true, onClick: onTrash },
          ]} />}
        </span>
        {it.subtitle && <small className="spf-sub" onMouseEnter={titleIfCut(it.subtitle)}>{it.subtitle}</small>}
      </span>
    </div>
  );
}
