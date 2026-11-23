# Design

## Context

Heute: ein Spielgebiet um die Gemeinde Kandern (ca. 10 × 10 km, 38 Regionspakete, 32,7 MB), komplett offline vorgeladen über den Welt-Downloader (`offline/worldDownloader.ts`, Cache `kc-world`). Höhen nur aus dem LGL-DGM (UTM 32N, Ursprung bei Kandern), OSM über Overpass in 2×2-km-Teilstücken. Streaming in drei Ringen, Flugmodus mit Höhenregel (`fly/`), Fahrzeuge mit Raycast-Physik (`vehicles/`), Wahrzeichen als Modelle in Ring 0/1 (`world/landmarks/`). Modelle entstehen per Blender-Skript (`tools/asset-pipeline/blender`).

Ziel: Region Müllheim – Lörrach – Basel – EuroAirport (ca. 30 × 35 km) und ein Hubschrauber, mit dem man sie überfliegt. Zielgerät bleibt das iPad Pro 1. Gen (Safari 16, 30 fps, Speicher knapp).

## Goals / Non-Goals

**Goals:**
- Großes Gebiet ohne Umbau des Kachelformats; Kernregion bleibt offline.
- Nahtloses Gelände über drei Länder.
- Hubschrauber, der Spaß macht und das Streaming nicht überholt.
- Messbar 30 fps auch über Basel.

**Non-Goals:**
- Wahrzeichen der neuen Städte, Hochhaus-Modelle von Hand, Flughafen-Terminal als Modell (Change `landmarks-region`); hier nur die Bauvorlagen und Silhouetten.
- Fahrende Züge (Change `trains`) und Flugzeuge (Change `airport-planes`).
- Verkehr auf der Autobahn.
- Laufzeit-Server: Cloudflare liefert nur statische Dateien.

## Decisions

### D1 Gebiet und Koordinaten

- Festes Rechteck in UTM 32N statt Gemeindegrenze: Westen Rhein/EuroAirport (ca. E 388000), Osten Lörrach (E 405500), Süden Basel-Süd (N 5268000), Norden Müllheim (N 5296000). Ursprung bleibt bei Kandern; die Entfernungen bleiben unter 20 km, float32 reicht (Genauigkeit unter 2 mm).
- Kernregion = Gemeinde Kandern + 500 m (wie bisher), alle übrigen Kacheln sind Nachladeregionen. Die Regionspakete bleiben 4 × 4 Kacheln (1 km²); geschätzt ca. 1000 Pakete.
- *Alternative:* zweites Koordinatensystem für Basel – verworfen, weil Kachel-IDs global bleiben sollen.

### D2 Höhendaten aus drei Ländern

- Quellen: LGL DGM1 (DE, Datenlizenz Deutschland – Namensnennung 2.0), swisstopo swissALTI3D 2 m (CH, frei nutzbar mit Quellenangabe, LV95 → UTM 32N umprojizieren), IGN RGE ALTI 5 m (F, Licence Ouverte 2.0, Lambert-93 → UTM 32N). Alle als Höhe über Meer; die Höhenbezüge unterscheiden sich um weniger als 0,5 m und werden nicht korrigiert.
- Zusammenführen auf das 2-m-Raster mit Vorrang nach Land (Landesgrenze aus OSM); in einem 30-m-Streifen an der Grenze wird linear überblendet (Anforderung „Grenze ohne Stufe“).
- Umprojektion mit eigener, getesteter Rechnung in `dgm/proj.ts` (UTM → WGS84, WGS84 → LV95 nach den Näherungsformeln von swisstopo mit ca. 1 m Genauigkeit, WGS84 → Lambert-93 exakt); jeder Punkt des 2-m-Rasters wird ins Quellsystem umgerechnet und dort bilinear abgetastet. Keine native GDAL-Abhängigkeit.
- Download wie bisher fortsetzbar in `data/raw/dgm-ch`, `data/raw/dgm-fr`.

### D3 Neue Inhalte im Kachelformat

- Neue `RoadKind`-Werte (abwärtskompatibel angehängt): `Motorway` gibt es schon; neu `Rail` wird um Gleisanzahl in den Details erweitert, `Runway`, `Taxiway` als Flächen-Arten (`LandKind`), Bahnsteige als Fläche. Ältere Spielstände sind nicht betroffen.
- Hochhausliste je Region in `index.json`-Nebendatei `skyline.json`: Position, Grundriss-Rechteck, Höhe, Farbe. Ab 40 m Höhe, gerundet.
- Kleinobjekt-Dichte in Nachladeregionen halbiert, Parkpositionen nur in Ortskernen.

