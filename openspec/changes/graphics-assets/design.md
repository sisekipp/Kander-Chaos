# Design: Modelle für Figur, Fahrzeuge, Gegenstände und Wahrzeichen

## Context

Motivation und Umfang: siehe `proposal.md`. Anforderungen: Specs `asset-pipeline`, `player-character`, `landmarks` sowie die Ergänzungen zu `vehicles`, `destructible-props` und `vehicle-damage`.

Heutiger Stand im Code:
- Fahrzeugmodelle: `vehicles/models/` (`car.ts`, `twoWheeler.ts`) aus dem Teile-Baukasten `engine/procedural/PartKit.ts`, Farbe aus `palette.ts`, lösbare Teile als Liste `detachable`.
- Props: `props/models/index.ts` (prozedural, Thin Instances je Art und Kachel).
- Spielfigur: `player/figure.ts` (Kapsel und Kugel), Bewegung in `player/Walker.ts`.
- Die Fahrphysik hängt nur an `VehicleSpec` (Abmessungen, Räder), nicht am Modell. Neue Modelle müssen nur dazu passen.

Ergebnisse der Recherche:
- **Quaternius** und **Kenney** veröffentlichen große Low-Poly-Pakete unter CC0 (kommerziell nutzbar, keine Namensnennung nötig) als glTF/GLB bzw. FBX. Die Lizenz ist pro Paket zu prüfen.
- Babylon lädt **meshopt-** und **Draco-komprimierte** glTF. Die Decoder kommen standardmäßig vom CDN und müssen für den Offline-Betrieb lokal konfiguriert werden (`MeshoptCompression.Configuration`). **gltf-transform** bietet Quantisierung (`KHR_mesh_quantization`, ohne Decoder) und meshopt.
- Viele animierte Figuren laufen auf schwacher Hardware am besten als **gebackene Vertex-Animation** (Animationstextur) mit Instanzen. glTF-Animationsgruppen müssen dafür vorher in eine Animationstextur gebacken werden.
- Skelett-Meshes lassen sich nicht einfach instanzieren. Für einzelne Figuren gibt es `AssetContainer.instantiateModelsToScene()`.

## Goals / Non-Goals

**Goals:**
- Deutlich schönere, stimmige Modelle bei gleicher Bildrate und kleinem Download.
- Klare, prüfbare Regeln für Lizenz, Stil, Größe und Leistung, damit neue Modelle später einfach dazukommen (NPCs, Basler Wahrzeichen).
- Physik und Spiellogik bleiben unverändert. Nur das Aussehen wird ausgetauscht.

**Non-Goals:**
- Kein eigenes Modellieren aller Objekte (nur Wahrzeichen und Lücken, die Pakete nicht füllen).
- Keine NPC-Logik, kein Verkehr.
- Keine realistischen PBR-Materialien. Der Look bleibt stilisiert mit Palette.

## Decisions

### D1 Quellen und Auswahl

- **Blender zuerst** (Entscheidung nach den ersten Props, auf Wunsch): Modelle entstehen vorrangig als Skripte für die Blender-Kommandozeile (`tools/asset-pipeline/blender/*.py`). Das gilt für Props, Zweiräder, Wahrzeichen und auch für Spielfigur und NPCs (Skelett und Animationen per Skript). So passen alle Modelle zum selben Stil, und lösbare Teile, Lackzonen und Knotennamen sind von Anfang an eingeplant. Fotos aus dem Internet dienen nur als Vorlage (Proportionen, Fenster, Dachform) und werden nicht ins Projekt übernommen.
- **Pakete** nur, wo sie sichtbar besser sind (Lizenz und Inhalt werden vor der Übernahme geprüft und ins Register eingetragen):
  - Kenney Car Kit (CC0): nach dem Vergleich ersetzt durch neun eigene Autotypen aus `blender/cars.py` (Kleinstwagen, Kleinwagen, Kompaktwagen, Kombi, Limousine, SUV, Familienvan, Kastenwagen, Pickup); Zweiräder aus `blender/vehicles.py`
  - Quaternius wird nicht mehr benötigt
