# @kandern/world-format

Gemeinsames Kachelformat für die Welt von Kandern Chaos. Die Pipeline (`tools/world-pipeline`) schreibt es, das Spiel (`apps/game`) liest es. Beide nutzen dieselben Funktionen, damit Schreiber und Leser nie auseinanderlaufen.

## Koordinatensystem

- Quelle: ETRS89 / UTM Zone 32N (**EPSG:25832**), die Projektion der LGL-BW-Geodaten.
- Ein fester **Weltursprung** (`WorldIndex.origin.easting/northing`) wird abgezogen. Spielkoordinaten liegen deshalb in Metern um (0, 0), und die float32-Genauigkeit der GPU reicht in der ganzen Gemeinde.
- Achsen im Spiel: **x = Osten**, **z = Norden**, **y = Höhe** (m ü. NN).
- Kachel `(tx, tz)` deckt `[tx·size, (tx+1)·size) × [tz·size, (tz+1)·size)` ab, Standardgröße 250 m.
- Polygone und Linien liegen in **kachel-lokalen** Koordinaten (Ursprung = südwestliche Ecke der Kachel).

## Dateien

```
world/
  index.json           WorldIndex: Version, Quelldatum, Pakete + SHA-256, Kachel -> Paket/Offset
  attribution.json     Quellen und Lizenzen (von der Pipeline erzeugt)
  region_<x>_<z>.bin   Regionspaket: einzeln gzip-komprimierte Kachelblöcke hintereinander
```

Jede Kachel ist **einzeln** komprimiert. Mit `[Offset, Länge]` aus dem Index lässt sich eine Kachel per Byte-Bereich (`Blob.slice`) lesen, ohne das ganze Paket zu entpacken. gzip wird mit `mtime = 0` geschrieben, sodass die Ausgabe bytegleich reproduzierbar ist.

## WorldIndex (`index.json`)

| Feld            | Bedeutung                                                                        |
| --------------- | -------------------------------------------------------------------------------- |
| `formatVersion` | Version des Kachelformats (`FORMAT_VERSION`)                                     |
| `buildVersion`  | 16 Hex-Zeichen, Hash über alle Paket-Hashes. Ändert sich, wenn sich Daten ändern |
| `sourceDate`    | Stand der Quelldaten (ISO-Datum)                                                 |
| `tileSize`      | Kantenlänge einer Kachel in m                                                    |
| `quant`         | Globale Höhen-Quantisierung `{ base, step }`: `h = base + wert·step`             |
| `origin`        | `{ epsg, easting, northing }`: Weltursprung in UTM 32N                           |
| `bounds`        | `{ minTx, minTz, maxTx, maxTz }`: belegter Kachelbereich (inklusive)             |
| `spawn`         | Startpunkt des Spielers `{ x, z }` in Weltkoordinaten                            |
| `packs[]`       | `{ file, bytes, sha256 }` je Regionspaket                                        |
| `tiles`         | `"tx,tz" -> [Paketindex, Offset, Länge]`                                         |

## Kachelblock (unkomprimiert, Little Endian)

Kopf:

| Typ      | Feld                          |
| -------- | ----------------------------- |
| u32      | Kennung `0x3154434B` ("KCT1") |
| u16      | Formatversion                 |
| i32, i32 | `tx`, `tz`                    |
| f32      | `size` (m)                    |
| f32, f32 | `quant.base`, `quant.step`    |

Danach folgen **Abschnitte** `u16 id, u32 länge, bytes`. Leser überspringen unbekannte Abschnitte.
Arrays werden als `u32 anzahl` gespeichert, gefolgt von einem Padding auf die Elementgröße und den Werten.
Zeichenketten sind `u16 länge` plus UTF-8.

### 1 – Terrain

`u8 anzahlLods`, je LOD: `u16 samples`, `u16[] heights` (samples² Werte).
Die Werte sind zeilenweise von Süd nach Nord angeordnet, innerhalb einer Zeile von West nach Ost. **Beide Kanten sind enthalten**: Der Abstand beträgt `size / (samples − 1)`, und benachbarte Kacheln teilen sich die Randwerte bitgenau. Möglich ist das durch die _globale_ Quantisierung. LOD0 ist die feinste Stufe (2 m bei 250-m-Kacheln = 126 Samples).

### 2 – Buildings

`u32 anzahl`, je Gebäude:

| Typ   | Feld         | Bedeutung                                                                                          |
| ----- | ------------ | -------------------------------------------------------------------------------------------------- |
| f64   | `id`         | stabile ID: OSM-Typ·1e12 + OSM-ID (Way = 1, Relation = 2)                                          |
| u8    | `type`       | `BuildingType` (Wohnhaus, Fachwerk, Hof, Gewerbe, Industrie, öffentlich, Kirche, Garage, Schuppen) |
| u8    | `roof`       | `RoofShape` (flach, Sattel, Walm, Zelt, Pult)                                                      |
| u8    | `levels`     | Stockwerke                                                                                         |
| u8    | `estimated`  | 1 = Werte aus Ergänzungsregeln geschätzt                                                           |
| f32   | `wallHeight` | Höhe bis Traufe (m)                                                                                |
| f32   | `roofHeight` | First − Traufe (m), 0 bei Flachdach                                                                |
| f32[] | `outline`    | Außenring CCW, `[x0,z0,x1,z1,…]` ohne Schlusspunkt                                                 |

