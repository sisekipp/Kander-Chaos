# Design: Grafik der Welt

## Context

Motivation und Umfang: siehe `proposal.md`. Anforderungen: Specs `road-rendering`, `world-visuals` sowie die Änderungen an `world-streaming` und `world-data-pipeline`.

Heutiger Stand im Code:
- Straßen und Gewässer werden in `world/gen/roadGen.ts` als einfache Bänder mit Vertex-Farbe erzeugt (ein `StandardMaterial`, `zOffset`).
- Gelände: `world/gen/terrainGen.ts`, Vertex-Farben je Landnutzung plus Rauschen.
- Gebäude: `world/gen/buildingGen.ts` und der prozedurale Fassaden-Shader in `world/materials.ts`.
- Bäume: `world/vegetation/` (3 Formen, Thin Instances).
- Licht: eine Hemisphären- und eine Richtungslichtquelle in `engine/Game.ts`, linearer Nebel.

Ergebnisse der Recherche, die das Design prägen:
- Auf dem A9X begrenzt die **Fill-Rate**: Auflösung, Overdraw, Alpha-Blending und teure Post-Effekte zählen mehr als Polygonzahlen. Empfohlen werden eingefrorene Materialien, `autoClear` aus, kein SSAO und eingebackene Verschattung (Babylon-Doku „Optimizing your scene“, Best-Practice-Thread im Babylon-Forum 2025).
- Stilisierte Mobile-Spiele erzielen ihren Look mit **Vertex-Farben, Licht-Verlauf und Nebel** statt mit Texturen (Vector Unit/MouseBot, Unity-Fallstudien).
- **Kreuzungen** lassen sich am robustesten wie bei A/B Street/osm2streets bilden: Straßenkanten versetzen, Arme nach Winkel sortieren, benachbarte Kanten schneiden, Straßen auf den Polygonrand kürzen.
- Tone-Mapping: Babylon bietet `TONEMAPPING_ACES` und „Khronos Neutral“. ACES lässt Weiß grau wirken, deshalb fällt die Wahl auf Neutral oder eine eigene, im Shader eingebaute Kurve.
- Safari: `engine.disableUniformBuffers` kann CPU-Zeit sparen. Das ist im Forum belegt, auf dem Gerät aber noch nicht geprüft.

## Goals / Non-Goals

**Goals:**
- Deutlich schöneres Bild bei gleicher Bildrate. Neue Effekte sind möglichst „kostenlos“: im Shader oder in Vertex-Daten statt zusätzlicher Draw Calls, Texturen oder Render-Pässe.
- Straßen tragen die Lesbarkeit der Welt: Typ, Richtung und Ort erkennt man auf einen Blick.
- Die Darstellungsdaten stehen in der Pipeline bereit, damit die Welterweiterung (Basel, Autobahnen, Rhein) sie nur noch nutzt.

**Non-Goals:**
- Keine Echtzeitschatten in „Niedrig“, kein SSAO, keine Spiegelungen, kein Bloom.
- Keine handmodellierten Wahrzeichen (folgt in `graphics-assets` bzw. bei der Welterweiterung).
- Keine neuen Modelle für Figur, Fahrzeuge oder Gegenstände.

## Decisions

### D1 Ein Straßen-Shader mit Straßenkoordinaten

Alle Straßenteile einer Kachel (Fahrbahn, Gehweg, Bordstein, Kreuzungen, Brückenfahrbahn) landen in **einem Mesh mit einem Material**. Jeder Vertex trägt:
- `uv.x` = Querposition in Metern von der Straßenmitte (−b/2 … +b/2)
- `uv.y` = Längsposition in Metern entlang der Straße
- `uv2.x` = Belag-/Typ-Code (Asphalt Haupt, Asphalt Wohn, Feldweg, Fußweg, Radweg, Bordstein, Gehweg-Pflaster, Kreuzung, Zebrastreifen)
- `uv2.y` = Markierungsprofil (keine, Mittellinie gestrichelt, Mittellinie + Ränder, Autobahn-Fahrstreifen)

Der Fragment-Shader zeichnet daraus Markierungen (`fract(uv.y / 9)` für Striche, `abs(uv.x)` für Randlinien), Feldweg-Grasstreifen, Pflasterfugen und Zebrastreifen. Antialiasing der Linien läuft über `fwidth()`, damit sie nah nicht flimmern und fern weich werden. Nebel und Licht kommen aus einem gemeinsamen Shader-Baustein (D6).

