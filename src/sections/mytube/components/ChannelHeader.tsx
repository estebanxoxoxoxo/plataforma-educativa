import { IcCheck } from '../../../shared/components/icons';
import type { MtChannel } from '../../../api/types';
import { IcMtPlus } from './MtIcons';

/** Cabecera de la vista de canal (ChannelView del POC): avatar, título (o «Canal»), @handle, Seguir/Siguiendo y la
 *  descripción curada en dos líneas que se expande al tocarla. Sin suscriptores (el POC no los muestra). */
export function ChannelHeader({ channel, followed, descOpen, onFollow, onToggleDesc }: {
  channel: MtChannel | null; followed: boolean; descOpen: boolean; onFollow: () => void; onToggleDesc: () => void;
}) {
  return (
    <>
      <div className="mt-chhead">
        {channel?.thumb
          ? <img className="mt-chav big" src={channel.thumb} alt="" referrerPolicy="no-referrer" />
          : <span className="mt-chav big" />}
        <div className="mt-chmeta">
          <h2>{channel?.title ?? 'Canal'}</h2>
          {channel?.handle && <p className="mt-handle">{channel.handle}</p>}
          <button type="button" className={`mt-follow${followed ? ' on' : ''}`} aria-pressed={followed} onClick={onFollow}>
            {followed ? <><IcCheck />Siguiendo</> : <><IcMtPlus />Seguir</>}
          </button>
        </div>
      </div>
      {channel?.desc && (
        <p className={`mt-desc${descOpen ? ' is-open' : ''}`} role="button" tabIndex={0} aria-expanded={descOpen}
          onClick={onToggleDesc} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleDesc(); } }}>
          {channel.desc}
        </p>
      )}
    </>
  );
}
