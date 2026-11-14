import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* Tienda en inglés (regla del dueño, 10-nov: TODO lo visible en EN se traduce, también los premios del padre): market.ts y
   progress.ts DE VERDAD; '../parent' se mockea con los premios de Ian LEÍDOS (solo lectura) de server/data/parent.json, el
   set de accesorios ('../identity') y se esconde wishlist.json (existsSync false: el módulo no lo lee ni lo escribe). */
vi.mock('node:fs', async (orig) => {
  const fs = await orig<typeof import('node:fs')>();
  return { ...fs, existsSync: (p: string) => (String(p).includes('wishlist') ? false : fs.existsSync(p)) };
});
vi.mock('../identity', () => ({ ACCESSORY_IDS: ['gorra', 'vincha', 'lazo', 'anteojos', 'auriculares', 'corona'] }));
const SEED = vi.hoisted(() => ({ items: [] as { id: number; emoji: string; title: string; desc?: string; price: number; stock: number | null; archived: boolean; createdAt: number }[] }));
vi.mock('../parent', () => ({
  anyParentItem: (id: number) => SEED.items.find(i => i.id === id), featureOn: () => true,
  policyItems: () => SEED.items.map(i => ({ ...i })), policyMemberId: () => 'ian',
  policyItem: (id: number) => SEED.items.find(i => i.id === id), itemOwner: (id: number) => (SEED.items.some(i => i.id === id) ? 'ian' : undefined),
}));
SEED.items = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'parent.json'), 'utf8')).members.ian.items;

/* i18n (pedido 9-nov): las tablas es→en del server, resueltas AL SERVIR por el idioma del pedido (runAsUser con lang).
   Fuera de un pedido (o en castellano) todo sale EXACTO como antes. */
const { runAsUser } = await import('../requestContext');
const { feedText } = await import('../feedEn');
const { dmText, statusEn, streakEn, monthEn } = await import('../friendsEn');
const { localizeMedal } = await import('../medals');
const { MEDALS } = await import('../medalRules');

const en = <T,>(fn: () => T) => runAsUser('ian', fn, 'en');

describe('feedEn: noticias, "por qué" y plantillas', () => {
  it('en inglés traduce lo conocido; en castellano y fuera de un pedido, nada', () => {
    expect(en(() => feedText('llegó a una racha de 12 días seguidos practicando'))).toBe('hit a 12-day practice streak');
    expect(en(() => feedText('LuMagma quiere ser tu amiga'))).toBe('LuMagma wants to be your friend');
    expect(en(() => feedText('La empezaste y te quedan 3 postas'))).toBe('You started it and have 3 steps left');
    expect(en(() => feedText('ganó la medalla de plata 🥈 en la Liga Cometa y subió a la Liga Estrella ⭐'))).toBe('won the silver medal 🥈 in the Comet League and moved up to the Star League ⭐');
    expect(en(() => feedText('hace 5 min'))).toBe('5 min ago');
    expect(en(() => feedText('algo que no está en la tabla'))).toBe('algo que no está en la tabla');
    expect(runAsUser('ian', () => feedText('Videos para vos'), 'es')).toBe('Videos para vos');
    expect(feedText('Videos para vos')).toBe('Videos para vos');
  });
  it('regla del 9-nov: nombres de liga y el pool de lecturas, también al servir', async () => {
    const { articleText, leagueName } = await import('../feedEn');
    expect(en(() => leagueName('Liga Cometa'))).toBe('Comet League');
    expect(leagueName('Liga Cometa')).toBe('Liga Cometa');
    expect(en(() => feedText('compartió la ruta «Cómo funciona el corazón»'))).toBe('shared the route “How the heart works”');
    const a = { url: 'https://es.wikipedia.org/wiki/Apolo_11', title: 'Apolo 11: el viaje a la Luna', snippet: 'x' };
    expect(en(() => articleText(a))).toMatchObject({ url: a.url, title: 'Apollo 11: the journey to the Moon', snippet: 'The mission that took the first humans to walk on the Moon, in July 1969.' });
    expect(articleText(a)).toBe(a);
  });
  it('respeta el espacio duro antes de un emoji (feedFake.glue)', () => {
    expect(en(() => feedText('llegó a 8 días seguidos practicando 🔥'))).toBe('hit 8 days of practice in a row 🔥');
  });
});

