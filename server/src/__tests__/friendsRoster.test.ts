import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* FS-BASE-B, friendsFake.ts DE VERDAD (el modelo, el juez y la config del padre simulados, como friendsJudgeDown.test):
   · hallazgo feedMix.test.ts:122: su lista de NPCs y su grafo de arranque son los de npcRoster.ts (de donde los demás tests
     sacan los invariantes del seed real). Si no coincidieran, importar friendsFake TIRA (falla fuerte al arrancar).
   · hallazgo feedFake.ts:194: npcRelation dice qué es cada NPC para el usuario activo (amigo / solicitud / nada).
   · hallazgo friendsFake.ts:539: con LIGAS APAGADAS para el chico, el NPC no le habla de ligas (prompt y persona). */

const FLAGS = vi.hoisted(() => ({ ligas: true } as Record<string, boolean>));
const C = vi.hoisted(() => ({ systems: [] as string[], wait: null as null | ((s: string) => void) }));
vi.mock('../llm', () => ({
  complete: async (o: { system?: string }) => {
    if (o.system) { C.systems.push(o.system); C.wait?.(o.system); return { text: '¡Qué bueno! Yo estoy con los planetas.' }; } // la respuesta del NPC
    return { text: '{"veredicto":"aprobado","categoria":"ninguna"}' }; // el juez de mensajes
  },
  parseJudgeJson: (raw: string) => JSON.parse(raw), spotlight: (s: string) => s,
}));
vi.mock('../judge', () => ({ judgeOutput: async () => ({ veredicto: 'aprobado' }) }));
vi.mock('../parent', () => ({
  featureOn: () => true, featureOnNow: (k: string) => FLAGS[k] !== false, blackTopicsAll: () => [], familyTopics: () => ({ white: [], black: [] }),
  familyBlockedTerms: () => [], topicHit: () => null, notifyParent: () => {}, notifyUnreviewed: () => {},
}));
vi.mock('../chat', () => ({ guionCrisis: () => 'GUION', safetyLine: () => '' }));

const Fr = await import('../friendsFake');
const { GRAPH_IDS, NPC_ROSTER } = await import('../npcRoster');
const { runAsUser } = await import('../requestContext');
beforeEach(() => { FLAGS.ligas = true; C.systems.length = 0; C.wait = null; Fr.resetFriends(); });

function send(user: string, id: string, text: string): Promise<{ status: number; body: any }> {
  const req = Readable.from([Buffer.from(JSON.stringify({ id, text }))]) as unknown as IncomingMessage;
  Object.assign(req, { method: 'POST', url: '/api/friends/send', headers: { 'x-innerith-user': user } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
    void runAsUser(user, () => Fr.friendsRoutes(req, res, new URL('/api/friends/send', 'http://localhost')));
  });
}
/** Manda un mensaje y devuelve el system prompt con el que el NPC arma su respuesta. */
async function npcPromptAfter(user: string, id: string): Promise<string> {
  const got = new Promise<string>(r => { C.wait = r; });
  const r = await send(user, id, '¿Qué estás practicando?');
  expect(r.body.status).not.toBe('blocked');
  return Promise.race([got, new Promise<string>((_, rej) => setTimeout(() => rej(new Error('el NPC no armó su respuesta')), 2000))]);
}

describe('npcRoster = el seed de friendsFake', () => {
  it('cada NPC del roster existe en friendsFake con el mismo nick y género', () => {
    for (const n of NPC_ROSTER) expect(Fr.npcInfo(n.nick), n.nick).toMatchObject({ id: n.id, girl: n.girl });
  });
  it('npcRelation: el grafo de arranque de cada usuario (amigos y solicitudes) es el del roster', () => {
    for (const [user, g] of Object.entries(GRAPH_IDS)) {
      runAsUser(user, () => {
        for (const id of g.friends) expect(Fr.npcRelation(id), `${user}: ${id}`).toBe('friend');
        for (const id of g.requests) expect(Fr.npcRelation(id), `${user}: ${id}`).toBe('request');
        for (const n of NPC_ROSTER) if (!g.friends.includes(n.id) && !g.requests.includes(n.id)) expect(Fr.npcRelation(n.id), `${user}: ${n.id}`).toBeNull();
      });
    }
  });
});

describe('con Ligas apagadas, los NPCs no hablan de ligas (hallazgo friendsFake.ts:539)', () => {
  it('Ligas PRENDIDAS: el prompt de TomiCohete trae su liga y sus carreras de XP (lo de siempre)', async () => {
    const sys = await npcPromptAfter('ian', 'f1');
    expect(sys).toMatch(/Liga actual: Liga Cometa/);
    expect(sys).toMatch(/carreras de XP/);
  });
  it('Ligas APAGADAS para Ian: ni «Liga actual», ni «las ligas» en sus temas, ni «carreras de XP» en la persona; y una regla', async () => {
    FLAGS.ligas = false;
    const sys = await npcPromptAfter('ian', 'f1');
    const rule = sys.split('\n').filter(l => l.startsWith('8. No hables de ligas'));
    expect(rule).toHaveLength(1); // la regla nueva (ella misma nombra lo que prohíbe)
    const rest = sys.split('\n').filter(l => !rule.includes(l)).join('\n');
    expect(rest).not.toMatch(/Liga actual|ligas|carreras? de XP|Competitivo/i);
    expect(sys).toMatch(/Le encantan los cohetes/); // el resto de la persona sigue
  });
  it('withoutLeagueTalk saca SOLO las oraciones que hablan de ligas', () => {
    expect(Fr.withoutLeagueTalk('Sabe de dinosaurios. Por ganar el oro en la Liga Cometa subió a la Liga Estrella. Le gusta contar datos.'))
      .toBe('Sabe de dinosaurios. Le gusta contar datos.');
  });
});
