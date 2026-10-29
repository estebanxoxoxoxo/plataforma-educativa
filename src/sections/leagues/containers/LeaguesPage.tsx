import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../../api';
import type { CloseWeekResult, FamilyCloseResult, FamilyLeague, FamilyPrizeOptions, FamilyPrizeRequest, FamilyWeekPrize } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { useUser } from '../../../hooks/user';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { useFeatures } from '../../parent/lib/features';
import { CloseBanner } from '../components/CloseBanner';
import { FamilyCloseBanner } from '../components/FamilyCloseBanner';
import { FamilyPrizeCard } from '../components/FamilyPrizeCard';
import { FamilyPrizeSheet } from '../components/FamilyPrizeSheet';
import { FamilyRanking } from '../components/FamilyRanking';
import { FamilyWeekCard } from '../components/FamilyWeekCard';
import { FullRanking } from '../components/FullRanking';
import { LeagueCycle } from '../components/LeagueCycle';
import { LeagueIcon } from '../components/LeagueIcon';
import { LeaguePanel } from '../components/LeaguePanel';
import { Ranking } from '../components/Ranking';
import { SimulateCloseChip } from '../components/SimulateCloseChip';
import { LEAGUE_WEEK_CLOSED } from '../lib/cycle';
import { familyCloseOn, prizeCarried, repeatablePrize, repeatRequest } from '../lib/familyWeek';
import { BASE_TABS, FAMILY_TAB, familyTabOn, geoCaption, leagueCaption, resolveTab } from '../lib/tabs';
import { useFontReady } from '../lib/useFontReady';

/** Para medir la fuente de las solapas: TODAS las etiquetas posibles (la de Familia aparece con los datos). */
const TAB_TEXT = [...BASE_TABS, FAMILY_TAB].map((t) => t.label).join(' ');

/** Todo lo de la vista: mi liga (con su ciclo) + su tabla + zona + país + la tabla de la semana de la familia (U4 · D2).
 *  La de la familia va en la MISMA carga pero no la tumba: si falla (o es un chico con Ligas apagadas: 403), la solapa no
 *  aparece y las otras tres siguen. */
async function loadLeagues() {
  const league = await api.myLeague();
  const [standing, zona, pais, family] = await Promise.all([
    api.leagueStanding(league.id),
    api.geoRanking('zona'),
    api.geoRanking('pais'),
    api.familyLeague().catch(() => null),
  ]);
  return { league, standing, zona, pais, family };
}

/** El motivo del server TAL CUAL SOLO en un 400 (los rechazos de la familia, §6.2, escritos para mostrarse); cualquier otro
 *  status (un 500 trae {error:'internal'}, un 404 'not found') o la red caída → el texto de respaldo en castellano. Mismo
 *  criterio que parent/lib/adultGate.rejectedReason. */
const reasonOf = (e: unknown, fallback: string) => (e instanceof ApiError && e.status === 400 && e.reason ? e.reason : fallback);

/** El último cierre simulado de esta visita: el de MI liga (U4) o el de la FAMILIA (U5, solo adulto), con su número de cierre
 *  (re-monta el aviso y los chips: festejo nuevo). */
type Closed = { kind: 'mine'; r: CloseWeekResult; n: number } | { kind: 'family'; r: FamilyCloseResult; n: number };

/** Ligas: el hero de MI liga (asignada por resultados, con su ciclo semanal: cierre + medalla de la semana pasada)
 *  siempre visible y, debajo, solapas deep-linkeables (?tab=, patrón de /espacio/videos): Mi liga (default, sin
 *  parámetro) · Tu zona · País · Familia (U4 · D2, `?tab=familia`: la tabla de la semana de la familia —grandes y chicos,
 *  por los ⚡ que ganó cada uno—; existe solo con ≥ 2 integrantes, si no `?tab=familia` cae en Mi liga), cada una con SOLO
 *  su tabla. Con un ADULTO activo (U4 · D4/U4-B2) su liga y sus tops de zona y país son de OTROS GRANDES: los captions lo
 *  dicen ("12 grandes", "Grandes de Palermo"), nunca "chicos". Contenedor puro: todo sale de la API.
 *  U5 (docs/USUARIOS.md §12): la solapa Familia suma, arriba de la tabla, "La semana pasada" (copa, marcas, historial) y el
 *  premio de la semana (lo ven todos; lo pone, cambia y quita SOLO el adulto —D4— con la hoja FamilyPrizeSheet); la tabla
 *  pinta el reto "N de 7 días" (D2) y el ↑ de quien ya superó su semana.
 *  Al pie, el botón de DEMO (regla 9 de docs/AGENTS.md): "Simular cierre de semana" cierra la semana DE TU LIGA; en la solapa
 *  Familia, para el adulto, "Simular cierre de la semana de la familia" cierra la de TODOS (copa, premio a los ganadores y
 *  las ligas públicas de cada uno). En los dos la vista se vuelve a pedir entera y el aviso del resultado queda arriba. */