### D4 Regionen nachladen (statische Dateien bei Cloudflare)

- `index.json` bekommt je Paket ein Feld `remote: true` und die Basis-URL der Nachladeregionen (`remoteBase`, relativ zum Weltordner: `../world-remote/`). Kernpakete liegen wie bisher in `world/`, Nachladeregionen in `world-remote/`.
- Auslieferung mit dem Spiel: Cloudflare baut das Projekt direkt aus GitHub (Workers Static Assets). Die Rohdaten (~2 GB) sind nicht im Git, deshalb werden die fertigen Regionspakete (hashbasierte, unveränderliche Dateinamen, je ~1,5 MB) mit eingecheckt. Kein R2, kein API-Token, kein eigener Upload-Schritt.
- Der Service Worker lädt `world-remote/` nicht vor, und die Dateien zählen nicht zum Offline-Budget (300 MB); der Welt-Downloader lädt nur Kernpakete.
- Spiel: `offline/regionCache.ts` (Cache-API, Name `kc-regions-<buildVersion>`) mit Budget 400 MB, LRU nach letztem Besuch (Zeitstempel in localStorage). `TileManager` fragt Nachladepakete über `offline/packSource.ts` an (Region-Cache oder Netz, Prüfsumme, höchstens zwei Downloads).
- Vorausladen: Pakete auf dem Weg der nächsten 20 s (+ 500 m Rand) werden mit niedriger Priorität angefordert.
- Offline-Rand: Ist ein Paket weder im Cache noch ladbar, gilt es als „gesperrt“ (neuer Versuch nach 30 s). Figur, Fahrzeuge, Flugmodus und Hubschrauber bekommen eine weiche Grenze 60 m davor (abbremsen, zurückschieben) und die UI zeigt den Hinweis.
- *Alternativen:* R2-Bucket mit Upload im Cloudflare-Build – verworfen (Token und Bucket-Verwaltung ohne Nutzen, die Dateien sind ohnehin statisch); alles vorladen – verworfen (500+ MB, Safari löscht große Speicher eher).

### D5 Fernsicht

- Ring 2 reicht heute bis ca. 1,5 km. Für den Flug kommt eine Fernsichtebene dazu: ein globales Gelände-Mesh der Region mit 64 m Raster (vorberechnet als eine Datei `farterrain.bin`, ca. 1 MB, Teil der Kernregion) und Silhouetten aus `skyline.json` als Thin Instances eines Quaders (ein Draw Call). Silhouetten innerhalb geladener Ring-0/1-Kacheln werden ausgeblendet.
- Sichtweite und Nebel werden im Hubschrauber/Flug auf 12 km erhöht, am Boden bleiben sie wie bisher.

### D6 Hubschrauber als Fahrzeug

- Neue `VehicleKind.Helicopter = 3` im Format (nicht auf Parkpositionen). Steht auf Landeplätzen: Landeplätze aus OSM (`aeroway=helipad`) plus feste Liste in `assets/helipads.json` (Kandern Blumenplatz-Nähe, Lörrach, Basel, EuroAirport).
- Flugmodell rein rechnerisch in `vehicles/helicopter/heliMath.ts` (wie `fly/flyMath.ts`): Wunschgeschwindigkeit aus Joystick, Hoch/Runter, exponentielle Annäherung, automatischer Schwebeflug, Neigung = Beschleunigung (max. 18°), Kurvenlage beim Drehen, Höhengrenzen 1–600 m, Tempo nach Höhe (≤ 30 m/s unter 120 m, ≤ 60 m/s darüber, mit Hysterese wie die Detailregel). Bodenkontakt und Landefläche aus Raycast nach unten (eben = Neigung < 12°, kein Dach = Treffer gehört nicht zur Gebäude-Kollision).
- Kollision mit Gebäuden: Kugel-Abfrage vor dem Hubschrauber (Havok `shapeCast`), bei Treffer Geschwindigkeit in Wandrichtung auf 0 und sanft zurückschieben. Kein dynamischer Physikkörper → kann nicht kippen.
- Babylon-Adapter `HelicopterController.ts`: Modell, Rotordrehung (Drehzahl als Zustand, 3 s Anlauf), Kamera (Verfolgerkamera aus `CameraRig` mit größerem Abstand, Rückschwenk nach 2 s), Streaming-Fokus wie im Flugmodus (`FlyFocus`).
- Spielfigur: beim Einsteigen ausgeblendet wie im Auto; Aussteigen nur bei Bodenabstand ≤ 1 m, an der Seite mit freiem Platz (`landing.ts` aus dem Flugmodus wiederverwenden).