describe('friendsEn: mensajes de los NPCs y su perfil', () => {
  it('plantillas con el nombre y la prenda, frases sembradas; lo que no conoce, tal cual', () => {
    expect(en(() => dmText('Gracias, Ian. Me puse la gorra para el próximo experimento 🧪'))).toBe('Thanks, Ian. I put on the cap for my next experiment 🧪');
    expect(en(() => dmText('Che, ¿viste el curso nuevo de paleontología?'))).toBe('Hey, did you see the new paleontology course?');
    expect(en(() => dmText('hola, esto lo escribió el chico'))).toBe('hola, esto lo escribió el chico');
    expect(dmText('Che, ¿viste el curso nuevo de paleontología?')).toBe('Che, ¿viste el curso nuevo de paleontología?');
  });
  it('status, racha y mes', () => {
    expect(en(() => [statusEn('Practicando: El sistema solar'), statusEn('Racha de 8 días'), streakEn('12 días'), monthEn('marzo')]))
      .toEqual(['Practicing: The solar system', '8-day streak', '12 days', 'March']);
    expect([statusEn('Racha de 8 días'), streakEn('12 días'), monthEn('marzo')]).toEqual(['Racha de 8 días', '12 días', 'marzo']);
  });
});

describe('medallas por id', () => {
  it('localizeMedal: inglés en un pedido en inglés, el castellano de la spec si no', () => {
    const m = { id: 'primera-posta' as const, emoji: '🎯', title: MEDALS['primera-posta'].title, text: MEDALS['primera-posta'].text, at: null };
    expect(en(() => localizeMedal(m))).toMatchObject({ title: 'First step', text: 'You completed your first step in Learn.' });
    expect(localizeMedal(m)).toBe(m);
  });
});

describe('calendario: el título de la clase (teachersFake.classTitle)', () => {
  it('en inglés «Science class with Sam»; en castellano, igual que siempre', async () => {
    const { classTitle } = await import('../teachersFake');
    expect(en(() => classTitle('Ciencias', 'Sam'))).toBe('Science class with Sam');
    expect(en(() => classTitle('Astronomía', 'Ana'))).toBe('Astronomía class with Ana');
    expect(classTitle('Ciencias', 'Sam')).toBe('Clase de Ciencias con Sam');
  });
});

describe('Tienda en inglés (10-nov): los premios del padre se traducen AL SERVIR; lo guardado queda en castellano', async () => {
  const M = await import('../market');
  const P = await import('../progress');
  const { prizeEn, prizeTitleEn, localizePrize } = await import('../parentEn');
  afterEach(() => { M.resetMarket(); P.resetProgress(); });
  const ES_TITLES = SEED.items.map(i => i.title);
  /** Un pedido HTTP a una de las rutas (marketRoutes / progressRoutes), con o sin X-Smarty-Lang: en. */
  function call(routes: (req: IncomingMessage, res: ServerResponse, url: URL) => unknown, method: string, path: string, lang?: 'en', body?: unknown): Promise<{ status: number; body: any }> {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
    Object.assign(req, { method, url: path, headers: { 'x-innerith-user': 'ian', ...(lang ? { 'x-smarty-lang': lang } : {}) } });
    return new Promise(resolve => {
      let status = 0;
      const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
      void runAsUser('ian', () => routes(req, res, new URL(path, 'http://localhost')), lang ?? 'es');
    });
  }
  const pizza = () => SEED.items.find(i => i.title === 'Pizza a elección')!;

  it('el seed de parent.json trae los 8 premios de la tabla', () => {
    expect(ES_TITLES).toHaveLength(8);
    for (const t of ES_TITLES) expect(prizeEn(t), t).toBeDefined();
    expect(prizeTitleEn('Un premio que tipeó el padre')).toBe('Un premio que tipeó el padre');
    expect(prizeEn('Un premio que tipeó el padre')).toBeUndefined();
  });
  it('(a) GET /api/market en inglés: títulos y descripciones en inglés, ninguno castellano de la tabla', async () => {
    const r = await call(M.marketRoutes, 'GET', '/api/market', 'en');
    expect(r.status).toBe(200);
    const premios = (r.body.items as { kind: string; title: string; desc?: string }[]).filter(i => i.kind === 'premio');
    expect(premios).toHaveLength(8);
    expect(premios.map(i => i.title)).toContain('1 extra hour of gaming on Saturday');
    expect(premios.find(i => i.title === '1 extra hour of gaming on Saturday')!.desc).toBe('One more hour of your game, on Saturday, with your homework done.');
    const json = JSON.stringify(r.body);
    for (const i of SEED.items) { expect(json).not.toContain(i.title); expect(json).not.toContain(i.desc!); }
  });
  it('(b) el canje servido vuelve en inglés (POST /redeem y GET /redemptions); en RAM queda en castellano', async () => {
    const r = await call(M.marketRoutes, 'POST', '/api/market/redeem', 'en', { itemId: pizza().id });
    expect(r.body.ok).toBe(true);
    expect(r.body.redemption.title).toBe('Pizza your way');
    expect((await call(M.marketRoutes, 'GET', '/api/market/redemptions', 'en')).body.redemptions[0].title).toBe('Pizza your way');
    expect(M.listRedemptions('ian')[0].title).toBe('Pizza a elección'); // fuera de un pedido en inglés: el castellano guardado
  });
  it('(c) GET /api/progress/tx tras un canje: «Redeemed: Pizza your way»', async () => {
    await call(M.marketRoutes, 'POST', '/api/market/redeem', 'en', { itemId: pizza().id });
    const tx = (await call(P.progressRoutes, 'GET', '/api/progress/tx', 'en')).body.tx as { label: string }[];
    expect(tx[0].label).toBe('Redeemed: Pizza your way');
  });
  it('(e) sin cabecera (castellano): todo EXACTO como en parent.json', async () => {
    const items = (await call(M.marketRoutes, 'GET', '/api/market')).body.items as { kind: string; title: string; desc?: string }[];
    const premios = items.filter(i => i.kind === 'premio');
    expect(premios.map(i => i.title).sort()).toEqual([...ES_TITLES].sort());
    for (const p of premios) expect(p.desc).toBe(SEED.items.find(i => i.title === p.title)!.desc);
    const red = await call(M.marketRoutes, 'POST', '/api/market/redeem', undefined, { itemId: pizza().id });
    expect(red.body.redemption.title).toBe('Pizza a elección');
    expect((await call(M.marketRoutes, 'GET', '/api/market/redemptions')).body.redemptions[0].title).toBe('Pizza a elección');
    expect(((await call(P.progressRoutes, 'GET', '/api/progress/tx')).body.tx as { label: string }[])[0].label).toBe('Canje: Pizza a elección');
  });
  it('localizePrize (Familia, premio de la liga y sus opciones): la tabla en inglés; texto libre del padre y su desc propia, tal cual', () => {
    const seeded = { title: 'Salida a escalar', desc: 'Una tarde en el muro de escalada, con el equipo alquilado.', emoji: '🧗' };
    expect(en(() => localizePrize(seeded))).toEqual({ title: 'Climbing trip', desc: 'An afternoon at the climbing wall, gear rental included.', emoji: '🧗' });
    expect(en(() => localizePrize({ title: 'Salida a escalar', desc: 'Con tu primo Juan.' }))).toEqual({ title: 'Climbing trip', desc: 'Con tu primo Juan.' });
    expect(en(() => localizePrize({ title: 'Helado doble', winners: ['ian'] }))).toEqual({ title: 'Helado doble', winners: ['ian'] });
    expect(localizePrize(seeded)).toBe(seeded);
  });
});