- **Stilprüfung** (Spec `asset-pipeline`): europäische Fahrzeugformen, keine Logos, StVO-Schilder. Was kein Paket passend liefert (z. B. Kleintransporter im europäischen Stil, StVO-Schilder, deutsche Straßenlaterne), wird **selbst gebaut**: einfache Low-Poly-Modelle in Blender (über die vorhandene Blender-Anbindung) oder weiter mit dem Teile-Baukasten. Dieselben Pipeline-Regeln gelten auch dann.
- Keine Nachbildung bestimmter Fahrzeugmarken oder -modelle. Die Fahrzeuge sind generische Typen (Kleinwagen, Kombi …).

### D2 Asset-Pipeline als eigenes Werkzeug

```
assets/
  sources/<paket>/...          Originaldateien (nicht im Build)
  registry.json                Lizenzregister: id, quelle, paket, lizenz, abruf, stilprüfung, änderungen
  recipes/<id>.json            Was aus der Quelle wird: Teilauswahl, Skalierung, Farbzonen,
                               lösbare Teile, Achsen-/Radpositionen (Fahrzeuge)
tools/asset-pipeline/src/
  registry.ts (+ test)         Register lesen/prüfen
  optimize.ts                  gltf-transform: dedup, weld, quantize, meshopt, Texturen ≤ 512 px
  recolor.ts (+ test)          Farbzonen -> Vertex-Farben bzw. Paletten-Index
  validate.ts (+ test)         Dreieckszahl, Materialanzahl, lösbare Teile, Logos-Prüfliste, Budget 15 MB
  bakeVat.ts                   Animationen der NPC-Figuren in Animationstextur backen
  cli.ts                       build / check
apps/game/public/models/       Ergebnis (.glb + vat-Texturen + manifest.json)
```

Der Spiel-Build (Budget-Plugin aus Phase 0) zählt `models/` mit. Das Asset-Manifest (`manifest.json`: id, Datei, Art, Farbzonen, Teile, Dreiecke) wird mit dem App-Shell-Precache offline geladen.

### D3 Laden im Spiel: Modell-Registry

`apps/game/src/assets/`:
- `meshopt.ts`: lokaler Decoder (aus dem `meshoptimizer`-Paket, als Vite-Asset gebündelt), gesetzt vor dem ersten Laden.
- `ModelRegistry.ts`: lädt beim Start alle Modelle aus dem Manifest einmal als `AssetContainer` (parallel, mit Fortschritt im Ladebildschirm) und gibt Vorlagen heraus.
  - Statische Modelle (Props, Fahrzeugkarosserien) werden für Thin Instances in eine eigene `VertexData` extrahiert. Das ist die bekannte Lehre: eigene Geometrie je Instanz-Mesh, kein Elternknoten.
  - Animierte Figuren laufen über `instantiateModelsToScene()`.
- `palette.ts`: wendet Farbzonen an (Vertex-Farben bzw. Paletten-Textur-Offset), deterministisch aus IDs.

### D4 Fahrzeuge: Modell austauschen, Physik behalten

- Jedes Fahrzeugmodell hat ein Rezept mit Zuordnung zur `VehicleKind` und **passenden `VehicleSpec`-Abmessungen** (Box, Radpositionen). Mehrere Automodelle teilen die Art `Car`, bekommen aber eigene Box- und Radmaße (z. B. Kleintransporter höher und länger).
- Räder sind eigene Knoten (Drehen, Lenken). Lösbare Teile sind mit `detach_*` im Knotennamen gekennzeichnet (Spec `vehicle-damage`), die Pipeline lehnt Modelle mit weniger als 2 solchen Teilen ab.
- `vehicles/models/` wird zum Adapter: `buildVehicleModel(scene, kind, id)` wählt deterministisch ein Modell zur Art und liefert weiterhin `VehicleModel` (root, body, wheels, steerNode, detachable, material). Schadens- und Fahrcode bleiben unverändert.

### D5 Spielfigur mit Animationszustand

