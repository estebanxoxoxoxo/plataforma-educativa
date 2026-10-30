import type { DriveFolder } from '../../../api/types';
import { IcFolderWin } from '../../../shared/components/icons';
import { DotMenu } from '../components/DotMenu';
import { titleIfCut } from '../lib/drive';

/** Tarjeta de carpeta: TODAS iguales, con el mismo ícono de carpeta (estilo Windows). Desde el 30-oct (pedido de Esteban,
 *  «que sea así» con una captura de Google Drive) es la fila compacta de Drive —ícono, nombre en un renglón y ⋯— del
 *  MISMO ancho que las tarjetas de archivos (comparten la grilla .spgrid); sin vista previa. Si el nombre no entra, se
 *  corta con «…» y el completo sale en el tooltip nativo. */
export function FolderCard({ f, onOpen, onEdit, onMove, onTrash }: {
  f: DriveFolder; onOpen: () => void; onEdit: () => void; onMove: () => void; onTrash: () => void;
}) {
  return (
    <div className="spd" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="spd-ico" aria-hidden="true"><IcFolderWin /></span>
      <b className="spd-name" onMouseEnter={titleIfCut(f.name)}>{f.name}</b>
      <DotMenu actions={[
        { label: 'Renombrar', onClick: onEdit },
        { label: 'Mover a…', onClick: onMove },
        { label: 'Mandar a la papelera', danger: true, onClick: onTrash },
      ]} />
    </div>
  );
}
