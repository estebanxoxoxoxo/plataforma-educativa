import { DOMAIN_MODE, fmtNum } from '../lib/format';
import type { ParentDashboard } from '../lib/types';
import { PanelState } from './PanelState';

/** "Protecciones" (solo lectura en la v1): lo que el backend real YA filtra siempre, sin interruptor.
 *  TODO(panel completo, audios 56 y 66): presets por familia y un wizard inicial (quiénes son, qué creen,
 *  edad del chico → todo configurado) en vez de editar listas a mano; después, edición fina de temas
 *  blancos/negros, palabras y sitios. Hoy la config real se importa del respaldo de Smarty. Pura. */
export function ProtectionsPanel({ kid, dash, failed, onRetry }: { kid: string; dash: ParentDashboard | null; failed: boolean; onRetry: () => void }) {
  const p = dash?.protections;
  const rows = p ? [
    { k: 'Sitios aprobados para leer', v: fmtNum(p.sites), d: 'Los artículos solo se abren desde estos sitios, y cada página pasa además por un revisor automático.' },
    { k: 'Videos aprobados', v: fmtNum(p.videos), d: 'El buscador, el chat, Aprender y Mi espacio muestran solo videos de este catálogo.' },
    { k: 'Palabras bloqueadas', v: fmtNum(p.blockedWords), d: 'Se filtran en búsquedas, títulos, respuestas del chat y ejercicios.' },
    { k: 'Temas bloqueados', v: fmtNum(p.blockedTopics), d: 'El revisor automático rechaza lecturas y respuestas del chat sobre estos temas.' },
    { k: 'Modo de dominios', v: DOMAIN_MODE[p.domainMode] ?? p.domainMode, d: p.domainMode === 'blanca' ? 'Un sitio que no está en la lista no se abre.' : 'Se aplican las reglas de dominios configuradas.' },
    { k: 'Versión de la política', v: String(p.policyVersion), d: 'Cambia cada vez que se actualizan las listas.' },
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
      <p className="pz-foot">La edición fina de temas y listas llega con el panel completo.</p>
    </section>
  );
}
