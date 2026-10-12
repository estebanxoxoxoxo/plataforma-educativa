import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScene } from '../../../learn/audio/sceneDirector';
import { recallableTargets } from '../../../learn/recallActivity';
import { IcArrowLeft, IcX } from '../components/LearnIcons';
import { ModuleHeader } from '../components/ModuleHeader';
import { PostaNode } from '../components/PostaNode';
import { progressByTarget, resolveRoute, type LearnRoute, type Posta, type PostaView, type RouteModule } from '../lib/learn';
import { useLearnData } from '../lib/learnData';
import { MODULE_COLORS } from '../lib/moduleColors';
import { ActivityOverlay } from './ActivityOverlay';
import { ReadingView } from './ReadingView';
import { VideoReadingView } from './VideoReadingView';

/* Vista de una Ruta estilo Duolingo: un camino de postas (zig-zag). El estado de cada
   posta (lograda/disponible/bloqueada + estrellas) se DERIVA de la maestría del objetivo
   (store persistido); jugar una posta lo actualiza. */

/* PORTE INNERITH (W3+W4): port EXACTO de smarty-poc app/src/zones/child/RutaView.tsx @ 47f434b — segmentos contiguos por
   módulo con su banda STICKY a color (6 colores en ciclo; "ver" = guidebook del contenido, sin bloqueo ni registro), el
   zig-zag por índice GLOBAL, estados de resolveRoute, la posta de REPASO (alcance = targets de las postas previas que no
   son de repaso —con moduleId, solo las de su módulo—, filtrados a lo ya jugado y ordenados por urgencia EN EL GESTO;
   K = min(5, n); sin nada jugado el click no hace nada: trampa 14), el placeholder de una posta sin definición y la escena
   de audio 'ruta' mientras el camino está montado. Estética de Innerith; la ruta abierta es ESTADO de Aprender (no URL),
   como en el POC. Las filas salen del store de la sección (el useLiveQuery del POC). */

