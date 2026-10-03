import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { Article } from '../../../api/types';
import { lastSearch } from '../../../hooks/user';
import { IcSparkDouble } from '../../../shared/components/icons';
import { GenerateCourseModal } from '../components/GenerateCourseModal';
import { ModerationOverlay } from '../components/ModerationOverlay';
import { WikiArticle } from '../components/WikiArticle';

export function ArticlePage() {
  const { id = '' } = useParams();
  const loc = useLocation();
  const go = useNavigate();
  const pre = (loc.state as { article?: Article } | null)?.article;
  const [article, setArticle] = useState<Article | undefined>(pre);
  const [mod, setMod] = useState<'none' | 'check' | 'block'>(pre ? 'none' : 'check');
  const [blockedOnOpen, setBlockedOnOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [modal, setModal] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Abrir: el servidor modera la página completa antes de mostrarla.
  useEffect(() => {
    let alive = true;
    scroller.current?.scrollTo({ top: 0 });
    if (pre?.id === id) { setArticle(pre); setMod('none'); return; }
    setMod('check');
    api.article(id).then((r) => {
      if (!alive) return;
      if (r.status === 'ok') { setArticle(r.article); setMod('none'); } else { setBlockedOnOpen(true); setMod('block'); }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (article) api.courseRequested(article.topic).then(setRequested);
  }, [article]);

  // Cada link también se modera antes de abrirse.
  const openLink = async (target: string) => {
    setMod('check');
    const r = await api.article(target);
    if (r.status === 'blocked') { setMod('block'); return; }
    go(`/descubrir/articulo/${target}`, { state: { article: r.article } });
  };

  const generate = async () => {
    if (!article || requested) return;
    setRequested(true);
    await api.generateCourse(article.topic);
    setModal(true);
  };

  return (
    <section className="view" id="v-article">
      <div className="abar">
        <button className="back" style={{ color: '#0B6B66' }} onClick={() => go(lastSearch.url)}>‹ Resultados</button>
        <button className={`gen${requested ? ' off' : ''}`} disabled={requested || !article} onClick={generate}><IcSparkDouble />Generar curso sobre este tema</button>
      </div>
      <div className="aview">
        <div className="ascroll" ref={scroller}>
          {article && <WikiArticle a={article} onLink={openLink} />}
        </div>
        <ModerationOverlay state={mod} onOk={() => (blockedOnOpen && !article ? go(lastSearch.url) : setMod('none'))} />
      </div>
      <GenerateCourseModal open={modal} topic={article?.topic ?? ''} onClose={() => setModal(false)} />
    </section>
  );
}
