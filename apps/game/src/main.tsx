import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import { registerServiceWorker } from './offline/swClient.ts';
import { useGameStore } from './state/store.ts';
import './ui/styles.css';

registerServiceWorker(() => useGameStore.getState().setUpdateReady(true));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Nur in der Entwicklung: Zugriff für Debugging/E2E-Tests
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  void Promise.all([
    import('./engine/gameInstance.ts'),
    import('./world/worldInstance.ts'),
    import('./player/input.ts'),
  ]).then(([g, w, i]) => {
    (window as unknown as Record<string, unknown>).__kc = {
      getGame: g.getGame,
      getWorld: w.getWorld,
      store: useGameStore,
      input: i.input,
    };
  });
}
