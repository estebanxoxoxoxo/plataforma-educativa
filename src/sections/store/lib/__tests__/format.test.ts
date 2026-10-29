// QA-U5-E (FIX-FINAL): «Tus canjes» y «Tus movimientos» escriben la fecha en la ZONA DE LA FAMILIA (`tz`, la de la barra
// superior), no en la del navegador. 2026-11-01T10:30Z = lunes 2 nov 00:30 en Kiritimati · domingo 1 nov 11:30 en Madrid.
import { describe, expect, it } from 'vitest';
import { fmtFull, fmtWhen } from '../format';

const KIRI = 'Pacific/Kiritimati';
const MAD = 'Europe/Madrid';
const T = Date.parse('2026-11-01T10:30:00Z');
const NOW = new Date(Date.parse('2026-11-01T10:31:00Z'));

describe('fmtWhen de la Tienda en la zona de la familia', () => {
  it('«Hoy · HH:MM» con la hora de la pared de la familia', () => {
    expect(fmtWhen(T, NOW, KIRI)).toBe('Hoy · 00:30');
    expect(fmtWhen(T, NOW, MAD)).toBe('Hoy · 11:30');
  });
  it('«Ayer» cruza la medianoche de la familia', () => {
    const t = Date.parse('2026-11-01T09:30:00Z');
    expect(fmtWhen(t, NOW, KIRI)).toBe('Ayer · 23:30');
    expect(fmtWhen(t, NOW, MAD)).toBe('Hoy · 10:30');
  });
  it('otro año (en la pared de la familia): con el año', () => {
    const t = Date.parse('2025-12-31T12:00:00Z');
    expect(fmtWhen(t, NOW, KIRI)).toMatch(/^1 ene\.? · 02:00$/);
    expect(fmtWhen(t, NOW, MAD)).toMatch(/^31 (de )?dic\.?( de)? 2025 · 13:00$/);
  });
  it('sin zona, o una desconocida: la local, como antes', () => {
    expect(fmtWhen(T, NOW, null)).toBe(fmtWhen(T, NOW));
    expect(fmtWhen(T, NOW, 'Marte/Olympus')).toBe(fmtWhen(T, NOW));
  });
  it('fmtFull también', () => {
    expect(fmtFull(T, KIRI)).toMatch(/lunes.*00:30/);
    expect(fmtFull(T, MAD)).toMatch(/domingo.*11:30/);
  });
});
