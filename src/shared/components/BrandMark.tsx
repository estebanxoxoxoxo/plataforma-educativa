/** La marca (rediseño 30-oct, pedido de Esteban: «un mejor ícono de app»): los 3 puntos de siempre (teal / azul /
 *  naranja) pero SUBIENDO y CRECIENDO — aprender es crecer — en la teja oscura redondeada. Ahora es un SVG: escala
 *  limpio en la barra (34) y en la etiqueta del chat (22, .cx-mark). El favicon de index.html es el mismo dibujo. */
export function BrandMark({ className = 'mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill="#1B2238" />
      <circle cx="9.6" cy="23.4" r="3" fill="#13A39A" />
      <circle cx="16.8" cy="17.6" r="4" fill="#3A5BD9" />
      <circle cx="24.6" cy="10.8" r="5" fill="#F26B3A" />
    </svg>
  );
}
