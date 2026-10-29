import { describe, expect, it } from 'vitest';
import type { CloseWeekResult, FamilyLeague, FamilyLeagueRow, FamilyPrizeOptions, FamilyWeekClosed, FamilyWeekPrize } from '../../../../api/types';
import {
  CONDITIONS, DEFAULT_CONDITION, beatLastWeek, capFirst, clampDays, closedPrizeLine, conditionText, cupLine, cupOf, daysText,
  draftFrom, familyCloseCopy, familyCloseOn, marksOf, marksText, namesList, prizeByText, prizeCarried, prizeRequest,
  reconcileDraft, repeatRequest, repeatablePrize, storePrizeFor, totalLine, upPrizeEmoji,
} from '../familyWeek';

/* U5-C — lo puro de la liga de la familia en el cliente (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2.6, §3, §4): textos solo
   positivos, el ↑ que aparece cuando se logra, la condición del premio para cada quien y el borrador de la hoja (solo forma:
   los límites los valida el server y su motivo se muestra tal cual). */

const bici: FamilyWeekPrize = {
  emoji: '🚲', title: '1 hora de bici', condition: 'supera-su-semana',
  by: { id: 'andres', name: 'Andrés' }, from: null, setAt: 1000,
};
const deTienda: FamilyWeekPrize = { ...bici, emoji: '🎬', title: 'Elegís la película', desc: 'El viernes', from: { member: 'luna', itemId: 4 }, setAt: 2000 };

/** La "semana pasada" del seed (USUARIOS §12): 🏆 Luna 1.350 · Ian 1.180 · Andrés 300, total 2.830, sin ↑. */
const seedWeek: FamilyWeekClosed = {
  week: 0, closedAt: 0, label: 'la semana pasada', simulated: false, total: 2830, prize: null,
  rows: [
    { id: 'luna', name: 'Luna', kind: 'child', xp: 1350, days: 6, marks: ['gano'] },
    { id: 'ian', name: 'Ian', kind: 'child', xp: 1180, days: 6, marks: [] },
    { id: 'andres', name: 'Andrés', kind: 'adult', xp: 300, days: 3, marks: [] },
  ],
};
/** El primer cierre simulado con el seed: 🏆 Luna · ↑ Ian · ↑ Andrés (y un ✨ para probar la combinación). */
const firstClose: FamilyWeekClosed = {
  week: 1, closedAt: 5000, label: 'la semana pasada', simulated: true, total: 2980,
  prize: { ...bici, winners: ['ian'] },
  rows: [
    { id: 'luna', name: 'Luna', kind: 'child', xp: 1290, days: 3, marks: ['gano'] },
    { id: 'ian', name: 'Ian', kind: 'child', xp: 1240, days: 7, marks: ['supero', 'siete'], prize: true },
    { id: 'andres', name: 'Andrés', kind: 'adult', xp: 450, days: 2, marks: ['supero'] },
  ],
};
const row = (over: Partial<FamilyLeagueRow>): FamilyLeagueRow =>
  ({ pos: 1, id: 'ian', name: 'Ian', nick: 'Ian', kind: 'child', xp: 1240, streakDays: 5, look: null, days: 3, prevXp: 1180, prizeEligible: true, ...over });

describe('namesList y capFirst', () => {
  it('une nombres como se dice', () => {
    expect(namesList([])).toBe('');
    expect(namesList(['Ian'])).toBe('Ian');
    expect(namesList(['Ian', 'Luna'])).toBe('Ian y Luna');
    expect(namesList(['Ian', 'Luna', 'Andrés'])).toBe('Ian, Luna y Andrés');
  });
  it('el rótulo del server con mayúscula', () => {
    expect(capFirst('la semana pasada')).toBe('La semana pasada');
    expect(capFirst('hace 2 semanas')).toBe('Hace 2 semanas');
    expect(capFirst('')).toBe('');
  });
});

