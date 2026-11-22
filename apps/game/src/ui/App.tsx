import { useState } from 'react';
import { GameCanvas } from './GameCanvas.tsx';
import { PerfOverlay } from './PerfOverlay.tsx';
import { DevPanel } from './DevPanel.tsx';
import { PlayingScreen } from './PlayingScreen.tsx';
import { LoadingScreen } from './LoadingScreen.tsx';
import { MenuScreen } from './MenuScreen.tsx';
import { AboutScreen } from './AboutScreen.tsx';
import { UpdateBanner } from './UpdateBanner.tsx';
import { useGameStore } from '../state/store.ts';

export function App() {
  const screen = useGameStore((s) => s.screen);
  const [devOpen, setDevOpen] = useState(false);
  return (
    <div className="app">
      <GameCanvas />
      <div className="overlay">
        {screen === 'playing' && <PlayingScreen />}
        <PerfOverlay />
        {screen === 'loading' && <LoadingScreen />}
        {screen === 'menu' && !devOpen && <MenuScreen onDevTools={() => setDevOpen(true)} />}
        {screen === 'about' && <AboutScreen />}
        {devOpen && <DevPanel onClose={() => setDevOpen(false)} />}
        <UpdateBanner />
      </div>
    </div>
  );
}
