import { useUser } from '../../../hooks/user';

export function HomePage() {
  const user = useUser();
  return (
    <section className="view" id="v-home">
      <p className="lede">Hola, {user?.name ?? ''}</p>
      <h2 className="h2">¿Qué querés hacer hoy?</h2>
    </section>
  );
}
