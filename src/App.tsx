import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { ArticlePage } from './sections/discover/containers/ArticlePage';
import { ChatPage } from './sections/discover/containers/ChatPage';
import { SearchPage } from './sections/discover/containers/SearchPage';
import { VideoPage } from './sections/discover/containers/VideoPage';
import { CoursePage } from './sections/learn/containers/CoursePage';
import { LearnPage } from './sections/learn/containers/LearnPage';
import { ExercisePage } from './sections/practice/containers/ExercisePage';
import { JourneyPage } from './sections/practice/containers/JourneyPage';
import { PracticePage } from './sections/practice/containers/PracticePage';
import { RecallPage } from './sections/recall/containers/RecallPage';
import { RecallSessionPage } from './sections/recall/containers/RecallSessionPage';
import { FriendsPage } from './sections/friends/containers/FriendsPage';
import { LeaguesPage } from './sections/leagues/containers/LeaguesPage';
import { FeedPage } from './sections/home/containers/FeedPage';
import { ChannelPage } from './sections/space/containers/ChannelPage';
import { DrivePage } from './sections/space/containers/DrivePage';
import { PlaylistPage } from './sections/space/containers/PlaylistPage';
import { TrashPage } from './sections/space/containers/TrashPage';
import { VideosPage } from './sections/space/containers/VideosPage';
import { StorePage } from './sections/store/containers/StorePage';
import { FeatureGate } from './sections/parent/containers/FeatureGate';
import { ParentPage } from './sections/parent/containers/ParentPage';
import { BgAudioHost } from './shared/audio/BgAudioHost';
import { Sidebar } from './shared/components/Sidebar';
import { UserProvider, useUser } from './hooks/user';

/* Rutas viejas /descubrir/{articulo,video}/:id → /buscar/… (conservan el :id). */
const OldArticle = () => <Navigate to={`/buscar/articulo/${encodeURIComponent(useParams().id ?? '')}`} replace />;
const OldVideo = () => <Navigate to={`/buscar/video/${useParams().id ?? ''}`} replace />;
/* Rutas viejas de Mi espacio → ahora viven dentro de Videos. */
const OldCanal = () => <Navigate to={`/espacio/videos/canal/${useParams().id ?? ''}`} replace />;
const OldLista = () => <Navigate to={`/espacio/videos/lista/${useParams().id ?? ''}`} replace />;

function Layout() {
  const user = useUser();
  return (
    <div className="app">
      <Sidebar user={user} />
      {/* FeatureGate: las secciones que el padre apagó (Tienda, Ligas, Amigos, Chat) no se abren ni por URL */}
      <main className="main"><FeatureGate><Outlet /></FeatureGate></main>
      {/* iframe oculto del audio de fondo: vive acá para sobrevivir el cambio de sección */}
      <BgAudioHost />
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
          {/* El chat es otra puerta para encontrar cosas; "Descubrir" es el feed (la home, ruta /). */}
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
          <Route path="espacio/videos" element={<VideosPage />} />
          <Route path="espacio/videos/canal/:id" element={<ChannelPage />} />
          <Route path="espacio/videos/lista/:id" element={<PlaylistPage />} />
          {/* redirecciones de la estructura vieja (canales y listas sueltos) */}
          <Route path="espacio/canales" element={<Navigate to="/espacio/videos" replace />} />
          <Route path="espacio/listas" element={<Navigate to="/espacio/videos?tab=listas" replace />} />
          <Route path="espacio/canales/:id" element={<OldCanal />} />
          <Route path="espacio/listas/:id" element={<OldLista />} />
          <Route path="tienda" element={<StorePage />} />
          <Route path="aprender" element={<LearnPage />} />
          <Route path="aprender/:id" element={<CoursePage />} />
          <Route path="practicar" element={<PracticePage />} />
          <Route path="practicar/:id" element={<JourneyPage />} />
          <Route path="practicar/:id/ejercicio/:n" element={<ExercisePage />} />
          {/* Repasar: las cartas diarias (Active Recall es solo el nombre interno) */}
          <Route path="repasar" element={<RecallPage />} />
          <Route path="repasar/sesion" element={<RecallSessionPage />} />
          <Route path="amigos" element={<FriendsPage />} />
          <Route path="ligas" element={<LeaguesPage />} />
          {/* Zona de padres: portón de adulto + funcionalidades, premios, actividad y protecciones */}
          <Route path="padres/*" element={<ParentPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </UserProvider>
  );
}
