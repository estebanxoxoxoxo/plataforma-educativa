import { IcTrash } from '../../../shared/components/icons';
import { LEARN_CATEGORIES } from '../lib/routeDraft';
import { IcCrFilePlus, IcCrUpload } from './CreateIcons';
import { L } from '../../../shared/lib/lang';

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
      <label className="cr-label" htmlFor="cr-route">{L('Ruta:', 'Route:')}</label>
      <select id="cr-route" className="cr-input cr-select cr-picker-sel" value={value} onChange={(e) => (e.target.value ? onPick(e.target.value) : onNew())}>
        <option value="">{L('➕ Nueva ruta…', '➕ New route…')}</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>{r.emoji} {r.title || L('(sin título)', '(untitled)')}</option>
        ))}
      </select>
      {isEditing && (
        <>
          <button type="button" className="cr-btn cr-btn--ghost" onClick={onNew}><IcCrFilePlus /> {L('Nueva', 'New')}</button>
          <button type="button" className="cr-btn cr-btn--ghost is-danger" onClick={onDelete} title={L('Eliminar esta ruta', 'Delete this route')}><IcTrash aria-hidden="true" /> {L('Borrar', 'Delete')}</button>
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
        <input className="cr-input cr-emoji cr-emoji--route" value={emoji} onChange={(e) => onEmoji(e.target.value)} aria-label={L('Emoji de la ruta', 'Route emoji')} />
        <input className="cr-input cr-title-in" value={title} onChange={(e) => onTitle(e.target.value)} placeholder={L('Título de la ruta', 'Route title')} aria-label={L('Título de la ruta', 'Route title')} />
      </div>

      <div className="cr-field-row">
        <label className="cr-label" htmlFor="cr-cat">{L('Categoría', 'Category')}</label>
        <input id="cr-cat" className="cr-input" list="cr-cats" value={category} onChange={(e) => onCategory(e.target.value)} placeholder={L('Ej: Ciencias Naturales, Filosofía…', 'E.g. Natural Sciences, Philosophy…')} />
        <datalist id="cr-cats">{LEARN_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
      </div>

      <div className="cr-cover">
        <div className="cr-cover-box">
          {coverPreview
            ? <img src={coverPreview} alt="" className="cr-cover-img" />
            : <span className="cr-cover-emo" aria-hidden="true">{emoji}</span>}
        </div>
        <div className="cr-cover-txt">
          <span className="cr-cover-h">{L('Portada', 'Cover')}</span>
          <span className="cr-cover-p">{cover ? L('Imagen subida (recortada 16:9).', 'Uploaded image (cropped 16:9).') : L('Se usa la imagen del 1er contenido (o el emoji).', 'Uses the image from the 1st content (or the emoji).')}</span>
          <div className="cr-cover-btns">
            <label className="cr-btn cr-btn--ghost cr-btn--sm cr-file">
              <IcCrUpload /> {L('Subir imagen', 'Upload image')}
              <input type="file" accept="image/*" className="cr-file-in" onChange={(e) => onCoverFile(e.target.files?.[0])} />
            </label>
            {cover && <button type="button" className="cr-link is-danger" onClick={onClearCover}>{L('Quitar', 'Remove')}</button>}
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
        <span className="cr-label">{L('Edad', 'Age')}</span>
        <input type="number" min={6} max={14} className="cr-input cr-num" value={edad} onChange={(e) => onEdad(e.target.value)} />
      </label>
      <label className="cr-gen-f">
        <span className="cr-label">{L('Nivel', 'Level')}</span>
        <select className="cr-input cr-select" value={nivel} onChange={(e) => onNivel(e.target.value)}>
          <option value="basico">{L('básico', 'basic')}</option>
          <option value="medio">{L('medio', 'intermediate')}</option>
          <option value="avanzado">{L('avanzado', 'advanced')}</option>
        </select>
      </label>
      <label className="cr-gen-f cr-gen-url">
        <span className="cr-label">route-lab</span>
        <input className="cr-input cr-url" value={url} onChange={(e) => onUrl(e.target.value)} aria-label={L('URL de route-lab', 'route-lab URL')} placeholder="http://localhost:5203" spellCheck={false} />
      </label>
    </div>
  );
}
