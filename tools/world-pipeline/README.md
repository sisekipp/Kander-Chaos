# @kandern/world-pipeline

Wandelt echte Geodaten der Gemeinde Kandern in die Kachelpakete des Spiels um. Das Format ist in `packages/world-format/README.md` beschrieben.

## Schnellstart

```bash
pnpm install
pnpm run pipeline -- fetch    # Rohdaten laden (einmalig, ca. 600 MB DGM + OSM)
pnpm run pipeline -- build    # Kacheln nach apps/game/public/world erzeugen
pnpm run pipeline -- check    # Prüfungen (Abdeckung, Budget, Straßennetz)
pnpm run pipeline -- check --determinism   # zusätzlich zwei Läufe vergleichen
```

`pnpm run pipeline -- --help` listet alle Schritte auf.

Voraussetzungen: Node ≥ 22.18, pnpm, `unzip` im PATH (macOS/Linux haben es standardmäßig).

## Ablauf

```
fetch
  1. Gemeindegrenze      Overpass: relation 1130283 (Kandern)            -> data/raw/osm-boundary.json
  2. DGM1-Kacheln        LGL Open GeoData, 2-km-ZIPs mit 1-m-XYZ        -> data/raw/dgm/*.zip
  3. 2-m-Raster          Mittel der vier 1-m-Punkte je geradem Punkt    -> data/work/dgm-2m.bin
  4. OSM-Daten           Overpass in ca. 2x2-km-Teilstücken             -> data/raw/osm-chunks/*.json
                         zusammengeführt, dedupliziert, sortiert         -> data/raw/osm-data.json
build
  5. Kachelauswahl       alle 250-m-Kacheln, die Gemeinde + 500 m berühren
  6. Gelände             LOD 126/33/9 Samples je Seite, globale Quantisierung
  7. Gebäude             Grundriss + Ergänzungsregeln, Zuordnung per Schwerpunkt
  8. Straßen             an Kreuzungen geteilt, an Kacheln geschnitten, Schnitt-Knoten-IDs
  9. Landnutzung/Wasser  an Kacheln zugeschnitten
 10. Ausgabe             region_<rx>_<rz>.<hash>.bin, index.json, attribution.json, places.json
check
 11. Hashes, Budget 120 MB, Ortsteil-Abdeckung, Konnektivität Kandern -> Tannenkirch
```

Alle Schritte sind **fortsetzbar**: Vorhandene Dateien in `data/raw` und `data/work` werden wiederverwendet. Um neu zu laden, die betreffende Datei löschen (für frische OSM-Daten etwa `data/raw/osm-data.json` und `data/raw/osm-chunks/`).

## Quellen

| Quelle                       | Inhalt                                                | Lizenz                                                                         | Abruf                                                                                           |
| ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| OpenStreetMap (Overpass API) | Grenze, Gebäude, Straßen, Landnutzung, Gewässer, Orte | ODbL 1.0, „© OpenStreetMap-Mitwirkende“                                        | `https://overpass-api.de/api/interpreter`                                                       |
| LGL Baden-Württemberg, DGM1  | Höhen 1-m-Raster (ETRS89/UTM32, DHHN2016)             | Datenlizenz Deutschland – Namensnennung 2.0, „Datenquelle: LGL, www.lgl-bw.de“ | `https://opengeodata.lgl-bw.de/data/dgm/dgm1_32_<E>_<N>_2_bw.zip` (E ungerade, N gerade, in km) |

`attribution.json` wird bei jedem Build erzeugt und vom Spiel auf der Seite „Über das Spiel“ angezeigt.

## Ergänzungsregeln für Gebäude

Die meisten OSM-Gebäude in Kandern haben nur Grundriss und `building=yes|house`. Fehlende Werte werden nach festen Regeln ergänzt (`src/buildings.ts`). Zufällige Anteile stammen immer aus der stabilen Gebäude-ID, sodass gleiche Eingaben gleiche Ausgaben ergeben:

