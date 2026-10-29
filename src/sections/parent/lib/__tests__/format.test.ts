// QA-U5-E (FIX-FINAL): las fechas del panel del padre se escriben en la ZONA DE LA FAMILIA (`tz`, la de la barra superior),
// no en la del navegador. Instante de prueba: 2026-11-01T10:30Z = lunes 2 nov 00:30 en Kiritimati (UTC+14) y domingo 1 nov
// 11:30 en Madrid (UTC+1). Ninguna aserción depende de la zona de la máquina que corre los tests.
import { describe, expect, it } from 'vitest';
import { fmtDay, fmtFull, fmtWhen } from '../format';

const KIRI = 'Pacific/Kiritimati';
const MAD = 'Europe/Madrid';
const T = Date.parse('2026-11-01T10:30:00Z');
const NOW = new Date(Date.parse('2026-11-01T10:31:00Z'));

describe('fmtWhen en la zona de la familia', () => {
  it('«Hoy» y la hora de la pared de la familia', () => {
    expect(fmtWhen(T, NOW, KIRI)).toBe('Hoy, 00:30');
    expect(fmtWhen(T, NOW, MAD)).toBe('Hoy, 11:30');
  });
  it('«Ayer» cruza la medianoche DE LA FAMILIA (no la del navegador)', () => {
    const t = Date.parse('2026-11-01T09:30:00Z'); // Kiritimati: dom 1 nov 23:30 · Madrid: dom 1 nov 10:30
    expect(fmtWhen(t, NOW, KIRI)).toBe('Ayer, 23:30');
    expect(fmtWhen(t, NOW, MAD)).toBe('Hoy, 10:30');
  });
  it('otro día del mismo año: día y mes cortos', () => {
    expect(fmtWhen(Date.parse('2026-10-20T12:00:00Z'), NOW, KIRI)).toMatch(/^21 oct\.?, 02:00$/);
  });
  it('el año también es el de la pared de la familia', () => {
    const t = Date.parse('2025-12-31T12:00:00Z'); // Kiritimati: 1 ene 2026 02:00 · Madrid: 31 dic 2025 13:00
    expect(fmtWhen(t, NOW, KIRI)).toMatch(/^1 ene\.?, 02:00$/);
    expect(fmtWhen(t, NOW, MAD)).toMatch(/^31 (de )?dic\.?( de)? 2025, 13:00$/);
  });
  it('sin zona, o una que este motor no conoce: la local, como antes', () => {
    expect(fmtWhen(T, NOW, null)).toBe(fmtWhen(T, NOW));
    expect(fmtWhen(T, NOW, 'Marte/Olympus')).toBe(fmtWhen(T, NOW));
  });
});

describe('fmtDay («cerró el …» de DeliveryRow)', () => {
  const closedAt = Date.parse('2026-11-01T10:00:00Z'); // el lunes 00:00 de Kiritimati
  it('el lunes de la familia, no el domingo del navegador', () => {
    expect(fmtDay(closedAt, KIRI)).toMatch(/^2 nov\.?$/);
    expect(fmtDay(closedAt, MAD)).toMatch(/^1 nov\.?$/);
  });
});

describe('fmtFull (el title de las fechas)', () => {
  it('día y hora en la zona de la familia', () => {
    expect(fmtFull(T, KIRI)).toMatch(/lunes.*2 de noviembre de 2026.*00:30/);
    expect(fmtFull(T, MAD)).toMatch(/domingo.*1 de noviembre de 2026.*11:30/);
  });
});
