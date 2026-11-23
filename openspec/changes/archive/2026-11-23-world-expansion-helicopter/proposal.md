# Proposal

## Why

Die Welt endet heute 500 m hinter der Gemeindegrenze von Kandern. Kinder wollen mit dem Hubschrauber über die Region fliegen: nach Basel mit den Hochhäusern, zum Flughafen, nach Lörrach, Weil am Rhein und Müllheim. Dafür braucht es ein deutlich größeres Gebiet, das nicht mehr komplett auf das iPad passt, und ein Fluggerät, das Spaß macht.

## What Changes

- **Spielgebiet** wächst auf das Rechteck Müllheim – Basel – Lörrach (ca. 30 × 35 km) einschließlich EuroAirport, Weil am Rhein und Basel (CH) mit Grenzgebiet in Frankreich.
- **Höhendaten** aus drei Quellen mit gemeinsamem Raster: LGL Baden-Württemberg (DE), swisstopo swissALTI3D (CH), IGN RGE ALTI (F). Nahtlose Übergänge an den Grenzen.
- **OSM-Inhalte** zusätzlich: Autobahnen (A5, A98, A35, Basler Autobahnen) mit Brücken und Anschlussstellen, Bahnstrecken mit Gleisen und Bahnhöfen, Flughafenflächen (Pisten, Rollwege, Vorfeld), Hochhäuser mit echten Höhen.
- **Zwei Regionsarten**: Die Kernregion (Gemeinde Kandern + Randstreifen) bleibt wie bisher vollständig offline vorgeladen. Alle anderen Regionen werden als statische Dateien mit dem Spiel bei Cloudflare ausgeliefert, nicht vorgeladen, sondern beim Annähern nachgeladen und auf dem Gerät mit einem Speicherbudget zwischengespeichert (älteste zuerst verdrängt). **BREAKING** für die Annahme „alles ist offline“: ohne Netz endet die spielbare Welt am Rand der bereits geladenen Regionen.
- **Fernsicht** für die große Fläche: gröbere Geländestufe und Silhouetten für Städte (Basel), damit man die Hochhäuser schon von weitem sieht.
- **Hubschrauber** als neues Fahrzeug: aufwendiges Blender-Modell (ziviler Hubschrauber ohne Logos, Kabine mit Glas, Kufen, drehender Haupt- und Heckrotor, Lackzone, lösbare Teile), Ein- und Aussteigen, kindgerechte Flugsteuerung (kann nicht abstürzen), Verfolgerkamera, Landen auf freien Flächen, Landeplätze (Kandern, Lörrach, Basel, Flughafen) mit Hubschrauber zum Einsteigen.
- **Tempo und Streaming** sind aufeinander abgestimmt: Höchstgeschwindigkeit nach Flughöhe, sodass das Gelände unter dem Hubschrauber immer geladen ist; beim Fehlen einer Region (offline) bleibt der Hubschrauber am Rand der geladenen Welt.
- Wahrzeichen in den neuen Städten, Züge und Flugzeuge folgen als eigene Changes (`landmarks-region`, `trains`, `airport-planes`); dieser Change legt die Daten dafür an (Bahnhöfe, Gleise, Flughafenflächen).

## Capabilities

### New Capabilities
- `regional-streaming`: Einteilung der Welt in Kern- und Nachladeregionen, Nachladen von Cloudflare (statische Dateien), Zwischenspeicher mit Budget und Verdrängung, Verhalten ohne Netz, Anzeige des Ladezustands.
- `helicopter`: Hubschrauber als Fahrzeug: Modell, Ein-/Aussteigen, Flugsteuerung, Kamera, Landen, Landeplätze, Geschwindigkeitsgrenzen nach Höhe.

### Modified Capabilities
- `world-data-pipeline`: Abdeckung wird vom Gemeindegebiet auf das regionale Spielgebiet erweitert; Gelände aus mehreren Höhenquellen; Größenbudget gilt getrennt für Kern- und Nachladeregionen; zusätzliche Inhalte (Autobahnen, Bahn, Flughafen, Hochhaushöhen).
- `offline-delivery`: Vorladen und Speicher-Budget beziehen sich auf die Kernregion; Nachladeregionen zählen zu einem eigenen, begrenzten Zwischenspeicher.
- `vehicles`: vierte Fahrzeugart Hubschrauber.
- `world-streaming`: Fernsicht über größere Distanz (Städte-Silhouetten), Streaming-Mittelpunkt folgt auch dem Hubschrauber.

## Impact

- `tools/world-pipeline`: Gebietsdefinition, neue DGM-Quellen (Download, Umprojektion nach UTM 32N, Zusammenführen), OSM-Abruf in mehr Teilstücken, Regionspakete getrennt nach Kern (`world/`) und Nachladeregionen (`world-remote/`, eingecheckt, Cloudflare baut aus GitHub).
- `packages/world-format`: Index mit Regionsart und Remote-URL; neue Straßen-/Flächenarten (Autobahn, Gleis, Piste, Rollweg).
- `apps/game`: Streaming-Erweiterung (Remote-Fetch, Cache-Verwaltung, Offline-Rand), Fernsicht, neues Fahrzeug Hubschrauber (`vehicles/helicopter/`), UI für Flugsteuerung und Ladezustand.
- `tools/asset-pipeline/blender`: Hubschrauber-Skript, Landeplatz-Prop.
- Cloudflare: keine neuen Dienste; die Nachladeregionen werden beim normalen Build aus GitHub als statische Dateien mit ausgeliefert.
- Datenmengen: Kernregion wie bisher (< 120 MB Kacheln), Nachladeregionen geschätzt 300–600 MB im Bucket, auf dem Gerät höchstens 400 MB Zwischenspeicher.
- Leistung: neue Messroute „Hubschrauber Basel“ auf dem iPad Pro 1. Gen.
