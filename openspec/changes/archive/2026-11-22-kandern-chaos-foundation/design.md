# Design: Kandern Chaos – Grundlagen

## Context

Das Projekt beginnt bei null; es gibt noch keinen Code. Motivation und Umfang stehen in `proposal.md`, die verbindlichen Anforderungen in den Specs `offline-delivery`, `world-data-pipeline`, `world-streaming` und `performance-budget`.

Folgende Rahmenbedingungen bestimmen fast jede Entscheidung:

- **Zielgerät** iPad Pro 1. Gen mit Safari 16: WebGL2, kein WebGPU, ca. 1–1,5 GB nutzbarer Speicher pro Tab, schwache CPU (A9X).
- **Komplett offline** nach dem ersten Laden. Es darf nichts zur Laufzeit von CDNs nachgeladen werden, auch keine WASM-Dateien von Babylon (Havok, KTX2-Transcoder, Draco).
- **Welt** etwa 12 × 9 km, davon 80–90 % Wald und Feld; Kosten entstehen vor allem in den Siedlungskernen.
- **Cloudflare Workers Static Assets** als Hosting: Einzeldateien höchstens 25 MiB, begrenzte Dateianzahl. Deshalb werden die Kacheln in Paketen ausgeliefert, nicht als tausende Einzeldateien.

## Goals / Non-Goals

**Goals:**
- Eine Architektur, auf der Fahrzeuge, NPCs, Zerstörung und Innenräume später aufsetzen, ohne Streaming oder Datenformat umzubauen.
- Früh am echten Gerät messen (Spike), bevor viel Inhalt entsteht.
- Datenformat und Laufzeit-Erzeugung so trennen, dass sich der Look ändern lässt, ohne die Pipeline neu zu bauen, und umgekehrt.

**Non-Goals:**
- Kein endgültiges Art-Design. Fassaden-Atlas und Farbpalette sind Platzhalter in Zielqualität "gut genug zum Messen".
- Keine handmodellierten Wahrzeichen in diesem Change.
- Kein Gamepad-Support und keine finale Touch-Steuerung (nur Testmodus).
- Kein Audio.

## Decisions

### D1 Repository-Struktur: Monorepo mit Vite+

```
/
+-- apps/game/            React-UI + Babylon.js, Service Worker, Web Worker
+-- tools/world-pipeline/ Node-CLI: OSM + DGM -> Kachelpakete
+-- packages/world-format/ gemeinsame Typen + (De-)Serialisierung des Kachelformats
+-- data/raw/             heruntergeladene Quelldaten (nicht im Git)
+-- docs/perf/            Messprotokolle vom Referenzgerät
```

Vite+ (`vp`) dient als einheitliche Toolchain für Dev-Server, Build, Tests (Vitest), Lint und den Task-Runner im Monorepo. `world-format` wird von Pipeline **und** Spiel benutzt, damit Schreiber und Leser nie auseinanderlaufen.
*Alternative:* getrennte Repos. Verworfen, weil das Kachelformat sich in Phase 0 häufig ändert.

### D2 Babylon.js 8 mit WebGL2-Engine, React nur als Overlay

Babylon läuft auf einem eigenen `<canvas>`, und die Render-Schleife bleibt außerhalb von React. React rendert Menüs, HUD und Touch-Steuerung als DOM-Overlay. Die Kommunikation läuft über einen kleinen Store (z. B. Zustand): Die Engine schreibt Werte gedrosselt (ca. 4 Hz für die Leistungsanzeige), und die UI sendet Befehle. Pro Bild gibt es kein React-Rendering.
*Alternative:* Babylon GUI für alles. Verworfen, weil Menüs, Formulare und der Datei-Import in React einfacher und barrierefreier sind. Babylon GUI bleibt für Dinge im 3D-Raum (z. B. Namen über NPCs) in späteren Changes.

### D3 Koordinaten: UTM 32N mit lokalem Ursprung

Quelldaten (LGL) liegen in ETRS89/UTM 32N (EPSG:25832) vor, OSM wird dorthin projiziert. Die Pipeline zieht einen festen Ursprung nahe der Kernstadt ab, sodass Spielkoordinaten in Metern um (0,0) liegen. So reicht die float32-Genauigkeit der GPU überall in der Gemeinde (max. ca. 7 km vom Ursprung). Kachelindex = `floor(x / 250), floor(z / 250)`.

### D4 Kachelformat: eigenes Binärformat, regional gepackt

