import { useState } from 'react';
import type { MtAdminChannel } from '../../mytube/lib/mytubeApi';

/** Un canal de MyTube en el panel (CanalRow del POC): cómo se le presenta al chico, con la descripción editable. El texto
 *  arranca con la descripción que había al abrir el panel; «Guardar» la deja como la que ve el chico (y ya no se pisa). */
export function YtChannelRow({ c, onSave }: { c: MtAdminChannel; onSave: (desc: string) => Promise<boolean> }) {
  const [desc, setDesc] = useState(c.desc);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const save = async () => {
    if (busy) return;
    setBusy(true); setErr(false);
    const ok = await onSave(desc);
    setBusy(false);
    if (ok) setSaved(true); else setErr(true);
  };
  return (
    <li className="pz-yt-ch">
      <div className="pz-yt-ch-top">
        {c.thumb ? <img className="pz-yt-av" src={c.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="pz-yt-av" />}
        <b className="pz-yt-ch-t">{c.title}</b>
        {c.followed && <span className="pz-yt-badge">seguido</span>}
        {c.handle && <code className="pz-yt-handle">{c.handle}</code>}
      </div>
      <textarea className="pz-input pz-yt-desc" rows={2} value={desc} aria-label={`Descripción de ${c.title}`}
        onChange={(e) => { setDesc(e.target.value); setSaved(false); }} />
      <div className="pz-yt-row">
        <button type="button" className="pz-btn pz-btn--sm" disabled={busy} onClick={() => void save()}>Guardar</button>
        {saved && <span className="pz-yt-ok">✓ Guardado</span>}
        {err && <span className="pz-yt-err">No se pudo guardar. Probá de nuevo.</span>}
      </div>
    </li>
  );
}