- `player/figure.ts` lädt das Figurmodell (≤ 3.000 Dreiecke, in Blender gebaut: Low-Poly-Kind mit Skelett, Animationen als Aktionen im GLB) mit einer Variante aus dem Spielstand.
- `player/animation/` (neu):
  - `animState.ts` (+ test): reine Zustandsmaschine (idle, walk, run, jump, fall, enter, exit, sitBike), Eingaben sind Geschwindigkeit, Bodenkontakt und Modus
  - `blend.ts` (+ test): Überblendgewichte über 0,3 s
  - `FigureAnimator.ts`: Babylon-Adapter auf `AnimationGroup`s mit `weight` und `speedRatio` (Gehanimation passend zur Geschwindigkeit)
- Auf Zweirädern wird die Figur an einen Sitzknoten des Fahrzeugmodells gehängt und neigt sich mit. Im Auto bleibt sie ausgeblendet.
- Die Figurvariante kommt ins Spielstand-Schema (`schemaVersion` 2 mit Migration, Standardvariante 0).

### D6 NPC-Figuren vorbereiten (gebackene Vertex-Animation)

- 8+ Figuren aus demselben Skelett- bzw. Animationssatz. `bakeVat.ts` backt die Animationen (stehen, gehen, rennen, umfallen, aufstehen, winken) in eine Animationstextur je Figur. Im Spiel nutzt Babylons `BakedVertexAnimationManager` diese Textur mit Thin Instances, sodass viele Figuren nur wenige Draw Calls kosten.
- In diesem Change gibt es nur eine **Testansicht** (alle Figuren nebeneinander, gehend). Bewegung, KI und Umfallen/Aufstehen folgen im NPC-Change.

### D7 Wahrzeichen

- **Auswahl** (Welt-Pipeline, `landmarks/select.ts`): besondere Gebäude in allen Ortsteilen und Nachbargemeinden automatisch nach OSM-Art (Kirche, Kapelle, Rathaus, Schule, Kita, Bahnhof, Supermarkt, Feuerwehr, Museum, Schloss, Halle, öffentlicher Bau, Gasthaus). `assets/landmarks/config.json` vergibt Namen, Stil und Handarbeit je OSM-ID und ergänzt Wahrzeichen ohne OSM-Gebäude (Ruine Sausenburg, Koordinaten aus der Recherche).
- **Ausgabe**: `world/landmarks.json` (Spiel) und `assets/landmarks/footprints.json` (Blender) mit Mitte, Längsachse, Grundriss im Modellsystem, Höhen und Art. Das Kachelformat bleibt unverändert (kein Flag-Bit): Der Worker bekommt die Gebäude-IDs der Wahrzeichen und lässt sie nur in Ring 0 aus; in Ring 1/2 bleibt der einfache Block.
- **Modelle** (`blender/landmarks.py`, `landmark_styles.py`, `lmkit.py`): je Gebäude aus dem echten Grundriss nach Bauvorlage der Art; Kanderner Wahrzeichen (Stadtkirche, St. Franz von Sales, Altes Rathaus, Bahnhof, Heimat- und Keramikmuseum, Forsthaus, Sausenburg) als Handarbeit nach Fotos (Wikimedia Commons) und der Kulturdenkmal-Liste. Supermärkte ohne Logos und Schriftzüge. ≤ 8.000 Dreiecke, ein Material (Vertex-Farben). Das Skript schreibt `assets/recipes/landmarks.json` und die Registereinträge.
- **Spiel**: `world/landmarks/LandmarkLayer.ts` (TileLayer, Ring 0) setzt das Modell auf Grundrissmitte, Längsachse und tiefste Geländehöhe (Sockel reicht 2 m in den Boden); Kollision als statisches Mesh in Weltlage. `placement.ts` enthält die Rechnung (Drehung, Weltlage, Bodenhöhe).

### D8 Reihenfolge zu `graphics-world`

`graphics-assets` setzt auf den Licht- und Nebel-Bausteinen aus `graphics-world` auf (D6 dort). Deshalb wird `graphics-world` zuerst umgesetzt. Modell-Pipeline und Registry (D2, D3) können parallel entstehen, weil sie keine Welt-Shader brauchen.

### D9a Weitere Kleinobjekte (Erweiterung)

