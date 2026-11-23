# Tasks

## 1. Liste und Pipeline

- [x] 1.1 Fotos und Höhen recherchieren; `assets/landmarks/region.json` mit allen Einträgen aus D1 anlegen (OSM-ID bzw. Koordinate + Ausrichtung, Bauvorlage, Sollhöhe)
- [x] 1.2 Welt-Pipeline: `region.json` einlesen, Zuordnung zu OSM-Gebäuden, freie Wahrzeichen; Unit-Tests (Treffer per ID, freie Koordinate, fehlende ID meldet Fehler)
- [x] 1.3 `skyline.json` um `landmarkId` erweitern; Check: alle Einträge aus `region.json` gefunden, Höhen innerhalb ±10 % des Sollwerts (Roche Bau 2 zwischen 185 und 225 m)

## 2. Modelle in Blender

- [x] 2.1 `region_styles.py`: Bauvorlagen `tower`, `station_hall`, `terminal`, `control_tower`, `hangar`, `bridge`, `stadium`, `fair_hall`, `airplane`
- [x] 2.2 `region_detail.py`: Handarbeit Roche-Turm Bau 1 und 2, Münster, Rathaus, Spalentor, Vitra-Bauten, Terminal mit Fluggastbrücken
- [x] 2.3 Flugzeuge: zwei Größen, fünf Fantasie-Lackierungen ohne Schrift; Platzierung am Terminal in `region.json`
- [x] 2.4 Vereinfachte Silhouetten-Form je Wahrzeichen (≤ 60 Dreiecke)
- [x] 2.5 `validate.ts`: Grenzen 8000 / 15000 Dreiecke (`large`), Unit-Test der Grenze; alle Modelle bauen, Sichtprüfung per Blender-Render gegen die Fotos

## 3. Laden bei Bedarf

- [x] 3.1 Ausgabe nach `models-remote/` mit `manifest-remote.json` (Hash-Dateinamen); Service Worker und `pwaPlugin` lassen den Ordner aus; E2E-Test „Erstbesuch lädt keine Regionsmodelle“
- [x] 3.2 `ModelRegistry.ensure(id)` über Region-Cache und Paketquelle (Prüfsumme, höchstens zwei Downloads, gesperrt + neuer Versuch); Unit-Tests mit Fake-Netz
- [x] 3.3 `LandmarkLayer`: Vorausladen ab Ring 2, `skipBuildings` je Kachel nur für geladene Modelle, Neuaufbau der Kachel beim Eintreffen; Unit-Tests der Auswahl
- [x] 3.4 E2E-Test offline: Region im Cache, Modell fehlt → generiertes Gebäude steht, keine Lücke

## 4. Fernsicht

- [x] 4.1 `world/far/`: vereinfachte Formen statt Quader für Wahrzeichen, ein Puffer, ≤ 30 Draw Calls; Unit-Test der Gruppierung
- [x] 4.2 E2E-Test: Münster aus 5 km als Form mit zwei Türmen (Silhouette mit `landmarkId`), Draw Calls +≤ 30

## 5. Prüfen und Messen

- [x] 5.1 E2E-Tests: über der Basler Innenstadt stehen Münster, Rathaus, Mittlere Brücke und beide Roche-Türme; kein doppeltes Gebäude; Hubschrauber prallt an Roche-Turm ab; am Landeplatz EuroAirport mindestens fünf Flugzeuge am Terminal
- [x] 5.2 Screenshots Basel, Weil, Lörrach, Müllheim, Flughafen; Desktop-Messung „Heli Basel“ in `docs/perf/README.md`
- [ ] 5.3 iPad-Messung „Heli Basel“ durch dich (Ø ≥ 30 fps, 1-%-Low ≥ 20 fps)
- [ ] 5.4 Commit, Push und Deploy nach Freigabe durch dich
