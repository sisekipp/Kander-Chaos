# Design

## Context

Heute gibt es 48 Wahrzeichen rund um Kandern:
- **Liste:** `tools/world-pipeline/src/landmarks/` wählt sie aus (Overrides und Extras aus `assets/landmarks/`) und schreibt `landmarks.json`.
- **Modelle:** `tools/asset-pipeline/blender/landmarks.py` baut sie aus `footprints.json` nach Bauvorlagen (`landmark_styles.py`) oder als Handarbeit.
- **Laden im Spiel:** `ModelRegistry` lädt beim Start alle Modelle aus `models/manifest.json`; sie gehören zum Offline-Kern.
- **Anzeige:** `LandmarkLayer` stellt das Modell in Ring 0/1 auf. Die Kachel-Worker lassen das generierte Gebäude über `skipBuildings` weg (Liste beim Start fest).
- **Fernsicht:** zeigt Gebäude ab 40 m aus `skyline.json` als Quader (`world/far/`).
- **Nachladen:** Regionspakete kommen über `offline/packSource.ts` mit dem Region-Cache (400 MB).

## Goals / Non-Goals

**Goals**
- Rund 30 erkennbare Wahrzeichen in Basel, Weil am Rhein, Lörrach, Müllheim und am EuroAirport, dazu fünf geparkte Flugzeuge.
- Modelle der Region erst bei Bedarf laden; Offline-Kern und Startzeit bleiben gleich.
- Silhouetten der Wahrzeichen in der Fernsicht mit vereinfachter Form.
- iPad Pro 1. Gen: über Basel weiter Ø ≥ 30 fps.

**Non-Goals**
- Fahrende Züge, startende und landende Flugzeuge: eigene Changes `trains` und `airport-planes`.
- Innenräume, begehbare Gebäude.
- Alle 1612 Wahrzeichen-Kandidaten aus OSM. Nur die Liste unten; der Rest bleibt generiert.

## Decisions

### D1 Liste der Wahrzeichen der Region

Neue Datei `assets/landmarks/region.json`. Je Eintrag:
- `id`, `name`
- `osm` (Way- oder Relation-ID) oder `lat`/`lon` mit `heading` bei freien Bauten
- `style` (Bauvorlage) oder `detail` (Handarbeit)
- `height` (bekannte Höhe als Sollwert)

Die Welt-Pipeline liest sie zusätzlich zur bestehenden Kandern-Liste. Treffer auf OSM-Gebäude laufen über die vorhandene Auswahl, freie Bauten über die Extras.

Erste Liste (Höhen aus öffentlichen Quellen, beim Bau mit Fotos abgleichen):

| Ort | Wahrzeichen | Art |
| --- | --- | --- |
| Basel | Roche-Turm Bau 1 (178 m), Bau 2 (205 m) | Handarbeit Hochhaus |
| Basel | Messeturm (105 m), BIZ-Turm, Claraturm | Vorlage Hochhaus |
| Basel | Münster, Rathaus, Spalentor | Handarbeit |
| Basel | Mittlere Brücke | Vorlage Brücke (frei, Koordinate) |
| Basel | Bahnhof SBB, Badischer Bahnhof | Vorlage Bahnhofshalle + Handarbeit Fassade |
| Basel | Messe mit Halle 1 (Ring), St. Jakob-Park | Vorlage Messehalle / Stadion |
| Weil am Rhein | Vitra-Feuerwehrhaus, Dachpavillon, Rutschturm | Handarbeit (klein) |
| Weil am Rhein | Dreiländerbrücke | Vorlage Brücke (frei) |
| Lörrach | Burg Rötteln, Rathaus-Hochhaus, Bahnhof | Vorlage Ruine / Hochhaus / Bahnhof |
| Müllheim | Martinskirche, Bahnhof | Vorlage Kirche / Bahnhof |
| EuroAirport | Terminal mit Fluggastbrücken, Tower, 2 Hangars | Handarbeit Terminal, Vorlage Tower/Hangar |
| EuroAirport | 5 Flugzeuge (3 Mittelstrecke, 2 Regional) | Vorlage Flugzeug (frei) |

### D2 Neue Bauvorlagen in Blender

`landmark_styles.py` wächst über 300 Zeilen. Deshalb kommen die neuen Vorlagen in ein eigenes Modul `region_styles.py`:

- `tower`: Hochhaus mit Stufen, Glasfassade und Kern
- `station_hall`: Bahnhofshalle mit Gleisdach
- `terminal`, `control_tower`, `hangar`
- `bridge`: Brücke mit Bögen
- `stadium`, `fair_hall`
- `airplane`: Flugzeug in Fantasie-Lackierung, ohne Schrift

Handarbeit für Münster, Roche-Türme, Rathaus, Spalentor, Vitra-Bauten und Terminal kommt in `region_detail.py`.