*Alternativen:*
- Texturen mit Markierungen: Speicher, Kacheln sichtbar, Mipmap-Probleme.
- Decals: zusätzliche Draw Calls und Overdraw.

### D2 Straßenquerschnitt nach Typ

Ein reines Modul `roads/profile.ts` liefert je Straßenart und Attributen den Querschnitt: Fahrbahnbreite, Fahrstreifen, Mittelstreifenbreite, Gehweg links/rechts (2 m), Bordsteinhöhe (0,12 m), Leitplanken. Der Generator extrudiert diesen Querschnitt entlang der Mittellinie. Bordsteine sind kleine senkrechte Streifen und damit zusätzliche Geometrie im selben Mesh.

Leitplanken und Brückengeländer sind niedrige Streifen-Geometrie im selben Mesh mit eigenem Typ-Code. Auch sie kosten keinen zusätzlichen Draw Call.

### D3 Kreuzungen in der Pipeline

In `tools/world-pipeline/src/roads/junctions.ts` nach dem Verfahren von A/B Street:
1. Für jeden Knoten mit ≥ 3 Armen die Arme nach Winkel sortieren.
2. Linke und rechte Kante jedes Arms um die halbe Breite (inkl. Gehweg) versetzen und benachbarte Kanten schneiden. Das ergibt die Eckpunkte.
3. Jeden Arm bis zur Polygonkante kürzen (Abstand in der Straße speichern: `trimStart`, `trimEnd`).
4. Das Kreuzungspolygon als Ring speichern (Kachel des Knotens).

Sonderfälle (fast parallele Arme, sehr kurze Arme): Rückfall auf ein Kreisscheiben-Polygon mit dem Radius der breitesten Straße. Getestet wird mit Fixtures (T, X, Y, spitzer Winkel, Kreisverkehr-Näherung).

Im Spiel werden Kreuzungspolygone per `earcut` trianguliert und mit Typ „Kreuzung“ (Asphalt ohne Markierung) ins Straßen-Mesh gelegt.

### D4 Brücken und Tunnel

- **Pipeline** (`roads/bridges.ts`): Zusammenhängende Brückenstücke (bridge=yes, auch über mehrere Wege und Kacheln) werden zu Brückenzügen verkettet. Die Fahrbahnhöhe ergibt sich aus der Geländehöhe an den beiden Enden, linear entlang der Länge interpoliert, mindestens 0,5 m über dem Gelände. Ausgegeben wird je Straße `deckStart`/`deckEnd` (Höhe am Anfang/Ende des Teilstücks), sodass Kachelstücke nahtlos passen.
- **Spiel:** Brückenfahrbahn mit Geländer (Typ-Code). Pfeiler (Quader) alle 15 m, wo die Fahrbahn > 3 m über dem Gelände liegt. Kollision: Das Straßen-Mesh einer Ring-0-Kachel bekommt für Brücken einen eigenen statischen Mesh-Shape (nur Brückensegmente, wenige Dreiecke).
- **Tunnel:** keine Fahrbahn innen. An beiden Enden steht ein Portal-Bogen aus Geometrie im Straßen-Mesh mit Typ „Beton“. Eine Durchfahrt durch das Gelände gibt es in diesem Change nicht, Tunnel sind in Kandern selten.

### D5 Darstellungsabschnitt im Kachelformat

Neuer optionaler Abschnitt 7 „Details“ (wie Abschnitt 6 hinten angehängt):
- je Straße (Index wie im Straßenabschnitt): `u8 lanes`, `u8 flags` (Einbahn, Gehweg links/rechts), `u8 surface`, `i8 layer`, `f32 trimStart`, `f32 trimEnd`, `f32 deckStart`, `f32 deckEnd` (NaN = keine Brücke)
- Kreuzungspolygone (`f32[]` Ringe)
- Zebrastreifen (Position, Querrichtung, Länge)
- Kirchtürme (Gebäude-ID, Position, Grundfläche)

Der Props-Abruf wird um `node["highway"="crossing"]` erweitert. Ein Neuabruf der Props-Teilstücke ist nötig.

### D6 Gemeinsamer Licht- und Nebel-Baustein für alle Welt-Shader

