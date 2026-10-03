import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ArticlePage } from './sections/discover/containers/ArticlePage';
import { ChatPage } from './sections/discover/containers/ChatPage';
import { SearchPage } from './sections/discover/containers/SearchPage';
import { VideoPage } from './sections/discover/containers/VideoPage';
import { CoursePage } from './sections/learn/containers/CoursePage';
import { LearnPage } from './sections/learn/containers/LearnPage';
import { ExercisePage } from './sections/practice/containers/ExercisePage';
import { JourneyPage } from './sections/practice/containers/JourneyPage';
import { PracticePage } from './sections/practice/containers/PracticePage';
import { FriendsPage } from './sections/friends/containers/FriendsPage';
import { LeagueDetailPage } from './sections/leagues/containers/LeagueDetailPage';
import { LeaguesPage } from './sections/leagues/containers/LeaguesPage';
import { HomePage } from './sections/home/containers/HomePage';
import { Sidebar } from './shared/components/Sidebar';
import { UserProvider, useUser } from './hooks/user';

function Layout() {
  const user = useUser();
  return (
    <div className="app">
      <Sidebar user={user} />
      <main className="main"><Outlet /></main>
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="descubrir" element={<Navigate to="busqueda" replace />} />
          <Route path="descubrir/busqueda" element={<SearchPage />} />
          <Route path="descubrir/articulo/:id" element={<ArticlePage />} />
          <Route path="descubrir/video/:id" element={<VideoPage />} />
          <Route path="descubrir/chat" element={<ChatPage />} />
          <Route path="aprender" element={<LearnPage />} />
          <Route path="aprender/:id" element={<CoursePage />} />
          <Route path="practicar" element={<PracticePage />} />
          <Route path="practicar/:id" element={<JourneyPage />} />
          <Route path="practicar/:id/ejercicio/:n" element={<ExercisePage />} />
          <Route path="amigos" element={<FriendsPage />} />
          <Route path="ligas" element={<LeaguesPage />} />
          <Route path="ligas/:id" element={<LeagueDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </UserProvider>
  );
}
