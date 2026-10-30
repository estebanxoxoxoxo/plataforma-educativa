import type { Playlist } from '../../../api/types';
import { IcMtPlus } from '../components/MtIcons';

/** Tarjeta de una lista del chico (MisListas del POC): portada = el primer video que siga aprobado y sin palabra
 *  bloqueada; el conteo cuenta solo esos (los resuelve el server al leer). Es la tarjeta de video común (.mt-card, 30-oct):
 *  portada 16:9 a sangre, nombre y conteo abajo. */
export function ListCard({ l, onOpen }: { l: Playlist; onOpen: () => void }) {
  return (
    <button type="button" className="mt-card mt-lcard" onClick={onOpen}>
      <span className="mt-cmedia mt-lcover">{l.cover && <img className="mt-cimg" src={l.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />}</span>
      <span className="mt-cbody">
        <b>{l.name}</b>
        <small>{l.count} {l.count === 1 ? 'video' : 'videos'}</small>
      </span>
    </button>
  );
}

/** La primera tarjeta de Mis listas: crea una lista y la abre. Mide lo MISMO que una lista (30-oct): el ＋ ocupa el lugar
 *  de la portada y el rótulo el del nombre, así la grilla no queda con una tarjeta de otro alto. */
export function NewListCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="mt-card mt-lnew" onClick={onClick}>
      <span className="mt-cmedia"><IcMtPlus /></span>
      <span className="mt-cbody"><span>Nueva lista</span></span>
    </button>
  );
}
