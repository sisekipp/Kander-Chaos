# Tasks

Für alle Aufgaben gilt die Codestruktur aus Design D11: höchstens 300 Zeilen je Datei, Rechenlogik ohne Babylon-Import in eigenen Modulen, `modul.test.ts` neben `modul.ts`. Eine Aufgabe ist erst erledigt, wenn ihre Tests grün sind und `vp check` fehlerfrei läuft.

## 1. Vorbereitung und Struktur

- [x] 1.1 `tools/world-pipeline/src/roads.ts` nach `roads/network.ts` verschieben und `world/materials.ts` in Feature-Ordner aufteilen (ohne Verhaltensänderung); alle bestehenden Unit- und E2E-Tests grün
- [x] 1.2 `world/gen/buildingGen.ts` in `gen/buildings/` (`walls.ts`, `roofs.ts`, `index.ts`) aufteilen, ohne Verhaltensänderung; bestehender Determinismus-Test für Gebäude grün
- [x] 1.3 Testmodus-Schalter für `engine.disableUniformBuffers` und eine Vergleichsmessung (Messlauf 60 s je Einstellung) vorbereiten; Browsertest, dass beide Einstellungen rendern

## 2. Kachelformat und Pipeline

- [x] 2.1 Abschnitt 7 „Details“ (Straßenattribute, Kreuzungen, Zebrastreifen, Kirchtürme) in `packages/world-format/detailsSection.ts`; Round-Trip-Test und Test „Leser ohne Abschnitt liest Rest korrekt“; Format-README ergänzen
- [x] 2.2 `roads/attributes.ts`: Fahrstreifen, Einbahn, Gehweg, Belag, Ebene aus OSM plus Ergänzungsregeln; Unit-Tests für Regeln (u. a. fehlender Gehweg im Ortskern)
- [x] 2.3 `roads/junctions.ts`: Kreuzungspolygone und Kürzung der Arme (Verfahren A/B Street), Rückfall Kreisscheibe; Unit-Tests mit T-, X-, Y-Kreuzung, spitzem Winkel und fast parallelen Armen
- [x] 2.4 `roads/bridges.ts`: Brückenzüge über Wege- und Kachelgrenzen, Deckhöhen (≥ 0,5 m über Gelände, max. 12 % Steigung); Unit-Tests inkl. nahtloser Höhe an der Kachelgrenze
- [x] 2.5 Props-Abfrage um `highway=crossing` erweitern, `roads/crossings.ts` (Position, Querrichtung, Länge); Unit-Test; Props-Teilstücke neu abrufen
- [x] 2.6 `buildings/churchTower.ts`: Turmlage aus Gebäudeteilen oder nach Regel (westliche Schmalseite); Unit-Tests
- [x] 2.7 `check` erweitern (Anteil Kreuzungen im Rückfallmodus < 15 %, Brücken ohne Höhensprung, Kirche Kandern hat Turm); Welt neu bauen, `check --determinism` grün; Pipeline-README um die Regeln ergänzen

## 3. Licht, Himmel, Farben

- [x] 3.1 Gemeinsame GLSL-Bausteine `world/shaders/` (Hemisphäre, Wrap-Sonne, Tone-Mapping-Kurve, Nebel in Horizontfarbe, Wert-Rauschen); Unit-Tests für die zugehörigen Farb-/Kurvenfunktionen in TS-Spiegelung (`skyColors.ts`)
- [x] 3.2 Himmelskuppel mit Verlauf und Sonnenglow, Panorama in Horizontfarbe, `scene.autoClear = false`; Browsertest: Himmel deckt jedes Pixel (Screenshot ohne Clear-Farbe), Sichtprüfung Horizont
- [x] 3.3 Alle bestehenden Welt-Materialien auf den gemeinsamen Licht-Baustein umstellen und nach dem Aufbau einfrieren; Sichtprüfung, dass weiße Fassaden hell bleiben

## 4. Gelände