export function RouteView({ route, onBack }: { route: LearnRoute; onBack: () => void }) {
  const rowsRaw = useLearnData().rows;
  const rows = useMemo(() => rowsRaw ?? [], [rowsRaw]);
  const byTarget = useMemo(() => progressByTarget(rows), [rows]);
  const views = resolveRoute(route, byTarget);

  // Agrupar las postas en SEGMENTOS contiguos por módulo (para el header sticky por sección).
  // Un segmento sin módulo = postas sueltas (sin header). El índice original se conserva (zig-zag).
  const moduleIdx = new Map<string, number>();
  route.modules?.forEach((m, i) => moduleIdx.set(m.id, i));
  const segments: { module?: RouteModule; colorIdx: number; items: { view: PostaView; index: number }[] }[] = [];
  views.forEach((view, index) => {
    const mod = view.posta.moduleId ? route.modules?.find((x) => x.id === view.posta.moduleId) : undefined;
    const cur = segments[segments.length - 1];
    if (!cur || cur.module?.id !== mod?.id) {
      segments.push({ module: mod, colorIdx: mod ? (moduleIdx.get(mod.id) ?? 0) : 0, items: [] });
    }
    segments[segments.length - 1].items.push({ view, index });
  });

  const [pending, setPending] = useState<Posta | null>(null);
  const [activity, setActivity] = useState<Posta | null>(null);
  const [recall, setRecall] = useState<{ posta: Posta; targets: string[] } | null>(null);
  const [content, setContent] = useState<RouteModule | null>(null); // módulo cuyo contenido se está viendo (guidebook)

  // Escena 'ruta' mientras estoy en el mapa de postas. Los overlays (actividad/recall) pushean su propia
  // escena ENCIMA (el tope del stack manda) y al cerrarse vuelve a 'ruta'. Ver SceneDirector.
  useScene('ruta');

  const play = (p: Posta) => {
    // Recall: repaso acotado a los objetivos de las postas PREVIAS de esta ruta,
    // ordenados por urgencia (calculado al vuelo en el gesto). Ver §7.1.
    if (p.kind === 'recall') {
      const idx = route.postas.findIndex((x) => x.id === p.id);
      const prev = route.postas.slice(0, idx).filter((x) => x.kind !== 'recall');
      // repaso de módulo (con moduleId): acota a los targets de su propio módulo;
      // repaso general (sin moduleId): todo lo previo de la ruta.
      const scoped = p.moduleId ? prev.filter((x) => x.moduleId === p.moduleId) : prev;
      const order = recallableTargets(rows, Date.now(), { scope: scoped.map((x) => x.target) });
      if (order.length) setRecall({ posta: p, targets: order });
      return;
    }
    // Con definición → la instancia real; sin definición → placeholder.
    if (p.definitionId) setActivity(p);
    else setPending(p);
  };

  return (
    <section className="view ln-ruta" id="v-ruta">
      <header className="ln-rhead">
        <button type="button" onClick={onBack} aria-label="Volver a rutas" className="ln-back">
          <IcArrowLeft strokeWidth={1.85} />
        </button>
        <span className="ln-remoji" aria-hidden="true">{route.emoji}</span>
        <h1 className="ln-rtitle">{route.title}</h1>
      </header>

      <div className="ln-segs">
        {segments.map((seg, si) => {
          const segColor = seg.module ? MODULE_COLORS[seg.colorIdx % MODULE_COLORS.length] : undefined;
          const nodes = (
            <div className="ln-path">
              {seg.items.map(({ view, index }) => (
                <PostaNode key={view.posta.id} view={view} index={index} onPlay={play} color={segColor} />
              ))}
            </div>
          );
          if (!seg.module) return <div key={`seg-${si}`}>{nodes}</div>;
          return (
            <section key={seg.module.id} className="ln-seg">
              <ModuleHeader
                module={seg.module}
                colorIdx={seg.colorIdx}
                onOpen={seg.module.source?.url ? () => setContent(seg.module!) : undefined}
              />
              {nodes}
            </section>
          );
        })}
      </div>

      {activity && activity.definitionId && (
        <ActivityOverlay
          definitionId={activity.definitionId}
          title={activity.title}
          target={activity.target}
          source={`ruta:${route.id}/posta:${activity.id}`}
          reading={activity.reading}
          onClose={() => setActivity(null)}
        />
      )}

      {recall && (
        <ActivityOverlay
          recallTargets={recall.targets}
          recallCount={Math.min(5, recall.targets.length)}
          title={recall.posta.title}
          target={recall.posta.target}
          source={`ruta:${route.id}/posta:${recall.posta.id}`}
          onClose={() => setRecall(null)}
        />
      )}

      {/* Contenido del módulo (tap en el header sticky = "guidebook"): mirar/leer la fuente. */}
      {content?.source && (
        content.source.kind === 'video' && content.source.videoId ? (
          <VideoReadingView
            videoId={content.source.videoId}
            title={content.source.title}
            ctaLabel="✕ Cerrar"
            onCta={() => setContent(null)}
            onClose={() => setContent(null)}
          />
        ) : (
          <ReadingView
            url={content.source.url}
            title={content.source.title}
            trusted
            ctaLabel="✕ Cerrar"
            onCta={() => setContent(null)}
            onClose={() => setContent(null)}
          />
        )
      )}

      {/* Placeholder de "abrir la instancia de actividad" (posta SIN definición: el paso 3 del POC lo reemplaza por la
          actividad real; hoy toda posta generada trae su definición). */}
      {pending && createPortal(
        <div className="shov ln-pend" onClick={() => setPending(null)}>
          <div className="ln-pend-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setPending(null)} aria-label="Cerrar" className="ln-ib ln-pend-x"><IcX /></button>
            <div className="ln-pend-emoji" aria-hidden="true">{route.emoji}</div>
            <h2 className="ln-pend-t">{pending.title}</h2>
            <p className="ln-pend-p">Acá se va a abrir la actividad. <br /><span>(próximo paso: enchufar el motor de actividades)</span></p>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