### D7 Hubschrauber-Modell in Blender

- Skript `tools/asset-pipeline/blender/helicopter.py` mit eigenem Baukasten: Rumpf aus Profil-Loft (Querschnitte entlang der Länge, Bevel), verglaste Kabine als eigener Körper, Kufen aus Rohren mit Biegung, Heckausleger konisch, Seitenleitwerk, Hauptrotor mit 4 Blättern und Rotorkopf als eigener Knoten `rotor-main`, Heckrotor `rotor-tail`, Positionslichter (rot/grün/weiß), Türen als `detach_*`. Lackzone `paint` mit zweiter Zone `stripe` (Zierstreifen).
- Budget ≤ 6.000 Dreiecke (höher als Autos, weil Hauptfahrzeug und oft nah im Bild), ≤ 4 Materialien. Varianten nur durch zivile Lackfarben (Rot, Blau, Weiß, Gelb), keine Polizei- oder Rettungsbeschriftung.
- Landeplatz-Prop `helipad`: runde Betonplatte mit H-Markierung und Randlichtern.

### D8 Modulstruktur

- `tools/world-pipeline/src/region/` – `area.ts` (Rechteck, Kern/Remote-Einteilung, Tests).
- `tools/world-pipeline/src/dgm/` – `swiss.ts`, `france.ts` (Download, Lesen), `lv95.ts`, `lambert93.ts` (Umrechnung + Tests), `merge.ts` (Vorrang und Überblendung + Tests); bisheriges `dgm.ts` wandert als `lgl.ts` hierher.
- `tools/world-pipeline/src/skyline.ts` (+ test).
- `apps/game/src/offline/regionCache.ts` (+ test), `offline/packSource.ts` (+ test).
- `apps/game/src/world/far/` – `farTerrain.ts`, `skyline.ts`, `FarLayer.ts`.
- `apps/game/src/world/tiles/blockedRegions.ts` (+ test) für den Offline-Rand.
- `apps/game/src/vehicles/helicopter/` – `heliMath.ts`, `heliLanding.ts` (+ tests), `HelicopterController.ts`, `helipads.ts`.
- `apps/game/src/ui/controls/HeliControls.tsx`.
- `World.ts` steht bei 297 Zeilen: vor Erweiterungen wird der Aufbau der Layer und Systeme in `world/worldSetup.ts` ausgelagert.

## Risks / Trade-offs

- **[Datenmenge Basel]** → Budget je Paket 25 MB; bei Überschreitung zuerst Kleinobjekte und Vegetation ausdünnen, dann Gebäude unter 20 m² weglassen. `check` meldet die größten Pakete.
- **[iPad-Leistung über Basel]** → Hochhäuser in Ring 1 als einfache Blöcke, Fernsicht als Thin Instances, Qualitätsstufe „Niedrig“ reduziert Ring-1-Radius; früh messen (Aufgabe 6.1) und bei Verfehlen Ring 1 im Flug verkleinern.
- **[Langsames Netz]** → Tempo über 120 m begrenzt; zusätzlich drosselt der Hubschrauber automatisch, wenn die Pakete in Flugrichtung noch fehlen (weicher Rand wie offline).
- **[Lizenzen CH/F]** → swissALTI3D und RGE ALTI sind frei mit Namensnennung; Prüfung und Eintrag in `attribution.json` als eigene Aufgabe, Abbruch, falls sich die Bedingungen geändert haben.
- **[Safari-Speicher]** → Gesamtziel < 700 MB; bei `QuotaExceededError` verkleinert sich das Region-Budget automatisch und die älteste Region fliegt raus.
- **[Größe Git und Deploy]** → Nachladeregionen ~211 MB eingecheckt (Dateien je ~1,5 MB, unter den Grenzen von GitHub und Workers Static Assets: 25 MiB je Datei, 20 000 Dateien); alte Stände fallen beim Neubau weg.

## Migration Plan

1. Pipeline baut zuerst nur das neue Gebiet ohne Remote-Trennung (lokal testen).
2. Remote-Trennung und `publish` in einen Test-Bucket, Spiel mit `?remoteBase=` gegen den Test-Bucket.
3. Nach Abnahme Upload in den Produktions-Bucket, dann App-Deployment (der alte App-Stand kennt keine Remote-Pakete und bleibt in seinem Gebiet funktionsfähig).
Rücknahme: altes `index.json` ohne Remote-Pakete ausliefern.

## Open Questions

- Ob der EuroAirport-Landeplatz auf dem Vorfeld oder neben dem Terminal liegen soll – Annahme: neben dem Terminal auf der Schweizer Seite.
