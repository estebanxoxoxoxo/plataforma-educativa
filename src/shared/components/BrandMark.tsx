/** Marca de 3 puntos (teal / azul / naranja). */
export function BrandMark({ className = 'mark' }: { className?: string }) {
  return (
    <span className={className}>
      <i style={{ background: '#13A39A' }} /><i style={{ background: '#3A5BD9' }} /><i style={{ background: '#F26B3A' }} />
    </span>
  );
}
