import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../api';
import type { AssignedLeague, LeagueStanding } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { useFeatures } from '../../parent/lib/features';
import { LeagueIcon } from '../../leagues/components/LeagueIcon';
import { ensureAudio } from '../../../learn/audio/service';
import { definitionsForTarget } from '../../../learn/definitions';
import { recallableTargets } from '../../../learn/recallActivity';
import { RouteCard, RouteCardSkeleton } from '../cards/RouteCard';
import { IcNavLearn } from '../../../shared/components/icons';
import { IcPlus } from '../components/LearnIcons';
import { RecallRootButton } from '../components/RecallRootButton';
import { bindLearnBgAudio } from '../lib/bgAudioBinding';
import { LEARN_CATEGORIES, progressByTarget, routeProgress, type LearnRoute } from '../lib/learn';
import { loadLearn, useLearnData } from '../lib/learnData';
import { ActivityOverlay } from './ActivityOverlay';
import { RouteView } from './RouteView';

/* Sección "Aprender" (Learn) — BETA, gateada por settings.learnActivo.
   Grilla de Rutas (cards) AGRUPADA por categoría + entrada raíz "Active recall" (repaso
   cross-ruta, scroll infinito, se calcula al vuelo desde la maestría). Ver ACTIVIDADES.md §5/§7. */

/* PORTE INNERITH (W3+W4): port EXACTO de smarty-poc app/src/zones/child/Learn.tsx @ 47f434b — Aprender y Practicar
   COLAPSADOS en una sola sección: el mosaico de las rutas del catálogo (las que genera /crear) agrupado por categoría (las
   de LEARN_CATEGORIES en su orden → las otras alfabético → "Sin categoría"; con un solo grupo, grilla plana), la entrada
   raíz de ACTIVE RECALL (≥1 objetivo jugado con Definición hoja; "· N temas" = esos objetivos; el orden por urgencia se
   calcula UNA vez en el gesto y el repaso no termina: cicla hasta Rendirse o cerrar) y la ruta abierta como ESTADO del
   componente (no URL; "Atrás" con una ruta abierta sale de Aprender, como en el POC). Abrir una ruta o el recall es el
   GESTO que desbloquea el audio. Estética de Innerith (encabezado con el botón Crear de siempre).
   No se porta: el panel TEMP "Probar YouTube" (trampa 37) ni el gate `learnActivo` (en Innerith Aprender está siempre).
   Desvíos de integración (aprobados): `?ruta=<id>` abre esa ruta directo (lo usa el hero del Feed) y se limpia al abrirla;
   el botón raíz espera la HIDRATACIÓN del motor antes de decidir si aparece (trampa 16: en el POC, en frío, podía no
   aparecer). */

const UNCATEGORIZED = 'Sin categoría';

// El SceneDirector de Learn manda sobre la música de fondo del chico (el MiniPlayer real).
bindLearnBgAudio();

