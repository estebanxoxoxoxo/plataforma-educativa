import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api } from '../../api';
import type { AvatarLook, Identity, User } from '../../api/types';
import { AVATAR_COLORS, AVATAR_VARIANT_COUNT, Avatar, avatarVariantName } from './Avatar';
import { IcClose } from './icons';

/* Identidad de Ian (visión §9: el avatar es un activo del chico). Su look lo ELIGE él y vive en el server
   (GET/POST /api/identity → server/data/identity.json, no se resetea con la demo); el de los demás usuarios se
   deriva del nick en el cliente (lookFor, en Avatar.tsx). Estilos: avatar.css (prefijo idav-). */

/* ---------- store: singleton de módulo + useSyncExternalStore (patrón de sections/parent/lib/features.ts) ----------
   Lo leen la tarjeta de la barra y la fila "Vos" de Ligas: al guardar, las dos cambian AL INSTANTE. */
type Snap = { id: Identity | null; failed: boolean };
let snap: Snap = { id: null, failed: false };
const listeners = new Set<() => void>();
const emit = (next: Snap) => { snap = next; listeners.forEach((l) => l()); };
let inflight: Promise<void> | null = null;
/** Sube con cada guardado: una lectura que salió antes no pisa lo recién guardado cuando vuelve. */
let version = 0;
function refresh(): Promise<void> {
  if (inflight) return inflight;
  const v = version;
  inflight = api.identity().then(
    (id) => { if (v === version) emit({ id, failed: false }); },
    () => { if (v === version) emit({ ...snap, failed: true }); },
  ).finally(() => { inflight = null; });
  return inflight;
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  if (!snap.id && !inflight) void refresh();
  return () => { listeners.delete(l); };
};
const useIdentity = () => useSyncExternalStore(subscribe, () => snap);
async function saveLook(look: AvatarLook): Promise<void> {
  version++;
  emit({ id: await api.setIdentity(look), failed: false });
}

/** Las iniciales de Ian son las de siempre: amarillo con letra marrón (barra y fila "Vos" de Ligas). */
const ME_COLOR = '#FFC23D';
const ME_INK = '#5A3D00';

/** El avatar de Ian donde aparezca (barra, filas "Vos" de Ligas). Mientras no se sabe su look: un círculo neutro
 *  (sin parpadeo de iniciales → personaje); si el server no responde, sus iniciales de siempre. */
export function MyAvatar({ name, size }: { name: string; size?: number }) {
  const { id, failed } = useIdentity();
  if (!id && !failed) return <span className="av3 idav-ph" style={size ? { width: size, height: size } : undefined} aria-hidden="true" />;
  return <Avatar name={name} color={ME_COLOR} look={id?.look} size={size} style={{ color: ME_INK }} />;
}

const COLOR_NAMES: Record<string, string> = {
  '#3A5BD9': 'Azul', '#13A39A': 'Verde agua', '#F26B3A': 'Naranja', '#8A5CF5': 'Violeta',
  '#E5487A': 'Rosa', '#F2A81D': 'Amarillo', '#1C9BD6': 'Celeste', '#18A957': 'Verde',
};
const IcPencil = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 012.8 0l.6.6a2 2 0 010 2.8L8.6 18.8z" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinejoin="round" /></svg>
);

/** Tarjeta de perfil del pie de la barra (la .profile de shell.css, ahora botón): avatar de Ian + nombre y edad.
 *  Tocarla abre "Tu avatar"; al guardar, el avatar nuevo aparece al instante (con un saltito). */
export function ProfileCard({ user }: { user?: User }) {
  const { id } = useIdentity();
  const [open, setOpen] = useState(false);
  const [saves, setSaves] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const name = user?.name ?? id?.nick ?? '';
  const close = (saved: boolean) => {
    setOpen(false);
    if (saved) setSaves((n) => n + 1);
    btn.current?.focus();
  };
  return (
    <>
      <button ref={btn} type="button" className="profile idav-prof" onClick={() => setOpen(true)} aria-haspopup="dialog"
        title="Cambiar tu avatar" aria-label={user ? `${user.name}, ${user.age} años. Cambiar tu avatar` : 'Cambiar tu avatar'}>
        <span className="idav-pav" key={saves} data-pop={saves > 0 || undefined}>
          <MyAvatar name={name} />
          <span className="idav-pen"><IcPencil /></span>
        </span>
        <div><b>{user?.name ?? '…'}</b><small>{user ? `${user.age} años` : ''}</small></div>
      </button>
      {open && <AvatarPicker name={name} current={id?.look ?? null} onClose={close} />}
    </>
  );
}

