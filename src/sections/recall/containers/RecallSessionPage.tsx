import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../../api';
import type { Answer, Course, Exercise, RecallAnswerResult, RecallCard, RecallFinish } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { IcArrowRight, IcBolt } from '../../../shared/components/icons';
import { useFeatures } from '../../parent/lib/features';
import { Option, type OptState } from '../../practice/cards/Option';
import { VFOption } from '../../practice/cards/VFOption';
import { AiAnalysis } from '../../practice/components/AiAnalysis';
import { ResultBar } from '../../practice/components/ResultBar';
import { TYPES } from '../../practice/lib/exerciseTypes';
import { CiteBox } from '../components/CiteBox';
import { RecallFinishView } from '../components/RecallFinishView';
import { CardSkeleton } from '../components/RecallSkeleton';
import { RecallTop } from '../components/RecallTop';
import { StrengthChange } from '../components/StrengthChange';
import { levelOf, RANK } from '../lib/levels';

type Phase = 'answering' | 'checking' | 'result';
const LETTERS = 'ABCDEFGH';
/** Lo que paga una carta bien en la sesión del día (server/src/recall.ts); las extra no suman. */
const XP_CARD = 5;

/** Cartas que el chico vio subir de nivel, por sesión: sobrevive a "Salir" y volver dentro de la misma carga
 *  (la sesión del día se retoma donde quedó), para marcarlas con ▲ en el resumen. */
const upsBySession = new Map<number, Set<number>>();

/** /repasar/sesion — el mazo de hoy; /repasar/sesion?extra=1 — una sesión extra (sin ⚡). */
export function RecallSessionPage() {
  const [params] = useSearchParams();
  const extra = params.get('extra') === '1';
  return <Deck key={extra ? 'extra' : 'hoy'} extra={extra} />;
}

