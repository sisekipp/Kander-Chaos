#!/usr/bin/env node
import { runFetch } from './fetch.ts';

const HELP = `Kandern Chaos – Welt-Daten-Pipeline

Verwendung: vp run pipeline -- <schritt> [optionen]

Schritte:
  fetch   Gemeindegrenze + OSM-Daten (Overpass) und LGL-DGM1-Kacheln nach data/raw laden,
          DGM auf 2-m-Raster reduzieren (data/work). Vorhandene Dateien werden wiederverwendet.
  build   Kachelpakete, index.json und attribution.json nach apps/game/public/world erzeugen.
  check   Abdeckung der Ortsteile, Größenbudget (120 MB) und Straßen-Konnektivität prüfen.
          --determinism  zusätzlich zweimal bauen und Hashes vergleichen.
  all     fetch + build + check

Optionen:
  --help  diese Hilfe
`;

async function main(argv: string[]): Promise<number> {
  const [step, ...rest] = argv.filter((a) => a !== '--');
  if (!step || step === '--help' || step === '-h' || step === 'help') {
    console.log(HELP);
    return 0;
  }
  switch (step) {
    case 'fetch':
      await runFetch();
      return 0;
    case 'build': {
      const { runBuild } = await import('./build.ts');
      await runBuild();
      return 0;
    }
    case 'check': {
      const { runCheck } = await import('./check.ts');
      return (await runCheck({ determinism: rest.includes('--determinism') })) ? 0 : 1;
    }
    case 'all': {
      await runFetch();
      const { runBuild } = await import('./build.ts');
      await runBuild();
      const { runCheck } = await import('./check.ts');
      return (await runCheck({ determinism: false })) ? 0 : 1;
    }
    default:
      console.error(`Unbekannter Schritt: ${step}\n`);
      console.log(HELP);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  },
);
