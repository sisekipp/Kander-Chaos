# Tasks

## 1. Projekt-Setup

- [x] 1.1 Monorepo mit Vite+ anlegen (`apps/game`, `tools/world-pipeline`, `packages/world-format`, `docs/perf`, `data/raw` in `.gitignore`) und prüfen, dass `vp install`, `vp test` und `vp build` im Root fehlerfrei durchlaufen
- [x] 1.2 `apps/game` mit React, TypeScript und Babylon.js (WebGL2-Engine; umgesetzt mit der aktuellen Version 9) aufsetzen: Vollbild-Canvas mit Render-Schleife außerhalb von React, DOM-Overlay für UI und kleiner Store als Brücke (D2); prüfen, dass `vp dev` eine leere Babylon-Szene mit React-Overlay zeigt
- [x] 1.3 Lokale Bereitstellung der WASM-Dateien (Havok; KTX2-Transcoder entfällt, da Fassaden prozedural sind – siehe 5.4) als statische Assets einrichten und Babylon-Pfade darauf setzen; prüfen, dass im Network-Tab beim Laden keine Anfrage an fremde Hosts erscheint
- [x] 1.4 Cloudflare-Deployment per Wrangler (Workers Static Assets, über die Git-Anbindung im Cloudflare-Dashboard) einrichten und eine erste Version deployen; prüfen, dass die URL auf dem iPad in Safari die Testszene zeigt

## 2. Machbarkeits-Spike auf dem Referenzgerät

- [x] 2.1 Leistungsanzeige (fps, Bildzeit, Draw Calls, geladene Kacheln, Speicher soweit verfügbar) als einblendbares React-Overlay mit 4-Hz-Aktualisierung bauen; prüfen, dass sie auf dem iPad per Touch ein- und ausblendbar ist
- [x] 2.2 Frame-Zeit-Rekorder bauen, der Mittelwert und 1-%-Perzentil über einen Messlauf berechnet und als JSON exportiert; Unit-Test für die Perzentil-Berechnung
- [x] 2.3 Synthetische Stress-Szene erzeugen (Gelände 250 × 250 m, ca. 400 extrudierte Box-Gebäude, 2000 Bäume als Thin Instances); auf dem iPad messen und im Testmodus aufrufbar machen
- [x] 2.4 Havok-Physik-Test: 50 dynamische Körper auf der Stress-Szene fallen lassen; Bildrate und WASM-Startzeit auf dem Referenzgerät messen
- [x] 2.5 Messergebnisse inklusive Entscheidung Havok/Fallback (D10) und ggf. angepasster Kachelgröße in `docs/perf/<datum>-spike.md` dokumentieren; prüfen, dass das Protokoll Gerät, iPadOS-Version, Messwerte und Entscheidung enthält

## 3. Kachelformat

- [x] 3.1 In `packages/world-format` Typen und Binär-Serialisierung für Kachelblöcke umsetzen (Höhenraster-LODs, Gebäude, Straßennetz, Landnutzung; D4); Round-Trip-Unit-Tests für jeden Abschnitt
- [x] 3.2 Regionspakete (Bündelung, gzip) und `index.json` (Version, Quelldatum, Kachel → Paket/Offset, SHA-256) umsetzen; Unit-Test: Paket schreiben, einzelne Kachel per Index lesen, Hash prüfen
- [x] 3.3 Format in `packages/world-format/README.md` dokumentieren (Abschnitte, Koordinatensystem UTM 32N mit lokalem Ursprung, Versionierung); prüfen, dass jedes Feld der Typen beschrieben ist

## 4. Welt-Daten-Pipeline