function Deck({ extra }: { extra: boolean }) {
  const go = useNavigate();
  const coinOn = useFeatures()?.tienda === true;
  // El server devuelve la sesión con las cartas que FALTAN (si ya existía, se retoma) y el total del mazo.
  const { data: s, error, reload } = useAsync(() => api.recallSession(extra), [extra]);
  const { data: courses } = useAsync(() => api.courses().catch(() => [] as Course[]), []);
  const colors = useMemo(() => new Map((courses ?? []).map((c) => [c.id, c.bg[0]])), [courses]);
  const [i, setI] = useState(0);
  const [finish, setFinish] = useState<RecallFinish | null>(null);
  const [finishFailed, setFinishFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const viewRef = useRef<HTMLElement>(null);

  const done = !!s && i >= s.cards.length;
  useEffect(() => {
    if (!s || !done || finish) return;
    let alive = true;
    setFinishFailed(false);
    api.recallFinish(s.id).then((f) => { if (alive) setFinish(f); }, () => { if (alive) setFinishFailed(true); });
    return () => { alive = false; };
  }, [s, done, finish, retry]);
  // Cada carta (y el resumen) arranca arriba: la vista scrollea por dentro de .view.
  useEffect(() => { viewRef.current?.scrollTo(0, 0); }, [i, finish]);

  const next = (r: RecallAnswerResult) => {
    if (!s) return;
    const before = levelOf(Math.max(0, r.fact.strength - r.fact.delta));
    if (RANK[r.fact.level] > RANK[before]) {
      const set = upsBySession.get(s.id) ?? new Set<number>();
      set.add(r.fact.id);
      upsBySession.set(s.id, set);
    }
    setI((x) => x + 1);
  };

  let body;
  if (error) {
    const empty = error instanceof ApiError && error.status === 409;
    body = (
      <div className="exwrap">
        <div className="rc-msg" role="alert">
          <b>{empty ? 'Todavía no hay cartas para repasar' : 'No pude armar tu mazo'}</b>
          <p>{empty ? 'Practicá un poco en Practicar y volvé: lo que vayas aprendiendo aparece acá.' : 'Probá de nuevo en un ratito.'}</p>
          <div className="rc-msg-act">
            {empty
              ? <Link className="rc-start" to="/practicar">Ir a Practicar<IcArrowRight /></Link>
              : <button className="rc-start" onClick={reload}>Reintentar</button>}
            <button className="rc-extra" onClick={() => go('/repasar')}>Volver a Repasar</button>
          </div>
        </div>
      </div>
    );
  } else if (!s) {
    body = <div className="exwrap"><CardSkeleton /></div>;
  } else if (finish) {
    body = (
      <div className="exwrap">
        <RecallFinishView finish={finish} extra={extra} coinOn={coinOn} upIds={upsBySession.get(s.id) ?? new Set()} onBack={() => go('/repasar')} />
      </div>
    );
  } else if (done) {
    body = (
      <div className="exwrap">
        <div className="rc-msg" role={finishFailed ? 'alert' : 'status'}>
          {finishFailed
            ? <><b>No pude armar tu resumen</b><p>Tus respuestas ya quedaron guardadas.</p>
                <div className="rc-msg-act"><button className="rc-start" onClick={() => setRetry((x) => x + 1)}>Reintentar</button>
                  <button className="rc-extra" onClick={() => go('/repasar')}>Volver a Repasar</button></div></>
            : <p className="rc-wait">Contando cómo te fue…</p>}
        </div>
      </div>
    );
  } else {
    const card = s.cards[i];
    body = (
      <CardPlay
        key={card.id} sessionId={s.id} card={card} total={s.total} behind={s.cards.length - i - 1}
        daily={!extra} coinOn={coinOn} color={colors.get(card.course.id)} last={i === s.cards.length - 1}
        onExit={() => go('/repasar')} onNext={next}
      />
    );
  }

  return <section className="view rc-ses" id="v-recall-ses" ref={viewRef}>{body}</section>;
}

/** Una carta en juego. Se remonta por carta: estado y reloj limpios en cada una (como la ficha de Practicar, cuyas
 *  piezas puras reusa: opciones, verdadero/falso, devolución de la abierta y pie con el resultado). */
function CardPlay({ sessionId, card, total, behind, daily, coinOn, color, last, onExit, onNext }: {
  sessionId: number; card: RecallCard; total: number;
  /** Cartas que quedan detrás de esta (para dibujar el mazo) */ behind: number;
  daily: boolean; coinOn: boolean; color?: string; last: boolean;
  onExit: () => void; onNext: (r: RecallAnswerResult) => void;
}) {
  const ex = card.ex;
  const T = TYPES[ex.type];
  const [phase, setPhase] = useState<Phase>('answering');
  const [left, setLeft] = useState(ex.seconds);
  const [clockOn, setClockOn] = useState(true);
  const [text, setText] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [vf, setVf] = useState<boolean | null>(null);
  const [result, setResult] = useState<RecallAnswerResult | null>(null);
  const [failed, setFailed] = useState(false);
  const endRef = useRef<HTMLSpanElement>(null);

  const submit = async (a: Answer) => {
    if (phase !== 'answering') return;
    setPhase('checking');
    setFailed(false);
    try {
      setResult(await api.recallAnswer(sessionId, card.id, a));
      setPhase('result');
    } catch {
      // Sin corrección no hay resultado: vuelve a "responder" (sin reloj, para que no se reenvíe solo).
      setFailed(true);
      setClockOn(false);
      setPhase('answering');
    }
  };

  // Reloj: se corta al enviar; si llega a 0 se envía como "tiempo agotado".
  useEffect(() => {
    if (phase !== 'answering' || !clockOn) return;
    if (left <= 0) { void submit({ kind: 'timeout' }); return; }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase, clockOn]);

  // Con la devolución a la vista, que el botón "Seguir" no quede abajo del pliegue.
  useEffect(() => {
    if (phase === 'result') endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [phase]);

  const ready = ex.type === 'open' ? text.trim().length > 0 : ex.type === 'mc' ? sel.length > 0 : vf !== null;
  const answer = (): Answer => (ex.type === 'open' ? { kind: 'open', text } : ex.type === 'mc' ? { kind: 'mc', selected: sel } : { kind: 'vf', value: vf! });
  const optState = (key: string, picked: boolean): OptState => {
    if (phase !== 'result' || !result?.correctOptions) return picked ? 'sel' : 'idle';
    return result.correctOptions.includes(key) ? 'right' : picked ? 'wrong' : 'idle';
  };
  const toggle = (o: string) => setSel((s) => (o === '__none__' ? (s.includes(o) ? [] : [o]) : s.includes(o) ? s.filter((x) => x !== o) : [...s.filter((x) => x !== '__none__'), o]));
  const locked = phase !== 'answering';
  const hint = ex.type === 'open' ? 'Respondé con tus palabras: no hay una única forma correcta.' : ex.type === 'mc' ? 'Marcá todas las que te parezcan correctas.' : 'Elegí si la afirmación es verdadera o falsa.';
  const label = phase === 'result' ? (last ? 'Ver cómo te fue' : 'Seguir')
    : phase === 'checking' ? (ex.type === 'open' ? 'Analizando…' : 'Revisando…')
    : ex.type === 'open' ? 'Enviar respuesta' : 'Comprobar';

  return (
    <div className="exwrap rc-wrap" style={{ '--c': T.c, '--d': T.d, '--soft': T.soft } as CSSProperties}>
      <RecallTop pos={ex.n} total={total} progress={ex.progress} from={Math.round(((ex.n - 1) / Math.max(1, total)) * 100)} left={left} seconds={ex.seconds} onClose={onExit} />
      <div className={`rc-stack${behind >= 2 ? ' rc-stack--2' : behind === 1 ? ' rc-stack--1' : ''}`}>
        <article className="excard rc-card" aria-label={`Carta ${ex.n} de ${total}`}>
          <div className="exhead">
            <span className="rc-cardtags">
              <span className="extype"><T.G />{T.l}</span>
              <span className="rc-course"><i aria-hidden="true" style={{ background: color ?? '#9AA5C4' }} />{card.course.name}</span>
            </span>
            {daily && <span className="exxp"><IcBolt />+{XP_CARD} XP</span>}
          </div>
          <div className="exbody">
            {renderBody(ex)}
            {phase === 'result' && result && (
              <div className="rc-after">
                <StrengthChange fact={result.fact} />
                <CiteBox cite={result.cite} />
              </div>
            )}
            {failed && <p className="rc-err" role="alert">No pude revisar tu respuesta. Fijate la conexión y probá de nuevo.</p>}
          </div>
          <ResultBar
            result={phase === 'result' ? (result?.correct ? 'good' : 'bad') : undefined}
            title={result?.title} detail={result?.detail} hint={hint} label={label}
            enabled={phase === 'answering' && ready} busy={phase === 'checking'}
            prize={phase === 'result' && daily && coinOn ? result?.xp : undefined}
            onClick={() => (phase === 'result' && result ? onNext(result) : ready && phase === 'answering' && submit(answer()))}
          />
        </article>
      </div>
      <span ref={endRef} className="rc-end" aria-hidden="true" />
    </div>
  );

  function renderBody(e: Exercise) {
    if (e.type === 'open') return <>
      <h3 className="exq">{e.question}</h3>
      <div className="tawrap">
        <textarea className="ta" value={text} onChange={(x) => setText(x.target.value)} placeholder={e.placeholder} readOnly={locked} rows={4} maxLength={600} autoFocus aria-label="Tu respuesta" />
        <small className="tacount">{text.length}/600</small>
      </div>
      {phase !== 'answering' && <AiAnalysis result={result?.ai && { ...result.ai, correct: result.correct }} />}
    </>;
    if (e.type === 'mc') return <>
      <h3 className="exq">{e.question}</h3>
      <p className="hint">{e.hint}</p>
      <div className="opts">
        {e.options.map((o, k) => <Option key={o} letter={LETTERS[k]} label={o} state={optState(o, sel.includes(o))} disabled={locked} onClick={() => toggle(o)} />)}
        <Option none label="Ninguna es correcta" state={optState('__none__', sel.includes('__none__'))} disabled={locked} onClick={() => toggle('__none__')} />
      </div>
    </>;
    return <>
      <h3 className="exq">¿Verdadero o falso?</h3>
      <blockquote className="stmt">{e.statement}</blockquote>
      <div className="vf">
        <VFOption value state={optState('true', vf === true)} disabled={locked} onClick={() => setVf(true)} />
        <VFOption value={false} state={optState('false', vf === false)} disabled={locked} onClick={() => setVf(false)} />
      </div>
    </>;
  }
}