describe('el reto "N de 7 días" (D2)', () => {
  it('entero de 0 a 7, aunque llegue algo raro', () => {
    expect(clampDays(3)).toBe(3);
    expect(clampDays(0)).toBe(0);
    expect(clampDays(9)).toBe(7);
    expect(clampDays(-2)).toBe(0);
    expect(clampDays(4.7)).toBe(4);
    expect(clampDays(undefined)).toBe(0);
    expect(clampDays(Number.NaN)).toBe(0);
  });
  it('el texto', () => {
    expect(daysText(5)).toBe('5 de 7 días');
    expect(daysText(1)).toBe('1 de 7 días');
    expect(daysText(12)).toBe('7 de 7 días');
  });
});

describe('↑ superó su semana (solo cuando se logra)', () => {
  it('prevXp null o ausente: no hay contra qué compararse', () => {
    expect(beatLastWeek({ xp: 500, prevXp: null })).toBe(false);
    expect(beatLastWeek({ xp: 500 })).toBe(false);
  });
  it('estuvo y no sumó (prevXp 0): cualquier XP la supera; igualar no alcanza', () => {
    expect(beatLastWeek({ xp: 10, prevXp: 0 })).toBe(true);
    expect(beatLastWeek({ xp: 0, prevXp: 0 })).toBe(false);
    expect(beatLastWeek({ xp: 1180, prevXp: 1180 })).toBe(false);
  });
  it('los seeds: Ian y Andrés ya la superaron, Luna todavía no (y la UI no dice cuánto le falta)', () => {
    expect(beatLastWeek({ xp: 1240, prevXp: 1180 })).toBe(true);
    expect(beatLastWeek({ xp: 450, prevXp: 300 })).toBe(true);
    expect(beatLastWeek({ xp: 1290, prevXp: 1350 })).toBe(false);
  });
  it('el emoji del premio va con el ↑ de un CHICO y solo con "supera su semana"', () => {
    expect(upPrizeEmoji(row({}), bici)).toBe('🚲');
    expect(upPrizeEmoji(row({ prizeEligible: undefined, kind: 'adult' }), bici)).toBeNull();
    expect(upPrizeEmoji(row({}), { ...bici, condition: 'gana-la-semana' })).toBeNull();
    expect(upPrizeEmoji(row({ xp: 1000 }), bici)).toBeNull();
    expect(upPrizeEmoji(row({}), null)).toBeNull();
  });
});

