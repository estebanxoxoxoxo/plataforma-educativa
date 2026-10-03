import type { PageResult } from '../../../api/types';

const Fav = ({ name, color }: { name: string; color: string }) => (
  <span className="g-fav"><i style={{ background: color }}>{name[0]}</i></span>
);
export const PageItem = ({ p, onOpen }: { p: PageResult; onOpen: () => void }) => (
  <>
    <div className="g-site"><Fav name={p.site} color={p.color} /><div><div className="g-name">{p.site}</div><div className="g-url">{p.url}<span className="g-dots">⋮</span></div></div></div>
    <h3 className="g-title" role="link" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>{p.title}</h3>
    <div className="g-snip">{p.date && <span className="g-date">{p.date} — </span>}<span dangerouslySetInnerHTML={{ __html: p.snippet }} /></div>
  </>
);