Ein kleines GLSL-Modul (`world/shaders/lighting.glsl.ts`) mit:
- Hemisphärenlicht (Himmelsfarbe oben, Bodenfarbe unten)
- Lambert-Sonne mit weichem Verlauf (Wrap-Lighting: `max(0, (dot(n,l)+w)/(1+w))`). Das wirkt stilisiert und lässt Schattenseiten nicht schwarz werden.
- Tone-Mapping im Shader (Kurve ähnlich Khronos Neutral)
- Höhen- und Distanznebel in Horizontfarbe

Gelände, Straßen, Gebäude, Bäume und Wasser nutzen diesen Baustein. Damit stimmen Licht und Farbe überall überein, und es braucht keinen Post-Process-Pass. Tone-Mapping im Shader kostet keinen zusätzlichen Vollbild-Pass, das ist der Fill-Rate-Vorteil gegenüber Babylons Image-Processing-Post-Process.

### D7 Himmel

Eine Himmelskuppel mit Vertex-Farben-Verlauf und angedeuteter Sonnenscheibe als Glow im Shader. Sie wird als Erstes gerendert, deshalb kann `scene.autoClear = false` gesetzt werden: Der Himmel deckt jedes Pixel ab. Das Panorama-Band aus Phase 0 bleibt, nimmt aber die Horizontfarbe an.

### D8 Boden-Shader

Ein eigener Shader für das Gelände statt `StandardMaterial`:
- Landnutzung als Vertex-Attribut (Typ-Code und Gewicht für weiche Übergänge, an Flächenrändern im Worker gemischt)
- Muster per Rauschfunktion im Fragment-Shader:
  - Acker: Furchen `sin((p·dir)·k)`, Richtung je Feld aus der Flächen-ID
  - Wiese: zwei Oktaven Rauschen
  - Wald: dunkle Flecken
  - Siedlung: leichte Pflasterstruktur
- Eingebackene Verschattung: Der Worker dunkelt Gelände-Vertices im Umkreis von 3 m um Gebäude und im Kronenradius unter Bäumen ab.

Kostenkontrolle: Nur eine Rauschfunktion (Wert-Rauschen, 2 Oktaven) ist erlaubt. Fernkacheln (Ring 1/2) bekommen eine `detail`-Uniform = 0 ohne Muster.

### D9 Gebäude im regionalen Stil

Der Generator in `world/gen/buildings/` wird aufgeteilt (`walls.ts`, `roofs.ts`, `details.ts`, `church.ts`):
- **Dachüberstand** 0,5 m an Traufe und Ortgang (heute 0,35 m), steilere Dächer (Wohnhaus 45°, Fachwerk 52°).
- **Haustür:** an der Wand, die der nächsten Straße am nächsten liegt (Straßen der Kachel liegen im Worker vor), als Fassadencode im Shader (dunkles Rechteck mit Rahmen).
- **Fensterläden:** Der Fassaden-Shader zeichnet bei ~50 % der Putz- und Fachwerkhäuser grüne, rote oder graue Läden neben die Fenster (Auswahl aus der Gebäude-ID im Vertex-Attribut).
- **Schornsteine:** kleiner Quader auf ~40 % der geneigten Dächer.
- **Kirche** (`church.ts`): Kirchenschiff aus dem Grundriss ohne Turmfläche, Satteldach mit 55°. Dazu ein Turm (quadratisch, Höhe 2,5× Traufhöhe, mind. 22 m) mit Spitzhelm (Pyramide, 0,9× Turmbreite hoch × 3). Turmposition aus den Kacheldaten (D5). Dazu kommen Schallöffnungen im Turm über den Fassaden-Shader und Fensterbögen am Kirchenschiff (Fassadencode „Kirche“).
- **Farben:** Palette des Markgräflerlands (Weiß, Elfenbein, helles Ocker, Sandstein-Rot an Sockeln), Biberschwanz-Ziegelrot mit leichter Variation.

### D10 Vegetation und Wasser

- **Bäume:** 5 Grundformen aus Grundkörpern (runder Laubbaum, hoher Laubbaum, Nadelbaum, Obstbaum, Busch). Jede Form trägt zwei Grüntöne (Krone oben heller) als Vertex-Farben, die Tönung je Instanz erfolgt über die Instanzmatrix-Skalierung plus ein Instanz-Farbattribut (`instanceColor`, Thin-Instance-Buffer). Die Draw Calls je Kachel bleiben bei 5.
- **Hecken:** Die Pipeline erzeugt aus `barrier=hedge` künftig Heckenfelder (Prop-Art bleibt Busch, neue Variante „Hecke“ als längliche Form).
- **Wasser:** eigener Shader auf den vorhandenen Wasserbändern und -flächen. Wellen als verschobenes Rauschen entlang der Fließrichtung (`uv.y` + Zeit), Glanzlicht aus Sonnenrichtung, Ufer etwas heller. Ohne Alpha-Blending.