describe('una semana cerrada: copa, marcas, total y premio (sin puestos)', () => {
  it('la copa del seed', () => {
    expect(cupOf(seedWeek)).toEqual({ id: 'luna', name: 'Luna', xp: 1350 });
    expect(cupLine(seedWeek)).toBe('🏆 Ganó Luna · 1.350 XP');
  });
  it('si nadie sumó no hay copa, y se dice sin drama', () => {
    const empty: FamilyWeekClosed = { ...seedWeek, total: 0, rows: seedWeek.rows.map((r) => ({ ...r, xp: 0, marks: [] })) };
    expect(cupOf(empty)).toBeNull();
    expect(cupLine(empty)).toBe('Nadie sumó esa semana.');
    expect(cupLine(empty, 'esta')).toBe('Nadie sumó esta semana.');
  });
  it('sin copa pero con XP (una tabla de uno): no hay línea de copa', () => {
    const solo: FamilyWeekClosed = { ...seedWeek, total: 300, rows: [{ ...seedWeek.rows[2] }] };
    expect(cupLine(solo)).toBeNull();
  });
  it('el seed no tiene marcas alcanzables (no se inventa una comparación)', () => {
    expect(marksOf(seedWeek)).toEqual([]);
    expect(marksText(seedWeek)).toBe('');
  });
  it('las marcas de cada uno, en el orden de la tabla; la copa sola no es ficha', () => {
    expect(marksOf(firstClose)).toEqual([
      { id: 'ian', name: 'Ian', text: '↑ superó su semana · ✨ los 7 días' },
      { id: 'andres', name: 'Andrés', text: '↑ superó su semana' },
    ]);
    expect(marksText(firstClose)).toBe('Ian ↑ superó su semana · ✨ los 7 días · Andrés ↑ superó su semana');
  });
  it('la línea cooperativa', () => {
    expect(totalLine(2830)).toBe('Entre todos sumaron 2.830 XP');
    expect(totalLine(0)).toBe('Entre todos sumaron 0 XP');
  });
  it('el premio: para quién, quién lo da y, sin ganadores, "sigue en juego" (nunca "nadie lo ganó")', () => {
    expect(closedPrizeLine(seedWeek)).toBeNull();
    expect(closedPrizeLine(firstClose)).toBe('🚲 1 hora de bici → para Ian (se lo da Andrés)');
    expect(closedPrizeLine(firstClose, 'andres')).toBe('🚲 1 hora de bici → para Ian (se lo das vos)');
    expect(closedPrizeLine(firstClose, 'ian')).toBe('🚲 1 hora de bici → para vos (se lo da Andrés)');
    const two: FamilyWeekClosed = { ...firstClose, prize: { ...bici, winners: ['ian', 'luna'] } };
    expect(closedPrizeLine(two)).toBe('🚲 1 hora de bici → para Ian y Luna (se lo da Andrés)');
    expect(closedPrizeLine(two, 'ian')).toBe('🚲 1 hora de bici → para Luna y vos (se lo da Andrés)');
    const none: FamilyWeekClosed = { ...firstClose, prize: { ...bici, winners: [] } };
    // sin `prizeInPlay` (server viejo): como siempre
    expect(closedPrizeLine(none)).toBe('🚲 1 hora de bici sigue en juego');
    expect(closedPrizeLine(none, 'andres', false)).toBe('🚲 1 hora de bici sigue en juego');
    // revisión de U5: "sigue en juego" SOLO si sigue HOY (prizeInPlay) y es la última semana cerrada
    const inPlay: FamilyWeekClosed = { ...none, prizeInPlay: true };
    const gone: FamilyWeekClosed = { ...none, prizeInPlay: false };
    expect(closedPrizeLine(inPlay)).toBe('🚲 1 hora de bici sigue en juego');
    expect(closedPrizeLine(inPlay, 'andres', true)).toBe('🚲 1 hora de bici sigue en juego');
    // una semana vieja de un premio arrastrado: en pasado, neutro
    expect(closedPrizeLine(inPlay, 'andres', false)).toBe('🚲 1 hora de bici pasó a la semana siguiente');
    // el adulto lo cambió o lo quitó: tampoco "sigue en juego"
    expect(closedPrizeLine(gone)).toBe('🚲 1 hora de bici pasó a la semana siguiente');
    expect(closedPrizeLine(gone, 'ian', false)).toBe('🚲 1 hora de bici pasó a la semana siguiente');
    // con ganadores, prizeInPlay no cambia nada
    expect(closedPrizeLine({ ...firstClose, prizeInPlay: false })).toBe('🚲 1 hora de bici → para Ian (se lo da Andrés)');
    for (const w of [seedWeek, firstClose, two, none, inPlay, gone]) {
      const all = [cupLine(w), marksText(w), totalLine(w.total), closedPrizeLine(w)].join(' ');
      expect(all).not.toMatch(/perdi|últim|ultim|bajó|te falta/i);
    }
  });
});

