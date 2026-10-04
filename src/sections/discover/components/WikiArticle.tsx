import type { Article } from '../../../api/types';

/** Artículo moderado con tipografía de Wikipedia. El HTML ya viene saneado del backend.
 *  Cada link del cuerpo se intercepta: no navega, se manda a moderar (onLink). */
export function WikiArticle({ a, onLink }: { a: Article; onLink: (url: string) => void }) {
  const isWiki = a.siteName === 'Wikipedia';
  return (
    <article className="wk" onClick={(e) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a');
      if (!link) return;
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href) onLink(href);
    }}>
      <h1 className="wk-title">{a.title}</h1>
      {isWiki
        ? <div className="wk-tabs"><span className="on">Artículo</span><span>Discusión</span><span className="r on">Leer</span></div>
        : <div className="wk-tabs"><span className="on">{a.siteName ?? new URL(a.url).hostname.replace(/^www\./, '')}</span></div>}
      <div className="wk-body">
        {a.hero && <div className="wk-thumb wk-hero"><img src={a.hero} alt="" referrerPolicy="no-referrer" /></div>}
        <div className="wk-html" dangerouslySetInnerHTML={{ __html: a.html }} />
      </div>
    </article>
  );
}
