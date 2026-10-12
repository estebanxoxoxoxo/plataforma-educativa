import type { Playlist } from '../../../api/types';
import { IcMtPlus } from '../components/MtIcons';

/** Tarjeta de una lista del chico (MisListas del POC): portada = el primer video que siga aprobado y sin palabra
 *  bloqueada; el conteo cuenta solo esos (los resuelve el server al leer). */
export function ListCard({ l, onOpen }: { l: Playlist; onOpen: () => void }) {
  return (
    <button type="button" className="mt-lcard" onClick={onOpen}>
      <span className="mt-lcover">{l.cover && <img src={l.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />}</span>
      <b>{l.name}</b>
      <small>{l.count} {l.count === 1 ? 'video' : 'videos'}</small>
    </button>
  );
}

/** La primera tarjeta de Mis listas: crea una lista y la abre. */
export function NewListCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="mt-lnew" onClick={onClick}>
      <IcMtPlus />
      <span>Nueva lista</span>
    </button>
  );
}
