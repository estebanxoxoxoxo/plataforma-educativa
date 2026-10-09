import { IcBook } from '../../../shared/components/icons';
import { presentCite } from '../lib/levels';

/** "De dónde sale": la cita textual del material de donde salió la carta (regla de oro de Practicar). */
export const CiteBox = ({ cite }: { cite: string }) => (
  <figure className="rc-cite">
    <figcaption><IcBook aria-hidden="true" />De dónde sale</figcaption>
    <blockquote>«{presentCite(cite)}»</blockquote>
  </figure>
);
