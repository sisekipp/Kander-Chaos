import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface PwaPluginOptions {
  /** Budget aller lokal gespeicherten Dateien (App-Shell + Weltpakete) in Bytes. */
  budgetBytes: number;
}

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

/**
 * Erzeugt nach dem Build `sw.js` mit der Precache-Liste der App-Shell und prüft das Speicher-Budget
 * (Spec offline-delivery: ≤ 300 MB). Weltpakete werden nicht vom Service Worker vorgeladen, sondern
 * vom Welt-Downloader – zählen aber zum Budget.
 */
export function pwaPlugin(opts: PwaPluginOptions): Plugin {
  let outDir = 'dist';
  return {
    name: 'kandern-pwa',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const files = walk(outDir).filter(
        (f) =>
          f !== 'sw.js' &&
          !f.startsWith('world/') &&
          // Nachladeregionen: nur bei Bedarf geladen, eigener Speicher (Region-Cache, 400 MB)
          !f.startsWith('world-remote/') &&
          f !== '_headers' &&
          !f.endsWith('.map'),
      );
      const shell = files.sort();
      const worldFiles = walk(outDir).filter((f) => f.startsWith('world/'));
      const size = (f: string) => statSync(path.join(outDir, f)).size;
      const groups: Record<string, number> = {};
      const add = (g: string, f: string) => {
        groups[g] = (groups[g] ?? 0) + size(f);
      };
      for (const f of shell)
        add(
          f.endsWith('.wasm')
            ? 'WASM'
            : f.startsWith('models/')
              ? '3D-Modelle'
              : f.startsWith('assets/')
                ? 'App-Bundles'
                : 'Sonstiges (HTML, Icons, Manifest)',
          f,
        );
      for (const f of worldFiles) add(f.endsWith('.bin') ? 'Weltpakete' : 'Welt-Metadaten', f);
      const total = Object.values(groups).reduce((a, b) => a + b, 0);
      const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
      const table = Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .map(([g, b]) => `  ${g.padEnd(36)} ${mb(b)}`)
        .join('\n');
      if (total > opts.budgetBytes) {
        throw new Error(`[pwa] Speicher-Budget überschritten: ${mb(total)} > ${mb(opts.budgetBytes)}\n${table}`);
      }
      const hash = createHash('sha256');
      for (const f of shell) hash.update(f).update(readFileSync(path.join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const tpl = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
      writeFileSync(
        path.join(outDir, 'sw.js'),
        tpl.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(shell)),
      );
      console.log(
        `[pwa] sw.js Version ${version}, ${shell.length} Shell-Dateien; Gesamt ${mb(total)} / ${mb(opts.budgetBytes)}\n${table}`,
      );
    },
  };
}
