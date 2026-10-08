import type { DriveFolder } from '../../../api/types';
import { IcFolderWin } from '../../../shared/components/icons';
import { DotMenu } from '../components/DotMenu';

/** Tarjeta de carpeta: TODAS iguales, con el mismo ícono de carpeta (estilo Windows). */
export function FolderCard({ f, onOpen, onEdit, onMove, onTrash }: {
  f: DriveFolder; onOpen: () => void; onEdit: () => void; onMove: () => void; onTrash: () => void;
}) {
  return (
    <div className="fcard-folder" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="fico"><IcFolderWin /></span>
      <b className="fname">{f.name}</b>
      <DotMenu actions={[
        { label: 'Renombrar', onClick: onEdit },
        { label: 'Mover a…', onClick: onMove },
        { label: 'Mandar a la papelera', danger: true, onClick: onTrash },
      ]} />
    </div>
  );
}
