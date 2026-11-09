import { Link } from 'react-router-dom';
import { FeedMotionControl } from '../containers/FeedMotionControl';
import { DOMAIN_MODE, fmtNum } from '../lib/format';
import { famTo } from '../lib/member';
import type { ParentDashboard } from '../lib/types';
import { PanelState } from './PanelState';
import { L } from '../../../shared/lib/lang';

/** "Protecciones": lo que el backend real filtra SIEMPRE, sin interruptor (solo lectura). Las palabras y los temas
 *  cuentan lo de fábrica (Smarty) + lo que sumó la familia en "Temas y palabras". Sitios y catálogo se importan del
 *  respaldo de Smarty (su edición fina —sitios, reglas de dominio, prompts— sigue en el "motor intermedio" de la POC).
 *  Debajo, el dial "Animación del Feed" (Feed v6): ese bloque es un contenedor propio (FeedMotionControl: lee y guarda la
 *  config del padre); el resto del panel es puro. U3: los números son los del integrante elegido (`dash.protections` de
 *  GET activity?member: sus palabras y temas de la familia + los de fábrica) y el dial es el suyo. */
export function ProtectionsPanel({ kid, member, dash, failed, onRetry }: { kid: string; member: string; dash: ParentDashboard | null; failed: boolean; onRetry: () => void }) {
  const p = dash?.protections;
  const rows = p ? [
    { k: L('Sitios aprobados para leer', 'Sites approved for reading'), v: fmtNum(p.sites), d: L('Los artículos solo se abren desde estos sitios, y cada página pasa además por un revisor automático.', 'Articles only open from these sites, and every page also goes through an automatic reviewer.') },
    { k: L('Videos aprobados', 'Approved videos'), v: fmtNum(p.videos), d: L('El buscador, el chat, Aprender y Mi espacio muestran solo videos de este catálogo.', 'Search, chat, Learn and My space only show videos from this catalog.') },
    { k: L('Palabras bloqueadas', 'Blocked words'), v: fmtNum(p.blockedWords), d: L('Las de fábrica más las de la familia. Se frenan en búsquedas, títulos, respuestas del chat, mensajes a amigos y ejercicios.', 'The built-in ones plus your family’s. They’re stopped in searches, titles, chat answers, messages to friends and exercises.') },
    { k: L('Temas bloqueados', 'Blocked topics'), v: fmtNum(p.blockedTopics), d: L('Los de fábrica más los de la familia. El revisor automático rechaza lecturas, respuestas del chat y mensajes entre amigos sobre estos temas.', 'The built-in ones plus your family’s. The automatic reviewer rejects readings, chat answers and messages between friends about these topics.') },
    { k: L('Modo de dominios', 'Domain mode'), v: DOMAIN_MODE[p.domainMode] ?? p.domainMode, d: p.domainMode === 'blanca' ? L('Un sitio que no está en la lista no se abre.', 'A site that isn’t on the list won’t open.') : L('Se aplican las reglas de dominios configuradas.', 'The configured domain rules apply.') },
    { k: L('Versión de la política', 'Policy version'), v: String(p.policyVersion), d: L('Cambia cada vez que se actualizan las listas de fábrica.', 'It changes every time the built-in lists are updated.') },
  ] : [];
  return (
    <section className="pz-panel" aria-labelledby="pz-prot-h">
      <header className="pz-panel-head">
        <h3 id="pz-prot-h">{L('Protecciones', 'Protections')}</h3>
        <p>{L(`Lo que Smarty filtra para ${kid} todo el tiempo. Está siempre activo y no depende de los interruptores.`, `What Smarty filters for ${kid} all the time. It’s always on and doesn’t depend on the switches.`)}</p>
      </header>
      {!dash ? <PanelState failed={failed} onRetry={onRetry} /> : !p ? (
        <p className="pz-muted">{L('No pude leer las protecciones ahora.', 'I couldn’t read the protections right now.')}</p>
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
      <FeedMotionControl kid={kid} member={member} />
      <p className="pz-foot">
        {L(`Para sumar temas o palabras para ${kid}, andá a `, `To add topics or words for ${kid}, go to `)}<Link to={famTo('/familia/temas', member)} className="pz-inline pz-inline--tight">{L('Temas y palabras', 'Topics and words')}</Link>{L('; los topes de volumen están en ', '; volume caps are in ')}<Link to={famTo('/familia/limites', member)} className="pz-inline pz-inline--tight">{L('Límites', 'Limits')}</Link>.
      </p>
    </section>
  );
}