export function LearnPage() {
  const go = useNavigate();
  const [params, setParams] = useSearchParams();
  const { routes, rows: rowsRaw, hydrated, defsRev, failed } = useLearnData();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [recall, setRecall] = useState<string[] | null>(null);
  const board = useLeagueBoard();

  // Al ENTRAR a la sección: rutas + hidratación del motor (todas las definiciones) + resultados.
  useEffect(() => { void loadLearn(); }, []);

  // Abrir una ruta es un GESTO → desbloquea el audio (autoplay); desde ahí el SceneDirector musicaliza
  // (RutaView pushea la escena 'ruta'). Ver SCENE_DIRECTOR.md.
  const openRoute = (id: string) => { void ensureAudio(); setRouteId(id); };

  // `?ruta=<id>` (hero y cards del Feed): abre esa ruta y limpia el parámetro (la ruta abierta no vive en la URL).
  const wanted = params.get('ruta');
  useEffect(() => {
    if (!wanted || !routes) return;
    if (routes.some((r) => r.id === wanted)) openRoute(wanted);
    setParams((p) => { p.delete('ruta'); return p; }, { replace: true });
  }, [wanted, routes, setParams]);

  const allRoutes = useMemo(() => routes ?? [], [routes]);
  const rows = useMemo(() => rowsRaw ?? [], [rowsRaw]);
  const byTarget = useMemo(() => progressByTarget(rows), [rows]);

  // Agrupar por categoría: conocidas (orden de LEARN_CATEGORIES) → otras (alfabético) → sin categoría.
  const groups = useMemo(() => {
    const byCat = new Map<string, LearnRoute[]>();
    for (const r of allRoutes) {
      const cat = r.category?.trim() || UNCATEGORIZED;
      const arr = byCat.get(cat);
      if (arr) arr.push(r);
      else byCat.set(cat, [r]);
    }
    const known = LEARN_CATEGORIES.filter((c) => byCat.has(c));
    const custom = [...byCat.keys()].filter((c) => c !== UNCATEGORIZED && !LEARN_CATEGORIES.includes(c)).sort((a, b) => a.localeCompare(b));
    const order = [...known, ...custom, ...(byCat.has(UNCATEGORIZED) ? [UNCATEGORIZED] : [])];
    return order.map((cat) => ({ cat, routes: byCat.get(cat)! }));
  }, [allRoutes]);

  const route = routeId ? allRoutes.find((r) => r.id === routeId) : null;

  // ¿hay algo para repasar? = objetivos leaf ya jugados (sin depender de `now`, para el render).
  // Se calcula recién con el catálogo HIDRATADO (defsRev): sin eso, en frío, quedaba vacío.
  const reviewable = useMemo(() => {
    if (!hydrated) return [];
    const seen = new Set(rows.map((r) => r.target));
    return [...seen].filter((t) => definitionsForTarget(t).some((d) => d.typeId !== 'multi'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, hydrated, defsRev]);

  // el orden por urgencia (con `now`) se calcula en el gesto, no en el render
  const openRecall = () => {
    void ensureAudio(); // gesto → desbloquea el audio para el recall
    const order = recallableTargets(rows, Date.now());
    if (order.length) setRecall(order);
  };

  if (route) return <RouteView route={route} onBack={() => setRouteId(null)} />;

  const card = (r: LearnRoute, i: number) => {
    const { done, total } = routeProgress(r, byTarget);
    return <RouteCard key={r.id} route={r} done={done} total={total} index={i} onOpen={() => openRoute(r.id)} />;
  };

  return (
    <section className="view" id="v-learn">
      <div className="lp-head">
        {/* Ícono + título, sin subtítulo, como Calendario (pedido de Esteban, 30-oct). */}
        <div className="lp-title">
          <span className="lp-tico" aria-hidden="true"><IcNavLearn /></span>
          <h2 className="h2">Aprender</h2>
        </div>
        {/* Crear vive DENTRO de Aprender (pedido 12-oct): botón a la altura del título, va a /crear. «+ Crear» con el azul
            de Active recall (pedido de Esteban, 30-oct): el + dice «hacé una ruta nueva» mejor que el ícono del menú. */}
        <button className="lp-create" onClick={() => go('/crear')}>
          <IcPlus />Crear
        </button>
      </div>

      {/* El menú contextual de Aprender (pedidos de Esteban, 30-oct): PRIMERO Active recall, después la liga COMPLETA
          (la tabla entera, no el resumen). Sin nada que mostrar, no hay columna y la vista usa todo el ancho (:has). */}
      {(reviewable.length > 0 || board) && (
        <aside className="lp-aside">
          <p className="lp-aside-k">Destacado</p>
          {reviewable.length > 0 && <RecallRootButton count={reviewable.length} onOpen={openRecall} />}
          {board && <LearnLeagueCard board={board} />}
        </aside>
      )}

      <div className="lp-main">

      {!routes ? (
        failed ? (
          <div className="ln-fail">
            <p>No pude traer tus rutas. Probá de nuevo en un ratito.</p>
            <button type="button" className="ln-btn ln-btn-quiet" onClick={() => void loadLearn()}>Reintentar</button>
          </div>
        ) : (
          <div className="ln-grid">{Array.from({ length: 4 }, (_, i) => <RouteCardSkeleton key={i} />)}</div>
        )
      ) : groups.length <= 1 ? (
        <div className="ln-grid">{allRoutes.map(card)}</div>
      ) : (
        groups.map(({ cat, routes: rs }) => (
          <section key={cat} className="ln-cat">
            <h3 className="ln-cat-h">
              {cat} <span>· {rs.length}</span>
            </h3>
            <div className="ln-grid">{rs.map(card)}</div>
          </section>
        ))
      )}
      </div>

      {recall && (
        <ActivityOverlay
          recallTargets={recall}
          title="Active recall"
          target="active-recall"
          source="active-recall"
          onClose={() => setRecall(null)}
        />
      )}
    </section>
  );
}

/** La liga de Aprender para el menú contextual (pedidos de Esteban, 30-oct: «como contextual de aprender que esté la
 *  liga» y «luego la liga completa»): el resumen y, apenas llega, la TABLA entera (leagueStanding). Solo un CHICO con
 *  Ligas prendidas; si nada llega (403, red), null y no hay tarjeta. */
type LeagueBoard = { l: AssignedLeague; rows: LeagueStanding['rows'] | null };
function useLeagueBoard(): LeagueBoard | null {
  const kid = useUser()?.kind === 'child';
  const ligasOn = useFeatures()?.ligas === true;
  const [b, setB] = useState<LeagueBoard | null>(null);
  useEffect(() => {
    if (!kid || !ligasOn) { setB(null); return; }
    let alive = true;
    api.myLeague().then(async (l) => {
      if (!alive) return;
      setB({ l, rows: null });
      try {
        const s = await api.leagueStanding(l.id);
        if (alive) setB({ l, rows: s.rows });
      } catch { /* sin tabla queda el resumen */ }
    }, () => { if (alive) setB(null); });
    return () => { alive = false; };
  }, [kid, ligasOn]);
  return b;
}

function LearnLeagueCard({ board }: { board: LeagueBoard }) {
  const { l, rows } = board;
  return (
    <Link className="lp-league" to="/ligas" aria-label={`${l.name}: puesto ${l.pos} de ${l.total}. Ver las ligas`}>
      <span className="lp-lg-head">
        <LeagueIcon color={l.color} />
        <span className="lp-lg-tx">
          <b>{l.name}</b>
          <small>Tu puesto {l.pos} de {l.total} · {l.xp.toLocaleString('es-AR')} XP esta semana</small>
        </span>
      </span>
      {rows && (
        <span className="lp-lg-rows">
          {rows.map((r) => (
            <span key={r.pos} className={`lp-lg-row${r.me ? ' is-me' : ''}`}>
              <b>{r.pos}º</b>
              <span className="lp-lg-nick">{r.me ? 'Vos' : r.nick}</span>
              <small>{r.xp.toLocaleString('es-AR')} XP</small>
            </span>
          ))}
        </span>
      )}
      <span className="lp-lg-cta">Ver las ligas ▸</span>
    </Link>
  );
}