Pro Kachel ein binärer Block mit Abschnitten: Höhenraster (mehrere LOD, `Uint16` mit Offset/Skalierung), Gebäude (Grundriss-Polygone, Höhe, Dachform, Typ, stabile ID), Straßennetz (Polylinien, Typ, Breite, Knoten-IDs über Kachelgrenzen), Landnutzung (Polygone mit Typ). Die Blöcke werden zu **Regionspaketen** von ca. 2 × 2 km gebündelt (jeweils < 20 MiB), gzip-komprimiert, mit Index-Datei (`world/index.json`: Version, Datum, Paketliste, Kachel → Paket/Offset, Hashes).

Die Dekomprimierung läuft im Web Worker (`DecompressionStream`, Fallback `fflate`). Pakete liegen **komprimiert** im Cache Storage, damit das Speicher-Budget eingehalten wird.
*Alternativen:* glTF pro Kachel (verworfen: fertige Meshes sind 10–20× größer und schwer stilistisch zu ändern); FlatBuffers/Protobuf (möglich, aber für Phase 0 Overkill, und Typed Arrays sind direkt transferierbar).

### D5 Pipeline: Node + TypeScript, Quelldaten lokal gecacht

> **Angepasst bei der Umsetzung:** Der Geofabrik-Teilextrakt „Regierungsbezirk Freiburg“ existiert nicht mehr, und eine einzelne große Overpass-Abfrage scheitert am Zeitlimit (HTTP 502/504). OSM wird deshalb per Overpass in ca. 2 × 2 km großen Teilstücken geladen, einzeln zwischengespeichert (fortsetzbar), dedupliziert und stabil sortiert zusammengeführt. `osmium` wird nicht gebraucht. DGM1-Kacheln kommen als 2-km-ZIPs mit 1-m-XYZ von `opengeodata.lgl-bw.de`.

- **OSM:** Ein Geofabrik-Extrakt (Regierungsbezirk Freiburg) wird heruntergeladen und mit `osmium` auf Gemeindegrenze + 500 m geschnitten, danach mit einem PBF/GeoJSON-Parser in Node gelesen.
- **DGM:** DGM1-Kacheln des LGL (GeoTIFF/XYZ) werden mit `geotiff.js` gelesen und auf 2 m resampelt; gröbere LODs entstehen durch Downsampling.
- **Ergänzungsregeln** für fehlende Stockwerke und Dachformen stehen in einer Tabelle im Code; deterministischer Zufall wird aus der OSM-ID abgeleitet.
- **Determinismus:** stabile Sortierung nach ID, kein `Date.now()` in Ausgaben, Quell-Datum kommt aus den Metadaten. Ein Test vergleicht Hashes zweier Läufe.
- **Ausgabe:** Pakete + `index.json` + `attribution.json` nach `apps/game/public/world/`.

### D6 Offline-Auslieferung: App-Shell per Service Worker, Welt per Downloader

```
  Service Worker (precache)              Welt-Downloader (App-Code)
  -------------------------              --------------------------
  index.html, JS/CSS-Bundles             liest world/index.json
  WASM: Havok, KTX2-Transcoder           lädt Paket für Paket
  Texturatlas, Modelle, Icons            prüft Hash, legt in Cache "world-vN"
  (klein, atomar, versioniert)           Fortschritt -> React-UI
                                         fehlt ein Paket: beim nächsten Online-Start weiter
```

Der Service Worker cached die App-Shell atomar (Workbox bzw. `vite-plugin-pwa` im injectManifest-Modus). Die ca. 100–200 MB Welt lädt **nicht** der SW-Install-Schritt: In Safari scheitert eine große atomare Installation leicht komplett. Stattdessen lädt ein eigener Downloader die Pakete einzeln, fortsetzbar und mit Hash-Prüfung (Spec: Unterbrochener Download). Der SW beantwortet danach alle Anfragen aus den Caches.

Updates: Eine neue Version bringt eine neue `index.json`, und nur Pakete mit geändertem Hash werden geladen. Aktiviert wird nach Bestätigung (`skipWaiting` erst auf Nutzer-Klick) oder beim nächsten Start.

Babylon-Pfade für Havok-WASM und den KTX2-Transcoder werden explizit auf lokale Dateien gesetzt. Ein Offline-Test (D11) stellt sicher, dass keine Anfrage an fremde Hosts geht.

Zusätzlich fordert die App `navigator.storage.persist()` an, wo verfügbar, und zeigt die Belegung über `navigator.storage.estimate()` an. Ein Build-Schritt summiert alle vorzuladenden Dateien und bricht über 300 MB ab.

### D7 Spielstände: IndexedDB + JSON-Export

