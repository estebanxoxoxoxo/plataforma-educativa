import { useId, type ReactNode } from 'react';

/** Una sección de Configuración: el `Section` de los Ajustes del POC (smarty-poc zones/admin/pages.tsx) portado al repo
 *  (tanda CONFIG, 30-oct): título claro, una bajada en gris opcional y los campos abajo. Tarjeta blanca de un solo trazo
 *  suave (settings.css, cfg-). La región queda nombrada por su título para quien navega por landmarks. */
export function CfgSection({ title, lede, children }: { title: string; lede?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="cfg-sec" aria-labelledby={id}>
      <h3 className="cfg-sec-t" id={id}>{title}</h3>
      {lede && <p className="cfg-sec-d">{lede}</p>}
      {children}
    </section>
  );
}
