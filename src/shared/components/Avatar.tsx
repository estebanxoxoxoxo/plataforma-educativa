import type { CSSProperties } from 'react';

export const Avatar = ({ name, color, style }: { name: string; color: string; style?: CSSProperties }) => (
  <span className="av3" style={{ background: color, ...style }}>{name[0]}</span>
);
