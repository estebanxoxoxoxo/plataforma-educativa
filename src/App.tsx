import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { ArticlePage } from './sections/discover/containers/ArticlePage';
import { ChatPage } from './sections/discover/containers/ChatPage';
import { SearchPage } from './sections/discover/containers/SearchPage';
import { VideoPage } from './sections/discover/containers/VideoPage';
import { LearnPage } from './sections/learn/containers/LearnPage';
import { CalendarPage } from './sections/calendar/containers/CalendarPage';
import { CreatePage } from './sections/create/containers/CreatePage';
import { MyTubePage } from './sections/mytube/containers/MyTubePage';
import { AfterDayPage } from './sections/afterday/containers/AfterDayPage';
import { ChatDock } from './sections/friends/containers/ChatDock';
import { LeaguesPage } from './sections/leagues/containers/LeaguesPage';
import { FeedPage } from './sections/home/containers/FeedPage';
import { ChannelView } from './sections/mytube/containers/ChannelView';
import { DrivePage } from './sections/space/containers/DrivePage';
import { ListView } from './sections/mytube/containers/ListView';
import { TrashPage } from './sections/space/containers/TrashPage';
import { StorePage } from './sections/store/containers/StorePage';
import { FeatureGate } from './sections/parent/containers/FeatureGate';
import { ParentPage } from './sections/parent/containers/ParentPage';
import { BgAudioHost } from './shared/audio/BgAudioHost';
import { Sidebar } from './shared/components/Sidebar';
import { TopBar } from './shared/components/TopBar';
import { UserProvider, useUser } from './hooks/user';

