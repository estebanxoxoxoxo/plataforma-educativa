import type { Article } from '../../../api/types';
import { imgSrc } from '../../../shared/lib/img';

/** Artículo con formato Wikipedia. Los links internos llevan data-article y se manejan por delegación. */
export function WikiArticle({ a, onLink }: { a: Article; onLink: (id: string) => void }) {
  const box = a.infobox;
  return (
    <article className="wk" onClick={(e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-article]');
      if (el) onLink(el.dataset.article!);
    }}>
      <h1 className="wk-title">{a.title}</h1>
      <div className="wk-tabs"><span className="on">Artículo</span><span>Discusión</span><span className="r on">Leer</span></div>
      {a.hatnote && <p className="wk-hat">{a.hatnote}</p>}
      <div className="wk-body">
        <div className="wk-box">
          <div className="hd">{box.title}</div>
          <div className="wk-sub" dangerouslySetInnerHTML={{ __html: box.range }} />
          <img src={imgSrc(box.img)} alt="" />
          <div className="cap" dangerouslySetInnerHTML={{ __html: box.caption }} />
          {box.taxonomy.length > 0 && <div className="hd" style={{ fontSize: 13 }}>Taxonomía</div>}
          {box.taxonomy.map(([k, v, s]) => (
            <div className="row" key={k}><span>{k}</span>{s === 'b' ? <b>{v}</b> : <span className={s === 'a' ? 'a' : undefined}>{v}</span>}</div>
          ))}
        </div>
        <div dangerouslySetInnerHTML={{ __html: a.html }} />
      </div>
    </article>
  );
}