### D11 Modulstruktur

```
tools/world-pipeline/src/roads/   (neu: Ordner; roads.ts zieht um)
  network.ts        bisheriges roads.ts (Netz, Kachelschnitt, Graph)
  attributes.ts     (+ test) Fahrstreifen, Einbahn, Gehweg, Belag, Regeln
  junctions.ts      (+ test) Kreuzungspolygone, Kürzung der Arme
  bridges.ts        (+ test) Brückenzüge, Deckhöhen
  crossings.ts      (+ test) Zebrastreifen aus OSM-Knoten
tools/world-pipeline/src/buildings/churchTower.ts (+ test)
packages/world-format/src/detailsSection.ts (+ test)

apps/game/src/world/
  shaders/          lighting.glsl.ts, noise.glsl.ts (gemeinsame GLSL-Bausteine)
  roads/            profile.ts (+ test), ribbon.ts (+ test), junctionMesh.ts (+ test),
                    bridgeMesh.ts (+ test), roadMaterial.ts, RoadLayer.ts
  terrain/          terrainMaterial.ts, landBlend.ts (+ test), bakedShade.ts (+ test)
  gen/buildings/    walls.ts, roofs.ts, details.ts (+ test), church.ts (+ test)
  sky/              SkyDome.ts, skyColors.ts (+ test)
  water/            waterMaterial.ts
  vegetation/       treeShapes.ts, TreeLayer.ts (erweitert)
```

Wie gehabt gilt: höchstens 300 Zeilen je Datei, Rechenlogik ohne Babylon-Import, Tests daneben. `materials.ts` wird dabei aufgelöst: Jedes Material bekommt seine eigene Datei im jeweiligen Feature-Ordner.

## Risks / Trade-offs

- **[Mehr Fragment-Arbeit auf dem A9X]** → Rauschen auf 2 Oktaven begrenzt, Muster nur in Ring 0 (`detail`-Uniform), Tone-Mapping und Nebel im Shader statt als Post-Pass, `autoClear` aus. Nach jeder Gruppe wird mit der vorhandenen Leistungsanzeige und der Testroute gemessen.
- **[Shader-Kompilierzeit beim Start]** (Safari kompiliert langsam) → wenige, große Shader statt vieler Varianten, Vorab-Kompilierung im Ladebildschirm (`material.forceCompilationAsync`).
- **[Kreuzungsgeometrie bei unsauberen OSM-Daten]** → Rückfall auf Kreisscheibe, Pipeline-Prüfung mit Zähler „Kreuzungen im Rückfallmodus“, Sichtprüfung am Blumenplatz.
- **[Brücken mit fehlerhaften Enden]** (z. B. Brücke endet mitten im Hang) → Deckhöhe nie unter Gelände + 0,5 m, Begrenzung der Steigung auf 12 %.
- **[Mehr Geometrie durch Gehwege/Bordsteine]** → Bordsteine nur in Ring 0, Ring 1 bekommt flache Bänder ohne Gehweg.
- **[disableUniformBuffers unklar]** → als Schalter im Testmodus messbar machen, Standard erst nach Messung festlegen.
- **[Weltdaten müssen neu gebaut werden]** → abwärtskompatibler Abschnitt, PWA-Update lädt nur geänderte Pakete.

## Migration Plan

1. Pipeline: Format-Abschnitt, Attribute, Kreuzungen, Brücken, Zebrastreifen, Kirchtürme; Props neu abrufen, Welt neu bauen, `check --determinism`.
2. Spiel: Shader-Bausteine, Himmel, Gelände, Straßen, Gebäude, Vegetation, Wasser, jeweils mit Messung.
3. Deployment über Cloudflare, Clients aktualisieren über „Update bereit“.

## Open Questions

- Feinabstimmung der Farbpalette und der Musterstärken erfolgt per Sichtprüfung. Specs und Aufgaben ändern sich dadurch nicht.
