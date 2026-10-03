import { useEffect, useState } from 'react';
import { api } from '../../../api';
import type { GeoRanking, GeoScope } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { GeoPicker } from '../components/GeoPicker';
import { Ranking } from '../components/Ranking';

export function GeoLeagues() {
  const [scope, setScope] = useState<GeoScope>('zona');
  const [last, setLast] = useState<GeoRanking | null>(null);
  const { data, loading } = useAsync(() => api.geoRanking(scope), [scope]);
  useEffect(() => { if (data) setLast(data); }, [data]);
  return (
    <div className="lpane">
      <GeoPicker value={scope} onChange={setScope} />
      {last && <Ranking r={last} loading={loading} />}
    </div>
  );
}
