import { useEffect, useState } from 'react';
import { getGame } from '../engine/gameInstance.ts';
import { World } from '../world/World.ts';
import { getWorld, setWorld } from '../world/worldInstance.ts';
import { attachKeyboard, input } from '../player/input.ts';
import { runMeasurement } from '../engine/devTools.ts';
import { hideStressScene } from '../engine/devTools.ts';
import { saveUniformBuffersEnabled } from '../engine/renderFlags.ts';
import { Controls } from './controls/index.tsx';
import { HealthBar } from './hud/HealthBar.tsx';
import { RegionEdgeHint } from './hud/RegionEdgeHint.tsx';
import { useGameStore } from '../state/store.ts';
import { disposeNpcPreview, toggleNpcPreview } from '../npc/preview/NpcPreview.ts';
import { getModels } from '../assets/ModelRegistry.ts';
import { loadSave, newSave, startAutosave } from '../save/saveStore.ts';
import { runChaosTest } from '../world/chaosTest.ts';

/** Testmodus: Welt laden, Figur steuern, Messfahrten starten. */
export function PlayingScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [status, setStatus] = useState('Welt wird geladen …');
  const [fast, setFast] = useState(false);
  const [quality, setQualityState] = useState(getGame()?.quality.level ?? 'low');
  const [measuring, setMeasuring] = useState(false);
  const debugPhysics = useGameStore((s) => s.debugPhysics);
  const [npcs, setNpcs] = useState(false);
  const setDebugPhysics = useGameStore((s) => s.setDebugPhysics);

  useEffect(() => {
    let cancelled = false;
    const game = getGame();
    if (!game) return;
    hideStressScene();
    const detachKeys = attachKeyboard();
    let stopAutosave: (() => void) | null = null;
    loadSave()
      .then((save) => {
        if (save) useGameStore.getState().setFigureVariant(save.figure.variant);
        return World.create(game, {
          save: save ? { x: save.player.x, z: save.player.z, worldVersion: save.worldVersion } : undefined,
        });
      })
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
                {},
                useGameStore.getState().figureVariant,
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
      disposeNpcPreview();
      input.fast = false;
      getWorld()?.dispose();
      setWorld(null);
    };
  }, []);

  const toggleFast = () => {
    input.fast = !input.fast;
    setFast(input.fast);
  };

  const route = (names: string[], label: string, flight: boolean | 'heli' = false) => {
    const w = getWorld(),
      g = getGame();
    if (!w || !g) return;
    const started =
      flight === 'heli'
        ? w.heli.startBaselRoute()
        : flight
          ? w.startFlightRoute(names[0], names[1])
          : w.startRoute(names);
    if (!started) {
      setStatus(`Route ${names.join(' → ')}: Orte nicht gefunden`);
      return;
    }
    setMeasuring(true);
    setStatus(`Messfahrt ${names.join(' → ')} läuft …`);
    g.perf.recorder.start(label);
    const poll = window.setInterval(() => {
      if (getWorld()?.routeActive) return;
      window.clearInterval(poll);
      if (flight === true) getWorld()?.stopFlying();
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

  /** Freier Messlauf (z. B. während einer Autofahrt) bzw. Chaos-Test – lädt jeweils einen JSON-Bericht herunter. */
  const measureFree = (label: string, seconds: number, during?: () => Promise<Record<string, number>>) => {
    const g = getGame(),
      w = getWorld();
    if (!g || !w) return;
    setMeasuring(true);
    setStatus(`${label} läuft (${seconds} s) …`);
    g.perf.recorder.start(label);
    void (during ? during() : new Promise<Record<string, number>>((r) => setTimeout(() => r({}), seconds * 1000))).then(
      (extra) => {
        g.perf.recorder.stop();
        Object.assign(g.perf.recorder.extra, extra, {
          maxPhysicsBodies: w.budget.count,
          vehicles: w.vehicles?.count ?? 0,
        });
        runMeasurement(
          g,
          label,
          0,
          (r) => {
            setMeasuring(false);
            setStatus(
              `${label}: Ø ${r.summary.avgFps.toFixed(1)} fps, 1 %-Low ${r.summary.p1LowFps.toFixed(1)} fps${extra.maxBodies !== undefined ? `, max. ${extra.maxBodies} Körper` : ''}`,
            );
          },
          true,
        );
      },
    );
  };

  /** NPC-Testansicht (gebackene Animationen, Thin Instances) 8 m vor der Figur in Blickrichtung der Kamera. */
  const toggleNpcs = () => {
    const g = getGame(),
      w = getWorld();
    if (!g || !w) return;
    const p = w.player.position,
      yaw = w.player.rig.forwardYaw;
    const at = { x: p.x + Math.sin(yaw) * 8, y: p.y, z: p.z + Math.cos(yaw) * 8, yaw };
    toggleNpcPreview(g.scene, getModels(), at)
      .then(setNpcs)
      .catch((e) => setStatus(`NPC-Testansicht: ${(e as Error).message}`));
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
      <Controls />
      <HealthBar />
      <RegionEdgeHint />
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
        <button className="secondary" disabled={measuring} onClick={() => route(['Kandern', 'Wollbach'], 'flug', true)}>
          Flug
        </button>
        <button
          className="secondary"
          disabled={measuring}
          onClick={() => route(['Kandern', 'Lörrach', 'Basel', 'EuroAirport'], 'hubschrauber-basel', 'heli')}
        >
          Heli Basel
        </button>
        <button className="secondary" disabled={measuring} onClick={() => measureFree('messlauf', 60)}>
          Messlauf 60 s
        </button>
        <button
          className="secondary"
          disabled={measuring}
          onClick={() => {
            const w = getWorld();
            if (w) measureFree('chaostest', 30, () => runChaosTest(w));
          }}
        >
          Chaos-Test
        </button>
        <button className={debugPhysics ? 'active' : 'secondary'} onClick={() => setDebugPhysics(!debugPhysics)}>
          Debug
        </button>
        <button className={npcs ? 'active' : 'secondary'} data-testid="npc-preview" onClick={toggleNpcs}>
          NPCs
        </button>
        <button
          className="secondary"
          onClick={() => {
            const g = getGame();
            if (!g) return;
            saveUniformBuffersEnabled(!g.uniformBuffers);
            location.reload();
          }}
        >
          UBO: {getGame()?.uniformBuffers === false ? 'aus' : 'an'}
        </button>
        <button className="secondary" onClick={switchQuality}>
          Qualität: {quality === 'low' ? 'Niedrig' : 'Hoch'}
        </button>
      </div>
      {status && <div className="toast panel">{status}</div>}
    </>
  );
}