Spielstände sind JSON mit `schemaVersion`, gespeichert in IndexedDB (z. B. über `idb-keyval`). Gespeichert wird automatisch alle 30 s, bei `visibilitychange` → hidden und bei `pagehide`. Der Export ist ein Download als `kandern-chaos-spielstand.json`. Der Import erfolgt über `<input type=file>` mit Schema-Validierung; erst nach erfolgreicher Prüfung wird ersetzt. Migrationen laufen über `schemaVersion`.

### D8 Laufzeit-Erzeugung im Web Worker

Ein Worker-Pool (1–2 Worker; der A9X hat 3 Kerne) erzeugt aus einem Kachelblock reine Typed Arrays (Positionen, Normalen, UVs, Vertex-Farben, Indizes) und schickt sie als Transferables zurück:

- **Gelände:** reguläres Gitter je LOD mit **Schürzen** (Skirts) an den Rändern gegen Risse zwischen Kacheln und LODs. Das ist einfacher und robuster als Kanten-Stitching.
- **Gebäude:** Grundriss extrudieren. Dächer: Flachdach per Triangulierung (`earcut`); Sattel- und Walmdach über das orientierte umschließende Rechteck bei annähernd rechteckigen Grundrissen; komplexe Grundrisse fallen auf Flach- oder Zeltdach zurück. Fassadenfarbe und -muster deterministisch aus Gebäude-ID + Typ. Ambient Occlusion (Bodennähe, Traufkante) wird in die Vertex-Farben gebacken.
- **Straßen:** Bänder entlang der Polylinien, Höhen vom Gelände abgetastet, minimal angehoben plus Depth-Bias gegen Z-Fighting.
- **Vegetation:** Baumpositionen per deterministischem Poisson-Disk-Sampling in Waldpolygonen, als Matrizen für Thin Instances.

Der Hauptthread erzeugt je Kachel und Material **ein** Mesh (zusammengeführt), friert Weltmatrizen und Materialien ein und hängt die Kachel zeitlich gestückelt ein (max. ca. 4 ms Upload-Budget pro Bild). Damit wird die 100-ms-Grenze der Spec eingehalten.
*Alternative:* Erzeugung im Hauptthread mit Time-Slicing. Verworfen, weil die CPU-Last auf dem A9X Bildeinbrüche verursacht.

### D9 Streaming-Manager

```
   Ring 0 (3x3)   volle Details, Kollision, später NPCs/Physik-Props
   Ring 1 (5x5)   Gelände LOD1, Gebäude als einfache Blöcke ohne Dach-Details,
                  Bäume als Thin Instances (Low-Poly)
   Ring 2 (bis ca. 1,5 km)  Gelände LOD2, Wald als Silhouetten-Karten
   dahinter       Nebel + statisches Hügel-Panorama (Skybox-Band)
```

Die Priorität einer Kachel ergibt sich aus Entfernung, gewichtet mit der Bewegungsrichtung (Skalarprodukt aus Geschwindigkeit und Richtung zur Kachel). Die Zahl geladener Kacheln hat eine harte Obergrenze. Entladen heißt: Meshes, Thin-Instance-Puffer und Physik-Shapes per `dispose()` freigeben. Eine Hysterese von ca. 30 m an den Grenzen verhindert Hin-und-Her-Laden.

### D10 Physik: Havok mit Absicherung durch den Spike

Havok (`@babylonjs/havok`, Physics V2) ist erste Wahl. Gelände wird als Heightfield-Shape pro Ring-0-Kachel abgebildet, Gebäude als statische Box- bzw. Convex-Hull-Shapes, die Spielfigur über den `PhysicsCharacterController`. Solange die Kollision der aktuellen Kachel nicht bereit ist, wird die Spielfigur eingefroren (Spec: Kachelwechsel).

Der Spike misst auf dem Referenzgerät: WASM-Start, 50 dynamische Körper plus eine Detailkachel. Verfehlt Havok die Ziele, ist der Fallback ein schlanker eigener kinematischer Controller (Raycast auf das Höhenraster plus Gebäude-AABBs) für die Spielfigur und eine leichtere Physik-Engine für Props. Die Entscheidung wird in `docs/perf/` festgehalten.

### D11 Rendering-Budget und Qualitätsstufen

