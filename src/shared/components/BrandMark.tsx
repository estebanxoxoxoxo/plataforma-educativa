/** La marca (rediseño 4-nov, 3ª vuelta — Esteban pasó la referencia: un monograma de ganchos entrelazados).
 *  El nudo Smarty: CUATRO «9» de esquinas cuadradas en simetría rotacional (el anillo de cada uno se cierra sobre
 *  su tallo y el tallo se desliza junto al anillo del vecino, tejido sin cruces), girado 45° para que apunte a las
 *  esquinas de la teja. Geometría afinada con búsqueda numérica de holguras (gap de borde ≥1.2 entre copias;
 *  sandbox en el scratchpad de la sesión del 4-nov). Trazo blanco 2.5 sobre la teja teal con degradé. Es un SVG:
 *  escala limpio en la barra (34), en la etiqueta del chat (22, .cx-mark) y en el favicon de index.html (el mismo
 *  dibujo). La unidad: anillo de 5.8×6.6 con esquinas 2.3, tallo en x=14.1 que baja hasta y=16.1. */
export function BrandMark({ className = 'mark' }: { className?: string }) {
  const nine = 'M14.1 16.1V6.1Q14.1 3.8 16.4 3.8H17.6Q19.9 3.8 19.9 6.1V8.1Q19.9 10.4 17.6 10.4H16.4Q14.1 10.4 14.1 8.1';
  return (
    <svg className={className} viewBox="0 0 34 34" aria-hidden="true">
      <defs>
        <linearGradient id="bm-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1ABCB1" />
          <stop offset="1" stopColor="#0D8C84" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="9" fill="url(#bm-tile)" />
      {/* brillo superior de la teja */}
      <path d="M0 12V9a9 9 0 0 1 9-9h16a9 9 0 0 1 9 9v3Z" fill="#fff" opacity=".08" />
      {/* el nudo: cuatro «9» rotados 90°, el conjunto a 45° */}
      {[45, 135, 225, 315].map((a) => (
        <path key={a} d={nine} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${a} 17 17)`} />
      ))}
    </svg>
  );
}
