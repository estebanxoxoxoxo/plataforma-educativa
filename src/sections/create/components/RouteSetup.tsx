import { IcTrash } from '../../../shared/components/icons';
import { LEARN_CATEGORIES } from '../lib/routeDraft';
import { IcCrFilePlus, IcCrUpload } from './CreateIcons';

/** Ruta: elegir una nueva o una guardada para editar (las del catálogo CON módulos) + Nueva / Borrar mientras se edita.
 *  Elegir "➕ Nueva ruta…" desde una guardada es "Nueva" (POC). Pura. */
export function RoutePicker({ routes, value, isEditing, onPick, onNew, onDelete }: {
  routes: { id: string; title: string; emoji: string }[];
  /** id de la ruta abierta si está guardada; '' = ruta nueva */
  value: string;
  isEditing: boolean;
  onPick: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="cr-picker">
      <label className="cr-label" htmlFor="cr-route">Ruta:</label>
      <select id="cr-route" className="cr-input cr-select cr-picker-sel" value={value} onChange={(e) => (e.target.value ? onPick(e.target.value) : onNew())}>
        <option value="">➕ Nueva ruta…</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>{r.emoji} {r.title || '(sin título)'}</option>
        ))}
      </select>
      {isEditing && (
        <>
          <button type="button" className="cr-btn cr-btn--ghost" onClick={onNew}><IcCrFilePlus /> Nueva</button>
          <button type="button" className="cr-btn cr-btn--ghost is-danger" onClick={onDelete} title="Eliminar esta ruta"><IcTrash aria-hidden="true" /> Borrar</button>
        </>
      )}
    </div>
  );
}

/** Identidad de la ruta: emoji + título, categoría (texto libre con las 13 sugerencias) y portada (subida → recorte 16:9;
 *  sin portada manual, la vista previa es la miniatura del video del 1er módulo o el emoji). Pura. */
export function RouteIdentity({ emoji, title, category, cover, coverPreview, onEmoji, onTitle, onCategory, onCoverFile, onClearCover }: {
  emoji: string;
  title: string;
  category: string;
  /** portada manual (data URL) si hay */
  cover?: string;
  /** lo que se ve en el recuadro: la manual o la miniatura del video del 1er contenido */
  coverPreview: string | null;
  onEmoji: (v: string) => void;
  onTitle: (v: string) => void;
  onCategory: (v: string) => void;
  onCoverFile: (f: File | null | undefined) => void;
  onClearCover: () => void;
}) {
  return (
    <>
      <div className="cr-ident">
        <input className="cr-input cr-emoji cr-emoji--route" value={emoji} onChange={(e) => onEmoji(e.target.value)} aria-label="Emoji de la ruta" />
        <input className="cr-input cr-title-in" value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Título de la ruta" aria-label="Título de la ruta" />
      </div>

      <div className="cr-field-row">
        <label className="cr-label" htmlFor="cr-cat">Categoría</label>
        <input id="cr-cat" className="cr-input" list="cr-cats" value={category} onChange={(e) => onCategory(e.target.value)} placeholder="Ej: Ciencias Naturales, Filosofía…" />
        <datalist id="cr-cats">{LEARN_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
      </div>

      <div className="cr-cover">
        <div className="cr-cover-box">
          {coverPreview
            ? <img src={coverPreview} alt="" className="cr-cover-img" />
            : <span className="cr-cover-emo" aria-hidden="true">{emoji}</span>}
        </div>
        <div className="cr-cover-txt">
          <span className="cr-cover-h">Portada</span>
          <span className="cr-cover-p">{cover ? 'Imagen subida (recortada 16:9).' : 'Se usa la imagen del 1er contenido (o el emoji).'}</span>
          <div className="cr-cover-btns">
            <label className="cr-btn cr-btn--ghost cr-btn--sm cr-file">
              <IcCrUpload /> Subir imagen
              <input type="file" accept="image/*" className="cr-file-in" onChange={(e) => onCoverFile(e.target.files?.[0])} />
            </label>
            {cover && <button type="button" className="cr-link is-danger" onClick={onClearCover}>Quitar</button>}
          </div>
        </div>
      </div>
    </>
  );
}

/** Para quién se genera (edad 6-14, nivel) y dónde corre route-lab (URL editable; se recuerda al Generar). Edad y nivel no
 *  se guardan con la ruta (POC). Pura. */
export function GenConfig({ edad, nivel, url, onEdad, onNivel, onUrl }: {
  edad: number;
  nivel: string;
  url: string;
  onEdad: (v: string) => void;
  onNivel: (v: string) => void;
  onUrl: (v: string) => void;
}) {
  return (
    <div className="cr-gen">
      <label className="cr-gen-f">
        <span className="cr-label">Edad</span>
        <input type="number" min={6} max={14} className="cr-input cr-num" value={edad} onChange={(e) => onEdad(e.target.value)} />
      </label>
      <label className="cr-gen-f">
        <span className="cr-label">Nivel</span>
        <select className="cr-input cr-select" value={nivel} onChange={(e) => onNivel(e.target.value)}>
          <option value="basico">básico</option>
          <option value="medio">medio</option>
          <option value="avanzado">avanzado</option>
        </select>
      </label>
      <label className="cr-gen-f cr-gen-url">
        <span className="cr-label">route-lab</span>
        <input className="cr-input cr-url" value={url} onChange={(e) => onUrl(e.target.value)} aria-label="URL de route-lab" placeholder="http://localhost:5203" spellCheck={false} />
      </label>
    </div>
  );
}
