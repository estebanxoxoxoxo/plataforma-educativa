import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { type ActivityHandle, type ActivityInstance, type CommonSnapshot } from '../../../learn/activity';
import { buildDefinition, definitionFor } from '../../../learn/definitions';
import { boardFor, TYPES } from '../../../learn/registry';
import { VisualStage, createVisualBridge, type VisualSink } from '../../../learn/visual';
import { createAudioBridge } from '../../../learn/audio/audioBridge';
import { audioSink } from '../../../learn/audio/service';
import { pushScene, updateScene, popScene, type Scene } from '../../../learn/audio/sceneDirector';
import { buildRecallActivity } from '../../../learn/recallActivity';
import { MULTI_ID, isChildFinished } from '../../../learn/activities/multi';
import type { LearnReading } from '../../../api/types';
import { useFeatures } from '../../parent/lib/features';
import { Runner } from '../components/ActivityChrome';
import { recordResult } from '../lib/learnData';
import { useOverlay } from '../lib/overlayNav';
import { ReadingView } from './ReadingView';
import { VideoReadingView } from './VideoReadingView';

/* Overlay a pantalla completa de una INSTANCIA de actividad desde una posta. La
   Definición (catálogo) dice el Tipo; el REGISTRY resuelve módulo+tablero. Marco
   (chrome): lobby → cuenta regresiva → juego → resultado, sobre el VisualStage
   (fondo+efectos), dirigido por el mismo stream de eventos. */

/* PORTE INNERITH (W3+W4): port EXACTO de smarty-poc app/src/learn/ActivityOverlay.tsx @ 47f434b — fases de contenido
   (lectura / video → "Empezar preguntas"), lobby/cuenta/juego/resultado (components/ActivityChrome), makeSeed, el multi de
   ACTIVE RECALL (acotado a K en una posta de repaso, sin fin en la raíz), PERSISTENCIA PRIMERO (el hijo de un multi a SU
   target; el resultado externo al target de la posta salvo en el recall; el agregado de un multi con rollup:true),
   VisualStage + puentes visual/audio y las escenas del SceneDirector por fase (gano/perdio al terminar). Cambios:
   · se dibuja en un portal sobre <body> (pantalla completa por encima del menú, la barra y el dock de Innerith);
   · economía Innerith (desvío aprobado): si el server acreditó ⚡ por una fila de esta partida, el resultado lo muestra
     chiquito ("+30 ⚡"; con la Tienda apagada no se nombra la moneda);
   · si una definición rompe al acuñarse (generador/portero: el import del server todavía no hace el acuñado seco
     completo, pendiente de W1), se muestra el MISMO error del POC en vez de tumbar la página (en el POC el import ya
     la habría rechazado). */

let seq = 0;
function makeSeed(): number {
  seq += 1;
  return (Date.now() + seq * 2654435761) >>> 0;
}

type Board = ComponentType<{ engine: unknown }>;
type Handle = ActivityHandle<ActivityInstance<CommonSnapshot>>;

/** Fase del overlay → escena de audio (el SceneDirector cruza el tema). finished → ganó/perdió aparte. */
const phaseScene = (p: 'reading' | 'video' | 'activity'): Scene =>
  p === 'reading' ? 'lectura' : p === 'video' ? 'video' : 'actividad';

function buildActivity(definitionId: string): Handle | null {
  const def = definitionFor(definitionId);
  if (!def) return null; // definición desconocida → el overlay muestra el error, sin jugar otra cosa
  try {
    return buildDefinition(def.id, makeSeed());
  } catch (e) {
    console.error(`[learn] no pude acuñar «${definitionId}»:`, e);
    return null;
  }
}

