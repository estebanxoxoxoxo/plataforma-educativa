import type { RecallLevel } from '../../../api/types';
import { LEVEL } from '../lib/levels';

/** Pastilla del nivel de una carta: punto de color + nombre (floja / mejorando / firme). */
export const LevelBadge = ({ level, pop, className = '' }: { level: RecallLevel; pop?: boolean; className?: string }) => (
  <span className={`rc-lv rc-lv--${level}${pop ? ' rc-lv--pop' : ''}${className ? ` ${className}` : ''}`}>
    <i aria-hidden="true" />{LEVEL[level].label}
  </span>
);
