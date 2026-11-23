# Tasks

Für alle Aufgaben gilt: höchstens 300 Zeilen je Datei, Rechenlogik ohne Babylon-Import in eigenen Modulen, `modul.test.ts` neben `modul.ts`. Eine Aufgabe ist erst erledigt, wenn ihre genannten Tests grün sind und `vp check` fehlerfrei läuft.

## 1. Vorbereitung

- [x] 1.1 `world/World.ts` (297 Zeilen) aufteilen: Aufbau von Layern und Systemen nach `world/worldSetup.ts`; bestehende Unit- und E2E-Tests bleiben grün
- [x] 1.2 Lizenzen prüfen (swissALTI3D, IGN RGE ALTI, OSM CH/F) und Bedingungen in `tools/world-pipeline/README.md` festhalten; Test: `attribution.test.ts` erwartet alle vier Quellen

## 2. Gebiet und Höhendaten

- [x] 2.1 `region/area.ts`: Spielgebiet-Rechteck, Kern-/Nachladeregionen, Paketeinteilung; Unit-Tests (Kandern im Kern, Basel/Müllheim remote, Kacheln außerhalb ausgeschlossen)
- [x] 2.2 `dgm/proj.ts`: UTM → WGS84, WGS84 → LV95 (Näherungsformeln swisstopo, ca. 1 m) und WGS84 → Lambert-93 (exakt); Unit-Tests mit Referenzpunkten (Bern, Basel, EuroAirport, Lambert-Ursprung)
- [x] 2.3 `dgm/swiss.ts`, `dgm/france.ts`: fortsetzbarer Download und Einlesen der Kacheln; bisheriges `dgm.ts` als `dgm/lgl.ts`; Unit-Tests mit kleinen Beispieldateien
- [x] 2.4 `dgm/merge.ts`: Vorrang nach Land und 30-m-Überblendung an der Grenze; Unit-Test (keine Stufe > 1 m an der Datengrenze); Stichprobe Otterbach/Riehen/Hüningen: Stufen an der Grenze (1,2–3,1 m) wie im natürlichen Gelände daneben (1,0–3,0 m)
- [x] 2.5 OSM-Abruf für das ganze Rechteck (mehr Teilstücke, Fortsetzen); Check: Müllheim, Lörrach, Weil, Basel, EuroAirport haben Gebäude bzw. Pisten

## 3. Neue Inhalte im Kachelformat

- [x] 3.1 Format: `LandKind` Piste, Rollweg, Bahnsteig; Gleisanzahl in den Details; `VehicleKind.Helicopter`; Unit-Tests für Lesen/Schreiben und Abwärtskompatibilität
- [x] 3.2 Pipeline: Autobahnen mit Richtungsfahrbahnen und Brücken, Bahnstrecken, Bahnsteige, Flughafenflächen; Unit-Tests (Klassifizierung) und Check „A5 bei Weil“, „Pisten EuroAirport“
- [x] 3.3 Echte Gebäudehöhen über 100 m und `skyline.ts` (Fernsicht-Liste ab 40 m je Region); Unit-Test, Check „Roche-Turm > 150 m in der Liste“
- [x] 3.4 Spiel: Darstellung von Autobahn (breiter, Mittelleitplanke), Gleisen, Bahnsteigen, Pisten und Rollwegen (Markierungen) im Straßen- bzw. Flächen-Layer; Unit-Tests der Geometrie, Screenshot-Test Autobahn und Piste
- [x] 3.5 Budgets: Kern ≤ 120 MB, Remote ≤ 800 MB, Paket ≤ 25 MB, Ausdünnung in Remote-Regionen; Check schlägt bei Überschreitung fehl (Unit-Test der Budgetprüfung)

## 4. Nachladen von Cloudflare

- [x] 4.1 Pipeline: Kern-/Nachlade-Ausgabe (`world/` und `world-remote/`), `index.json` mit `remote` und `remoteBase`; Service Worker und Budget lassen `world-remote/` aus; Unit-Tests für Index und Paketzuordnung
- [x] 4.2 `offline/regionCache.ts`: Cache-API, Budget 400 MB, LRU nach letztem Besuch, Versionswechsel verwirft alte Regionen; Unit-Tests mit Fake-Cache
- [x] 4.3 `offline/packSource.ts`: Kern aus `kc-world`, Remote aus Cache oder Netz, höchstens 2 parallele Downloads, Priorität; Unit-Tests; `TileManager` nutzt die Quelle
- [x] 4.4 `StreamingPlanner`: Vorausladen über 20 s Weg; `tiles/blockedRegions.ts` für nicht ladbare Pakete; Unit-Tests
- [x] 4.5 Weicher Rand für Figur, Fahrzeuge, Flugmodus und Hubschrauber vor gesperrten Kacheln, Hinweis in der UI; E2E-Test offline: Rand bremst, Hinweis erscheint, keine Löcher
- [x] 4.6 Einstellungen: belegter Speicher der Regionen, „Gespeicherte Regionen löschen“; Erstbesuch lädt nur den Kern; E2E-Tests (Erstbesuch, Löschen behält Spielstand)

