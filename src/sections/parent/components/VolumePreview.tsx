/** Vista previa del efecto de un tope de volumen: la barra de 0 a 100 con la parte que el chico puede usar y la
 *  bloqueada (rayada, con candado en el tope), más la frase de qué pasa. Pura. */
export function VolumePreview({ kid, cap, what }: { kid: string; cap: number; what: 'la música' | 'los ruidos' }) {
  const text = cap >= 100 ? `Sin tope: ${kid} elige el volumen de ${what}.`
    : cap === 0 ? `Con 0, ${what} de fondo ${what === 'la música' ? 'queda muda' : 'quedan mudos'}.`
    : what === 'la música' ? `${kid} puede subirla hasta ${cap} de 100. Si sonaba más fuerte, baja a ${cap} en el acto.`
    : `${kid} puede subirlos hasta ${cap} de 100. Si sonaban más fuerte, bajan a ${cap} en el acto.`;
  return (
    <div className="pz-vp" aria-hidden="true">
      <span className="pz-vp-k">Así lo ve {kid}</span>
      <span className="pz-vp-bar">
        <i className="pz-vp-on" style={{ width: `${cap}%` }} />
        {cap < 100 && <i className="pz-vp-off" style={{ left: `${cap}%` }} />}
        <b className="pz-vp-knob" style={{ left: `${cap}%` }}>
          {cap < 100 && (
            <svg viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="6.5" rx="1.4" fill="currentColor" /><path d="M5.5 7V5.4a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          )}
        </b>
      </span>
      <span className="pz-vp-t">{text}</span>
    </div>
  );
}