/** Hoja "Tu avatar" (patrón global .shov/.shcard): personaje (16 dibujados + Iniciales) y color, con vista previa.
 *  Radios nativos: flechas para moverse dentro de cada grupo, Tab entre grupos, Esc cierra, Tab queda adentro. */
function AvatarPicker({ name, current, onClose }: { name: string; current: AvatarLook; onClose: (saved: boolean) => void }) {
  const [variant, setVariant] = useState<number | null>(current ? current.variant : null); // null = iniciales
  const [color, setColor] = useState<string>(current?.color ?? AVATAR_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const card = useRef<HTMLDivElement>(null);
  const draft: AvatarLook = variant === null ? null : { variant, color };
  const dirty = (draft === null) !== (current === null) || (!!draft && !!current && (draft.variant !== current.variant || draft.color !== current.color));
  const live = useRef({ busy, onClose });
  useLayoutEffect(() => { live.current = { busy, onClose }; });

  // Foco al abrir: la opción elegida (así las flechas ya recorren el set).
  useEffect(() => { card.current?.querySelector<HTMLInputElement>('input[name="idav-v"]:checked')?.focus(); }, []);
  // Teclado: Esc cierra (salvo mientras guarda) y Tab no se escapa de la hoja.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = card.current;
      if (!c) return;
      if (e.key === 'Escape') { e.preventDefault(); if (!live.current.busy) live.current.onClose(false); return; }
      if (e.key !== 'Tab') return;
      const els = [...c.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1], at = document.activeElement;
      if (!c.contains(at)) { e.preventDefault(); first.focus(); return; }
      if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true); setErr('');
    try { await saveLook(draft); onClose(true); }
    catch { setErr('No se pudo guardar. Probá de nuevo en un ratito.'); setBusy(false); }
  };
  const caption = variant === null ? 'Iniciales' : `${avatarVariantName(variant)} · ${COLOR_NAMES[color] ?? ''}`;

  return (
    <div className="shov idav-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(false); }}>
      <div className="shcard idav-sheet" ref={card} role="dialog" aria-modal="true" aria-labelledby="idav-t" aria-describedby="idav-d">
        <div className="idav-top">
          <span className="idav-prev" key={`${variant}-${color}`}>
            <Avatar name={name} color={ME_COLOR} look={draft} size={84} style={{ color: ME_INK }} />
          </span>
          <div className="idav-head">
            <h3 className="idav-t" id="idav-t">Tu avatar</h3>
            <p className="idav-d" id="idav-d">Así te ven tus amigos y tu liga.</p>
            <p className="idav-cap" aria-live="polite">{caption}</p>
          </div>
          <button type="button" className="idav-x" aria-label="Cerrar" disabled={busy} onClick={() => onClose(false)}><IcClose /></button>
        </div>

        <fieldset className="idav-set" disabled={busy}>
          <legend className="lbl">Personaje</legend>
          <div className="idav-grid">
            {Array.from({ length: AVATAR_VARIANT_COUNT }, (_, v) => (
              <label key={v} className="idav-opt" title={avatarVariantName(v)}>
                <input type="radio" name="idav-v" value={v} checked={variant === v} onChange={() => setVariant(v)} />
                <Avatar name={name} color={ME_COLOR} look={{ variant: v, color }} size={40} />
                <span className="idav-sr">{avatarVariantName(v)}</span>
              </label>
            ))}
            <label className="idav-opt" title="Iniciales (el clásico)">
              <input type="radio" name="idav-v" value="iniciales" checked={variant === null} onChange={() => setVariant(null)} />
              <Avatar name={name} color={ME_COLOR} size={40} style={{ color: ME_INK }} />
              <span className="idav-sr">Iniciales</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="idav-set" disabled={busy || variant === null}>
          <legend className="lbl">Color{variant === null && <span className="idav-note"> · con iniciales queda tu amarillo</span>}</legend>
          <div className="idav-colors">
            {AVATAR_COLORS.map((c) => (
              <label key={c} className="idav-sw" title={COLOR_NAMES[c]} style={{ background: c }}>
                <input type="radio" name="idav-c" value={c} checked={color === c} onChange={() => setColor(c)} />
                <span className="idav-sr">{COLOR_NAMES[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {err && <p className="idav-err" role="alert">{err}</p>}
        <div className="idav-btns">
          <button type="button" className="idav-btn idav-btn--ghost" disabled={busy} onClick={() => onClose(false)}>Cancelar</button>
          <button type="button" className="idav-btn" disabled={busy || !dirty} aria-busy={busy} onClick={() => void save()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
