# Tasks

Für alle Aufgaben gilt die Codestruktur aus Design D11: höchstens 300 Zeilen je Datei, Logik ohne Babylon-Import in eigenen Modulen, `modul.test.ts` neben `modul.ts`. Eine Aufgabe ist erst erledigt, wenn ihre Tests grün sind und `vp check` fehlerfrei läuft.

## 0. Codestruktur vorbereiten

- [x] 0.1 Lint-Regel `max-lines` (300, ohne Leer-/Kommentarzeilen, Testdateien ausgenommen) als Fehler in `vite.config.ts` aktivieren; prüfen, dass `vp check` bei einer Datei über 300 Zeilen fehlschlägt
- [x] 0.2 `TileManager` zerlegen in `world/tiles/` (`TileManager` = Lebenszyklus, `TileUploader`, `TileCollision`, `layers.ts` mit `TileLayer`-Schnittstelle) und Bäume als `world/vegetation/TreeLayer.ts` auslagern, ohne Verhaltensänderung; Unit-Test für die Layer-Benachrichtigung (bereit/entladen), automatisierter Browsertest: Mesh-, Knoten- und Geometriezahl nach Hin- und Rückfahrt unverändert; alle bestehenden Unit- und E2E-Tests grün
- [x] 0.3 `Player` in `player/PlayerController.ts` (Zustandsmaschine, vorerst nur `walking`) und `player/Walker.ts` aufteilen, Kamera-Nachführung nach `camera/CameraRig.ts` mit testbarer `followMath.ts` verschieben; Unit-Test für `followMath`, bestehende E2E-Tests grün
- [x] 0.4 Übrige Dateien über 300 Zeilen (z. B. `buildingGen.ts`: Wände/Dächer trennen) aufteilen, bis `vp check` mit der neuen Regel fehlerfrei läuft; alle Tests grün

## 1. Kachelformat und Pipeline

- [x] 1.1 Abschnitt 6 „Props“ (Kleinobjekte + Parkpositionen) in `packages/world-format` ergänzen, ohne `FORMAT_VERSION` zu erhöhen; Round-Trip-Unit-Test plus Test, dass ein Leser ohne Props-Unterstützung (Abschnitt übersprungen) Gelände/Gebäude/Straßen weiter korrekt liest; Format-README ergänzen
- [x] 1.2 Fortsetzbaren Overpass-Abruf für Straßenmöbel, Barrieren und Parkplätze (`data/raw/osm-props-chunks/`) im Schritt `fetch` ergänzen; prüfen, dass ein zweiter Lauf vorhandene Teilstücke wiederverwendet
- [x] 1.3 OSM-Props einlesen (Laternen, Mülleimer, Bänke, Schilder; Zäune/Hecken in 2,5-m-Felder zerlegt) und je Kachel zuordnen; Unit-Tests für Zuordnung und Feldzerlegung
- [x] 1.4 Deterministische Ergänzung (Laternen entlang Wohnstraßen, Büsche in Gärten, Zaunfelder am Straßenrand, Mülleimer/Bänke an Plätzen) mit Konfliktprüfung gegen Fahrbahnen und Gebäude; Unit-Tests: Determinismus, nichts auf Fahrbahn oder in Gebäuden
- [x] 1.5 Parkpositionen (Straßenrand + Raster in Parkplatzflächen, ≥ 6 m Abstand, ≥ 15 m von Kreuzungen, ~10 % Zweiräder) erzeugen; Unit-Tests für Abstände und Kreuzungsabstand
- [x] 1.6 `check` erweitern (≥ 10 Parkpositionen rund um den Blumenplatz, ≥ 3 Prop-Arten in der Kernstadt, Budget 120 MB, Determinismus); Welt neu bauen, `check --determinism` grün; Pipeline-README um die Regeln ergänzen

## 2. Physik-Grundlagen

- [x] 2.1 Physik-Budget-Manager (Register dynamischer Körper, Obergrenze 80, Trümmer max. 60, Ausblenden nach Ruhezeit, Einfrieren/Entfernen der ältesten) als testbare Logik plus Babylon-Anbindung; Unit-Tests für Verdrängungsreihenfolge und Zeiten
- [x] 2.2 Feste Physik-Teilschritte (1/60 s, max. 2 pro Bild) und Debug-Ansicht (Raycasts, Kräfte) im Testmodus; im Browser prüfen, dass die Debug-Ansicht ein- und ausschaltbar ist

## 3. Fahrzeuge

- [x] 3.1 Prozedurale Low-Poly-Modelle für Auto, Fahrrad, Motorrad mit lösbaren Teilen und Farbpalette (deterministisch aus Parkpositions-ID); Unit-Test für Determinismus der Farbwahl, Sichtprüfung im Browser
- [x] 3.2 Raycast-Fahrzeugphysik (Federn, Antrieb, Seitenhalt, Bremse, Lenkung, Abtrieb, v_max je Art) als Klasse mit testbarer Kraftberechnung; Unit-Tests für Federkraft, Geschwindigkeitsbegrenzung und lenkwinkelabhängige Reduktion
- [x] 3.3 Zweirad-Stabilisator (Zielneigung aus Lenkung × Geschwindigkeit, kein Umkippen) und Selbstaufrichten nach 2 s; im Browser prüfen: enge Kurve mit Fahrrad kippt nicht, Auto auf dem Dach richtet sich auf
- [x] 3.4 Fahrwerte abstimmen; automatisierter Browsertest: Endgeschwindigkeiten je Art innerhalb ±15 % der Richtwerte, Auto schafft 30 % Steigung, Fahrzeug prallt an Hauswand ab statt durchzufahren
- [x] 3.5 Fahrzeug-Manager: Besetzen der Parkpositionen aus Ring-0-Kacheln (max. 24, nächste zuerst), ruhend STATIC ↔ dynamisch (max. 8), Merken bewegter Fahrzeuge und des zuletzt gefahrenen bis 1 km; Unit-Tests für Auswahl, Physik-LOD und Gedächtnis; Browsertest: ≥ 5 Fahrzeuge inkl. Zweirad im Umkreis von 150 m um den Startpunkt

