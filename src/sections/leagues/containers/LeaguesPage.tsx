import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../api';
import type { CloseWeekResult } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { useFeatures } from '../../parent/lib/features';
import { CloseBanner } from '../components/CloseBanner';
import { FullRanking } from '../components/FullRanking';
import { LeagueCycle } from '../components/LeagueCycle';
import { LeagueIcon } from '../components/LeagueIcon';
import { LeaguePanel } from '../components/LeaguePanel';
import { Ranking } from '../components/Ranking';
import { SimulateCloseChip } from '../components/SimulateCloseChip';
import { LEAGUE_WEEK_CLOSED } from '../lib/cycle';
import { useFontReady } from '../lib/useFontReady';

type LTab = 'liga' | 'zona' | 'pais';
const TABS: { id: LTab; label: string }[] = [
  { id: 'liga', label: 'Mi liga' },
  { id: 'zona', label: 'Tu zona' },
  { id: 'pais', label: 'País' },
];

/** Todo lo de la vista: mi liga (con su ciclo) + su tabla + zona + país. */
async function loadLeagues() {
  const league = await api.myLeague();
  const [standing, zona, pais] = await Promise.all([
    api.leagueStanding(league.id),
    api.geoRanking('zona'),
    api.geoRanking('pais'),
  ]);
  return { league, standing, zona, pais };
}

/** Ligas: el hero de MI liga (asignada por resultados, con su ciclo semanal: cierre + medalla de la semana pasada)
 *  siempre visible y, debajo, tres solapas deep-linkeables (?tab=, patrón de /espacio/videos): Mi liga (default,
 *  sin parámetro) · Tu zona · País, cada una con SOLO su tabla. Contenedor puro: todo sale de la API.
 *  Al pie, el botón de DEMO "Simular cierre de semana" (regla 9 de docs/AGENTS.md): el server cierra la semana y la vista
 *  se vuelve a pedir entera; la semana nueva llega junto con el aviso del resultado (arriba, sin parpadeo). */
export function LeaguesPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('tab');
  const tab: LTab = q === 'zona' || q === 'pais' ? q : 'liga';
  const fontReady = useFontReady('800 14.5px Nunito', TABS.map((t) => t.label).join(' '));
  const { data, error, setData, reload } = useAsync(loadLeagues, []);
  const features = useFeatures();
  const go = useNavigate();
  const view = useRef<HTMLElement>(null);
  const [closing, setClosing] = useState(false);
  const [closeFailed, setCloseFailed] = useState(false);
  /** El último cierre simulado en esta visita (el aviso) y cuántos van (re-monta el aviso y los chips: festejo nuevo). */
  const [closed, setClosed] = useState<{ r: CloseWeekResult; n: number } | null>(null);

  const simulateClose = async () => {
    if (closing) return;
    setClosing(true);
    setCloseFailed(false);
    let r: CloseWeekResult;
    try { r = await api.closeWeek(); } catch { setClosing(false); setCloseFailed(true); return; }
    try { setData(await loadLeagues()); } catch { reload(); }
    setClosed((c) => ({ r, n: (c?.n ?? 0) + 1 }));
    setClosing(false);
    // Aviso para lo que muestra el ciclo FUERA de Ligas (p. ej. la medallita del avatar en la barra): que se vuelva a pedir.
    window.dispatchEvent(new CustomEvent(LEAGUE_WEEK_CLOSED, { detail: r }));
    // El botón quedó al pie: el resultado y la semana nueva están arriba.
    view.current?.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return (
    <section className="view" id="v-leagues" ref={view}>
      <h2 className="h2">Ligas</h2>
      <p className="lede">Tu liga se asigna según tus resultados. Con tu puntaje también tenés un puesto en tu zona y en el país.</p>
      {closed && (
        <CloseBanner key={closed.n} r={closed.r} coins={features?.tienda === true}
          onDismiss={() => setClosed(null)} onFeed={() => go('/')} />
      )}
      {error && <p className="lempty">No pude cargar las ligas ahora. Probemos de nuevo en un ratito.</p>}
      {data && <>
        <div className="lhead">
          <LeagueIcon color={data.league.color} />
          <div>
            {/* Los chips del ciclo van A LA DERECHA del título (pedido 9-oct): el bloque queda de dos
                líneas parejas (título+chips / lede) y el ícono centra bien contra las dos. */}
            <div className="ltitle-row">
              <h3 className="ltitle">{data.league.name}</h3>
              <LeagueCycle key={closed?.n ?? 0} league={data.league} fresh={!!closed} />
            </div>
            <p className="lede">Asignada por tus resultados · Tu puesto {data.league.pos} de {data.league.total} · {data.league.xp.toLocaleString('es-AR')} XP esta semana{data.league.closesInDays === undefined && ` · cierra ${data.league.closes}`}</p>
          </div>
        </div>
        <UnderlineTabs key={fontReady ? 'font' : 'fallback'} tabs={TABS} value={tab} onChange={(t) => setParams(t === 'liga' ? {} : { tab: t })}
          className="ltabs" tabClass="ltab" inkClass="ltink" />
        <div className="lpanels">
          <LeaguePanel on={tab === 'liga'} label="Mi liga" caption={`${data.league.name} · ${data.league.total} chicos`}>
            <FullRanking rows={data.standing.rows} />
          </LeaguePanel>
          <LeaguePanel on={tab === 'zona'} label="Tu zona" caption={data.zona.name}><Ranking r={data.zona} /></LeaguePanel>
          <LeaguePanel on={tab === 'pais'} label="País" caption={data.pais.name}><Ranking r={data.pais} /></LeaguePanel>
        </div>
        <SimulateCloseChip busy={closing} failed={closeFailed} onClick={() => void simulateClose()} />
      </>}
    </section>
  );
}
