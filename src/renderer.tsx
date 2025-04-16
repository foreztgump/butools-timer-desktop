import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { useTimerInterval } from './hooks/useTimerInterval';
import { LauncherPage } from './pages/LauncherPage';
import { TimerPage } from './pages/TimerPage';
import { AudioProvider } from './context/AudioProvider';

function App() {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex-grow h-full">
        <Routes>
          <Route path="/" element={<LauncherPage />} />
          <Route path="/timer/:instanceId" element={<TimerPage />} />
        </Routes>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AudioProvider>
        <App />
      </AudioProvider>
    </HashRouter>
  </React.StrictMode>
); 