import { describe, expect, it } from 'vitest';
import { chipLabel, hasMedalNews, hiddenNote, newsTitle, sinceText, timesText } from '../medals';

describe('chipLabel (aria-label del chip del perfil)', () => {
  it('sin nuevas: solo la cantidad', () => expect(chipLabel(5, 0)).toBe('Tus medallas: 5'));
  it('una nueva, singular', () => expect(chipLabel(5, 1)).toBe('Tus medallas: 5, 1 nueva'));
  it('varias nuevas, plural', () => expect(chipLabel(6, 2)).toBe('Tus medallas: 6, 2 nuevas'));
});

describe('sinceText ("Desde el…" de la pila)', () => {
  const now = new Date(2026, 9, 29, 12);
  it('del año en curso: día y mes', () => expect(sinceText(new Date(2026, 9, 23, 10, 5).getTime(), now)).toBe('Desde el 23 de octubre'));
  it('de otro año: con el año', () => expect(sinceText(new Date(2025, 9, 23, 10).getTime(), now)).toBe('Desde el 23 de octubre de 2025'));
  it('sin fecha (las del seed): nada', () => {
    expect(sinceText(null, now)).toBeNull();
    expect(sinceText(undefined, now)).toBeNull();
    expect(sinceText(Number.NaN, now)).toBeNull();
  });
  // QA-U5-E (FIX-FINAL): en la ZONA DE LA FAMILIA (la de la barra superior), no en la del navegador.
  it('en la zona de la familia: el día de SU pared', () => {
    const at = Date.parse('2026-11-01T10:30:00Z'); // Kiritimati: lun 2 nov 00:30 · Madrid: dom 1 nov 11:30
    const n = new Date(at);
    expect(sinceText(at, n, 'Pacific/Kiritimati')).toBe('Desde el 2 de noviembre');
    expect(sinceText(at, n, 'Europe/Madrid')).toBe('Desde el 1 de noviembre');
  });
  it('en la zona de la familia: también el año', () => {
    const at = Date.parse('2025-12-31T12:00:00Z'); // Kiritimati: 1 ene 2026 · Madrid: 31 dic 2025
    const n = new Date(Date.parse('2026-06-01T12:00:00Z'));
    expect(sinceText(at, n, 'Pacific/Kiritimati')).toBe('Desde el 1 de enero');
    expect(sinceText(at, n, 'Europe/Madrid')).toBe('Desde el 31 de diciembre de 2025');
  });
  it('sin zona, o una desconocida: la local, como antes', () => {
    const at = new Date(2026, 9, 23, 10, 5).getTime();
    expect(sinceText(at, now, null)).toBe('Desde el 23 de octubre');
    expect(sinceText(at, now, 'Marte/Olympus')).toBe('Desde el 23 de octubre');
  });
});

describe('timesText ("×N" de las repetibles)', () => {
  it('solo con 2 o más', () => {
    expect(timesText(undefined)).toBeNull();
    expect(timesText(1)).toBeNull();
    expect(timesText(2)).toBe('×2');
    expect(timesText(3)).toBe('×3');
  });
});

describe('hiddenNote (Familia → Actividad)', () => {
  it('con los nombres de los on-off', () => {
    expect(hiddenNote('ligas', 'Luna')).toBe('(Ligas apagadas: Luna no la ve)');
    expect(hiddenNote('amigos', 'Ian')).toBe('(Amigos apagado: Ian no la ve)');
  });
});

describe('noticias del Feed', () => {
  it('título de la noticia', () => expect(newsTitle({ title: 'Primera posta' })).toBe('Ganaste la medalla «Primera posta»'));
  it('hasMedalNews mira el kind', () => {
    expect(hasMedalNews([{ kind: 'video' }, { kind: 'friend' }])).toBe(false);
    expect(hasMedalNews([{ kind: 'video' }, { kind: 'medal' }])).toBe(true);
    expect(hasMedalNews([])).toBe(false);
  });
});
