import type { ComponentType } from 'react';
import type { NodeType } from '../../../api/types';
import { GlyphMC, GlyphOpen, GlyphSkip, GlyphTrophy, GlyphVF } from '../../../shared/components/icons';

/** Colores y etiquetas por tipo de ejercicio (TYPES del prototipo). */
export const TYPES: Record<NodeType, { l?: string; s?: string; c: string; d: string; soft?: string; G: ComponentType }> = {
  open: { l: 'Pregunta abierta', s: 'La analiza la IA · con tiempo límite', c: '#8A5CF5', d: '#6439D0', soft: '#F1ECFE', G: GlyphOpen },
  mc: { l: 'Multiple choice', s: 'Varias, una o ninguna correcta', c: '#3A5BD9', d: '#2843A8', soft: '#E7ECFD', G: GlyphMC },
  vf: { l: 'Verdadero o falso', s: 'Una afirmación para evaluar', c: '#F26B3A', d: '#C24B1F', soft: '#FDEBE3', G: GlyphVF },
  trophy: { c: '#F2A81D', d: '#C4830A', G: GlyphTrophy },
  skip: { c: '#58B83F', d: '#3F8F2B', G: GlyphSkip },
};
