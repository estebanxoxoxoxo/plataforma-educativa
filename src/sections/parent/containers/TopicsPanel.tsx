import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import type { ParentConfig } from '../../../api/types';
import { ChipEditor, type TermsStatus } from '../components/ChipEditor';
import { PanelState } from '../components/PanelState';
import { parentCall, rejectedReason } from '../lib/adultGate';
import { fmtNum, quoted } from '../lib/format';
import { famTo } from '../lib/member';
import { savedTouchingPreset, useMemberConfig } from '../lib/memberConfig';
import { TERM_LIMITS, termError, termKey } from '../lib/terms';

type Key = 'white' | 'black' | 'words';
const NAME: Record<Key, string> = { white: 'las sugerencias', black: 'los temas que no tienen que aparecer', words: 'las palabras bloqueadas' };

/** "Temas y palabras": lo que la familia promueve, lo que no quiere que aparezca y sus palabras bloqueadas (VISION §10;
 *  audios 8 y 35: el padre programa el algoritmo). Cada cambio se guarda al instante y se aplica en el server: no es un
 *  filtro de pantalla. Lo que el server guardó es lo que se ve (nada optimista); quitar algo se puede deshacer.
 *  U3: todo es del integrante `member` (su config, lib/memberConfig.ts; los POST llevan ?member). Las palabras y temas de un
 *  hermano no se ven acá ni lo alcanzan. */