describe('el premio en juego (§3.2-§3.3)', () => {
  it('D1: arranca en "para todos los que superen su semana anterior", y es la primera opción', () => {
    expect(DEFAULT_CONDITION).toBe('supera-su-semana');
    expect(CONDITIONS.map((c) => c.id)).toEqual(['supera-su-semana', 'gana-la-semana']);
    expect(CONDITIONS[0].help).toBe('Cada chico compite contra su propia semana: lo pueden ganar todos.');
    expect(CONDITIONS[1].help).toBe('Se lo lleva el chico que más sume (si empatan, los dos).');
  });
  it('la condición para el chico y para el adulto', () => {
    expect(conditionText('supera-su-semana', 'child')).toBe('Si superás tu semana anterior');
    expect(conditionText('gana-la-semana', 'child')).toBe('Si ganás la semana');
    expect(conditionText('supera-su-semana', 'adult')).toBe('Para todos los que superen su semana anterior');
    expect(conditionText('gana-la-semana', 'adult')).toBe('Para el que gane la semana');
  });
  it('quién lo da', () => {
    expect(prizeByText(bici, 'child')).toBe('Te lo da Andrés');
    expect(prizeByText(bici, 'adult', 'andres')).toBe('Lo prometiste vos');
    expect(prizeByText(bici, 'adult', 'otra')).toBe('Lo prometió Andrés');
  });
  it('"sigue en juego": el de hoy es el mismo que quedó sin ganadores la semana pasada', () => {
    const carried = { prize: bici, history: [{ ...firstClose, prize: { ...bici, winners: [] } }] };
    expect(prizeCarried(carried)).toBe(true);
    expect(prizeCarried({ ...carried, prize: { ...bici, setAt: 9 } })).toBe(false);
    expect(prizeCarried({ prize: bici, history: [firstClose] })).toBe(false);
    expect(prizeCarried({ prize: null, history: carried.history })).toBe(false);
    expect(prizeCarried({ prize: bici, history: [seedWeek] })).toBe(false);
  });
  it('"sigue en juego" con prizeInPlay del server: manda ese dato (sin el campo, la identidad por setAt de siempre)', () => {
    const week = { ...firstClose, prize: { ...bici, winners: [] } };
    expect(prizeCarried({ prize: bici, history: [{ ...week, prizeInPlay: true }] })).toBe(true);
    // mismo setAt pero el server dice que ya no es el vigente (p. ej. lo consumió otro cierre): no
    expect(prizeCarried({ prize: bici, history: [{ ...week, prizeInPlay: false }] })).toBe(false);
    // sin premio hoy, nunca
    expect(prizeCarried({ prize: null, history: [{ ...week, prizeInPlay: true }] })).toBe(false);
    expect(prizeCarried({ prize: bici, history: [] })).toBe(false);
  });
  it('"Repetir el de la semana pasada": solo si hoy no hay premio y el anterior se lo llevó alguien', () => {
    const p = repeatablePrize({ prize: null, history: [firstClose] });
    expect(p).toEqual(bici);
    expect(p && 'winners' in p).toBe(false);
    expect(repeatablePrize({ prize: bici, history: [firstClose] })).toBeNull();
    expect(repeatablePrize({ prize: null, history: [{ ...firstClose, prize: { ...bici, winners: [] } }] })).toBeNull();
    expect(repeatablePrize({ prize: null, history: [seedWeek] })).toBeNull();
    expect(repeatablePrize({ prize: null, history: [] })).toBeNull();
  });
  it('el pedido de "Repetir": SIEMPRE el texto prometido (sin from: "informativo, no lo ata")', () => {
    // de la Tienda: el texto copiado, no `from` (el server re-copiaba el ítem de HOY, o 400 si se archivó)
    expect(repeatRequest(deTienda)).toEqual({ condition: 'supera-su-semana', emoji: '🎬', title: 'Elegís la película', desc: 'El viernes' });
    expect(repeatRequest(deTienda)).not.toHaveProperty('from');
    expect(repeatRequest(bici)).toEqual({ condition: 'supera-su-semana', emoji: '🚲', title: '1 hora de bici' });
    expect(repeatRequest({ ...bici, desc: 'El sábado', condition: 'gana-la-semana' }))
      .toEqual({ condition: 'gana-la-semana', emoji: '🚲', title: '1 hora de bici', desc: 'El sábado' });
  });
  it('D4: el chip del cierre de la familia, solo para el adulto y con dos o más', () => {
    const rows = [row({}), row({ id: 'luna', pos: 2 })];
    expect(familyCloseOn({ canManage: true, rows })).toBe(true);
    expect(familyCloseOn({ canManage: false, rows })).toBe(false);
    expect(familyCloseOn({ rows })).toBe(false);
    expect(familyCloseOn({ canManage: true, rows: rows.slice(0, 1) })).toBe(false);
    expect(familyCloseOn(null)).toBe(false);
  });
  it('la Tienda muestra el premio solo a un chico que está en la tabla', () => {
    const f: Pick<FamilyLeague, 'prize' | 'rows'> = { prize: bici, rows: [row({ me: true }), row({ id: 'andres', kind: 'adult', prizeEligible: undefined })] };
    expect(storePrizeFor(f)).toEqual(bici);
    expect(storePrizeFor({ ...f, prize: null })).toBeNull();
    expect(storePrizeFor({ prize: bici, rows: [row({}), row({ id: 'andres', kind: 'adult', prizeEligible: undefined, me: true })] })).toBeNull();
    expect(storePrizeFor(null)).toBeNull();
  });
});

