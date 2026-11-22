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