## 5. Fernsicht

- [x] 5.1 Pipeline: `farterrain.bin` (64-m-Raster der Region) als Teil des Kerns; Unit-Test Größe und Höhen
- [x] 5.2 `world/far/`: Fernsicht-Gelände, Silhouetten als Thin Instances, Ausblenden in geladenen Ring-0/1-Kacheln, Sichtweite 20 km im Flug (Kandern–Basel ≈ 17 km); Unit-Tests der Auswahl; E2E-Test: aus 300 m über Kandern sind Silhouetten in Basel vorhanden, Draw Calls +≤ 30

## 6. Hubschrauber

- [ ] 6.1 Früher Messpunkt: Flugmodus-Flug über die Basler Innenstadt auf Desktop und (durch dich) auf dem iPad; Ergebnis entscheidet über Ring-1-Radius im Flug (`docs/perf/<datum>-basel.md`)
- [x] 6.2 `blender/helicopter.py`: Modell (Rumpf-Loft, Kabinenglas, Kufen, Heckausleger, Leitwerk, Rotoren `rotor-main`/`rotor-tail`, Lichter, `detach_*`-Türen, Lackzonen `paint`/`stripe`), Rezept und Register; Build-Grenzwerte (≤ 6.000 Dreiecke, ≤ 4 Materialien); Render-Vorschau zur Sichtprüfung
- [x] 6.3 `blender` Landeplatz-Prop `helipad`, `assets/helipads.json` und `vehicles/helicopter/helipads.ts` (OSM-Helipads + feste Liste Kandern, Lörrach, Basel, EuroAirport); Unit-Test
- [x] 6.4 `heliMath.ts`: Flugschritt (Schwebeflug, Neigung, Kurvenlage, Höhengrenzen 1–600 m, Tempo nach Höhe mit Hysterese); Unit-Tests je Regel
- [x] 6.5 `heliLanding.ts`: Landefläche erkennen (Neigung < 12°, kein Dach), automatisches Abbremsen und Aufsetzen, Aussteigen nur ≤ 1 m; Unit-Tests
- [x] 6.6 `HelicopterController.ts`: Modell, Rotordrehzahl, Gebäudekollision per Shape-Cast (abprallen, nie kippen), Verfolgerkamera, Streaming-Fokus und Detailregel; Integration in Ein-/Aussteigen
- [x] 6.7 `ui/controls/HeliControls.tsx` (Joystick, Hoch, Runter, Schnell, Aussteigen nur am Boden) und Tastatur
- [x] 6.8 E2E-Tests: Einsteigen am Landeplatz Kandern, Rotoren laufen an, Steigen, Loslassen → Schweben in ≤ 2 s, Hochhaus-Abprall bleibt aufrecht, Landung auf dem Blumenplatz, kein Aussteigen in der Luft, Tempo-Grenzen nach Höhe

## 7. Messung und Abschluss

- [x] 7.1 Messroute „Hubschrauber Basel“ (Kandern → Lörrach → Basel Innenstadt → Flughafen) im Testmodus, E2E-Test: läuft durch, keine Löcher unter dem Hubschrauber, Desktop-Wert in `docs/perf/README.md`
- [ ] 7.2 Messung auf dem iPad Pro 1. Gen (Ziel Ø ≥ 30 fps, 1-%-Low ≥ 20 fps) mit Netz-Nachladen; Ergebnis in `docs/perf/<datum>-hubschrauber.md`
- [ ] 7.3 Commit inkl. `world-remote/`, Push und Deployment über den Cloudflare-Build aus GitHub nach Freigabe durch dich

## Workflow follow-up

- Danach die Changes `landmarks-region` (Hochhäuser, Basler Bahnhöfe, Flughafen-Terminal), `trains` und `airport-planes` planen.
