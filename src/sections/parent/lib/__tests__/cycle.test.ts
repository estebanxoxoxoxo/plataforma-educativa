import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CycleRange, SchedulesResponse } from '../../../../api/types';
import { adoptCycle, cycleAllows, effectiveTz, isSectionOpen, serverDate, toMemberCycle } from '../cycle';

/* El store del Ciclo del día del chico (tanda F2): cómo normaliza lo que manda el server y cómo evalúa el menú con la
   hora del SERVER (delta) en la zona de la familia, con el override de demo y FAIL-OPEN. Las reglas en sí son las
   compartidas con el server (src/shared/lib/cycleRules.ts, con sus tests en server/src/__tests__/cycleRules.test.ts). */

type Snap = Parameters<typeof isSectionOpen>[1] & object;
const RANGES: CycleRange[] = [
  { id: 'manana', name: 'Mañana', from: '08:00', to: '12:00', sections: ['aprender', 'buscar'] },
  { id: 'tarde', name: 'Tarde', from: '14:00', to: '18:00', sections: ['mytube', 'tienda'] },
];
const NOW = Date.UTC(2026, 9, 28, 12, 0); // el reloj del navegador: 12:00 UTC
/** Un snap cuyo reloj del server marca `hhmm` UTC (el navegador está corrido: el delta lo arregla). */
const snapAt = (hhmm: string, over: Partial<Snap> = {}): Snap => {
  const [h, m] = hhmm.split(':').map(Number);
  return { ranges: RANGES, demoRange: null, member: 'ian', tz: 'UTC', serverTz: null, offset: Date.UTC(2026, 9, 28, h, m) - NOW, failed: false, syncedAt: NOW, sig: '', ...over };
};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('toMemberCycle (lo que manda el server → lo que usa el store)', () => {
  const base: SchedulesResponse = { serverNow: 1, tz: 'America/New_York', member: 'luna', cycle: { ranges: RANGES }, demoRange: 'tarde' };
  it('toma ciclo, override, zona e integrante', () => {
    expect(toMemberCycle(base)).toEqual({ member: 'luna', ranges: RANGES, demoRange: 'tarde', serverNow: 1, tz: 'America/New_York', serverTz: null });
  });
  it('vacíos y nulos se normalizan a null; una CycleResponse también sirve', () => {
    expect(toMemberCycle({ ...base, demoRange: '', tz: '', member: '' })).toMatchObject({ demoRange: null, tz: null, member: null });
    expect(toMemberCycle({ cycle: { ranges: [] }, member: 'ian', serverNow: 5, tz: null, demoRange: null })).toMatchObject({ member: 'ian', ranges: [] });
  });
  it('sin la forma esperada → null (no se adopta: rige lo que había, fail-open)', () => {
    for (const bad of [null, 3, {}, { ...base, cycle: undefined }, { ...base, cycle: { ranges: 'x' } }, { ...base, serverNow: '1' }]) expect(toMemberCycle(bad)).toBeNull();
  });
});

describe('evaluación con la hora del server', () => {
  it('serverDate aplica el delta', () => {
    expect(serverDate(snapAt('09:30')).toISOString()).toBe('2026-10-28T09:30:00.000Z');
  });
  it('dentro y fuera de un rango; lo que no figura en ningún rango, fuera de todo rango', () => {
    expect(isSectionOpen('aprender', snapAt('09:30'))).toBe(true);
    expect(isSectionOpen('mytube', snapAt('09:30'))).toBe(false);
    expect(isSectionOpen('mytube', snapAt('15:00'))).toBe(true);
    expect(isSectionOpen('chat', snapAt('03:00'))).toBe(true);
    expect(isSectionOpen('chat', snapAt('09:30'))).toBe(false); // 29-oct: la Mañana en curso es exclusiva
  });
  it('el override de demo manda sobre el reloj (como el server): "estás en la Tarde" a las 09:30', () => {
    const s = snapAt('09:30', { demoRange: 'tarde' });
    expect(isSectionOpen('mytube', s)).toBe(true);
    expect(isSectionOpen('aprender', s)).toBe(false);
    // 29-oct (rangos exclusivos, cycleRules.ts): antes Calendario —que no está en ningún rango— seguía abierto con el override;
    // ahora "estás en la Tarde" es EXACTAMENTE lo de la Tarde.
    expect(isSectionOpen('calendario', s)).toBe(false);
  });
  it('29-oct · el menú de Ian con su ciclo real (r1 21:00–22:00, solo After Day): a las 21:30 solo After Day y el Feed', () => {
    const ian: CycleRange[] = [{ id: 'r1', name: 'Rango 1', from: '21:00', to: '22:00', sections: ['afterday'] }];
    const menu = ['/', '/buscar', '/chat', '/mytube', '/aprender', '/afterday', '/tienda', '/calendario', '/espacio/carpetas'];
    expect(menu.filter((p) => cycleAllows(snapAt('21:30', { ranges: ian }), p))).toEqual(['/', '/afterday']);
    expect(menu.filter((p) => cycleAllows(snapAt('15:00', { ranges: ian }), p))).toEqual(menu.filter((p) => p !== '/afterday'));
  });
  it('fail-open: sin dato todavía, todo disponible', () => {
    expect(isSectionOpen('mytube', snapAt('09:30', { ranges: null }))).toBe(true);
  });
  it('cycleAllows (el menú): la ruta de la sección decide; el Feed y lo que no es del ciclo, siempre', () => {
    const s = snapAt('09:30');
    expect(cycleAllows(s, '/mytube')).toBe(false);
    expect(cycleAllows(s, '/aprender')).toBe(true);
    expect(cycleAllows(s, '/')).toBe(true);
    expect(cycleAllows(s, '/familia')).toBe(true);
  });
});

/* FS-BASE-B (hallazgos cycleRules.ts:62 / mentors.ts:49): con la tz de la familia en null ("Automática") el server evalúa en
   SU zona; el cliente ahora recibe esa zona (serverTz, aditivo) y evalúa en la misma pared, esté donde esté el navegador. */
describe('tz Automática = la del SERVER', () => {
  it('toMemberCycle trae serverTz; effectiveTz = la de la familia o, en Automática, la del server (null solo sin ninguna)', () => {
    expect(toMemberCycle({ serverNow: 1, tz: null, serverTz: 'America/Chicago', member: 'ian', cycle: { ranges: [] }, demoRange: null }))
      .toMatchObject({ tz: null, serverTz: 'America/Chicago' });
    expect(effectiveTz(null, 'America/Chicago')).toBe('America/Chicago');
    expect(effectiveTz('Europe/Madrid', 'America/Chicago')).toBe('Europe/Madrid');
    expect(effectiveTz(null, null)).toBeNull();
  });
  it('server en Chicago y tz null: a las 15:00 UTC el store ve las 10:00 de Chicago (Mañana abierta), como el 403 del server', () => {
    const t = Date.UTC(2026, 9, 28, 15, 0);
    vi.setSystemTime(t);
    adoptCycle({ serverNow: t, tz: null, serverTz: 'America/Chicago', member: 'ian', cycle: { ranges: RANGES }, demoRange: null });
    expect(isSectionOpen('aprender')).toBe(true); // 10:00 en Chicago: dentro de Mañana (08-12); en UTC o en Madrid, no
    expect(isSectionOpen('mytube')).toBe(false); // Tarde (14-18) todavía no
  });
});