export function TopicsPanel({ kid, member }: { kid: string; member: string }) {
  const { cfg, failed, reload } = useMemberConfig(member);
  const [busy, setBusy] = useState<Key | null>(null);
  const [status, setStatus] = useState<Record<Key, TermsStatus>>({ white: null, black: null, words: null });
  const cur = useRef<ParentConfig | null>(null);
  const alive = useRef(true);
  cur.current = cfg;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Los avisos de éxito se van solos (con "Deshacer", un rato más); los errores quedan hasta la próxima acción.
  useEffect(() => {
    const keys = (Object.keys(status) as Key[]).filter((k) => status[k]?.kind === 'saved');
    if (!keys.length) return;
    const t = setTimeout(() => setStatus((s) => { const n = { ...s }; for (const k of keys) if (n[k] === status[k]) n[k] = null; return n; }), keys.some((k) => status[k]?.undo) ? 9000 : 6000);
    return () => clearTimeout(t);
  }, [status]);

  const listOf = (c: ParentConfig, k: Key) => (k === 'words' ? c.words.extra : c.topics[k]);
  const say = (k: Key, s: TermsStatus) => setStatus((st) => ({ ...st, [k]: s }));

  /** Guarda la lista completa nueva de `k` (el server la reemplaza) y muestra lo que pasó. */
  const save = async (k: Key, next: string[], ok: string, undo?: () => void): Promise<boolean> => {
    setBusy(k);
    say(k, null);
    try {
      // la respuesta es lo que guardó el server; editar a mano deja el preset sin aplicar (se relee para confirmarlo)
      if (k === 'words') {
        const r = await parentCall(api.parentWords(next, member));
        savedTouchingPreset(member, { words: r, preset: null });
      } else {
        const r = await parentCall(api.parentTopics(k === 'white' ? { white: next } : { black: next }, member));
        savedTouchingPreset(member, { topics: r, preset: null });
      }
      if (alive.current) say(k, { kind: 'saved', text: ok, undo });
      return true;
    } catch (e) {
      // el motivo del server si lo rechazó (p. ej. un choque con la otra lista que esta pestaña todavía no veía)
      if (alive.current) say(k, { kind: 'error', text: rejectedReason(e) ?? 'No se pudo guardar. Revisá la conexión y probá de nuevo.' });
      return false;
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const add = (k: Key) => async (terms: string[]): Promise<boolean> => {
    const c = cur.current;
    if (!c) return false;
    const kind = k === 'words' ? 'palabra' : 'tema';
    for (const t of terms) { const e = termError(t, kind, kid); if (e) { say(k, { kind: 'error', text: e }); return false; } }
    const list = listOf(c, k);
    const have = new Set(list.map(termKey));
    const other: Key | null = k === 'white' ? 'black' : k === 'black' ? 'white' : null;
    const otherKeys = new Set(other ? c.topics[other].map(termKey) : []);
    const fresh: string[] = [], dup: string[] = [], clash: string[] = [];
    for (const t of terms) {
      const key = termKey(t);
      if (have.has(key) || fresh.some((f) => termKey(f) === key)) dup.push(t);
      else if (otherKeys.has(key)) clash.push(t);
      else fresh.push(t);
    }
    if (clash.length && other) { say(k, { kind: 'error', text: `${quoted(clash)} ya ${clash.length === 1 ? 'está' : 'están'} en ${NAME[other]}: sacalo de ahí primero.` }); return false; }
    if (!fresh.length) { say(k, { kind: 'error', text: `${quoted(dup)} ya ${dup.length === 1 ? 'estaba' : 'estaban'} en la lista.` }); return true; }
    const max = k === 'words' ? TERM_LIMITS.words : TERM_LIMITS.topics;
    if (list.length + fresh.length > max) { say(k, { kind: 'error', text: `Hasta ${max} ${k === 'words' ? 'palabras' : 'temas por lista'}. Quitá alguno antes de sumar más.` }); return false; }
    const what = quoted(fresh);
    const ok = k === 'white' ? `Guardado: el Feed ya le sugiere a ${kid} ${what} y el chat lo propone.`
      : k === 'black' ? `Guardado: ${what} ya no le aparece a ${kid} (Feed, búsquedas, lecturas, chat y mensajes).`
      : `Guardado: ${what} ya se frena en búsquedas, títulos, chat y mensajes a amigos.`;
    return save(k, [...list, ...fresh], ok);
  };

  const remove = (k: Key) => (term: string) => {
    const c = cur.current;
    if (!c || busy) return;
    const undo = () => { const now = cur.current; if (now && !listOf(now, k).some((t) => termKey(t) === termKey(term))) void save(k, [...listOf(now, k), term], `Volvió «${term}».`); };
    void save(k, listOf(c, k).filter((t) => t !== term), `Quitado: «${term}».`, undo);
  };

  return (
    <section className="pz-panel" aria-labelledby="pz-topics-h">
      <header className="pz-panel-head">
        <h3 id="pz-topics-h">Temas y palabras</h3>
        <p>Vos le das forma a lo que {kid} ve: qué temas promover, cuáles no tienen que aparecer y qué palabras se frenan. Cada cambio se aplica al instante.</p>
      </header>
      {!cfg && <PanelState failed={failed} onRetry={() => void reload()} />}
      {cfg && (
        <div className="pz-terms-grid">
          <ChipEditor id="white" tone="white" title="Sugerencias de la familia" items={cfg.topics.white} busy={busy === 'white'} status={status.white}
            help={<>Temas que querés promover. El Feed los pone primero —uno de cada tres videos, con «Porque a tu familia le interesa»— y el chat los propone. Guían, no dirigen: el resto sigue los intereses de {kid}.</>}
            empty="Todavía no sugeriste ningún tema." placeholder="Por ejemplo: historia, astronomía" onAdd={add('white')} onRemove={remove('white')} />
          <ChipEditor id="black" tone="black" title="Temas que no tienen que aparecer" items={cfg.topics.black} busy={busy === 'black'} status={status.black}
            help={<>El revisor automático los rechaza en lecturas, chat y mensajes entre amigos; el Feed saca lo que pega con ellos y el nombre se frena en búsquedas. Se suman a los temas que Innerith ya vigila de fábrica (<Link to={famTo('/familia/protecciones', member)} className="pz-inline pz-inline--tight">ver Protecciones</Link>).</>}
            empty="No agregaste temas: rige solo la protección de fábrica." placeholder="Por ejemplo: Halloween, videojuegos violentos" onAdd={add('black')} onRemove={remove('black')} />
          <ChipEditor id="words" tone="word" title="Palabras bloqueadas de la familia" items={cfg.words.extra} busy={busy === 'words'} status={status.words}
            help={<>Corte exacto, sin importar mayúsculas ni tildes y por palabra entera: frena búsquedas, títulos de videos, respuestas del chat y mensajes a amigos. Se suman a las {fmtNum(cfg.words.builtin)} de fábrica.</>}
            empty="No agregaste palabras: rigen las de fábrica." placeholder="Por ejemplo: fortnite, tiktok" onAdd={add('words')} onRemove={remove('words')} />
        </div>
      )}
      <p className="pz-note">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="6.2" r="1.1" fill="currentColor" /></svg>
        Podés sumar varios de una vez separándolos con comas. Un tema no puede estar en las dos listas.
      </p>
    </section>
  );
}
