import { useRef, useState } from 'react';
import { useGameStore } from '../state/store.ts';
import { RegionStorage } from './RegionStorage.tsx';
import { exportSave, importSave, SaveValidationError } from '../save/saveStore.ts';

export function MenuScreen({ onDevTools }: { onDevTools: () => void }) {
  const setScreen = useGameStore((s) => s.setScreen);
  const simple = useGameStore((s) => s.simpleDriving);
  const setSimple = useGameStore((s) => s.setSimpleDriving);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const s = await importSave(f);
      setMsg(`Spielstand vom ${new Date(s.savedAt).toLocaleString('de-DE')} geladen.`);
    } catch (err) {
      setMsg(err instanceof SaveValidationError ? err.message : `Import fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  return (
    <div className="panel center">
      <h1>Kandern Chaos</h1>
      <p>Grundlagen-Build</p>
      <div className="stack">
        <button onClick={() => setScreen('playing')}>Testmodus</button>
        <button className="secondary" onClick={onDevTools}>
          Spike-Werkzeuge
        </button>
        <div className="row">
          <button
            className="secondary"
            onClick={async () =>
              setMsg(
                (await exportSave()) ? 'Spielstand wurde als Datei gespeichert.' : 'Noch kein Spielstand vorhanden.',
              )
            }
          >
            Spielstand exportieren
          </button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>
            Spielstand importieren
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={onImport}
          data-testid="import-input"
        />
        <label className="toggle">
          <input type="checkbox" checked={simple} onChange={(e) => setSimple(e.target.checked)} />
          <span>Einfach fahren (Auto gibt selbst Gas)</span>
        </label>
        <RegionStorage />
        <button className="secondary" onClick={() => setScreen('about')}>
          Über das Spiel
        </button>
      </div>
      {msg && (
        <p className="status" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
