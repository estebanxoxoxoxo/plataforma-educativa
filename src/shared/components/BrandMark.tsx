/** La marca (rediseño 30-oct, pedido de Esteban: «algo más Duolingo, sin que dé a entender que es una copia»): una
 *  MASCOTA como ícono — el zorro naranja de la casa, cara simple y amistosa sobre la teja teal de Innerith (animal y
 *  paleta propios: nada de búhos ni verdes). Es un SVG: escala limpio en la barra (34), en la etiqueta del chat
 *  (22, .cx-mark) y en el favicon de index.html, que es el mismo dibujo. */
export function BrandMark({ className = 'mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill="#13A39A" />
      {/* orejas */}
      <path d="M8.6 6.6l6 4.2-4.6 3.4z" fill="#F26B3A" />
      <path d="M25.4 6.6l-6 4.2 4.6 3.4z" fill="#F26B3A" />
      {/* cabeza y hocico */}
      <ellipse cx="17" cy="19" rx="10.2" ry="8.6" fill="#F26B3A" />
      <ellipse cx="17" cy="22.4" rx="6.4" ry="4.8" fill="#fff" />
      {/* ojos y nariz */}
      <circle cx="12.7" cy="17.4" r="1.7" fill="#1B2238" />
      <circle cx="21.3" cy="17.4" r="1.7" fill="#1B2238" />
      <circle cx="17" cy="21.4" r="1.5" fill="#1B2238" />
    </svg>
  );
}