- **Typ** aus `building=*`. `building=yes` wird bei ≥ 35 m² zum Wohnhaus, darunter zum Schuppen.
- **Fachwerk**, wenn `building:material=timber_framing` gesetzt ist. Sonst werden Wohnhäuser in einem Ortskern (Radius: Stadt 320 m, Dorf 170 m, Weiler 80 m um den OSM-Ortspunkt) mit einer Wahrscheinlichkeit von bis zu 55 % zu Fachwerk.
- **Stockwerke**: `building:levels`, sonst nach Typ und Grundfläche.
- **Dach**: `roof:shape`, sonst nach Typ. 25 % der Wohnhäuser bekommen ein Walmdach, Grundflächen über 1500 m² ein Flachdach.
- **Dachhöhe**: `roof:height`, sonst halbe Gebäudetiefe × tan(Dachneigung des Typs), höchstens 9 m.
- **Wandhöhe**: `height` − Dachhöhe, sonst Stockwerke × 2,9 m + 0,4 m. Kirchen sind mindestens 12 m hoch.

Geschätzte Gebäude tragen in den Kacheldaten `estimated = 1`. So lassen sich OSM-Lücken später gezielt nachpflegen.

## Kleinobjekte und Parkpositionen

Quelle ist ein zweiter, fortsetzbarer Overpass-Abruf (`data/raw/osm-props-chunks/` → `osm-props.json`, 4-km-Teilstücke) mit Laternen, Ampeln, Haltestellen, Mülleimern, Bänken, Schildern, Zäunen, Hecken, Mauern, Parkplätzen und Spielplätzen. Danach werden je Kachel (`src/props/`) nacheinander gesetzt:

1. **Echte OSM-Objekte** an ihrer Position, sofern sie nicht auf einer Fahrbahn oder in einem Gebäude liegen. Zäune und Mauern werden in 2,5-m-Felder zerlegt, Hecken in Büsche alle 1,8 m.
2. **Ergänzung nach Regeln** (`fill.ts`, Zufall aus Weg- bzw. Gebäude-ID):
   - Laternen alle ~30 m entlang von Wohn-, Neben- und Ortsstraßen im bebauten Umfeld, wechselseitig, Breite/2 + 1,6 m vom Straßenmittelpunkt.
   - Zaunfelder in Läufen von 3–8 Feldern am Rand von Wohnstraßen (Breite/2 + 2 m).
   - 1–3 Büsche je Wohn-, Fachwerk- oder Hofgebäude, 2–5 m vor einer Wand.
   - Bank und Mülleimer an Bushaltestellen, Spielplätzen und Parks.
3. **Parkpositionen** (`parking.ts`): am Rand von Wohn- und Nebenstraßen alle 6–10 m mit 25 % Wahrscheinlichkeit, mindestens 15 m von echten Kreuzungen und 6 m voneinander entfernt. In Parkplatzflächen als Raster 2,8 × 5,5 m (höchstens 30 je Fläche). Etwa 10 % sind Zweiräder.

Konflikte prüft ein 0,5-m-Raster (`conflicts.ts`) gegen Fahrbahnen, Wege und Gebäude der Kachel **und ihrer Nachbarn**. Gesetzte Objekte belegen ihren Platz. `check` verlangt mindestens 10 Parkpositionen und 3 Prop-Arten im Umkreis von 300 m um den Blumenplatz.

## Determinismus

- Quelldaten werden zwischengespeichert, OSM-Elemente nach Typ und ID sortiert.
- Kacheln, Gebäude, Straßen und Flächen werden stabil sortiert.
- gzip wird mit `mtime = 0` geschrieben, und die Ausgabe enthält keine Zeitstempel außer dem OSM-Datenstand.
- `check --determinism` baut zweimal in temporäre Ordner und vergleicht alle Dateien per SHA-256.

## Tests

```bash
pnpm exec vp test run tools
```
