# Proposal: Kandern Chaos – Grundlagen

## Why

**Kandern Chaos** ist ein kindgerechtes Open-World-Spiel für 8- bis 12-Jährige. Es spielt in der ganzen Gemeinde Kandern (Baden-Württemberg) mit echter Geografie. Bevor Fahrzeuge, NPCs, Spaßwaffen oder Aufgaben entstehen, muss das technische Fundament stehen und auf dem schwächsten Zielgerät (iPad Pro, 1. Generation, Safari 16) nachgewiesen sein: eine offline lauffähige Web-App, eine Daten-Pipeline aus echten Geodaten und eine gestreamte Welt.

### Produktvision (Leitplanken für alle Folge-Changes)

- **Welt:** die ganze Gemeinde Kandern mit Ortsteilen (u. a. Wollbach, Holzen, Riedlingen, Tannenkirch, Sitzenkirch, Feuerbach), mit Straßen, Gebäuden, Wäldern, Wiesen und Tieren.
- **Stil:** stilisiert mit echter Geometrie. Grundrisse, Höhen, Dachformen und Gelände sind echt, die Oberflächen warm und leicht comicartig. Ausgewählte Wahrzeichen werden von Hand modelliert.
- **Spielprinzip:** Sandkasten mit leichten Aufgaben, Rennen, Sammelaufgaben und Chaos-Challenges. Belohnungen sind Fahrzeuge, Spaßwaffen und Lackierungen.
- **Gewaltfreiheit:** Es gibt nur Spaßwaffen (Eierkanone, Konfettikanone usw.). Menschen können nicht sterben: Sie fallen um, sind kurz benommen und stehen wieder auf.
- **Physik:** Kleine Objekte (Büsche, Mülleimer, Zäune, Schilder) lassen sich umfahren und zerstören, Fahrzeuge lassen sich beschädigen und zerstören.
- **Fortbewegung:** zu Fuß, Auto, Fahrrad, Motorrad. Ausgewählte Gebäude sind begehbar.
- **Plattform:** Browser, ausgeliefert über Cloudflare, nach dem ersten Laden komplett offline spielbar. Zielgerät: iPad Pro 1. Gen mit 30 fps und Touch-Steuerung.

## What Changes

- Projekt-Setup: Babylon.js, React-UI, Vite+ als Toolchain, TypeScript.
- Offline-Auslieferung als PWA über Cloudflare: Service Worker, vollständiges Vorladen aller Spieldaten, Installation auf dem Home-Bildschirm, lokale Spielstände.
- Build-Pipeline für Geodaten: OpenStreetMap (Straßen, Gebäude, Landnutzung, Gewässer) und das Geländemodell des LGL Baden-Württemberg werden in kompakte Kachel-Dateien für die ganze Gemeinde umgewandelt.
- Welt-Streaming: Kacheln werden abhängig von der Spielerposition in Detailstufen geladen und entladen. Gebäude-Meshes entstehen zur Laufzeit in einem Web Worker.
- Ein spielbarer Minimal-Ausschnitt (Kernstadt Kandern), in dem sich eine Spielfigur oder Kamera bewegen lässt, um Streaming und Performance zu prüfen.
- Machbarkeits-Spike auf dem Zielgerät: Havok-Physik in Safari 16, Erzeugungszeit einer Kernstadt-Kachel, Bildrate und Speicherverbrauch.

**Nicht in diesem Change:** Fahrzeuge, NPCs, Tiere, Spaßwaffen, Zerstörung, Innenräume, Aufgaben und Belohnungen. Sie folgen als eigene Changes.

## Capabilities

### New Capabilities

- `offline-delivery`: Auslieferung über Cloudflare als installierbare PWA, vollständiges Vorladen, Offline-Start, Updates, Speicher-Budget und lokale Spielstände inklusive Export.
- `world-data-pipeline`: Umwandlung von OSM- und DGM-Daten in versionierte Kachel-Dateien für die Gemeinde Kandern, mit Quellenangabe und Lizenzhinweisen.
- `world-streaming`: Laden, Detailstufen und Entladen von Weltkacheln um den Spieler herum sowie die prozedurale Erzeugung von Gelände, Straßen, Gebäuden und Vegetation im stilisierten Look.
- `performance-budget`: Verbindliche Leistungsziele für das iPad Pro 1. Gen (Bildrate, Speicher, Ladezeiten pro Kachel, Auflösungsskalierung) und wie sie gemessen werden.

### Modified Capabilities

_Keine – es existieren noch keine Specs._

## Impact

- **Neues Repository-Layout:** App (React + Babylon.js), Web-Worker-Code und ein separates Pipeline-Tool (Node) für Geodaten.
- **Abhängigkeiten:** Babylon.js (Core, Loaders, voraussichtlich Havok), React, Vite+, Service-Worker-Tooling, Werkzeuge für Geodaten (OSM-Parsing, Höhenraster) und KTX2-Texturkompression.
- **Externe Daten und Lizenzen:** OSM (ODbL, Namensnennung im Spiel nötig), LGL-BW-Geodaten (Datenlizenz Deutschland, Namensnennung).
- **Infrastruktur:** Cloudflare (Pages bzw. Workers Static Assets), ohne Server-Logik zur Laufzeit.
- **Risiko:** Ist Havok oder die Kachel-Erzeugung auf dem A9X zu langsam, ändern sich Physik-Wahl, Kachelgröße oder Sichtweite. Der Spike entscheidet das, bevor Folge-Changes darauf aufbauen.
