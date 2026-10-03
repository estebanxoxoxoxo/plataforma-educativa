import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { lastSearch } from '../../../hooks/user';
import { VideoInfo } from '../components/VideoInfo';
import { VideoPlayer } from '../components/VideoPlayer';

export function VideoPage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const { data: v } = useAsync(() => api.video(id), [id]);
  return (
    <section className="view" id="v-player">
      <button className="back" onClick={() => go(lastSearch.url.includes('tab=') ? lastSearch.url.replace(/tab=\w+/, 'tab=videos') : lastSearch.url)}>‹ Videos</button>
      {v ? <><VideoPlayer key={v.id} v={v} /><VideoInfo v={v} /></> : <div className="player" />}
    </section>
  );
}
