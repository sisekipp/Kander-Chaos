import { useEffect, useState } from 'react';
import { useGameStore } from '../state/store.ts';
import { WORLD_URL } from '../world/World.ts';

interface Source {
  id: string;
  name: string;
  attribution: string;
  license: string;
  licenseUrl: string;
  url: string;
  retrieved: string;
  note?: string;
}

/** Bibliotheken, die im Spiel ausgeliefert werden (Lizenzangaben). */
const LIBRARIES: [string, string][] = [
  ['Babylon.js', 'Apache License 2.0'],
  ['Havok Physics (@babylonjs/havok)', 'MIT'],
  ['React / React DOM', 'MIT'],
  ['zustand', 'MIT'],
  ['fflate', 'MIT'],
  ['earcut', 'ISC'],
  ['idb-keyval', 'Apache License 2.0'],
];

/** "Über das Spiel": Quellen- und Lizenzangaben – offline aus dem Welt-Cache. */
export function AboutScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const storage = useGameStore((s) => s.storage);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${WORLD_URL}attribution.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((a: { sources: Source[] }) => setSources(a.sources))
      .catch((e) => setError(`Quellenangaben nicht verfügbar (${(e as Error).message})`));
  }, []);
  return (
    <div className="panel center about">
      <h2>Über das Spiel</h2>
      <p>Kandern Chaos – ein Spiel in der echten Gemeinde Kandern, gebaut aus offenen Geodaten.</p>
      <h3>Kartendaten</h3>
      {error && <p className="status">{error}</p>}
      {sources?.map((s) => (
        <div key={s.id} className="source">
          <b>{s.attribution}</b>
          <div>{s.name}</div>
          <div className="status">
            Lizenz: {s.license} · Stand {s.retrieved}
          </div>
          {s.note && <div className="status">{s.note}</div>}
        </div>
      ))}
      <h3>Software</h3>
      <ul className="libs">
        {LIBRARIES.map(([n, l]) => (
          <li key={n}>
            {n} – {l}
          </li>
        ))}
      </ul>
      {storage && (
        <p className="status">
          Speicher: {storage.usageMb ?? '?'} MB belegt{storage.quotaMb ? ` von ${storage.quotaMb} MB` : ''} ·{' '}
          {storage.persisted ? 'dauerhaft gespeichert' : 'Browser darf Daten bei Platzmangel löschen'}
        </p>
      )}
      <div className="stack">
        <button className="secondary" onClick={() => setScreen('menu')}>
          Zurück
        </button>
      </div>
    </div>
  );
}
