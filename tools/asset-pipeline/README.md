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

## Modelle aus Blender

Alle Modelle im Spiel sind eigene Modelle aus der Blender-Kommandozeile (Fremdmodelle nur als CC0 und nur nach Stilprüfung). Bilder aus dem Internet dienen nur als Vorlage, sie werden nicht ins Spiel übernommen. Die Skripte sind deterministisch und schreiben GLB-Dateien, die eingecheckt werden. Deshalb braucht `assets build` auf einem frischen Checkout **kein** Blender.

```
B=/Applications/Blender.app/Contents/MacOS/Blender      # bzw. `blender` im PATH
$B -b --python-exit-code 1 -P tools/asset-pipeline/blender/props.py      -- assets/own        # Kleinobjekte
$B -b --python-exit-code 1 -P tools/asset-pipeline/blender/vehicles.py   -- assets/own        # Fahrräder, Roller, Motorrad
$B -b --python-exit-code 1 -P tools/asset-pipeline/blender/cars.py       -- assets/own        # 9 Autotypen
$B -b --python-exit-code 1 -P tools/asset-pipeline/blender/helicopter.py -- assets/own        # Hubschrauber
$B -b --python-exit-code 1 -P tools/asset-pipeline/blender/landmarks.py  -- assets/landmarks  # Wahrzeichen
$B -b --python-exit-code 1 -P tools/asset-pipeline/blender/figure.py     -- assets/own        # Spielfigur (Skelett, 8 Animationen)
$B -b --python-exit-code 1 -P tools/asset-pipeline/blender/npcs.py       -- assets/own        # 8 NPC-Figuren
```

| Skript                                 | Inhalt                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `kit.py`                               | gemeinsame Bausteine: Farben, Grundkörper, Räder, Export (Gruppen → benannte Knoten)            |
| `props.py`                             | Kleinobjekte (Fußpunkt im Ursprung, Maße wie `PROP_EXTENTS` im Spiel)                           |
| `vehicles.py`                          | Zweiräder mit Knoten `body`, `steer`, `wheel-front/back`, `detach_*`                            |
| `carkit.py`, `cars.py`                 | Autos aus Seitenprofilen, Radläufe, Türen, Spiegel; Lackzone `paint`                            |
| `lmkit.py`, `landmark_styles.py`       | Wahrzeichen aus dem echten Grundriss nach Bauvorlage der Art (Kirche, Schule, Supermarkt …)     |
| `landmarks.py`                         | liest `assets/landmarks/footprints.json`, baut Handarbeit nach Fotos, schreibt Rezepte/Register |
| `region_styles.py`, `region_detail.py` | Wahrzeichen der Region (Nachladeregionen, `remote` im Rezept)                                   |

Figuren: `figkit.py` (Körper aus Grundformen, starr an 11 Knochen gebunden) und `figanim.py` (gemeinsamer Animationssatz als Posen in Grad, 30 fps) teilen sich Spielfigur (`figure.py`, Farbzonen `shirt`/`pants`/`hair` für die Varianten) und NPCs (`npcs.py`, feste Farben). Für Modelle der Art `npc` verbindet der Build alle Teile zu einem Primitiv und backt die Animationen nach der Optimierung in eine Animationstextur `<id>.vat.bin` (RGBA16F im Layout von Babylons `BakedVertexAnimationManager`, `src/bakeVat.ts`). Danach entfernt er die Animationen aus dem GLB.

Achsen: Blender ist z-oben, der glTF-Export dreht nach y-oben, die Vorderseite zeigt nach −y. Babylon sieht ein Blender-Modell als (−bx, bz, −by). Vertex-Farben kommen als RGBA. Das Spiel setzt deshalb `hasVertexAlpha = false`, sonst landen die Meshes im Transparenz-Durchgang.

Wahrzeichen hängen an der Welt-Pipeline: Erst schreibt `world build` die Datei `assets/landmarks/footprints.json`, danach baut `landmarks.py` die Modelle neu.

## Frischer Checkout

```
pnpm install
pnpm --filter @kandern/asset-pipeline assets build   # erzeugt apps/game/public/models (+ models-remote)
pnpm exec vp fmt apps/game/public/models/manifest.json       # Manifest wie eingecheckt formatieren
git status apps/game/public/models                   # keine Änderung: Ausgabe ist reproduzierbar
```

Geprüft am 2026-11-23 mit einem frischen Klon: Alle GLB-Dateien sind byte-gleich, das Manifest ist inhaltlich gleich (2,00 MB, Build in etwa 2 s).

## Ein Modell hinzufügen

1. Eigenes Modell als Blender-Skript unter `tools/asset-pipeline/blender/` schreiben und nach `assets/own/<id>.glb` exportieren (bzw. ein CC0-Paket unter `assets/sources/<paket>/` ablegen).
2. Eintrag in `assets/registry.json`:
   ```json
   {
     "id": "bench-park",
     "kind": "prop",
     "source": "eigenes Modell: tools/asset-pipeline/blender/props.py (Blender-Kommandozeile)",
     "package": "Kandern Chaos – eigene Modelle",
     "license": "own",
     "retrieved": "2026-11-22",
     "style": { "european": true, "noLogos": true, "notes": "Parkbank mit Betonfüßen" },
     "changes": "Grundfarben in Vertex-Farben eingebacken",
     "status": "accepted"
   }
   ```
3. Rezept `assets/recipes/bench-park.json` (mehrere Rezepte dürfen als Liste in einer Datei stehen, z. B. `landmarks.json`):
   ```json
   { "id": "bench-park", "kind": "prop", "source": "own/bench-park.glb" }
   ```
   Lackzonen: `"colorZones": { "paint": ["paint"] }` – das Material `paint` wird zur Zone `zone_paint`, die das Spiel je Instanz einfärbt.
4. `assets build` ausführen, Ausgabe prüfen und `pnpm exec vp fmt apps/game/public/models/manifest.json`.

## Tests

`vp test run tools/asset-pipeline` – Register, Farbzonen, Optimierung (Rundweg lesen/schreiben) und jede Prüfregel.
