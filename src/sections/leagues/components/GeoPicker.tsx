import type { GeoScope } from '../../../api/types';

export const GEO_SCOPES: { id: GeoScope; label: string; place: string }[] = [
  { id: 'zona', label: 'Tu zona', place: 'Palermo' }, { id: 'prov', label: 'Provincia', place: 'Buenos Aires' }, { id: 'pais', label: 'País', place: 'Argentina' },
];
export const GeoPicker = ({ value, onChange }: { value: GeoScope; onChange: (g: GeoScope) => void }) => (
  <div className="geo">{GEO_SCOPES.map((g) => <button key={g.id} className={g.id === value ? 'on' : ''} onClick={() => onChange(g.id)}>{g.label}<small>{g.place}</small></button>)}</div>
);