## 4. Ein-/Aussteigen, Steuerung, Kamera

- [x] 4.1 Spielzustand `walking`/`driving` mit Einsteigen (≤ 3 m, Aktionsknopf/Taste E) und Aussteigen (Abbremsen > 15 km/h, freie Absetzstelle per Kandidatenprüfung); Unit-Test der Kandidatenauswahl; Browsertest: Aussteigen an einer Hauswand landet auf freiem Boden
- [x] 4.2 Eingabe um Gas, Bremse/Rückwärts, Hupe, Aktion erweitern; Tastatur (W/A/S/D, Leertaste, E) und „Einfach“-Modus (Auto-Gas, Einstellung im Menü); Unit-Test für die Auto-Gas-Logik
- [x] 4.3 Touch-UI für beide Modi (große Knöpfe ≥ 64 pt, Einsteigen-Knopf nur in Reichweite, Zustandsbalken im Fahrzeug); Browserprüfung der Anzeige je Modus
- [x] 4.4 `CameraRig` mit Lauf- und Fahrkamera (folgt von hinten, Zoom nach Tempo, Zurückschwenken nach ≤ 2 s); Browsertest des Zurückschwenkens

## 5. Fahrzeugschaden

- [x] 5.1 Schadensmodell (Schwelle 10 km/h, Kurve, Kleinobjekte max. 2 %, Entprellung 150 ms) als testbare Logik; Unit-Tests: 5 km/h kein Schaden, 60 km/h gegen Wand ≥ 30 %, 10 Büsche ≤ 20 %
- [x] 5.2 Havok-Kollisionsereignisse an das Schadensmodell anbinden; Browsertest: harter Aufprall senkt den Zustand
- [x] 5.3 Sichtbare Stufen (Färbung ab 70 %, abfallende Teile ab 40 %, Rauch ab 40 %/15 %) mit Partikeln ohne Texturdateien; Trümmer verschwinden nach 10 s; Browserprüfung der Stufen
- [x] 5.4 Totalschaden („Puff“ ohne Feuer, Wrack fahruntüchtig, automatisches Aussteigen), Wrack verschwindet nach 20 s, Wiedererscheinen nach 60 s außer Sicht oder Neuladen der Kachel; Unit-Test der Wiedererscheinen-Regel; Browsertest Totalschaden mit Spieler

## 6. Zerstörbare Kleinobjekte

- [x] 6.1 Prozedurale Modelle für Busch, Mülleimer, Zaunfeld, Schild, Laterne, Bank inkl. vorgefertigter Trümmerteile; Sichtprüfung im Browser
- [x] 6.2 Props als Thin Instances je Art und Ring-0-Kachel (eigene Geometrie je Mesh) im `TileManager` hochladen und entladen; Browserprüfung: ≤ 8 zusätzliche Draw Calls für die Kachel am Blumenplatz, keine Lecks nach Hin- und Rückfahrt
- [x] 6.3 Trefferprüfung über 2D-Raster je Kachel, Auslösen je Art (wegfliegen, zerbrechen, umknicken) mit Impuls aus Fahrzeuggeschwindigkeit; Unit-Tests für Rastersuche und Schwellen
- [x] 6.4 Blockierende Collider für Laternen, Schilder und Bänke im 30-m-Umkreis der Figur; Browsertest: zu Fuß gegen eine Laterne wird aufgehalten
- [x] 6.5 Wiederaufbau nach 60 s außer Sicht bzw. beim Neuladen der Kachel; Unit-Test der Regel; Browsertest: zerstörter Zaun steht nach Entladen/Neuladen wieder

## 7. Integration und Messung

- [x] 7.1 E2E-Test (Playwright/WebKit): Einsteigen, Fahren, Kleinobjekt umfahren, Aussteigen, offline lauffähig, keine Anfragen an fremde Hosts
- [x] 7.2 Desktop-Chaos-Test (automatisiert): 30 s Zerstörung am Blumenplatz, nie mehr als 80 dynamische Körper und 60 Trümmer
- [x] 7.3 Messanleitung in `docs/perf/README.md` um Fahrzeug- und Chaos-Messung ergänzen; Messung auf dem iPad Pro 1. Gen (Testroute im Auto, Chaos-Test) mit Ziel ≥ 30 fps Ø und ≥ 20 fps 1-%-Low, Ergebnis in `docs/perf/<datum>-fahrzeuge.md`

## Workflow follow-up

- Nach Abnahme auf dem iPad den Change archivieren und die Specs übernehmen.
