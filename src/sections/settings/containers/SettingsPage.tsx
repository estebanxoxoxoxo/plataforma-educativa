import { useUser } from '../../../hooks/user';
import { CycleDemoControl } from '../../parent/containers/CycleDemoControl';
import { ProfileSection } from '../components/ProfileSection';
import { SoundSection } from '../components/SoundSection';
import { SwitchUserSection } from '../components/SwitchUserSection';
// Las demás secciones importan su CSS desde src/main.tsx; esta tanda solo puede tocar src/sections/settings/**, así que el
// CSS entra desde acá (Vite lo mete igual en el bundle: App importa esta página de forma estática).
import '../settings.css';

/** Configuración del usuario ACTIVO (/configuracion). Tanda CONFIG, 30-oct — pedido de Esteban: «si el usuario clickea en
 *  el avatar tiene que ir configuración de usuario; la sacás de smarty-poc y agregale toda la parte que tenemos de edición
 *  del avatar como un punto más de configuración». Alcance elegido por él: «lo nuestro, estilo POC» = el PATRÓN de los
 *  Ajustes del POC (columna angosta centrada, secciones con título claro, ayuda en gris abajo de cada campo, bordes de un
 *  trazo suave) con lo de usuario de ACÁ: Tu avatar, Sonido y Cambiar de usuario (demo). Lo parental vive en Familia.
 *  No marca ninguna solapa del menú (no es una sección). Estilos: settings.css (cfg-). */
export function SettingsPage() {
  const user = useUser();
  return (
    <section className="view cfg">
      <div className="cfg-col">
        <header className="cfg-head">
          <h2 className="h2">Configuración</h2>
          {user && <p className="lede">Cuenta de {user.name}</p>}
        </header>
        <ProfileSection user={user} />
        <SoundSection adult={user?.kind === 'adult'} />
        {/* El selector del Ciclo (demo) vive acá desde el 30-oct (pedido de Esteban: «pasá lo de ciclo demo al perfil
            del usuario»); antes estaba en el Sidebar. Él decide solo cuándo aparece. */}
        <CycleDemoControl user={user ?? undefined} />
        <SwitchUserSection user={user} />
      </div>
    </section>
  );
}
