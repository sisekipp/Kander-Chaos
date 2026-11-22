# Tasks

Für alle Aufgaben gilt die Codestruktur aus Design D9 bzw. Projektregeln: höchstens 300 Zeilen je Datei, Rechenlogik ohne Babylon-Import in eigenen Modulen, `modul.test.ts` neben `modul.ts`. Eine Aufgabe ist erst erledigt, wenn ihre Tests grün sind und `vp check` fehlerfrei läuft. Voraussetzung: `graphics-world` ist umgesetzt (Licht- und Nebel-Bausteine).

## 1. Asset-Pipeline

- [x] 1.1 Ordner `assets/` (Quellen, `registry.json`, `recipes/`) und Werkzeug `tools/asset-pipeline` mit `build`/`check` anlegen; `registry.ts` mit Pflichtfeldern (Quelle, Paket, Lizenz, Abrufdatum, Stilprüfung, Änderungen); Unit-Test: Build schlägt bei Modell ohne Registereintrag fehl
- [ ] 1.2 Kandidatenpakete (Quaternius, Kenney) auf Lizenz (CC0) und Stil prüfen, Ergebnis je Modell ins Register; Lücken (europäischer Kleintransporter, StVO-Schilder, deutsche Laterne o. ä.) als selbst zu bauende Modelle im Register vormerken
- [x] 1.3 `optimize.ts` mit gltf-transform (dedup, weld, Quantisierung, meshopt, Texturen ≤ 512 px) und `recolor.ts` (Farbzonen); Unit-Test für Farbzonen; Prüfung, dass die Ausgabe in Babylon lädt (Node-Test mit Loader oder Browsertest)
- [x] 1.4 `validate.ts`: Dreiecksgrenzen je Art, Materialanzahl, mindestens 2 lösbare Teile bei Fahrzeugen, Budget 15 MB gesamt; Unit-Tests für jede Regel
- [ ] 1.5 README der Asset-Pipeline (Ablauf, Regeln, wie man ein Modell hinzufügt); prüfen, dass ein frischer Checkout mit den Befehlen die Modelle erzeugt

## 2. Laden im Spiel

- [x] 2.1 `@babylonjs/loaders` und lokalen meshopt-Decoder einbinden (`assets/meshopt.ts`); E2E-Test: Modelle laden offline ohne Anfragen an fremde Hosts
- [x] 2.2 `assets/ModelRegistry.ts`: Manifest lesen, Modelle als AssetContainer laden (Fortschritt im Ladebildschirm), Vorlagen für Thin Instances (eigene VertexData) und für animierte Figuren; Unit-Test für die Manifest-Auswertung; Browsertest Ladefortschritt
- [x] 2.3 `assets/palette.ts`: deterministische Farbwahl je ID auf Farbzonen; Unit-Test

## 3. Kleinobjekte

- [x] 3.1 Prop-Modelle (Mülleimer, Bank, Laterne, StVO-Schilder, Gartenzaun, Büsche in mehreren Formen) übernehmen bzw. bauen und durch die Pipeline schicken
- [x] 3.2 `props/models` auf die Registry umstellen (Thin Instances, Trümmer passend zu Farbe/Material); bestehende Props-E2E-Tests grün, ≤ 8 Draw Calls je Kachel, Sichtprüfung per Screenshot

## 3b. Weitere Kleinobjekte (Erweiterung)

- [x] 3.3 OpenSpec-Artefakte erweitern (Proposal, Spec-Delta `destructible-props`, Design D9a, Aufgaben)
- [x] 3.4 Kachelformat: neue `PropKind`-Werte und gemeinsame Formtabelle (`propShapes.ts`) in `@kandern/world-format`; Unit-Test für die Zuordnung; Format-README ergänzen
- [x] 3.5 Pipeline: OSM-Zuordnung der neuen Arten und Schildvarianten, Blumenkübel nach Regel, Props-Abfrage erweitern, Teilstücke neu abrufen, Welt neu bauen; `check`: höchstens 12 Formen je Kachel; Unit-Tests
- [x] 3.6 Modelle Briefkasten, Hydrant, Poller, Fahrradbügel, Litfaßsäule, Blumenkübel, Dreiecks-, Fußgängerüberweg- und Haltestellenschild (Blender-Kommandozeile) durch die Pipeline
- [x] 3.7 Spiel: Regeln, Kollisionsmaße, Massen, Trümmerfarben und Formen der neuen Arten; Unit-Tests für die Regeln; Props-E2E (≤ 12 Draw Calls, Poller anfahren), Sichtprüfung

