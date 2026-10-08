import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { Article } from '../../../api/types';
import { lastSearch } from '../../../hooks/user';
import { FolderSheet } from '../../../shared/components/FolderSheet';
import { IcBookmark, IcSparkDouble } from '../../../shared/components/icons';
import { GenerateCourseModal } from '../components/GenerateCourseModal';
import { ModerationOverlay, type ModState } from '../components/ModerationOverlay';
import { WikiArticle } from '../components/WikiArticle';

export function ArticlePage() {
  const { id = '' } = useParams();
  const loc = useLocation();
  const go = useNavigate();
  const st = loc.state as { article?: Article; backTo?: string; backLabel?: string } | null;
  const pre = st?.article;
  // Si se llegó desde un curso de Aprender, "volver" lleva al curso (y se conserva al seguir links).
  const back = st?.backTo ? { to: st.backTo, label: st.backLabel ?? '‹ Volver' } : { to: lastSearch.url, label: '‹ Resultados' };
  const [article, setArticle] = useState<Article | undefined>(pre);
  const [mod, setMod] = useState<ModState>(pre ? 'none' : 'check');
  const [blockedOnOpen, setBlockedOnOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Abrir: el servidor modera la página completa antes de mostrarla.
  useEffect(() => {
    let alive = true;
    scroller.current?.scrollTo({ top: 0 });
    if (pre?.id === id) { setArticle(pre); setMod('none'); return; }
    setMod('check');
    api.article(id).then(
      (r) => {
        if (!alive) return;
        if (r.status === 'ok') { setArticle(r.article); setMod('none'); return; }
        setBlockedOnOpen(true); setMod(r.status === 'blocked' ? 'block' : 'error');
      },
      () => { if (alive) { setBlockedOnOpen(true); setMod('error'); } }, // backend caído → fail-closed
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (article) api.courseRequested(article.topic).then(setRequested);
  }, [article]);

  // Cada link también se modera antes de abrirse.
  const openLink = async (target: string) => {
    setMod('check');
    const r = await api.article(target).catch(() => null);
    if (!r || r.status === 'error') { setMod('error'); return; }
    if (r.status === 'blocked') { setMod('block'); return; }
    go(`/buscar/articulo/${encodeURIComponent(target)}`, { state: { article: r.article, backTo: st?.backTo, backLabel: st?.backLabel } });
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
        <button className="back" style={{ color: '#0B6B66' }} onClick={() => go(back.to)}>{back.label}</button>
        <div className="abar-acts">
          <button className="asave" disabled={!article} onClick={() => setSaving(true)}><IcBookmark />Guardar</button>
          <button className={`gen${requested ? ' off' : ''}`} disabled={requested || !article} onClick={generate}><IcSparkDouble />Generar curso sobre este tema</button>
        </div>
      </div>
      <div className="aview">
        <div className="ascroll" ref={scroller}>
          {article && <WikiArticle a={article} onLink={openLink} />}
        </div>
        <ModerationOverlay state={mod} onOk={() => (blockedOnOpen && !article ? go(back.to) : setMod('none'))} />
      </div>
      <GenerateCourseModal open={modal} topic={article?.topic ?? ''} onClose={() => setModal(false)} />
      {article && <FolderSheet open={saving} title="¿Dónde lo guardás?" cta="Guardar acá"
        onPick={async (folderId, folderName) => {
          const r = await api.saveItem({ folderId, article: { url: article.id, title: article.title, source: article.siteName } }).catch(() => null);
          if (!r) return { error: 'No se pudo guardar ahora.' };
          return { done: r.existed ? `Ya estaba en ${folderName}` : `Guardado en ${folderName}` };
        }} onClose={() => setSaving(false)} />}
    </section>
  );
}
