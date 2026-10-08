import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/base.css';
import './styles/shell.css';
import './sections/home/home.css';
import './sections/discover/discover.css';
import './sections/space/space.css';
import './sections/learn/learn.css';
import './sections/practice/practice.css';
import './sections/friends/friends.css';
import './sections/leagues/leagues.css';
import './sections/store/store.css';
import './sections/parent/parent.css';

/** Modo "stage" (?stage al abrir): 1280×720 escalado como el prototipo, para comparar píxel a píxel. */
function StageFrame({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.body.classList.add('stage-mode');
    const fit = () => { if (frame.current && stage.current) stage.current.style.transform = `scale(${frame.current.clientWidth / 1280})`; };
    const ro = new ResizeObserver(fit); ro.observe(frame.current!); fit();
    return () => ro.disconnect();
  }, []);
  return <div className="stage-frame" ref={frame}><div className="stage" ref={stage}>{children}</div></div>;
}

const stageMode = new URLSearchParams(location.search).has('stage');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {stageMode ? <StageFrame><App /></StageFrame> : <App />}
    </BrowserRouter>
  </StrictMode>,
);
