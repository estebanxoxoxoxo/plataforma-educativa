import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { Answer, AnswerResult, Exercise } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { Option, type OptState } from '../cards/Option';
import { VFOption } from '../cards/VFOption';
import { AiAnalysis } from '../components/AiAnalysis';
import { ExTypeBadge } from '../components/ExTypeBadge';
import { ExerciseBar } from '../components/ExerciseBar';
import { ExerciseFooter } from '../components/ExerciseFooter';
import { TYPES } from '../lib/exerciseTypes';

type Phase = 'answering' | 'checking' | 'result';
/** Se remonta por ejercicio: estado y temporizador limpios en cada uno. */
export function ExercisePage() {
  const { id, n } = useParams();
  return <Exercise_ key={`${id}-${n}`} />;
}
function Exercise_() {
  const { id = '', n: nStr = '0' } = useParams();
  const n = Number(nStr);
  const go = useNavigate();
  const { data: ex } = useAsync(() => api.exercise(id, n), [id, n]);
  const [phase, setPhase] = useState<Phase>('answering');
  const [left, setLeft] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [vf, setVf] = useState<boolean | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);

  useEffect(() => { if (ex) setLeft(ex.seconds); }, [ex]);

  const submit = async (a: Answer) => {
    if (!ex || phase !== 'answering') return;
    setPhase('checking');
    setResult(await api.submit(id, n, a));
    setPhase('result');
  };

  // temporizador: se corta al enviar; si llega a 0 se envía como "tiempo agotado"
  useEffect(() => {
    if (!ex || phase !== 'answering' || left === null) return;
    if (left <= 0) { submit({ kind: 'timeout' }); return; }
    const t = setTimeout(() => setLeft((s) => (s ?? 0) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase, ex]);

  if (!ex) return <section className="view" id="v-ex" />;
  const T = TYPES[ex.type];
  const ready = ex.type === 'open' ? text.trim().length > 0 : ex.type === 'mc' ? sel.length > 0 : vf !== null;
  const answer = (): Answer => (ex.type === 'open' ? { kind: 'open', text } : ex.type === 'mc' ? { kind: 'mc', selected: sel } : { kind: 'vf', value: vf! });

  const next = async () => {
    if (result?.correct) { await api.completeNode(id, n); go(`/practicar/${id}`, { state: { completed: n } }); }
    else go(`/practicar/${id}`);
  };
  const optState = (key: string, picked: boolean): OptState => {
    if (phase !== 'result' || !result?.correctOptions) return picked ? 'sel' : 'idle';
    const right = result.correctOptions.includes(key);
    return right ? 'right' : picked ? 'wrong' : 'idle';
  };
  const toggle = (o: string) => setSel((s) => (o === '__none__' ? (s.includes(o) ? [] : [o]) : s.includes(o) ? s.filter((x) => x !== o) : [...s.filter((x) => x !== '__none__'), o]));
  const locked = phase !== 'answering';

  return (
    <section className="view" id="v-ex" style={{ '--c': T.c, '--d': T.d, '--soft': T.soft } as CSSProperties}>
      <ExerciseBar progress={ex.progress} left={left ?? ex.seconds} total={ex.seconds} onClose={() => go(`/practicar/${id}`)} />
      <div className="exbody">
        <ExTypeBadge type={ex.type} />
        {renderBody(ex)}
      </div>
      <ExerciseFooter
        result={phase === 'result' ? (result?.correct ? 'good' : 'bad') : undefined}
        title={result?.title} detail={result?.detail}
        label={phase === 'result' ? 'Continuar' : phase === 'checking' ? (ex.type === 'open' ? 'Analizando…' : 'Comprobando…') : ex.type === 'open' ? 'Enviar' : 'Comprobar'}
        enabled={phase === 'answering' && ready}
        onClick={() => (phase === 'result' ? next() : ready && submit(answer()))}
      />
    </section>
  );

  function renderBody(e: Exercise) {
    if (e.type === 'open') return <>
      <h3 className="exq">{e.question}</h3>
      <textarea className="ta" value={text} onChange={(x) => setText(x.target.value)} placeholder={e.placeholder} readOnly={locked} rows={3} autoFocus />
      {phase !== 'answering' && <AiAnalysis result={result?.ai && { ...result.ai, correct: result.correct }} />}
    </>;
    if (e.type === 'mc') return <>
      <h3 className="exq">{e.question}</h3>
      <span className="hint">{e.hint}</span>
      <div className="opts">
        {e.options.map((o) => <Option key={o} label={o} state={optState(o, sel.includes(o))} disabled={locked} onClick={() => toggle(o)} />)}
        <Option none label="Ninguna es correcta" state={optState('__none__', sel.includes('__none__'))} disabled={locked} onClick={() => toggle('__none__')} />
      </div>
    </>;
    return <>
      <h3 className="exq">¿Verdadero o falso?</h3>
      <div className="stmt">{e.statement}</div>
      <div className="vf">
        <VFOption value state={optState('true', vf === true)} disabled={locked} onClick={() => setVf(true)} />
        <VFOption value={false} state={optState('false', vf === false)} disabled={locked} onClick={() => setVf(false)} />
      </div>
    </>;
  }
}
