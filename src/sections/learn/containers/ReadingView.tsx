import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { Article } from '../../../api/types';
import { FolderSheet } from '../../../shared/components/FolderSheet';
import { WikiArticle } from '../../discover/components/WikiArticle';
import { useOverlay } from '../lib/overlayNav';

/* Lectura de una posta (fase 'reading' del overlay) y guidebook de un módulo de artículo: port del ReadingView del POC
   (smarty-poc app/src/zones/child/ReadingView.tsx) sobre el LECTOR REAL de Innerith.

   Por qué un ReadingView propio y no la página /buscar/articulo: ArticlePage está atada a su ruta (useParams, "‹
   Resultados", navega para seguir links) y abrirla sacaría al chico de Learn y le haría perder la partida. Acá se usa el
   MISMO endpoint de lectura del server (api.article → gate de sitio + extracción + juez + caché) y la MISMA pieza que
   dibuja el artículo (WikiArticle de la sección discover), dentro de un overlay de la pila de Learn.

   Igual que el POC: CTA arriba a la izquierda ("Empezar preguntas →" en la fase de lectura, "✕ Cerrar" en el guidebook)
   SIEMPRE tocable —aun cargando o con la página caída (trampa 27)—, "Atrás" del navegador = cierra el overlay de ARRIBA
   de la pila (en el guidebook y en un lector anidado, este; en la fase de lectura de una posta, el ActivityOverlay
   entero: ver lib/overlayNav), título del artículo + sitio · host, estados
   "Estoy revisando esta página para vos…" / no disponible / no se pudo revisar, pie con "Guardar artículo" (→ "Guardado en
   X ›", que lleva a Mi espacio y deja la partida: trampa 30) y "✓ Página revisada", y los links del cuerpo abren un lector
   ANIDADO no confiable (trampa 26).
   DESVÍOS (documentados): (1) `trusted` (en el POC saltea el juez y los resúmenes por sección) no tiene equivalente: el
   lector de Innerith SIEMPRE modera en el server (más estricto; la lectura de una ruta ya aprobada sale de la caché);
   (2) el POC pre-clasifica cada link con la lista blanca del navegador (no aprobado → texto plano + aviso); en Innerith la
   lista vive en el server: el link abre el lector anidado y, si el sitio no está aprobado, ese lector lo dice; (3) el
   cuerpo usa el formato del lector de Innerith (artículo completo con la tipografía de Wikipedia) en vez del modo zen
   por secciones del POC (estética); (4) al abrirse no se sabe si el artículo ya estaba guardado (no hay consulta por URL
   en la API de Mi espacio): el botón arranca en "Guardar artículo" y, si ya estaba, la hoja lo avisa ("Ya estaba en X"). */
export function ReadingView({ url, title, onClose, ctaLabel, onCta }: {
  url: string;
  title: string;
  onClose: () => void;
  ctaLabel?: string;
  onCta?: () => void;
  /** Del POC (lectura de una ruta = contenido ya curado). En Innerith el server modera siempre: ver DESVÍO (1). */
  trusted?: boolean;
}) {
  const { close, z } = useOverlay(onClose);
  const go = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [state, setState] = useState<'cargando' | 'ok' | 'bloqueado' | 'error'>('cargando');
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState<{ folderId: number; folderName: string } | null>(null);
  // Link DENTRO del artículo → se abre como lector ANIDADO (la pila de overlays maneja el "Volver").
  const [child, setChild] = useState<{ url: string; title: string } | null>(null);
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();

  useEffect(() => {
    let alive = true;
    setState('cargando');
    api.article(url).then(
      (r) => {
        if (!alive) return;
        if (r.status === 'ok') { setArticle(r.article); setState('ok'); return; }
        setState(r.status === 'blocked' ? 'bloqueado' : 'error');
      },
      () => { if (alive) setState('error'); }, // backend caído → fail-closed
    );
    return () => { alive = false; };
  }, [url]);

  /* Un link del cuerpo: los anclas de la misma página y lo que no es http(s) no hacen nada; el resto abre el lector
     anidado (el server decide si se puede leer). */
  function followLink(raw: string) {
    let u: URL;
    try { u = new URL(raw, url); } catch { return; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    if (u.href.split('#')[0] === url.split('#')[0]) return; // ancla en la misma página
    setChild({ url: u.href, title: u.href });
  }

  return (
    <>
      {createPortal(
        <div className="ln-ov ln-read" style={{ zIndex: z }}>
          <header className="ln-read-head">
            <button type="button" className="ln-read-cta" onClick={onCta ?? close}>{ctaLabel ?? '✕ Volver'}</button>
            <div className="ln-read-tt">
              <p className="ln-read-t">{article?.title ?? title}</p>
              <p className="ln-read-host">{article?.siteName ? `${article.siteName} · ${host}` : host}</p>
            </div>
          </header>

          <div className="ln-read-body">
            {state === 'cargando' && <p className="ln-read-msg ln-pulse">Estoy revisando esta página para vos…</p>}
            {state === 'error' && <p className="ln-read-msg">No puedo revisar esto ahora mismo. Probemos de nuevo en un ratito 🙂</p>}
            {state === 'bloqueado' && (
              <div className="ln-read-msg">
                Esta página no está disponible.<br /><span>Si te interesa, podés pedírsela a papá o mamá.</span>
              </div>
            )}
            {state === 'ok' && article && (
              <div className="ln-read-art">
                <WikiArticle a={article} onLink={followLink} />
              </div>
            )}
          </div>

          {state === 'ok' && article && (
            <footer className="ln-read-foot">
              {saved ? (
                <button type="button" className="ln-read-save is-on" onClick={() => go(`/espacio/carpetas/${saved.folderId}`)}>
                  ⭐ Guardado en {saved.folderName} ›
                </button>
              ) : (
                <button type="button" className="ln-read-save" onClick={() => setPicking(true)}>☆ Guardar artículo</button>
              )}
              <span className="ln-read-ok">✓ Página revisada por Innerith</span>
            </footer>
          )}

          {article && (
            <FolderSheet open={picking} title="¿Dónde lo guardás?" cta="Guardar acá"
              onPick={async (folderId, folderName) => {
                const r = await api.saveItem({ folderId, article: { url: article.id, title: article.title, source: article.siteName } }).catch(() => null);
                if (!r) return { error: 'No se pudo guardar ahora.' };
                setSaved({ folderId, folderName });
                return { done: r.existed ? `Ya estaba en ${folderName}` : `Guardado en ${folderName}` };
              }}
              onClose={() => setPicking(false)} />
          )}
        </div>,
        document.body,
      )}
      {/* Lector ANIDADO al seguir un link: se monta encima (z más alto) y la pila de overlays maneja el "Volver". */}
      {child && <ReadingView url={child.url} title={child.title} onClose={() => setChild(null)} />}
    </>
  );
}