describe('la hoja del premio: borrador (solo forma)', () => {
  it('abre con D1 y en "De los premios de tus chicos"; "Cambiar" abre con lo vigente', () => {
    expect(draftFrom(null)).toEqual({ mode: 'tienda', pick: null, emoji: '', title: '', desc: '', condition: 'supera-su-semana' });
    expect(draftFrom(deTienda)).toMatchObject({ mode: 'tienda', pick: { member: 'luna', itemId: 4 }, condition: 'supera-su-semana' });
    expect(draftFrom({ ...bici, desc: 'Sábado', condition: 'gana-la-semana' }))
      .toEqual({ mode: 'nuevo', pick: null, emoji: '🚲', title: '1 hora de bici', desc: 'Sábado', condition: 'gana-la-semana' });
  });
  it('de la Tienda: hace falta elegir uno', () => {
    const d = draftFrom(null);
    expect(prizeRequest(d)).toBeNull();
    expect(prizeRequest({ ...d, pick: { member: 'ian', itemId: 2 } })).toEqual({ condition: 'supera-su-semana', from: { member: 'ian', itemId: 2 } });
  });
  it('uno nuevo: emoji y título no vacíos; los límites los decide el server (un título de 1 letra viaja)', () => {
    const d = { ...draftFrom(null), mode: 'nuevo' as const };
    expect(prizeRequest(d)).toBeNull();
    expect(prizeRequest({ ...d, emoji: '🚲', title: '   ' })).toBeNull();
    expect(prizeRequest({ ...d, emoji: '  ', title: 'Bici' })).toBeNull();
    expect(prizeRequest({ ...d, emoji: '🚲', title: 'a' })).toEqual({ condition: 'supera-su-semana', emoji: '🚲', title: 'a' });
    expect(prizeRequest({ ...d, emoji: ' 🚲 ', title: ' 1 hora de bici ', desc: '  ', condition: 'gana-la-semana' }))
      .toEqual({ condition: 'gana-la-semana', emoji: '🚲', title: '1 hora de bici' });
    expect(prizeRequest({ ...d, emoji: '🚲', title: 'Bici', desc: ' El sábado ' })).toEqual({ condition: 'supera-su-semana', emoji: '🚲', title: 'Bici', desc: 'El sábado' });
  });
  it('una condición inválida no arma pedido', () => {
    expect(prizeRequest({ ...draftFrom(null), pick: { member: 'ian', itemId: 2 }, condition: 'x' as never })).toBeNull();
  });
  it('"Cambiar" un premio de la Tienda: con el mismo elegido va el texto PROMETIDO, sin from; con otro, ese from', () => {
    const d = draftFrom(deTienda);
    expect(d.kept).toEqual({ from: { member: 'luna', itemId: 4 }, emoji: '🎬', title: 'Elegís la película', desc: 'El viernes' });
    expect(prizeRequest(d)).toEqual({ condition: 'supera-su-semana', emoji: '🎬', title: 'Elegís la película', desc: 'El viernes' });
    // solo cambia la condición
    expect(prizeRequest({ ...d, condition: 'gana-la-semana' }))
      .toEqual({ condition: 'gana-la-semana', emoji: '🎬', title: 'Elegís la película', desc: 'El viernes' });
    // eligió otro premio de la Tienda: ese sí va con from (el server lo copia ahora)
    expect(prizeRequest({ ...d, pick: { member: 'ian', itemId: 2 } })).toEqual({ condition: 'supera-su-semana', from: { member: 'ian', itemId: 2 } });
    // el escrito no lleva kept
    expect(draftFrom(bici).kept).toBeUndefined();
  });
  it('"Cambiar" cuando llegan las opciones: si el ítem ya no está o cambió su texto, pasa a "Uno nuevo" con lo prometido', () => {
    const d = draftFrom(deTienda);
    const opts = (items: FamilyPrizeOptions['groups'][number]['items']): FamilyPrizeOptions =>
      ({ groups: [{ member: 'ian', name: 'Ian', items: [{ itemId: 2, emoji: '🍦', title: 'Helado' }] }, { member: 'luna', name: 'Luna', items }] });
    const same = opts([{ itemId: 4, emoji: '🎬', title: 'Elegís la película', desc: 'El viernes' }]);
    // sigue igual: no cambia nada (queda marcado en la lista)
    expect(reconcileDraft(d, same)).toBe(d);
    // todavía cargando o falló la lectura: no se toca
    expect(reconcileDraft(d, null)).toBe(d);
    expect(reconcileDraft(d, 'error')).toBe(d);
    const nuevo = { ...d, mode: 'nuevo', pick: null, emoji: '🎬', title: 'Elegís la película', desc: 'El viernes' };
    // archivado (no viene en las opciones)
    expect(reconcileDraft(d, opts([]))).toEqual(nuevo);
    // editado: otro título, otra descripción u otro emoji
    expect(reconcileDraft(d, opts([{ itemId: 4, emoji: '🎬', title: 'Elegís la película y el pochoclo', desc: 'El viernes' }]))).toEqual(nuevo);
    expect(reconcileDraft(d, opts([{ itemId: 4, emoji: '🎬', title: 'Elegís la película' }]))).toEqual(nuevo);
    expect(reconcileDraft(d, opts([{ itemId: 4, emoji: '🍿', title: 'Elegís la película', desc: 'El viernes' }]))).toEqual(nuevo);
    // y el pedido de ese borrador es el texto prometido
    expect(prizeRequest(reconcileDraft(d, opts([])))).toEqual({ condition: 'supera-su-semana', emoji: '🎬', title: 'Elegís la película', desc: 'El viernes' });
    // si el adulto ya eligió otro, o es un premio escrito, no se toca
    const other = { ...d, pick: { member: 'ian', itemId: 2 } };
    expect(reconcileDraft(other, opts([]))).toBe(other);
    const written = draftFrom(bici);
    expect(reconcileDraft(written, opts([]))).toBe(written);
    const fresh = draftFrom(null);
    expect(reconcileDraft(fresh, opts([]))).toBe(fresh);
  });
});