/* Rutas viejas /descubrir/{articulo,video}/:id → /buscar/… (conservan el :id). */
const OldArticle = () => <Navigate to={`/buscar/articulo/${encodeURIComponent(useParams().id ?? '')}`} replace />;
const OldVideo = () => <Navigate to={`/buscar/video/${useParams().id ?? ''}`} replace />;
/* Rutas viejas de Mi espacio → ahora viven dentro de Videos. */
const OldCanal = () => <Navigate to={`/mytube/canal/${useParams().id ?? ''}`} replace />;
const OldLista = () => <Navigate to={`/mytube/lista/${useParams().id ?? ''}`} replace />;
const MtCanal = OldCanal;
const MtLista = OldLista;
/* La Zona de padres (/padres/*) pasó a ser Familia (/familia/*, línea 14-oct): conserva la subruta (y query/hash). */
function OldParent() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/padres/, '/familia')}${search}${hash}`} replace />;
}

function Layout() {
  const user = useUser();
  return (
    <div className="app">
      <Sidebar user={user} />
      {/* FeatureGate: las secciones que el padre apagó (Tienda, Ligas, Amigos, Chat) no se abren ni por URL — al chico:
          los candados son del dependiente; con un adulto activo pasa todo (docs/USUARIOS.md §4) */}
      <main className="main">
        {/* Barra superior GT7 (pedido 12-oct): liga (link a /ligas) · ⚡ · reloj · campana */}
        <TopBar />
        <div className="main-body"><FeatureGate><Outlet /></FeatureGate></div>
      </main>
      {/* iframe oculto del audio de fondo: vive acá para sobrevivir el cambio de sección */}
      <BgAudioHost />
      <ChatDock />
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<FeedPage />} />
          <Route path="buscar" element={<SearchPage />} />
          <Route path="buscar/articulo/:id" element={<ArticlePage />} />
          <Route path="buscar/video/:id" element={<VideoPage />} />
          {/* El chat es otra puerta para encontrar cosas; "Home" (el menú) es el feed — el "descubrir" de la visión. */}
          <Route path="chat" element={<ChatPage />} />
          {/* redirecciones de las rutas viejas (historial / marcadores) */}
          <Route path="descubrir" element={<Navigate to="/chat" replace />} />
          <Route path="descubrir/busqueda" element={<Navigate to="/buscar" replace />} />
          <Route path="descubrir/chat" element={<Navigate to="/chat" replace />} />
          <Route path="descubrir/articulo/:id" element={<OldArticle />} />
          <Route path="descubrir/video/:id" element={<OldVideo />} />
          <Route path="espacio" element={<Navigate to="/espacio/carpetas" replace />} />
          <Route path="espacio/carpetas" element={<DrivePage />} />
          <Route path="espacio/carpetas/:folderId" element={<DrivePage />} />
          <Route path="espacio/papelera" element={<TrashPage />} />
          {/* MyTube (W5): la sección nueva; las rutas viejas de Videos redirigen acá */}
          <Route path="mytube" element={<MyTubePage />} />
          {/* After Day (porte Smarty W6): la música de fondo curada por el padre, con su propia franja (W7). */}
          <Route path="afterday" element={<AfterDayPage />} />
          <Route path="mytube/canal/:id" element={<ChannelView />} />
          <Route path="mytube/lista/:id" element={<ListView />} />
          <Route path="espacio/videos" element={<Navigate to="/mytube" replace />} />
          <Route path="espacio/videos/canal/:id" element={<MtCanal />} />
          <Route path="espacio/videos/lista/:id" element={<MtLista />} />
          {/* redirecciones de la estructura vieja (canales y listas sueltos) */}
          <Route path="espacio/canales" element={<Navigate to="/espacio/videos" replace />} />
          <Route path="espacio/listas" element={<Navigate to="/espacio/videos?tab=listas" replace />} />
          <Route path="espacio/canales/:id" element={<OldCanal />} />
          <Route path="espacio/listas/:id" element={<OldLista />} />
          <Route path="tienda" element={<StorePage />} />
          {/* Aprender = Learn (porte Smarty W3+W4): aprender + practicar + Active Recall COLAPSADOS en una sola sección;
              la ruta abierta es estado de la vista (no URL) y `?ruta=<id>` la abre directo. Los cursos viejos y Practicar
              se retiraron: sus rutas redirigen a Aprender. */}
          <Route path="aprender" element={<LearnPage />} />
          <Route path="aprender/:id" element={<Navigate to="/aprender" replace />} />
          <Route path="practicar" element={<Navigate to="/aprender" replace />} />
          <Route path="practicar/:id" element={<Navigate to="/aprender" replace />} />
          <Route path="practicar/:id/ejercicio/:n" element={<Navigate to="/aprender" replace />} />
          {/* Repasar se eliminó (12-oct): el Active Recall exacto del POC vive DENTRO de Learn (W4) */}
          <Route path="repasar/*" element={<Navigate to="/aprender" replace />} />
          {/* Amigos dejó de ser sección (12-oct, tanda F2): los amigos viven en el dock de Mensajes, se buscan en
              Buscar → Personas y las solicitudes llegan a la zona pinneada del Feed. La ruta vieja va al Feed. */}
          <Route path="amigos/*" element={<Navigate to="/" replace />} />
          {/* Calendario: las clases del usuario activo con sus mentores (tanda U2: los contrata el adulto en Buscar → Mentores) */}
          <Route path="calendario" element={<CalendarPage />} />
          {/* Crear: el creador de rutas del porte Smarty (zona del chico, como el POC) */}
          <Route path="crear" element={<CreatePage />} />
          <Route path="ligas" element={<LeaguesPage />} />
          {/* Familia (línea 14-oct, docs/USUARIOS.md §5): la ex Zona de padres es ahora el punto de menú del ADULTO, sin
              portón — funcionalidades, temas, YouTube, límites, avisos, premios, mentorías, actividad y protecciones de su
              dependiente. Con un chico activo navega al Feed. Las rutas viejas /padres/* redirigen conservando la subruta. */}
          <Route path="familia/*" element={<ParentPage />} />
          <Route path="padres/*" element={<OldParent />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </UserProvider>
  );
}
