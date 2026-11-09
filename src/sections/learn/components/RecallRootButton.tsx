import { IcChevronRight, IcRefreshCw } from './LearnIcons';
import { L } from '../../../shared/lib/lang';

/** Entrada raíz de Active recall (Learn.tsx del POC): aparece con ≥1 objetivo ya jugado que tiene Definición hoja;
 *  `count` = esos objetivos. Abre el repaso SIN FIN entre todas las rutas. Pura. */
export const RecallRootButton = ({ count, onOpen }: { count: number; onOpen: () => void }) => (
  <button type="button" className="ln-recall" onClick={onOpen}>
    <IcRefreshCw />
    <span className="ln-recall-t">
      <b>Active recall</b>
      <small>{L('Repasá lo que más necesitás', 'Review what you need most')} · {count} {count === 1 ? L('tema', 'topic') : L('temas', 'topics')}</small>
    </span>
    <IcChevronRight className="ln-go" />
  </button>
);
