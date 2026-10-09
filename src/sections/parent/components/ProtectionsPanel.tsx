import { Link } from 'react-router-dom';
import { DOMAIN_MODE, fmtNum } from '../lib/format';
import type { ParentDashboard } from '../lib/types';
import { PanelState } from './PanelState';

/** "Protecciones" (solo lectura): lo que el backend real filtra SIEMPRE, sin interruptor. Las palabras y los temas
 *  cuentan lo de fábrica (Smarty) + lo que sumó la familia en "Temas y palabras". Sitios y catálogo se importan del
 *  respaldo de Smarty (su edición fina —sitios, reglas de dominio, prompts— sigue en el "motor intermedio" de la POC).
 *  Pura. */
export function ProtectionsPanel({ kid, dash, failed, onRetry }: { kid: string; dash: ParentDashboard | null; failed: boolean; onRetry: () => void }) {
  const p = dash?.protections;
  const rows = p ? [
    { k: 'Sitios aprobados para leer', v: fmtNum(p.sites), d: 'Los artículos solo se abren desde estos sitios, y cada página pasa además por un revisor automático.' },
    { k: 'Videos aprobados', v: fmtNum(p.videos), d: 'El buscador, el chat, Aprender y Mi espacio muestran solo videos de este catálogo.' },
    { k: 'Palabras bloqueadas', v: fmtNum(p.blockedWords), d: 'Las de fábrica más las de la familia. Se frenan en búsquedas, títulos, respuestas del chat, mensajes a amigos y ejercicios.' },
    { k: 'Temas bloqueados', v: fmtNum(p.blockedTopics), d: 'Los de fábrica más los de la familia. El revisor automático rechaza lecturas, respuestas del chat y mensajes entre amigos sobre estos temas.' },
    { k: 'Modo de dominios', v: DOMAIN_MODE[p.domainMode] ?? p.domainMode, d: p.domainMode === 'blanca' ? 'Un sitio que no está en la lista no se abre.' : 'Se aplican las reglas de dominios configuradas.' },
    { k: 'Versión de la política', v: String(p.policyVersion), d: 'Cambia cada vez que se actualizan las listas de fábrica.' },
  ] : [];
  return (
    <section className="pz-panel" aria-labelledby="pz-prot-h">
      <header className="pz-panel-head">
        <h3 id="pz-prot-h">Protecciones</h3>
        <p>Lo que Innerith filtra para {kid} todo el tiempo. Está siempre activo y no depende de los interruptores.</p>
      </header>
      {!dash ? <PanelState failed={failed} onRetry={onRetry} /> : !p ? (
        <p className="pz-muted">No pude leer las protecciones ahora.</p>
      ) : (
        <dl className="pz-prot">
          {rows.map((r) => (
            <div className="pz-prot-row" key={r.k}>
              <dt>{r.k}</dt>
              <dd className="pz-prot-v">{r.v}</dd>
              <dd className="pz-prot-d">{r.d}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="pz-foot">
        Para sumar temas o palabras de la familia, andá a <Link to="/padres/temas" className="pz-inline pz-inline--tight">Temas y palabras</Link>; los topes de volumen están en <Link to="/padres/limites" className="pz-inline pz-inline--tight">Límites</Link>.
      </p>
    </section>
  );
}