- [x] 4.1 CLI-Gerüst in `tools/world-pipeline` mit Schritten `fetch`, `build`, `check` und Konfigurationsdatei (Kachelgröße, Ursprung, Randstreifen); prüfen, dass `vp run pipeline -- --help` alle Schritte auflistet
- [x] 4.2 `fetch`: OSM-Daten per Overpass in fortsetzbaren Teilstücken (der Geofabrik-Teilextrakt Freiburg existiert nicht mehr, große Overpass-Abfragen scheitern am Zeitlimit) und LGL-DGM-Kacheln für Gemeinde + 500 m nach `data/raw` laden; prüfen, dass ein zweiter Lauf vorhandene Dateien wiederverwendet
- [x] 4.3 Gelände: DGM auf 2 m resampeln, Kachel-Höhenraster plus gröbere LODs erzeugen; Test: Höhe am Blumenplatz weicht höchstens 2 m vom DGM ab, Kanten benachbarter Kacheln sind identisch
- [x] 4.4 Gebäude: Grundrisse projizieren, genau einer Kachel zuordnen (Schwerpunkt), Höhe/Dachform/Typ nach dokumentierten Ergänzungsregeln mit ID-basiertem deterministischem Zufall; Unit-Tests für die Regeln und für Gebäude über Kachelgrenzen
- [x] 4.5 Straßennetz mit Typ, Breite und kachelübergreifenden Knoten-IDs erzeugen; Test: Graphsuche findet eine Verbindung Kernstadt → Tannenkirch
- [x] 4.6 Landnutzung (Waldtypen, Wiese, Acker, Obstwiese, Weinberg, Siedlung, Gewässer) pro Kachel zuschneiden; Test: eine bekannte Waldkachel enthält Waldflächen mit Typ
- [x] 4.7 `attribution.json` mit OSM (ODbL) und LGL BW (Datenlizenz Deutschland) inklusive Abrufdatum erzeugen; Test prüft Pflichteinträge
- [x] 4.8 `check`: Abdeckung der Ortsteile, 120-MB-Budget und Determinismus (zwei Läufe, Hashvergleich) prüfen; prüfen, dass `check` bei überschrittenem Budget mit Fehlercode endet
- [x] 4.9 Ablauf und Quellen der Pipeline in `tools/world-pipeline/README.md` dokumentieren; prüfen, dass ein frischer Checkout mit den dokumentierten Befehlen die Pakete erzeugt

## 5. Laufzeit-Erzeugung (Web Worker)

- [x] 5.1 Worker-Pool (1–2 Worker) mit Nachrichtenprotokoll und Transferables aufsetzen, Pakete im Worker entpacken (`DecompressionStream`, Fallback `fflate`); Test: Kachel wird im Worker gelesen und als Typed Arrays zurückgegeben
- [x] 5.2 Gelände-Mesh je LOD mit Schürzen erzeugen; visuell prüfen, dass an Kachel- und LOD-Grenzen keine Risse sichtbar sind, plus Unit-Test für Vertex-Anzahl und Schürzenhöhe
- [x] 5.3 Gebäude-Generator: Extrusion, Flachdach (`earcut`), Sattel- und Walmdach über orientiertes Rechteck, Fallback für komplexe Grundrisse, deterministische Farbe/Fassade aus ID und Typ, gebackene AO in Vertex-Farben; Unit-Test: gleicher Input ergibt identische Arrays
- [x] 5.4 Platzhalter-Fassaden (Fachwerk, Putz, Scheune, Gewerbe, öffentlich) prozedural im Fragment-Shader statt als KTX2-Atlas (0 Byte Texturdaten, ein Material) erzeugen und den Typen zuordnen; visuell prüfen, dass Altstadt und Gewerbe deutlich unterscheidbar sind
- [x] 5.5 Straßenbänder entlang der Polylinien mit vom Gelände abgetasteter Höhe und Depth-Bias erzeugen; visuell an einer Hangstraße in Kandern prüfen: kein Versinken, kein Schweben, kein Flimmern
- [x] 5.6 Vegetation: deterministisches Poisson-Disk-Sampling in Waldpolygonen, Low-Poly-Baumarten (Laub, Nadel, Obst) als Thin Instances, Silhouetten-Variante für Ring 2; Unit-Test für Determinismus und dafür, dass keine Bäume außerhalb von Waldflächen stehen

## 6. Streaming-Manager

- [x] 6.1 Ring-Logik (Ring 0/1/2, Hysterese, harte Kachel-Obergrenze) und Priorisierung nach Entfernung und Bewegungsrichtung umsetzen (D9); Unit-Tests mit simulierten Spielerpfaden
- [x] 6.2 Zeitgestückeltes Einhängen in die Szene (Upload-Budget ca. 4 ms pro Bild), ein Mesh pro Kachel und Material, eingefrorene Matrizen und Materialien; im Testmodus prüfen, dass beim Kachelwechsel kein Bild länger als 100 ms dauert
- [x] 6.3 Entladen mit vollständigem `dispose()` von Meshes, Instanz-Puffern und Physik-Shapes; Test: nach einer Hin-und-Rückfahrt ist die Zahl der Meshes in der Szene gleich dem Ausgangswert
- [x] 6.4 Nebel und statisches Hügel-Panorama hinter Ring 2 ergänzen; visuell prüfen, dass am Horizont keine harte Weltkante sichtbar ist

## 7. Spielfigur, Kollision und Testmodus

