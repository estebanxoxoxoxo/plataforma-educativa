/** Corazón de la lista de deseos: lleno si el premio está en la lista, contorno si no
 *  (trazo 2.2 como el resto de los íconos; vive en la sección porque icons.tsx está en uso por el menú). */
export function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="st-heart-ic" aria-hidden="true">
      <path
        d="M12 20.2s-7.4-4.4-9.2-9.3C1.6 7.6 3.5 4.3 6.9 4.1c2.1-.1 3.8 1 5.1 2.9 1.3-1.9 3-3 5.1-2.9 3.4.2 5.3 3.5 4.1 6.8-1.8 4.9-9.2 9.3-9.2 9.3z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** ❤ dentro de un texto: el mismo corazón rosa de las tarjetas (el emoji ❤ se ve oscuro en Windows).
 *  El "❤" de texto queda oculto a la vista, para lectores de pantalla y para el texto copiado. */
export function HeartInline() {
  return (
    <>
      <span className="st-heart-inline" aria-hidden="true"><Heart filled /></span>
      <span className="st-sr">❤</span>
    </>
  );
}