Jedes Gebäude gehört genau **einer** Kachel, nämlich der, in der sein Schwerpunkt liegt. Der Grundriss darf über den Kachelrand hinausragen.

### 3 – Roads

`u32 anzahl`, je Straße: `f64 id`, `u8 kind` (`RoadKind`), `u8 flags` (Bit 0 Brücke, Bit 1 Tunnel), `f32 width`, `f64 startNode`, `f64 endNode`, `str name`, `f32[] points`.
Straßen werden an Kachelgrenzen geschnitten. Am Schnittpunkt erhalten beide Teile dieselbe synthetische Knoten-ID, damit das Netz über Kachelgrenzen hinweg verbunden bleibt.

### 4 – Land

`u32 anzahl`, je Fläche: `u8 kind` (`LandKind`), `u16 anzahlRinge`, `f32[]` je Ring. Ring 0 ist außen (CCW), alle weiteren sind Löcher (CW). Die Flächen sind auf die Kachel zugeschnitten.

### 5 – Waterways

`u32 anzahl`, je Gewässerlinie: `u8 kind` (0 Fluss, 1 Bach, 2 Graben), `f32 width`, `str name`, `f32[] points`.

### 6 – Props (optional)

Kleinobjekte und Parkpositionen. Der Abschnitt steht **hinter** allen anderen und fehlt bei Kacheln ohne Inhalt, die dadurch bytegleich zum alten Format bleiben. Leser ohne Kenntnis des Abschnitts überspringen ihn, deshalb gibt es keine neue Formatversion.

`u32 anzahlProps`, je Prop: `u8 kind` (`PropKind`: 0 Busch, 1 Mülleimer, 2 Zaunfeld, 3 Schild, 4 Laterne, 5 Bank, 6 Briefkasten, 7 Hydrant, 8 Poller, 9 Fahrradbügel, 10 Litfaßsäule, 11 Blumenkübel), `u8 variant` (Busch: 0–2 Größen, 1 hoch, 3 Heckenfeld; Zaun: 0 Holz, 1 Mauer; Schild `SignVariant`: 0 rund, 1 Ampel, 2 Haltestelle, 3 Dreieck, 4 blaues Quadrat), `f32 x`, `f32 z` (Kachel-lokal), `f32 rot` (Gierwinkel).

`u32 anzahlParkpositionen`, je Position: `f64 id` (stabil), `u8 kind` (`VehicleKind`: 0 Auto, 1 Fahrrad, 2 Motorrad), `f32 x`, `f32 z`, `f32 heading`.

### 7 – Details (optional)

Darstellungsdaten für Straßen und Gebäude. Steht hinter Abschnitt 6 und fehlt, wenn es nichts zu speichern gibt. Leser ohne Kenntnis überspringen ihn.

`u32 anzahlStraßen` (0 oder gleich der Anzahl im Straßenabschnitt, gleicher Index), je Straße: `u8 lanes`, `u8 flags` (1 Einbahn, 2 Gehweg links, 4 Gehweg rechts, 8 Teil eines Kreisverkehrs), `u8 surface` (`Surface`: 0 Asphalt, 1 Pflaster, 2 Schotter, 3 Erde, 4 Gras, 5 Beton), `i8 layer`, `f32 trimStart`, `f32 trimEnd` (Kürzung in m an Kreuzungen), `f32 deckStart`, `f32 deckEnd` (Brückenhöhe in m, NaN = keine Brücke).

`u32 anzahlKreuzungen`, je Kreuzung: `f64 node`, `u8 fallback` (1 = Kreisscheibe), `f32[] ring` (CCW, Kachel-lokal).

`u32 anzahlZebrastreifen`, je Zebrastreifen: `f32 x`, `f32 z`, `f32 dirX`, `f32 dirZ` (Laufrichtung, normiert), `f32 length`.

`u32 anzahlKirchtürme`, je Turm: `f64 buildingId`, `f32 x`, `f32 z`, `f32 size` (Kantenlänge), `f32 rot`.

`u32 anzahlKreisverkehre`, je Kreisverkehr: `f32 x`, `f32 z` (Mitte), `f32 radius` (Fahrbahnmitte), `f32 width`. Ältere Abschnitte enden vor dieser Liste; Leser prüfen die Restlänge.

Die sichtbare Form je Art und Variante (`propShape`, `PropShape`) liegt in `propShapes.ts`. Jede Form kostet je Kachel einen Draw Call; die Pipeline prüft höchstens `MAX_SHAPES_PER_TILE` = 12 Formen je Kachel.

## Versionierung

- `FORMAT_VERSION` wird erhöht, sobald sich bestehende Abschnitte inkompatibel ändern. Ältere Spiele lehnen neuere Kacheln mit einer klaren Fehlermeldung ab.
- Neue, optionale Abschnitte brauchen keine neue Version, weil Leser sie überspringen.
- `buildVersion` im Index kennzeichnet den Datenstand. Das Spiel lädt bei einem Update nur Pakete mit geändertem SHA-256 neu.

## API

```ts
encodeTile(tile) / decodeTile(bytes)        // Kachelblock
buildPack(tiles) / readTileFromPack(...)    // Regionspaket
buildWorldIndex({...})                      // index.json
sampleHeight(tile, lod, lx, lz)             // bilineare Höhe
sha256Hex(bytes) / verifyPack(entry, bytes) // Integrität
```
