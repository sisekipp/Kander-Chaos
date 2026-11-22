#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { paths } from './paths.ts';
import { checkModels, validateRegistry, type Registry } from './registry.ts';
import { buildModels } from './build.ts';

const USAGE = `asset-pipeline <befehl>
  check   Register und Rezepte prüfen (Lizenz, Stil, Pflichtfelder)
  build   prüfen, Modelle optimieren und nach apps/game/public/models schreiben`;

async function loadRegistry(): Promise<Registry> {
  return JSON.parse(await readFile(paths.registry, 'utf8')) as Registry;
}

/** Modell-IDs aller Rezepte (Dateiname ohne .json). */
async function recipeIds(): Promise<string[]> {
  if (!existsSync(paths.recipes)) return [];
  return (await readdir(paths.recipes)).filter((f) => f.endsWith('.json')).map((f) => path.basename(f, '.json'));
}

async function check(): Promise<boolean> {
  const reg = await loadRegistry();
  const errors = [...validateRegistry(reg), ...checkModels(await recipeIds(), reg)];
  for (const e of errors) console.log(`  ✘ ${e}`);
  if (!errors.length) console.log(`  ✔ Register (${reg.entries.length} Einträge) und Rezepte in Ordnung`);
  return errors.length === 0;
}

const cmd = process.argv[2];
if (cmd === 'check' || cmd === 'build') {
  const ok = await check();
  if (!ok) {
    console.log('[asset-pipeline] FEHLER – Build abgebrochen');
    process.exit(1);
  }
  if (cmd === 'build') {
    const r = await buildModels();
    for (const m of r.messages) console.log(`  ${m}`);
    if (!r.ok) {
      console.log('[asset-pipeline] FEHLER – Build abgebrochen');
      process.exit(1);
    }
    console.log('[asset-pipeline] Modelle und manifest.json geschrieben');
  }
} else {
  console.log(USAGE);
  process.exit(cmd ? 1 : 0);
}
