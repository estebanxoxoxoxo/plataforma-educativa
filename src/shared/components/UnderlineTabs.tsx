import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function UnderlineTabs<T extends string>({ tabs, value, onChange, className, tabClass, inkClass }: {
  tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void; className: string; tabClass: string; inkClass: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ink, setInk] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = refs.current[value];
    if (el) setInk({ left: el.offsetLeft, width: el.offsetWidth });
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