describe('Familia → Avisos en inglés (10-nov): las plantillas de parent.ts, AL SERVIR; lo citado del chico, intacto', async () => {
  const { alertTextEn, alertSourceEn } = await import('../parentEn');
  // Los cuerpos EXACTOS que arman parent.notifyParent / notifyUnreviewed (y que quedan así en alerts.json)
  const SUPPORT = 'Se le mostró el mensaje de contención de la familia, que lo invita a hablarlo con un adulto de confianza.';
  it('sin clasificar (notifyUnreviewed): uno y varios mensajes, con la cita tal cual', () => {
    const one = 'Sin clasificar: el revisor automático no pudo revisar un mensaje de Ian en el chat con el asistente (no respondió). No se le mostró ninguna respuesta y se le sugirió hablar con un adulto de confianza si le pasa algo. Por si era importante, esto es lo que escribió: «dame articulos sobre esto».';
    expect(en(() => alertTextEn(one))).toBe('Unclassified: the automatic reviewer couldn’t check a message from Ian in the chat with the assistant (it didn’t respond). No reply was shown, and they were encouraged to talk to a trusted adult if something’s going on. In case it was important, here’s what they wrote: “dame articulos sobre esto”.');
    const many = 'Sin clasificar: el revisor automático no pudo revisar 3 mensajes de Luna en la conversación con LuMagma (Amigos) (no respondió). No se le mostró ninguna respuesta y se le sugirió hablar con un adulto de confianza si le pasa algo. Por si era importante, esto es lo último que escribió: «uno» · «dos, ¿no?» · «tres».';
    expect(alertTextEn(many)).toBe('Unclassified: the automatic reviewer couldn’t check 3 messages from Luna in the conversation with LuMagma (Friends) (it didn’t respond). No reply was shown, and they were encouraged to talk to a trusted adult if something’s going on. In case it was important, here’s the latest they wrote: “uno” · “dos, ¿no?” · “tres”.');
  });
  it('crisis (con y sin clasificar), contacto y bloqueos; lo que no es una plantilla, tal cual', () => {
    const said = 'no quiero estar más acá, me siento re mal';
    expect(alertTextEn(`Hubo un mensaje de crisis en el buscador. Ian escribió: «${said}». ${SUPPORT} Hablalo con Ian con calma cuanto antes.`))
      .toBe(`There was a crisis message in Search. Ian wrote: “${said}”. They were shown the family’s support message, which encourages them to talk it over with a trusted adult. Talk it over calmly with Ian as soon as you can.`);
    expect(alertTextEn(`Posible mensaje de crisis en el chat con el asistente, sin clasificar: el revisor automático no respondió y una red de frases lo marcó. Tu hijo escribió: «${said}». ${SUPPORT} Leelo y, si hace falta, hablalo con tu hijo con calma cuanto antes.`))
      .toBe(`Possible crisis message in the chat with the assistant, unclassified: the automatic reviewer didn’t respond and a phrase filter flagged it. Your child wrote: “${said}”. They were shown the family’s support message, which encourages them to talk it over with a trusted adult. Read it and, if needed, talk it over calmly with your child as soon as you can.`);
    expect(alertTextEn('Luna quiso pasar un dato de contacto o seguir la charla fuera de Smarty en la conversación con CataNova (Amigos): «mi insta es @luna». El Moderador lo frenó y el mensaje no llegó.'))
      .toBe('Luna tried to share contact info or move the chat outside Smarty in the conversation with CataNova (Friends): “mi insta es @luna”. The Moderator stopped it and the message wasn’t delivered.');
    expect(alertTextEn('Ian insistió: el Moderador frenó 3 mensajes suyos en el chat con el asistente en pocos minutos (palabras, insultos o temas que la familia no quiere). Ninguno llegó. El último: «sos un tonto».'))
      .toBe('Ian kept trying: the Moderator stopped 3 of their messages in the chat with the assistant within a few minutes (words, insults or topics the family doesn’t want). None got through. The last one: “sos un tonto”.');
    expect(alertTextEn('Un aviso viejo con otra redacción.')).toBe('Un aviso viejo con otra redacción.');
    expect([alertSourceEn('el chat con el asistente'), alertSourceEn('Smarty')]).toEqual(['the chat with the assistant', 'Smarty']);
  });
});

