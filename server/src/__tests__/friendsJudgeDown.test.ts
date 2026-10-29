import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Amigos con el juez de mensajes CAÍDO (FS-BASE-A; hallazgo chat.ts:252, que nombra también este camino: friendsFake.ts
   494-495 y 663): friendsFake.ts DE VERDAD con el modelo caído. Antes: «Ahora no pude revisar tu mensaje…» y NADA para el
   padre («una falla del juez no es culpa del chico»), aunque el mensaje fuera una crisis. Ahora: la red de frases →
   guion + aviso de crisis sin clasificar; si no pega → no sale, con la línea de cuidado, y aviso sin clasificar. */

vi.mock('../llm', () => ({
  complete: async () => { throw new Error('503 del modelo'); },
  parseJudgeJson: () => ({}), spotlight: (s: string) => s,
}));
vi.mock('../judge', () => ({ judgeOutput: async () => ({ veredicto: 'aprobado' }) }));
const P = vi.hoisted(() => ({ notify: [] as unknown[][], unreviewed: [] as unknown[][] }));
vi.mock('../parent', () => ({
  featureOn: () => true, featureOnNow: () => true, blackTopicsAll: () => [], familyTopics: () => ({ white: [], black: [] }),
  familyBlockedTerms: () => [], topicHit: () => null,
  notifyParent: (...a: unknown[]) => { P.notify.push(a); },
  notifyUnreviewed: (...a: unknown[]) => { P.unreviewed.push(a); },
}));
vi.mock('../chat', () => ({ guionCrisis: () => 'GUION DE CONTENCIÓN', safetyLine: () => ' Si te pasa algo o te sentís mal, contáselo a un adulto de confianza.' }));

const Fr = await import('../friendsFake');
const { runAsUser } = await import('../requestContext');
function send(text: string): Promise<{ status: number; body: any }> {
  const req = Readable.from([Buffer.from(JSON.stringify({ id: 'f1', text }))]) as unknown as IncomingMessage;
  Object.assign(req, { method: 'POST', url: '/api/friends/send', headers: { 'x-innerith-user': 'ian' } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
    void runAsUser('ian', () => Fr.friendsRoutes(req, res, new URL('/api/friends/send', 'http://localhost')));
  });
}
beforeEach(() => { P.notify.length = 0; P.unreviewed.length = 0; });

describe('Amigos: juez de mensajes caído', () => {
  it('con una frase de crisis: no sale, se le muestra el GUION y el padre recibe el aviso de crisis SIN CLASIFICAR', async () => {
    const r = await send('ya no quiero vivir');
    expect(r.body).toEqual({ status: 'blocked', notice: 'GUION DE CONTENCIÓN' });
    expect(P.notify).toEqual([['crisis', 'ya no quiero vivir', 'la conversación con TomiCohete (Amigos)', { unclassified: true }]]);
    expect(P.unreviewed).toEqual([]);
  });

  it('sin frase de crisis: no sale, con la línea de cuidado, y el aviso sin clasificar (no el "insistió")', async () => {
    const r = await send('che, ¿jugamos a la tarde?');
    expect(r.body.status).toBe('blocked');
    expect(r.body.notice).toMatch(/^Ahora no pude revisar tu mensaje.*adulto de confianza\.$/);
    expect(P.unreviewed).toEqual([['che, ¿jugamos a la tarde?', 'la conversación con TomiCohete (Amigos)']]);
    expect(P.notify).toEqual([]);
  });
});
