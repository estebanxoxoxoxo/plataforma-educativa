import { BrandMark } from '../../../shared/components/BrandMark';
import { IcCheck, IcX } from '../../../shared/components/icons';

/** Devolución de la IA sobre una respuesta abierta (esqueleto mientras analiza). */
export const AiAnalysis = ({ result }: { result?: { verdict: string; feedback: string; correct: boolean } }) => (
  <div className="aic">
    <div className="aihead"><BrandMark /><b>Análisis de Innerith</b>
      {result && <span className={`verdict ${result.correct ? 'y' : 'n'}`}>{result.correct ? <IcCheck /> : <IcX />}{result.verdict}</span>}
    </div>
    {!result
      ? <div className="aisk"><i style={{ width: '92%' }} /><i style={{ width: '74%' }} /><i style={{ width: '45%' }} /></div>
      : <p>{result.feedback}</p>}
  </div>
);
