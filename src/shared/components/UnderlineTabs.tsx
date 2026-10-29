import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function UnderlineTabs<T extends string>({ tabs, value, onChange, className, tabClass, inkClass }: {
  tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void; className: string; tabClass: string; inkClass: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ink, setInk] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = refs.current[value];
    if (!el) return;
    setInk({ left: el.offsetLeft, width: el.offsetWidth });
    // Donde la fila se desliza (teléfono: Ligas, Buscar, MyTube) la activa se trae entera a la vista al entrar y al cambiar
    // (QA-T4 H7: a 280, ?tab=familia arrancaba con «Familia» medio afuera). Solo en horizontal y respetando el
    // scroll-padding de la fila; si la fila no desborda (o no es scroller), no hace nada.
    const row = el.parentElement;
    if (!row || row.scrollWidth <= row.clientWidth + 1) return;
    const pad = parseFloat(getComputedStyle(row).scrollPaddingInlineStart) || 0;
    const l = el.offsetLeft, r = l + el.offsetWidth;
    if (l - pad < row.scrollLeft) row.scrollLeft = l - pad;
    else if (r + pad > row.scrollLeft + row.clientWidth) row.scrollLeft = r + pad - row.clientWidth;
  }, [value]);
  return (
    <div className={className} role="tablist">
      {tabs.map((t) => (
        <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} role="tab" aria-selected={t.id === value}
          className={`${tabClass}${t.id === value ? ' on' : ''}`} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
      <span className={inkClass} style={ink} />
    </div>
  );
}
