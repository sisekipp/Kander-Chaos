# @kandern/asset-pipeline

Bringt 3D-Modelle (Fahrzeuge, Kleinobjekte, Figuren, Wahrzeichen) geprüft, optimiert und komprimiert ins Spiel.

## Befehle

```
pnpm --filter @kandern/asset-pipeline assets check   # Register und Rezepte prüfen
pnpm --filter @kandern/asset-pipeline assets build   # prüfen, optimieren, nach apps/game/public/models schreiben
```

`build` bricht ab, wenn ein Modell keinen angenommenen Registereintrag hat, die Stilprüfung nicht bestanden ist, eine Regel verletzt wird oder alle Modelle zusammen mehr als 15 MB belegen.

## Ablauf

```
assets/sources/<paket>/…     Originaldateien (nicht im Build)
assets/registry.json         Lizenzregister (Pflicht für jedes Modell)
assets/recipes/<id>.json     Rezept: Quelle, Art, Skalierung, Farbzonen, Fahrzeugmaße
        │
        ▼  build
  1. Register prüfen          Quelle, Paket, Lizenz (CC0 oder eigenes Modell), Abrufdatum, Stilprüfung, Änderungen
  2. Quelle lesen, skalieren
  3. Farbzonen anwenden       Zonen-Materialien (z. B. Lack) + ein Material für feste Farben (Vertex-Farben)
  4. Optimieren               dedup, weld, prune, Quantisierung (KHR_mesh_quantization), meshopt (EXT_meshopt_compression)
  5. Prüfen                   Dreiecke je Art, Materialanzahl, Texturen ≤ 512 px, Fahrzeuge ≥ 2 lösbare Teile (detach_*)
  6. Schreiben                apps/game/public/models/<id>.glb + manifest.json, Budget ≤ 15 MB
```

## Regeln

| Art             | Dreiecke | Materialien |
| --------------- | -------- | ----------- |
| Spielfigur, NPC | ≤ 3.000  | ≤ 4         |
| Fahrzeug        | ≤ 2.500  | ≤ 4         |
| Kleinobjekt     | ≤ 600    | ≤ 3         |
| Wahrzeichen     | ≤ 8.000  | ≤ 2         |

- **Lizenz:** nur CC0 (`CC0-1.0`) oder eigene Modelle (`own`).
- **Stil:** Fahrzeuge und Gegenstände europäisch, ohne Markenlogos; Verkehrsschilder in StVO-Form und -Farbe. Keine Nachbildung bestimmter Fahrzeugmarken oder -modelle.
- **Fahrzeuge:** Räder als eigene Knoten, lösbare Teile mit `detach_` im Knotennamen, Maße (Box, Radradius, Radknoten, Sitz) im Rezept passend zur Fahrphysik.

## Ein Modell hinzufügen

1. Paket unter `assets/sources/<paket>/` ablegen (bzw. eigenes Modell als GLB unter `assets/own/`).
2. Eintrag in `assets/registry.json`:
   ```json
   {
     "id": "bench-park",
     "kind": "prop",
     "source": "https://…/paketseite",
     "package": "Paketname",
     "license": "CC0-1.0",
     "retrieved": "2026-11-22",
     "style": { "european": true, "noLogos": true },
     "changes": "umgefärbt, Sockel entfernt",
     "status": "accepted"
   }
   ```
3. Rezept `assets/recipes/bench-park.json`:
   ```json
   { "id": "bench-park", "kind": "prop", "source": "<paket>/Models/bench.glb", "colorZones": { "wood": ["wood"] } }
   ```
4. `assets build` ausführen und die Ausgabe prüfen.

## Tests

`vp test run tools/asset-pipeline` – Register, Farbzonen, Optimierung (Rundweg lesen/schreiben) und jede Prüfregel.