- `hardwareScalingLevel` dynamisch: Start auf "Niedrig" bei ca. 0,55-facher Auflösung, adaptive Absenkung in Stufen bei < 28 fps über 3 s, Untergrenze ca. 0,4. Das UI liegt im DOM und bleibt deshalb scharf.
- **Niedrig:** keine Echtzeitschatten (Blob-Schatten unter der Figur), Nebel ab ca. 600 m, kein Post-Processing, kein MSAA.
- **Hoch:** eine Schatten-Cascade nahe dem Spieler, FXAA, weitere Sichtweite.
- **Erkennung des Referenzgeräts:** iPad mit A9X ist nicht direkt erkennbar. Heuristik: WebGL-Renderer-String, `hardwareConcurrency`, Bildschirmgröße plus eine kurze Benchmark-Messung beim ersten Start; Standard ist "Niedrig", wenn unsicher.
- **Texturen:** ~~ein Fassaden-Atlas 2048² als KTX2~~ **Angepasst:** Fassaden (Fenster, Fachwerk, Latten, Glasbänder, Ziegel) entstehen prozedural im Fragment-Shader eines einzigen Gebäudematerials aus uv (Meter) und Fassadentyp. 0 Byte Texturdaten, kein KTX2-Transcoder nötig, beliebig skalierbar. Ring-1-Gebäude nutzen dasselbe Material ohne Detailmuster.
- **Szene:** `scene.skipPointerMovePicking`, eingefrorene aktive Meshes je Kachel, keine Picking-Abfragen im Spiel-Loop.

### D12 Test- und Messstrategie

- **Unit-Tests (Vitest):** Kachelformat Round-Trip, Ergänzungsregeln, Dach-Generator, Determinismus (Hashvergleich).
- **Pipeline-Prüfungen:** Größenbudget, Abdeckung der Ortsteile, Straßen-Konnektivität Kernstadt → Tannenkirch (Graphsuche).
- **E2E (Playwright mit WebKit):** erster Ladevorgang, danach Netzwerk aus → Neustart → Welt erscheint; Assertion "keine Anfragen an fremde Hosts"; Export/Import des Spielstands.
- **Referenzgerät (manuell, protokolliert):** festgelegte Testroute im Testmodus mit automatischer Bewegung; Bildrate und Perzentile protokolliert die App selbst und exportiert sie als JSON. Den Speicher misst die Safari Web Inspector Timeline per Remote-Debugging am Mac. Ergebnisse kommen in `docs/perf/<datum>.md`.

## Risks / Trade-offs

- **[Havok in Safari 16 zu langsam oder instabil]** → Spike als erste Aufgabe; Fallback nach D10; Folge-Changes zur Physik starten erst nach dokumentiertem Ergebnis.
- **[Safari löscht Website-Daten]** (bei Nichtnutzung bzw. Speicherdruck) → Spielstand-Export, `storage.persist()`, beim Start Integritätsprüfung der Welt-Caches mit automatischem Nachladen, sobald online.
- **[300-MB-Budget reicht nicht]** → Gebäude prozedural statt als Meshes, Pakete komprimiert im Cache, Budget-Prüfung im Build bricht früh ab.
- **[Kachel-Erzeugung > 3 s in der Altstadt]** → Kachelgröße für die Kernstadt verkleinerbar (Format unterstützt variable Kantenlänge pro Region), alternativ Gebäude der dichtesten Kacheln in der Pipeline vortriangulieren.
- **[Speicherspitzen beim Erzeugen]** → Worker-Pool klein halten, Typed Arrays transferieren statt kopieren, harte Kachel-Obergrenze.
- **[OSM-Datenlücken]** (fehlende Gebäude oder Dachformen in Ortsteilen) → Ergänzungsregeln; Lücken werden für eine spätere manuelle Pflege (ggf. Beiträge zu OSM) protokolliert.
- **[Lizenzen]** → Namensnennung für ODbL und Datenlizenz Deutschland aus `attribution.json` im Spiel; die ODbL-Share-Alike-Pflicht betrifft abgeleitete Datenbanken. Die Kachelpakete gelten als solche und werden auf Nachfrage unter ODbL bereitgestellt (Hinweis auf der Quellenseite).
- **[Gerätezugang]** → Messungen auf dem Referenzgerät brauchen ein physisches iPad Pro 1. Gen. Ohne Gerät gelten Performance-Ziele als nicht nachgewiesen.

## Migration Plan

Neues Projekt, keine Migration. Auslieferung: Ein Build erzeugt `apps/game/dist` inklusive `world/`; das Deployment läuft per Wrangler auf Cloudflare Workers Static Assets. Ein Rollback ist ein erneutes Deployment der vorherigen Version. Clients behalten bis zur Bestätigung die alte Version (D6), deshalb ist ein Rollback für bereits installierte Geräte ebenfalls ein normales Update.

## Open Questions

- Genaue Kachelgröße (250 m Standard) und Ring-Radien werden nach den ersten Spike-Messungen feinjustiert. Das ändert weder Specs noch Aufgaben.
- Liste der handmodellierten Wahrzeichen (Rathaus, Kirche, Kandertalbahn-Bahnhof, …) gehört in einen späteren Change.
