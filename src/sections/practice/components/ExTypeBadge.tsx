import { TYPES } from '../lib/exerciseTypes';

export const ExTypeBadge = ({ type }: { type: 'open' | 'mc' | 'vf' }) => {
  const T = TYPES[type];
  return <span className="extype"><T.G />{T.l}</span>;
};