- **Neue Arten** in `PropKind` (Kachelformat, gleiche u8-Kodierung): Briefkasten, Hydrant, Poller, Fahrradbügel, Litfaßsäule, Blumenkübel. Ältere Spielstände sind nicht betroffen (Props werden nicht gespeichert).
- **Formen:** Die Zuordnung Art + Variante → sichtbare Form (`PropShape`) liegt in `@kandern/world-format`, damit Pipeline (Prüfung) und Spiel (Instanzpuffer) dieselbe Tabelle nutzen. Schilder: Variante aus `traffic_sign` – `DE:205`/`DE:206` Dreieck bzw. Stopp als Dreiecksform, `DE:350` blaues Quadrat, `highway=bus_stop` Haltestellenschild, `highway=traffic_signals` Ampel, sonst rundes Schild.
- **Draw Calls:** eine Form = ein Draw Call je Kachel; Grenze 12. `check` zählt die Formen je Kachel und meldet Überschreitungen.
- **Verhalten:** Briefkasten fliegt weg (schwer, Schwelle 20 km/h); Hydrant, Poller und Litfaßsäule kippen (Schwellen 30/25/35 km/h, halten Fußgänger auf); Fahrradbügel und Blumenkübel zerbrechen (15/12 km/h).
- **Modelle:** selbst gebaut mit der Blender-Kommandozeile (`tools/asset-pipeline/blender/props.py`), Regeln wie bei allen Modellen (≤ 600 Dreiecke, kein Text, keine Logos).

### D9 Modulstruktur (Zusammenfassung)

```
assets/                      Quellen, Register, Rezepte, Wahrzeichen
tools/asset-pipeline/src/    registry, optimize, recolor, validate, bakeVat, cli (je + test, außer reinen Adaptern)
apps/game/src/assets/        meshopt.ts, ModelRegistry.ts, palette.ts (+ test)
apps/game/src/vehicles/models/   Adapter auf Registry (bisherige prozedurale Modelle als Rückfall entfernt)
apps/game/src/props/models/      Adapter auf Registry
apps/game/src/player/figure.ts, player/animation/   Figur + Animationszustand
apps/game/src/world/landmarks/   LandmarkLayer.ts, placement.ts (+ test)
apps/game/src/npc/preview/       Testansicht der NPC-Figuren (VAT)
```

## Risks / Trade-offs

- **[CC0-Pakete passen stilistisch nicht zu Europa]** → Stilprüfung im Register. Fehlende Typen werden selbst gebaut, und die Palette wird vereinheitlicht.
- **[Lizenz einzelner Pakete abweichend]** → Register-Pflicht mit URL und Lizenz je Modell, Build bricht ohne Eintrag ab.
- **[Mehr Dreiecke als die Klötzchen]** → Grenzwerte je Art (Figur 3.000, Auto ≤ 2.500, Prop ≤ 600, Wahrzeichen ≤ 8.000), Prüfung in `validate.ts`, Fahrzeuge bleiben statisch, solange sie nicht bewegt werden.
- **[Skelettanimation kostet CPU auf dem A9X]** → nur die Spielfigur mit Echtzeit-Skelett, NPCs über Animationstexturen.
- **[Ladezeit durch viele Modelle]** → alle Modelle in wenigen GLB-Dateien gebündelt, meshopt-Decoder schnell, paralleles Laden im Ladebildschirm.
- **[Wahrzeichen-Ähnlichkeit]** → Sichtprüfung mit dir bzw. Ortskundigen vor der Abnahme.

## Migration Plan

1. Asset-Pipeline und Register aufbauen, erste Pakete prüfen und übernehmen.
2. Registry im Spiel. Props, Fahrzeuge und Figur nacheinander umstellen, jeweils mit E2E-Tests.
3. NPC-Testansicht, Wahrzeichen.
4. Spielstand-Migration (Figurvariante), Deployment. Ältere Spielstände werden automatisch auf Version 2 gehoben.

## Open Questions

- Welche konkreten Pakete am Ende genommen werden, entscheidet die Lizenz- und Stilprüfung zu Beginn der Umsetzung. Specs und Aufgaben bleiben davon unberührt.