## 4. Fahrzeuge

- [ ] 4.1 Fahrzeugmodelle (4 Autos, 2 Fahrräder, Roller, Motorrad) übernehmen bzw. bauen; Rezepte mit Box- und Radmaßen, Rad- und Sitzknoten, `detach_*`-Teilen
- [x] 4.2 `vehicles/models` als Adapter auf die Registry (deterministische Modell- und Farbwahl je Parkposition, VehicleSpec-Maße aus dem Rezept); Unit-Test für die Modellwahl; alle Fahrphysik-, Fahr- und Schadens-E2E-Tests grün (Endgeschwindigkeiten weiter ±15 %)
- [ ] 4.3 Sichtprüfung per Screenshot (Straße mit mehreren Modellen), Prüfliste „europäisch, keine Logos“ im Register abgehakt

## 5. Spielfigur

- [ ] 5.1 Figurmodell mit ≥ 4 Varianten und Animationen (stehen, gehen, rennen, springen, fallen, einsteigen, aussteigen, sitzen) übernehmen; Validierung ≤ 3.000 Dreiecke
- [ ] 5.2 `player/animation/animState.ts` und `blend.ts` (Zustände, Überblendung 0,3 s, Gehgeschwindigkeit passend); Unit-Tests für Zustandswechsel und Gewichte
- [ ] 5.3 `FigureAnimator.ts` und neue `figure.ts`; Figur sitzt sichtbar auf Fahrrad/Motorrad und neigt sich mit; E2E-Test: Animation wechselt beim Losgehen und beim Einsteigen
- [ ] 5.4 Figurvariante im Menü wählbar und im Spielstand gespeichert (Schema-Version 2 mit Migration); Unit-Test für die Migration, E2E-Test: Variante bleibt nach Neustart erhalten

## 6. NPC-Figuren vorbereiten

- [ ] 6.1 ≥ 8 NPC-Figuren mit gemeinsamem Animationssatz übernehmen; `bakeVat.ts` backt Animationstexturen
- [ ] 6.2 Testansicht im Testmodus (alle Figuren nebeneinander, gebackene Gehanimation mit Thin Instances); Browsertest: 8 Figuren sichtbar, Draw Calls ≤ Anzahl Figurmodelle

## 7. Wahrzeichen

- [ ] 7.1 Welt-Pipeline: Gebäude mit Wahrzeichen-Zuordnung (OSM-ID) als `landmark` markieren; Unit-Test; Welt neu bauen, `check --determinism` grün
- [ ] 7.2 `world/landmarks/LandmarkLayer.ts` + `placement.ts` (Position, Ausrichtung, Geländehöhe, Kollision); Unit-Test für die Platzierung; E2E-Test: Figur kann nicht durch das Wahrzeichen laufen
- [ ] 7.3 Modelle evangelische Kirche und Rathaus Kandern (Blender, ≤ 8.000 Dreiecke, ≤ 2 Materialien), Grenzwertprüfung im Build; Sichtprüfung per Screenshot und durch dich

## 8. Integration und Messung

- [ ] 8.1 Alle Unit- und E2E-Tests grün, Budget-Prüfung (Modelle ≤ 15 MB, gesamt ≤ 300 MB) im Build
- [ ] 8.2 Messung auf dem iPad Pro 1. Gen (Testroute, Messlauf in der Kernstadt mit Fahrzeugen, NPC-Testansicht) mit Ziel Ø ≥ 30 fps und 1-%-Low ≥ 20 fps; Ergebnis in `docs/perf/<datum>-modelle.md`

## Workflow follow-up

- Nach Abnahme den Change archivieren und die Specs übernehmen; danach NPC-Change planen.