describe('Mentorías en inglés (10-nov): materia y bio del catálogo, AL SERVIR', async () => {
  const T = await import('../teachersFake');
  function get(user: string, path: string, lang?: 'en'): Promise<any> {
    const req = Readable.from([]) as unknown as IncomingMessage;
    Object.assign(req, { method: 'GET', url: path, headers: { 'x-innerith-user': user, ...(lang ? { 'x-smarty-lang': lang } : {}) } });
    return new Promise(resolve => {
      const res = { writeHead: () => {}, end: (raw: string) => resolve(JSON.parse(raw)) } as unknown as ServerResponse;
      void runAsUser(user, () => T.teachersRoutes(req, res, new URL(path, 'http://localhost')), lang ?? 'es');
    });
  }
  it('GET /api/mentors: «Matemática» → Math y la bio en inglés; en castellano, tal cual', async () => {
    const caroEn = (await get('andres', '/api/mentors', 'en')).mentors.find((m: { id: string }) => m.id === 'caro-mendez');
    expect(caroEn).toMatchObject({ name: 'Caro Méndez', subject: 'Math', bio: 'Turns every problem into a logic challenge: from equations to algebra, with no memorized formulas.' });
    const caroEs = (await get('andres', '/api/mentors')).mentors.find((m: { id: string }) => m.id === 'caro-mendez');
    expect(caroEs).toMatchObject({ subject: 'Matemática', bio: 'Convierte cada problema en un desafío de lógica: de las ecuaciones al álgebra, sin fórmulas de memoria.' });
    // ninguna materia ni bio del catálogo queda en castellano en inglés
    const all = (await get('andres', '/api/mentors', 'en')).mentors as { subject: string; bio: string }[];
    expect(all.map(m => m.subject)).toEqual(['Math', 'Reading & writing', 'English', 'Science', 'History', 'Programming', 'Music', 'Chess']);
    for (const m of all) expect(m.bio, m.bio).not.toMatch(/[áéíóúñ¿¡]|\b(de|con|y|tu|tus)\b/);
  });
  it('subjectOut / bioOut: tabla en inglés; lo desconocido, tal cual', () => {
    expect(en(() => [T.subjectOut('Matemática'), T.subjectOut('Astronomía'), T.bioOut('Una bio nueva')])).toEqual(['Math', 'Astronomía', 'Una bio nueva']);
    expect(T.subjectOut('Matemática')).toBe('Matemática');
  });
});
