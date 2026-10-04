import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { lastSearch } from '../../../hooks/user';
import { VideoInfo } from '../components/VideoInfo';
import { VideoPlayer } from '../components/VideoPlayer';

export function VideoPage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const st = useLocation().state as { backTo?: string; backLabel?: string } | null;
  const { data: v } = useAsync(() => api.video(id), [id]);
  // Desde un curso de Aprender se vuelve al curso; si no, a la solapa Videos de la última búsqueda.
  const back = st?.backTo
    ? { to: st.backTo, label: st.backLabel ?? '‹ Volver' }
    : { to: lastSearch.url.includes('tab=') ? lastSearch.url.replace(/tab=\w+/, 'tab=videos') : lastSearch.url, label: '‹ Videos' };
  return (
    <section className="view" id="v-player">
      <button className="back" onClick={() => go(back.to)}>{back.label}</button>
      {v ? <><VideoPlayer key={v.id} v={v} /><VideoInfo v={v} /></> : <div className="player" />}
    </section>
  );
}