export function LeaguesPage() {
  const [params, setParams] = useSearchParams();
  const fontReady = useFontReady('800 14.5px Nunito', TAB_TEXT);
  const { data, error, setData, reload } = useAsync(loadLeagues, []);
  const features = useFeatures();
  const adult = useUser()?.kind === 'adult';
  const go = useNavigate();
  const view = useRef<HTMLElement>(null);
  const [closing, setClosing] = useState(false);
  /** null = sin falla; '' = falla sin motivo (texto de siempre); otro = el motivo del server. */
  const [closeFail, setCloseFail] = useState<string | null>(null);
  const [closed, setClosed] = useState<Closed | null>(null);
  // El premio de la semana (U5, solo adulto): la hoja y las acciones de la tarjeta.
  const [sheet, setSheet] = useState<{ initial: FamilyWeekPrize | null; n: number } | null>(null);
  const [options, setOptions] = useState<FamilyPrizeOptions | null | 'error'>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetErr, setSheetErr] = useState<{ msg: string; n: number } | null>(null);
  const [cardBusy, setCardBusy] = useState<'clear' | 'repeat' | null>(null);
  const [cardErr, setCardErr] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const optSeq = useRef(0);

  const family = data?.family ?? null;
  const familyOn = familyTabOn(family);
  const tabs = familyOn ? [...BASE_TABS, FAMILY_TAB] : BASE_TABS;
  const tab = resolveTab(params.get('tab'), familyOn);
  const meId = family?.rows.find((r) => r.me)?.id;
  const coins = features?.tienda === true;
  /** En la solapa Familia, el adulto (D4) tiene el chip del cierre de la FAMILIA; un chico, el de siempre. */
  const famClose = tab === 'familia' && familyCloseOn(family);

  /** Los datos más recientes (las acciones del premio responden después de un await: no pisar con una foto vieja). */
  const latest = useRef(data);
  useEffect(() => { latest.current = data; });
  const setFamily = (f: FamilyLeague) => { const d = latest.current; if (d) setData({ ...d, family: f }); };
  const scrollTop = () => view.current?.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  const simulateClose = async () => {
    if (closing) return;
    setClosing(true);
    setCloseFail(null);
    let r: CloseWeekResult;
    try { r = await api.closeWeek(); } catch { setClosing(false); setCloseFail(''); return; }
    try { setData(await loadLeagues()); } catch { reload(); }
    setClosed((c) => ({ kind: 'mine', r, n: (c?.n ?? 0) + 1 }));
    setClosing(false);
    // Aviso para lo que muestra el ciclo FUERA de Ligas (p. ej. la medallita del avatar en la barra): que se vuelva a pedir.
    window.dispatchEvent(new CustomEvent(LEAGUE_WEEK_CLOSED, { detail: r }));
    // El botón quedó al pie: el resultado y la semana nueva están arriba.
    scrollTop();
  };

  /** U5 · D4: el cierre de la semana de TODA la familia (solo adulto). El evento de siempre va con `detail = mine` (el cierre
   *  de la liga pública del que apretó): así la medallita del avatar y las medallas se vuelven a pedir sin que Ligas sepa
   *  de ellas. */
  const simulateFamilyClose = async () => {
    if (closing) return;
    setClosing(true);
    setCloseFail(null);
    setCardErr(null);
    let r: FamilyCloseResult;
    try { r = await api.closeFamilyWeek(); } catch (e) { setClosing(false); setCloseFail(reasonOf(e, '')); return; }
    try { setData(await loadLeagues()); } catch { reload(); }
    setClosed((c) => ({ kind: 'family', r, n: (c?.n ?? 0) + 1 }));
    setClosing(false);
    window.dispatchEvent(new CustomEvent(LEAGUE_WEEK_CLOSED, { detail: r.mine }));
    scrollTop();
  };

  /* ---------- el premio de la semana (§3.2): la hoja, quitar y repetir ---------- */
  /** El foco vuelve al botón que abrió la hoja; si ya no está (el premio cambió la tarjeta), al título de la tarjeta. */
  const refocusPrize = () => {
    const btn = opener.current;
    opener.current = null;
    requestAnimationFrame(() => {
      if (btn?.isConnected && !(btn as HTMLButtonElement).disabled) { btn.focus(); return; }
      view.current?.querySelector<HTMLElement>('[data-lgp-focus]')?.focus();
    });
  };
  const loadOptions = () => {
    const n = ++optSeq.current;
    setOptions(null);
    api.familyPrizeOptions().then(
      (o) => { if (n === optSeq.current) setOptions(o); },
      () => { if (n === optSeq.current) setOptions('error'); },
    );
  };
  const openSheet = (btn: HTMLElement) => {
    opener.current = btn;
    setSheetErr(null);
    setCardErr(null);
    setSheet((s) => ({ initial: family?.prize ?? null, n: (s?.n ?? 0) + 1 }));
    loadOptions();
  };
  const closeSheet = () => {
    if (sheetBusy) return;
    setSheet(null);
    refocusPrize();
  };
  const submitPrize = async (req: FamilyPrizeRequest) => {
    if (sheetBusy) return;
    setSheetBusy(true);
    try {
      setFamily(await api.setFamilyPrize(req));
      setSheet(null);
      setSheetErr(null);
      opener.current = null; // la tarjeta cambió: el foco va a su título
      refocusPrize();
    } catch (e) {
      setSheetErr((s) => ({ msg: reasonOf(e, 'No pude guardar el premio ahora. Probá de nuevo en un ratito.'), n: (s?.n ?? 0) + 1 }));
    } finally {
      setSheetBusy(false);
    }
  };
  const clearPrize = async () => {
    if (cardBusy) return;
    setCardBusy('clear');
    setCardErr(null);
    try {
      setFamily(await api.clearFamilyPrize());
      refocusPrize();
    } catch (e) {
      setCardErr(reasonOf(e, 'No pude quitar el premio ahora. Probá de nuevo en un ratito.'));
    } finally {
      setCardBusy(null);
    }
  };
  /** "Repetir el de la semana pasada": re-envía el premio que se consumió como texto literal, sin `from` (si el ítem
   *  de la Tienda cambió o se archivó, lo prometido se conserva igual). */
  const repeatPrize = async () => {
    const p = family ? repeatablePrize(family) : null;
    if (!p || cardBusy) return;
    setCardBusy('repeat');
    setCardErr(null);
    try {
      setFamily(await api.setFamilyPrize(repeatRequest(p)));
      refocusPrize();
    } catch (e) {
      setCardErr(reasonOf(e, 'No pude poner el premio ahora. Probá de nuevo en un ratito.'));
    } finally {
      setCardBusy(null);
    }
  };

  return (
    <section className="view" id="v-leagues" ref={view}>
      <h2 className="h2">Ligas</h2>
      <p className="lede">Tu liga se asigna según tus resultados. Con tu puntaje también tenés un puesto en tu zona y en el país.</p>
      {closed?.kind === 'mine' && (
        <CloseBanner key={closed.n} r={closed.r} coins={coins} onDismiss={() => setClosed(null)} onFeed={() => go('/')} />
      )}
      {closed?.kind === 'family' && (
        <FamilyCloseBanner key={closed.n} r={closed.r} meId={meId} coins={coins} onDismiss={() => setClosed(null)} onFeed={() => go('/')} />
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
        {/* key: la tinta se vuelve a medir con la fuente real y cuando aparece la solapa Familia */}
        <UnderlineTabs key={`${fontReady ? 'font' : 'fallback'}-${tabs.length}`} tabs={tabs} value={tab}
          onChange={(t) => { setCloseFail(null); setParams(t === 'liga' ? {} : { tab: t }); }} className="ltabs" tabClass="ltab" inkClass="ltink" />
        <div className="lpanels">
          <LeaguePanel on={tab === 'liga'} label="Mi liga" caption={leagueCaption(data.league.name, data.league.total, adult)}>
            <FullRanking rows={data.standing.rows} />
          </LeaguePanel>
          <LeaguePanel on={tab === 'zona'} label="Tu zona" caption={geoCaption(data.zona.name, adult)}><Ranking r={data.zona} /></LeaguePanel>
          <LeaguePanel on={tab === 'pais'} label="País" caption={geoCaption(data.pais.name, adult)}><Ranking r={data.pais} /></LeaguePanel>
          {familyOn && family && (
            <LeaguePanel on={tab === 'familia'} label="Familia" caption="Tu familia · esta semana">
              <div className="lgw-top">
                <FamilyWeekCard history={family.history ?? []} meId={meId} />
                <FamilyPrizeCard prize={family.prize ?? null} carried={prizeCarried(family)} repeatable={repeatablePrize(family)}
                  manage={family.canManage === true} meId={meId} busy={cardBusy} error={cardErr}
                  onOpen={openSheet} onClear={() => void clearPrize()} onRepeat={() => void repeatPrize()} />
              </div>
              <FamilyRanking rows={family.rows} prize={family.prize ?? null} coins={coins} />
            </LeaguePanel>
          )}
        </div>
        {famClose ? (
          <SimulateCloseChip busy={closing} failed={closeFail !== null} failedText={closeFail} onClick={() => void simulateFamilyClose()}
            label="Simular cierre de la semana de la familia" busyLabel="Cerrando la semana de la familia…"
            title="Botón de demo: cierra ahora la semana de toda la familia (copa, premio y la liga de cada uno)" />
        ) : (
          <SimulateCloseChip busy={closing} failed={closeFail !== null} onClick={() => void simulateClose()} />
        )}
      </>}
      {sheet && (
        <FamilyPrizeSheet key={sheet.n} initial={sheet.initial} options={options} busy={sheetBusy}
          error={sheetErr?.msg ?? null} errorSeq={sheetErr?.n ?? 0}
          onSubmit={(req) => void submitPrize(req)} onRetryOptions={loadOptions} onClose={closeSheet} />
      )}
    </section>
  );
}