describe('el aviso del cierre de la familia', () => {
  const mine: CloseWeekResult = {
    closed: { league: { id: 'chispa-g', name: 'Liga Chispa', color: '#F26B3A' }, pos: 9, total: 12, medal: null, xp: 450 },
    next: { league: { id: 'chispa-g', name: 'Liga Chispa', color: '#F26B3A' }, movement: 'queda', closesInDays: 7 },
    feedAdded: 1,
  };
  it('copa, marcas, total, premio y la línea de su liga con el closeCopy de siempre', () => {
    const c = familyCloseCopy({ closed: firstClose, mine }, 'andres');
    expect(c.title).toBe('¡Cerró la semana de la familia!');
    expect(c.cup).toBe('🏆 Ganó Luna · 1.290 XP');
    expect(c.marks.map((m) => m.name)).toEqual(['Ian', 'Andrés']);
    expect(c.total).toBe('Entre todos sumaron 2.980 XP');
    expect(c.prize).toBe('🚲 1 hora de bici → para Ian (se lo das vos)');
    expect(c.mine).toBe('Tu liga también cerró: saliste 9º de 12 en la Liga Chispa con 450 XP.');
  });
  it('el cierre recién hecho sin ganadores: "sigue en juego" (es la última semana y el server dice que sigue)', () => {
    const none: FamilyWeekClosed = { ...firstClose, prize: { ...bici, winners: [] }, prizeInPlay: true };
    expect(familyCloseCopy({ closed: none, mine }, 'andres').prize).toBe('🚲 1 hora de bici sigue en juego');
  });
  it('si nadie sumó, la copa no existe y se dice "esta semana"', () => {
    const empty: FamilyWeekClosed = { ...firstClose, total: 0, prize: null, rows: firstClose.rows.map((r) => ({ ...r, xp: 0, marks: [] })) };
    const c = familyCloseCopy({ closed: empty, mine: { ...mine, closed: { ...mine.closed, xp: 0 } } });
    expect(c.cup).toBe('Nadie sumó esta semana.');
    expect(c.prize).toBeNull();
    expect(c.mine).toBe('Tu liga también cerró: saliste 9º de 12 en la Liga Chispa.');
  });
});