Weitere Regeln:
- Fotos werden vorher gesucht, wie bei Kandern.
- Keine Logos oder Schrift.
- Farben als Vertex-Farben.

### D3 Grenzen in der Asset-Pipeline

- `validate.ts` bekommt `LANDMARK_TRIANGLES = 8000` und `LANDMARK_LARGE_TRIANGLES = 15000` für Rezepte mit `large: true` (Hochhäuser, Terminal).
- Überschreitung führt zum Abbruch (Spec „Dreiecksgrenze“).

### D4 Modelle der Region bei Bedarf laden

- **Ablage:**
  - Regionsmodelle landen in `apps/game/public/models-remote/` mit eigenem `manifest-remote.json`.
  - Dateinamen tragen den Inhalts-Hash.
  - Der Service Worker lädt den Ordner nicht vor (wie `world-remote/`), und `pwaPlugin` lässt ihn aus dem Budget.
- **`ModelRegistry`:**
  - lädt beim Start nur das Kern-Manifest
  - neu: `ensure(id): Promise<boolean>` lädt ein Regionsmodell
  - Die Bytes kommen über dieselbe Quelle wie die Regionspakete (Region-Cache, Prüfsumme, höchstens zwei Downloads).
  - Fehler lassen das Modell als „nicht verfügbar“ zurück; nach 30 s gibt es einen neuen Versuch.
- **Vorausladen:** Nähert sich der Spieler einer Kachel mit Regions-Wahrzeichen (Ring 2 erreicht), fordert der `LandmarkLayer` das Modell an.
- **Generiertes Gebäude nur weglassen, wenn das Modell da ist:**
  - Die Worker-Anfrage bekommt `skipBuildings` künftig je Kachel aus den bereits geladenen Modellen statt einer festen Liste.
  - Wird ein Modell fertig, solange seine Kachel in Ring 0/1 ist, baut der `TileManager` diese Kachel neu: Gebäude ohne den Block, dann das Modell.
  - Ohne Netz bleibt das generierte Gebäude (Spec „Offline ohne Modell“).
- *Alternative:* alle Modelle in den Kern. Verworfen: Startzeit und Offline-Budget wachsen für Gegenden, die viele nie besuchen.

### D5 Silhouetten der Wahrzeichen

- Die Asset-Pipeline schreibt je Wahrzeichen zusätzlich eine stark vereinfachte Form (≤ 60 Dreiecke): Hülle aus den größten Bauteilen, als Teil von `manifest-remote.json` / Kern-Manifest (`silhouette`).
- `skyline.json` bekommt für Wahrzeichen die `landmarkId`; die Fernsicht nimmt dann die vereinfachte Form statt des Quaders.
- Alle Formen kommen in einen gemeinsamen Mesh-Puffer; je Form gibt es eine Thin-Instance-Gruppe. Bei etwa 30 Formen sind das ≤ 30 Draw Calls. Die Silhouetten-Formen sind klein (zusammen < 100 kB) und gehören zum Kern, damit die Fernsicht offline funktioniert.

### D6 Kollision

Die Kollision läuft wie bei den bestehenden Wahrzeichen:
- Kollisionsboxen aus dem Modell (`collider_*`-Knoten bzw. Bounding-Boxen der Bauteile)
- Hochhäuser: Box je Stufe
- Brücken: Fahrbahndeck plus Pfeiler

Die vorhandene Hubschrauber-Kollision (Wandtreffer) greift damit automatisch.

## Risks / Trade-offs

- **Dreiecke über Basel:** Viele große Modelle gleichzeitig in Ring 0/1. Gegenmaßnahmen:
  - Ring 1 zeigt die vereinfachte Form statt des vollen Modells.
  - Messroute „Heli Basel“ auf dem iPad prüfen.
- **Neuaufbau von Kacheln beim Eintreffen eines Modells:** Das ist ein kurzer Ruckler. Er bleibt gering, weil das Modell schon ab Ring 2 vorausgeladen wird und der Neuaufbau über die Upload-Warteschlange läuft.
- **Erkennbarkeit ohne Logos:** Bahnhöfe und das Terminal leben von Schriftzügen. Ausgleich über markante Formen (Uhrturm SBB, Halle des Badischen Bahnhofs) und Farben.
- **Genauigkeit der Höhen:** OSM-Höhen fehlen teils; Sollwerte stehen in `region.json` und werden geprüft.

## Open Questions

- **Mittlere Brücke und Dreiländerbrücke:** Sollen sie die OSM-Brückengeometrie ersetzen oder darüberliegen? Vorschlag: Das Modell ersetzt nur die Optik, Fahrbahn und Kollision bleiben aus den Kacheldaten.
- **Anzahl der Flugzeuge:** fünf, oder an jeder Fluggastbrücke eines? Annahme für diesen Change: fünf.