export function ActivityOverlay({
  definitionId,
  title,
  target,
  source,
  onClose,
  recallTargets,
  recallCount,
  reading,
}: {
  definitionId?: string;
  title: string;
  target: string;
  source: string;
  onClose: () => void;
  /** Si viene, es ACTIVE RECALL: arma un multi con estos objetivos due (en vez de una
   *  Definición del catálogo) y graba sólo los sub-resultados. */
  recallTargets?: string[];
  /** Recall ACOTADO a K ejercicios (posta in-route). Sin esto = endless (raíz). */
  recallCount?: number;
  /** Contenido a mostrar ANTES de la actividad (fase de presentación de la posta): artículo
   *  (default) o video de YouTube (kind:'video' + videoId). No aplica al recall. La
   *  actividad/motor no lo conoce: es UI del overlay. */
  reading?: LearnReading;
}) {
  const { close, z } = useOverlay(onClose);
  const [gameNo, setGameNo] = useState(0);
  // Fase de presentación: si la posta trae contenido (y no es recall), se consume ANTES de la
  // actividad (leer el artículo o mirar el video). El Runner NO arranca hasta 'activity'.
  const [phase, setPhase] = useState<'reading' | 'video' | 'activity'>(
    reading && !recallTargets ? (reading.kind === 'video' ? 'video' : 'reading') : 'activity',
  );
  // Economía Innerith: ⚡ acreditados en la partida en curso (se suman los de cada fila que pagó).
  const [awarded, setAwarded] = useState<{ game: number; ec: number }>({ game: 0, ec: 0 });
  const showCoins = useFeatures()?.tienda === true;
  const gameRef = useRef(gameNo);
  gameRef.current = gameNo;

  // Escena de audio: la fase (lectura/video/actividad) va al stack del SceneDirector; el `finished` la
  // pasa a ganó/perdió. Push al montar / pop al desmontar → al cerrar, el stack vuelve a 'ruta' (RutaView).
  const sceneIdRef = useRef<number | null>(null);
  useEffect(() => {
    const id = pushScene(phaseScene(phase));
    sceneIdRef.current = id;
    return () => popScene(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (sceneIdRef.current != null) updateScene(sceneIdRef.current, phaseScene(phase));
  }, [phase, gameNo]);
  // gameNo en deps a propósito: "jugar de nuevo" lo incrementa para reconstruir la actividad
  const handle = useMemo<Handle | null>(
    () => (recallTargets ? buildRecallActivity(recallTargets, makeSeed(), recallCount != null ? { count: recallCount } : undefined) : buildActivity(definitionId ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [definitionId, gameNo, recallTargets, recallCount],
  );
  const def = definitionId ? definitionFor(definitionId) : undefined;
  const Board: Board = recallTargets ? TYPES.multi.Board : ((def ? boardFor(def.typeId) : null) ?? TYPES.domino.Board);

  const stageRef = useRef<VisualSink | null>(null);
  const visualProxyRef = useRef<VisualSink>({
    burst: (o) => stageRef.current?.burst(o),
    flash: (t) => stageRef.current?.flash(t),
    shake: (i) => stageRef.current?.shake(i),
    pop: (o) => stageRef.current?.pop(o),
    setBackground: (m) => stageRef.current?.setBackground(m),
  });

  useEffect(() => {
    if (!handle) return;
    const game = gameRef.current;
    const visual = createVisualBridge(visualProxyRef.current);
    const audio = createAudioBridge(audioSink);
    const paid = (a: { ec: number } | undefined) => {
      if (a && a.ec > 0) setAwarded((prev) => (prev.game === game ? { game, ec: prev.ec + a.ec } : { game, ec: a.ec }));
    };
    const unsub = handle.onEvent((e) => {
      // PERSISTENCIA PRIMERO: el guardado no puede depender de que los efectos no tiren.
      // — sub-resultado de una multi-actividad → se graba a SU objetivo (mueve las
      //   postas reales). Aplica al recall y a cualquier multi posta.
      if (isChildFinished(e)) {
        const d = e.data;
        if (d.target)
          void recordResult({
            target: d.target,
            source,
            definitionId: d.result.definitionId ?? d.definitionId,
            result: d.result,
            // un hijo que a su vez es multi también es agregado (no vale doble para economía)
            rollup: d.result.activityId === MULTI_ID || undefined,
          }).then(paid);
      }
      // — resultado externo (la actividad entera) → al objetivo de la posta. El recall
      //   no graba su outer (es endless / sesión); sólo sus hijos.
      if (e.kind === 'finished' && !recallTargets)
        void recordResult({
          target,
          source,
          definitionId,
          result: e.result,
          // el outer de una multi AGREGA lo que sus hijos ya grabaron → se marca
          // rollup para que la futura economía (XP/EC) no cuente el esfuerzo dos veces
          rollup: e.result.activityId === MULTI_ID || undefined,
        }).then(paid);
      // Escena de audio: al terminar la actividad, ganó/perdió (el director cambia el ánimo del tema).
      if (e.kind === 'finished' && sceneIdRef.current != null)
        updateScene(sceneIdRef.current, e.result.outcome === 'completed' ? 'gano' : 'perdio');
      // Efectos cosméticos, aislados entre sí: si uno tira, no rompe al otro.
      try {
        visual(e);
      } catch (err) {
        console.error('[learn] visualBridge tiró:', err);
      }
      try {
        audio(e);
      } catch (err) {
        console.error('[learn] audioBridge tiró:', err);
      }
    });
    return () => {
      unsub();
      handle.instance.dispose();
    };
  }, [handle, target, source, definitionId, recallTargets]);

  // El fondo (música del chico) lo maneja el SceneDirector por escena (fade en actividad/lectura,
  // pausa en video) — es el único dueño del duck (SCENE_DIRECTOR.md). Antes acá se pausaba directo.

  // FASE VIDEO: el contenido es un video de YouTube → se reproduce a pantalla completa
  // (mismo patrón que la lectura); "Empezar preguntas" pasa a la fase de actividad.
  if (phase === 'video' && reading?.videoId) {
    return (
      <VideoReadingView
        videoId={reading.videoId}
        title={reading.title}
        ctaLabel="Empezar preguntas →"
        onCta={() => setPhase('activity')}
        onClose={() => setPhase('activity')}
      />
    );
  }

  // FASE LECTURA: se muestra el lector zen a pantalla completa (su hábitat), anidado en la
  // pila de overlays; "Empezar preguntas" (onClose del lector) pasa a la fase de actividad.
  if (phase === 'reading' && reading) {
    // onCta cambia la fase DIRECTO (no vía history.back): evita ambigüedad de la pila de
    // overlays anidada (ReadingView tiene su propia entrada). onClose (atrás del navegador) idem.
    return (
      <ReadingView
        url={reading.url}
        title={reading.title}
        trusted
        ctaLabel="Empezar preguntas →"
        onCta={() => setPhase('activity')}
        onClose={() => setPhase('activity')}
      />
    );
  }

  if (!handle) {
    return createPortal(
      <div className="ln-ov ln-ov-err" style={{ zIndex: z }}>
        <div className="ln-err">
          <p className="ln-err-emoji" aria-hidden="true">🧩</p>
          <p className="ln-err-t">No encontré esta actividad</p>
          <p className="ln-err-p">La definición «{definitionId}» no está en el catálogo.</p>
          <button type="button" className="ln-btn ln-btn-quiet" onClick={close}>Cerrar</button>
        </div>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div className="ln-ov" style={{ zIndex: z }}>
      <VisualStage ref={stageRef} className="ln-ov-stage">
        <Runner
          instance={handle.instance}
          Board={Board}
          title={title}
          awardedEc={showCoins && awarded.game === gameNo ? awarded.ec : 0}
          onPlayAgain={() => setGameNo((n) => n + 1)}
          onClose={close}
        />
      </VisualStage>
    </div>,
    document.body,
  );
}
