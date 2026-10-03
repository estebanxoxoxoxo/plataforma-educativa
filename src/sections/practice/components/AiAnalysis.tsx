import { GlyphOpen, IcCheck, IcX } from '../../../shared/components/icons';

export const AiAnalysis = ({ result }: { result?: { verdict: string; feedback: string; correct: boolean } }) => (
  <div className="aic">
    <span className="lbl"><GlyphOpen />Análisis de la IA</span>
    {!result
      ? <div className="aisk"><i style={{ width: '90%' }} /><i style={{ width: '70%' }} /><i style={{ width: '40%' }} /></div>
      : <><div className="crit"><span className={result.correct ? 'y' : 'n'}>{result.correct ? <IcCheck /> : <IcX />}{result.verdict}</span></div><p>{result.feedback}</p></>}
  </div>
);
