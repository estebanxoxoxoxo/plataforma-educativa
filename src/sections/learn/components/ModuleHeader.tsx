import type { RouteModule } from '../lib/learn';
import { MODULE_COLORS } from '../lib/moduleColors';
import { IcBookOpen, IcMonitorPlay } from './LearnIcons';

/** Header de módulo: banda STICKY minimalista (sólo el título + "ver" si hay contenido), con el
 *  color del módulo. Se queda pineada bajo la barra del título → siempre sabés en qué módulo estás.
 *  (ModuleHeader de RutaView del POC; "ver" = el GUIDEBOOK: abre el contenido libre, sin bloqueo ni registro.) Pura. */
export function ModuleHeader({ module, colorIdx, onOpen }: { module: RouteModule; colorIdx: number; onOpen?: () => void }) {
  const c = MODULE_COLORS[colorIdx % MODULE_COLORS.length];
  const canOpen = !!onOpen;
  const ContentIcon = module.source?.kind === 'video' ? IcMonitorPlay : IcBookOpen;
  return (
    <button type="button" disabled={!canOpen} onClick={onOpen} className="ln-band" style={{ background: c.band, color: c.ink }}>
      <span className="ln-band-t">{module.title}</span>
      {canOpen && <span className="ln-band-see"><ContentIcon /> ver</span>}
    </button>
  );
}