- [x] 4.1 `terrain/landBlend.ts`: Landnutzungs-Code und Übergangsgewicht je Vertex im Worker; Unit-Test für weiche Übergänge
- [x] 4.2 `terrain/bakedShade.ts`: Abdunkelung um Gebäude und unter Bäumen; Unit-Test (Vertex neben Gebäude dunkler als freie Wiese)
- [x] 4.3 `terrain/terrainMaterial.ts`: Boden-Shader mit Acker-Furchen (Richtung je Feld), Wiesen- und Waldmuster, `detail`-Uniform für Ring 1/2; Sichtprüfung Acker neben Wiese

## 5. Straßen

- [x] 5.1 `roads/profile.ts`: Querschnitte je Straßenart (Fahrbahn, Mittelstreifen, Gehweg, Bordstein, Leitplanke); Unit-Tests je Art
- [x] 5.2 `roads/ribbon.ts`: Extrusion des Querschnitts mit Straßenkoordinaten (uv/uv2), Kürzung an Kreuzungen, Höhen vom Gelände bzw. Brückendeck; Unit-Tests (Querkoordinate, Länge, Kürzung)
- [x] 5.3 `roads/junctionMesh.ts`: Triangulierung der Kreuzungspolygone, Zebrastreifen-Geometrie; Unit-Test
- [x] 5.4 `roads/bridgeMesh.ts`: Geländer, Pfeiler (> 3 m Höhe), Tunnelportale; Unit-Test für Pfeilerabstände
- [x] 5.5 `roads/roadMaterial.ts`: Straßen-Shader mit Markierungen (gestrichelte Mittellinie, Randlinien, Autobahn-Fahrstreifen), Feldweg-Grasstreifen, Pflaster, Zebrastreifen, Antialiasing über `fwidth`; Sichtprüfung je Straßenart
- [x] 5.6 `roads/RoadLayer.ts` als TileLayer (ersetzt das bisherige Straßenband), Brücken-Kollision für Ring 0; Browsertests: ≤ 4 Draw Calls für Straßen am Blumenplatz, Auto fährt über eine Brücke ohne durchzufallen, Speicherleck-Test grün

## 6. Gebäude

- [x] 6.1 `gen/buildings/details.ts`: Dachüberstand, Haustür zur nächsten Straße, Fensterläden-Auswahl, Schornsteine – deterministisch aus der Gebäude-ID; Unit-Tests (Determinismus, Tür zeigt zur Straße)
- [x] 6.2 Fassaden-Shader um Türen, Fensterläden, Kirchenfenster und Schallöffnungen erweitern; regionale Farbpalette; Sichtprüfung Altstadtgasse
- [x] 6.3 `gen/buildings/church.ts`: Kirchenschiff plus Turm mit Spitzhelm an der Turmlage aus den Kacheldaten; Unit-Test (Turm überragt Schiff, steht an der richtigen Stelle); Sichtprüfung Kirche Kandern

## 7. Vegetation und Wasser

- [x] 7.1 Fünf Baumformen mit zwei Grüntönen und Instanz-Farbtönung (`instanceColor`), Hecken-Variante; Unit-Test für die Formauswahl je Landnutzung; Browsertest: höchstens 5 Baum-Draw-Calls je Kachel
- [x] 7.2 `water/waterMaterial.ts`: bewegte Oberfläche in Fließrichtung, Glanzlicht, ohne Alpha-Blending; Sichtprüfung an der Kander

## 8. Integration und Messung

- [x] 8.1 Alle bestehenden E2E-Tests grün; neue Screenshot-Prüfungen (Blumenplatz, Hauptstraße, Feldweg, Kirche, Brücke) im Testlauf ablegen
- [ ] 8.2 Desktop-Messung der Testroute (Vergleich vorher/nachher) in `docs/perf/README.md` ergänzen; Messung auf dem iPad Pro 1. Gen (Testroute, Messlauf in der Kernstadt) mit Ziel Ø ≥ 30 fps und 1-%-Low ≥ 20 fps, Ergebnis in `docs/perf/<datum>-grafik.md`

## Workflow follow-up

- Nach Abnahme auf dem iPad den Change archivieren und die Specs übernehmen.
