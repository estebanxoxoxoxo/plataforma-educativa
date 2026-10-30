import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { ChannelCard } from '../cards/ChannelCard';
import { IcMtTv } from '../components/MtIcons';
import { CardSkeleton } from '../components/VideoList';
import { channelPath, type MtDetailState } from '../lib/nav';

/** Canales: SOLO los que el chico sigue y tienen contenido aprobado (followedChannels del POC), en el orden del server
 *  (por channelId). Tocar uno abre la vista del canal. */
export function ChannelsPane() {
  const go = useNavigate();
  const { data, error } = useAsync(() => api.mtChannels(), []);

  if (error) return <p className="mt-empty">No pude cargar tus canales ahora.</p>;
  if (!data) return <div className="mt-chgrid" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}</div>;
  if (!data.channels.length) {
    return (
      <div className="mt-none">
        <IcMtTv />
        <p>Todavía no seguís ningún canal.<br />Cuando veas un video, tocá <b>Seguir</b> para tenerlo acá.</p>
      </div>
    );
  }
  return (
    <div className="mt-chgrid">
      {data.channels.map((c) => (
        <ChannelCard key={c.channelId} c={c} onOpen={() => go(channelPath(c.channelId), { state: { fromMyTube: true } satisfies MtDetailState })} />
      ))}
    </div>
  );
}
