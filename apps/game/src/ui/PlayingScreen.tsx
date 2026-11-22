import { useEffect, useState } from 'react';
import { getGame } from '../engine/gameInstance.ts';
import { World } from '../world/World.ts';
import { getWorld, setWorld } from '../world/worldInstance.ts';
import { attachKeyboard, input } from '../player/input.ts';
import { runMeasurement } from '../engine/devTools.ts';
import { hideStressScene } from '../engine/devTools.ts';
import { TouchControls } from './TouchControls.tsx';
import { useGameStore } from '../state/store.ts';
import { loadSave, newSave, startAutosave } from '../save/saveStore.ts';

/** Testmodus: Welt laden, Figur steuern, Messfahrten starten. */
export function PlayingScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [status, setStatus] = useState('Welt wird geladen …');
  const [fast, setFast] = useState(false);
  const [quality, setQualityState] = useState(getGame()?.quality.level ?? 'low');
  const [measuring, setMeasuring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const game = getGame();
    if (!game) return;
    hideStressScene();
    const detachKeys = attachKeyboard();
    let stopAutosave: (() => void) | null = null;
    loadSave()
      .then((save) =>
        World.create(game, {
          save: save ? { x: save.player.x, z: save.player.z, worldVersion: save.worldVersion } : undefined,
        }),
      )
      .then((w) => {
        if (cancelled) {
          w.dispose();
          return;
        }
        setWorld(w);
        // ?autosave=<ms> nur für Tests (Standard 30 s)
        const autosaveMs = Number(new URLSearchParams(location.search).get('autosave')) || 30_000;
        stopAutosave = startAutosave(
          {
            snapshot: () => {
              const ww = getWorld();
              if (!ww || ww.player.isFrozen) return null;
              const p = ww.player.position;
              return newSave(
                { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, yaw: ww.player.heading },
                game.quality.level,
                ww.index.buildVersion,
              );
            },
          },
          autosaveMs,
        );
        setStatus(w.physics ? '' : 'Physik nicht verfügbar – Bewegung ohne Kollision');
      })
      .catch((e) => setStatus(`Fehler: ${(e as Error).message}`));
    const t = window.setInterval(() => {
      const w = getWorld();
      if (!w) return;
      if (w.player.isFrozen && !w.routeActive) setStatus('Kachel wird geladen …');
      else setStatus((s) => (s === 'Kachel wird geladen …' || s === 'Welt wird geladen …' ? '' : s));
    }, 300);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      detachKeys();
      stopAutosave?.();
      input.fast = false;
      getWorld()?.dispose();
      setWorld(null);
    };
  }, []);

  const toggleFast = () => {
    input.fast = !input.fast;
    setFast(input.fast);
  };

  const route = (names: string[], label: string) => {
    const w = getWorld(),
      g = getGame();
    if (!w || !g) return;
    if (!w.startRoute(names)) {
      setStatus(`Route ${names.join(' → ')}: Orte nicht gefunden`);
      return;
    }
    setMeasuring(true);
    setStatus(`Messfahrt ${names.join(' → ')} läuft …`);
    g.perf.recorder.start(label);
    const poll = window.setInterval(() => {
      if (getWorld()?.routeActive) return;
      window.clearInterval(poll);
      g.perf.recorder.stop();
      // Bericht über den Messlauf-Mechanismus (0 s Nachlauf) herunterladen
      runMeasurement(
        g,
        label,
        0,
        (r) => {
          setMeasuring(false);
          setStatus(
            `Fertig: Ø ${r.summary.avgFps.toFixed(1)} fps, 1 %-Low ${r.summary.p1LowFps.toFixed(1)} fps, max ${r.summary.maxFrameMs.toFixed(0)} ms`,
          );
        },
        true,
      );
    }, 250);
  };

  const switchQuality = () => {
    const g = getGame();
    if (!g) return;
    const next = g.quality.level === 'low' ? 'high' : 'low';
    g.setQuality(next);
    setQualityState(next);
  };

  return (
    <>
      <TouchControls />
      <div className="hud">
        <button className="secondary" onClick={() => setScreen('menu')}>
          Menü
        </button>
        <button className={fast ? 'active' : ''} onClick={toggleFast}>
          {fast ? '80 km/h an' : 'Schnell (80 km/h)'}
        </button>
        <button
          className="secondary"
          disabled={measuring}
          onClick={() => route(['Kandern', 'Holzen', 'Riedlingen'], 'testroute')}
        >
          Testroute
        </button>
        <button
          className="secondary"
          disabled={measuring}
          onClick={() => route(['Feuerbach', 'Kandern', 'Wollbach'], 'langefahrt')}
        >
          Lange Fahrt
        </button>
        <button className="secondary" onClick={switchQuality}>
          Qualität: {quality === 'low' ? 'Niedrig' : 'Hoch'}
        </button>
      </div>
      {status && <div className="toast panel">{status}</div>}
    </>
  );
}