- [x] 7.1 Kollision nach Spike-Entscheidung (Havok-Heightfield + Gebäude-Shapes + Character Controller oder Fallback) für Ring-0-Kacheln; Spielfigur einfrieren, solange die Kollision der aktuellen Kachel fehlt; im Testmodus prüfen: Figur bleibt an Wänden stehen und fällt beim Kachelwechsel nicht durchs Gelände
- [x] 7.2 Touch-Steuerung für den Testmodus (virtueller Joystick links, Kamerawischen rechts) als React-Komponente mit Pointer-Events; auf dem iPad prüfen, dass Bewegung und Kamera gleichzeitig bedienbar sind
- [x] 7.3 Schnellfahrmodus (80 km/h) und Startpunkt Kernstadt; automatische Testroute (Kernstadt → Landstraße → Ortsteil) zum reproduzierbaren Abfahren; prüfen, dass die Route ohne Eingriff durchläuft und der Frame-Rekorder ein JSON liefert

## 8. Rendering-Budget und Qualitätsstufen

- [x] 8.1 Qualitätsstufen "Niedrig" und "Hoch" (Schatten, Nebelweite, FXAA, Sichtweite) mit Geräte-Heuristik und Standard "Niedrig" auf dem Referenzgerät umsetzen (D11); prüfen, dass das Referenzgerät beim ersten Start "Niedrig" wählt
- [x] 8.2 Adaptive Auflösungsskalierung (Absenkung bei < 28 fps über 3 s bis zur Untergrenze) umsetzen; Unit-Test für die Regellogik und Sichtprüfung, dass das DOM-UI scharf bleibt

## 9. Offline-Auslieferung und Spielstände

- [x] 9.1 Service Worker mit atomarem Precache der App-Shell (Bundles, WASM, Atlas, Icons) und Web-App-Manifest ("Kandern Chaos", Querformat, Vollbild, Icons) einrichten; Playwright-WebKit-Test: nach erstem Laden startet die App-Shell offline
- [x] 9.2 Welt-Downloader: Pakete einzeln mit Hash-Prüfung in einen versionierten Cache laden, Fortschritt in Prozent und Meldung "Bereit zum Offline-Spielen" anzeigen, nach Abbruch fortsetzen; E2E-Test mit simuliertem Verbindungsabbruch
- [x] 9.3 Updates: neue `index.json` erkennen, nur geänderte Pakete laden, Hinweis "Update bereit", Aktivierung erst nach Bestätigung oder beim nächsten Start; E2E-Test mit zwei Build-Versionen
- [x] 9.4 Speicher-Budget-Prüfung im Build (Summe aller vorzuladenden Dateien ≤ 300 MB, Aufschlüsselung nach Gruppen), `navigator.storage.persist()` und Belegungsanzeige; prüfen, dass ein künstlich vergrößerter Build fehlschlägt
- [x] 9.5 Spielstände in IndexedDB mit `schemaVersion`, Autosave alle 30 s sowie bei `visibilitychange`/`pagehide`, Wiederherstellung der Position beim Start; E2E-Test: App schließen und neu öffnen stellt die Position wieder her
- [x] 9.6 Spielstand-Export und -Import mit Schema-Validierung und verständlicher Fehlermeldung; E2E-Tests für gültige, beschädigte und fremde Dateien (bestehender Stand bleibt bei Fehlern erhalten)
- [x] 9.7 Seite "Über das Spiel" mit Quellenangaben aus `attribution.json` und Bibliothekslizenzen; E2E-Test: Seite ist offline erreichbar und nennt OSM und LGL BW

## 10. Integration und Abnahme auf dem Referenzgerät

- [x] 10.1 E2E-Gesamttest (Playwright WebKit): erster Besuch → vollständiger Download → Netzwerk aus → Neustart → Spielfigur in der Kernstadt steuerbar, ohne Anfragen an fremde Hosts
- [x] 10.2 Abnahmemessung auf dem iPad Pro 1. Gen nach festgelegter Testroute (dreimal hintereinander): mittlere fps ≥ 30, 1-%-Perzentil ≥ 20, Speicher < 900 MB (Web Inspector), kein Tab-Neustart, dichteste Kernstadt-Kachel ≤ 3 s, Offline-Kaltstart vom Home-Bildschirm ≤ 15 s; Ergebnisse in `docs/perf/<datum>-abnahme.md`
- [x] 10.3 Lange Fahrt Feuerbach → Kernstadt → Wollbach auf dem Referenzgerät; prüfen, dass Kachelzahl und Speicher stabil bleiben und keine fehlenden Detailkacheln sichtbar werden; Ergebnis im Abnahmeprotokoll ergänzen

## Workflow follow-up

- Nach erfolgreicher Abnahme den Change archivieren und die Specs übernehmen.
- Folge-Changes planen: Fahrzeuge (Auto, Fahrrad, Motorrad), zerstörbare Props, NPCs mit Umfallen/Aufstehen, Spaßwaffen, Innenräume, Tiere, Aufgaben/Belohnungen, Wahrzeichen.
