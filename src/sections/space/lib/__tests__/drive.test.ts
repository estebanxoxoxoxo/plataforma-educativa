import { describe, expect, it } from 'vitest';
import type { DriveItem } from '../../../../api/types';
import { readingSource } from '../drive';

const art = (url: string, subtitle?: string): DriveItem =>
  ({ id: 1, type: 'articulo', title: 'Los volcanes', subtitle, target: { type: 'article', url }, createdAt: 0 });

describe('readingSource (vista previa de una lectura en Mi espacio)', () => {
  it('usa la fuente guardada si la hay', () => {
    expect(readingSource(art('https://www.example.org/a', 'Ciencia Kids'))).toBe('Ciencia Kids');
  });
  it('si no, el host de la URL sin www', () => {
    expect(readingSource(art('https://www.natgeokids.com/la/volcanes'))).toBe('natgeokids.com');
  });
  it('URL rota o sin lectura: null (la previa queda solo con el libro)', () => {
    expect(readingSource(art('no es una url'))).toBeNull();
    expect(readingSource({ id: 2, type: 'video', title: 'x', target: { type: 'video', id: 'abc' }, createdAt: 0 })).toBeNull();
  });
});
