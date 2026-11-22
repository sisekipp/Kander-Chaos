# Kandern Chaos

Kindgerechtes Open-World-Spiel in der echten Gemeinde Kandern: Babylon.js, React, Vite+, offline als PWA, ausgeliefert über Cloudflare.

## Struktur

| Ordner | Inhalt |
|---|---|
| `apps/game` | Spiel: React-UI, Babylon.js-Engine, Web Worker, Service Worker, E2E-Tests |
| `packages/world-format` | Kachelformat (gemeinsam für Pipeline und Spiel) |
| `tools/world-pipeline` | OSM + LGL-DGM → Kachelpakete |
| `docs/perf` | Messanleitung und -protokolle für das iPad Pro 1. Gen |
| `openspec/` | Planung (Changes, Specs) |

## Befehle

```bash
pnpm install
pnpm run pipeline -- fetch      # Geodaten laden (einmalig)
pnpm run pipeline -- build      # Welt bauen -> apps/game/public/world
pnpm run pipeline -- check      # Prüfungen
pnpm run dev                    # Entwicklungsserver
pnpm exec vp test run           # Unit-Tests
pnpm --filter @kandern/game exec playwright test   # E2E (WebKit, Produktions-Build)
pnpm --filter @kandern/game run deploy             # Build + Cloudflare (wrangler login nötig)
```

Kartendaten: © OpenStreetMap-Mitwirkende (ODbL) · Höhendaten: LGL Baden-Württemberg (Datenlizenz Deutschland – Namensnennung 2.0).
