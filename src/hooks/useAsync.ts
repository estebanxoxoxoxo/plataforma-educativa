import { useCallback, useEffect, useState, type DependencyList } from 'react';

export type AsyncState<T> = { data?: T; loading: boolean; error?: Error };

/** Ejecuta una llamada a la API y expone { data, loading, error }. Se re-ejecuta cuando cambian las deps. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (error: Error) => alive && setState({ loading: false, error }),
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T) => setState({ data, loading: false }), []);
  return { ...state, reload, setData };
}

/** Promesa que espera ms; útil para encadenar animaciones. */
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
