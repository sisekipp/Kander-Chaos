# Proposal: Modelle für Figur, Fahrzeuge, Gegenstände und Wahrzeichen

## Why

Spielfigur, Fahrzeuge und Kleinobjekte sind heute im Code aus Kapseln und Quadern zusammengesetzt und sehen nicht ansprechend aus. Mit den kommenden NPCs wird das noch auffälliger. Gute Modelle von Hand im Code zu bauen ist zu aufwendig. Frei nutzbare Low-Poly-Modellpakete unter CC0 (z. B. Quaternius, Kenney) liefern dagegen stilisierte, animierte und für schwache Geräte gemachte Modelle. Sie müssen aber zur Region passen: deutsche bzw. europäische Autos, Gegenstände wie in deutschen Orten. Wahrzeichen wie die Kirche in Kandern müssen erkennbar sein.

## What Changes

- **Asset-Pipeline:**
  - Auswahl von CC0-Modellen mit Lizenzregister (Quelle, Lizenz, Datum je Modell)
  - Optimierung mit gltf-transform (Duplikate zusammenfassen, Quantisierung, meshopt-Komprimierung)
  - lokal mitgelieferte Decoder (offline), Umfärben in die Spielpalette
  - Größenbudget und Prüfungen im Build
- **Neue Spielfigur:** kindgerechte Figur mit Animationen (stehen, gehen, rennen, springen, sitzen im Fahrzeug, ein- und aussteigen) und mehreren wählbaren Farbvarianten.
- **Fahrzeuge im europäischen Stil:**
  - Autos: Kleinwagen, Kompaktwagen, Kombi, Kleintransporter
  - Fahrräder: Stadtrad, Mountainbike
  - Zweiräder mit Motor: Roller, Motorrad
  - keine US-typischen Fahrzeuge, keine echten Markenlogos
  - lösbare Teile für den Schaden bleiben erhalten
- **Kleinobjekte im deutschen Stil:** Mülleimer, Parkbank, Straßenlaterne, Verkehrsschilder in StVO-Formen (ohne Text bzw. nur mit Symbolen), Gartenzaun, Büsche. Dazu passende Trümmerteile.
- **Figuren-Baukasten für NPCs:** mindestens 8 unterschiedliche Erwachsenen- und Kinderfiguren mit denselben Animationen, vorbereitet für viele gleichzeitige Figuren (gebackene Vertex-Animation). Das Verhalten der NPCs folgt im nächsten Change.
- **Wahrzeichen:** Mechanismus, der ein OSM-Gebäude anhand seiner ID durch ein eigenes Modell ersetzt. Erste Wahrzeichen: evangelische Kirche und Rathaus in Kandern. Modelle für Wahrzeichen werden selbst erstellt, z. B. in Blender. Basler Wahrzeichen (Roche-Türme, Badischer Bahnhof, Bahnhof SBB) folgen mit der Welterweiterung.

**Nicht in diesem Change:**
- NPC-Verhalten und Verkehr
- Welterweiterung, Basler Wahrzeichen
- neue Fahrzeugarten mit eigener Physik (z. B. Traktor, Bus)
- Ton

## Capabilities

### New Capabilities

- `asset-pipeline`: Herkunft, Lizenzen, Auswahlkriterien (regionaler Stil), Optimierung, Komprimierung, Offline-Decoder, Größenbudget und Prüfungen aller eingebundenen 3D-Modelle sowie der Figuren-Baukasten für NPCs.
- `player-character`: Aussehen, Varianten und Animationen der Spielfigur.
- `landmarks`: Ersetzen von OSM-Gebäuden durch eigene Wahrzeichen-Modelle, erste Wahrzeichen in Kandern.

### Modified Capabilities

- `vehicles`: neue Anforderung an das Aussehen der Fahrzeuge (europäische Modelle, Vielfalt, keine Markenlogos).
- `destructible-props`: neue Anforderung an das Aussehen der Kleinobjekte (deutscher Stil) und ihrer Trümmer.
- `vehicle-damage`: neue Anforderung, dass Fahrzeugmodelle ihre lösbaren Teile kennzeichnen.

## Impact

- **Neuer Ordner** `assets/` (Quellmodelle, Lizenzregister) und ein Werkzeug `tools/asset-pipeline` (gltf-transform).
- **Spiel:**
  - Laden von glTF/GLB über `@babylonjs/loaders` mit lokalem meshopt-Decoder
  - Modell-Registry, Austausch der prozeduralen Modelle in `vehicles/models`, `props/models`, `player/figure`
  - neue Animationssteuerung der Figur
- **Abhängigkeiten:** `@babylonjs/loaders`, `@gltf-transform/core|extensions|functions`, `meshoptimizer` (Decoder lokal ausgeliefert).
- **Größe:** Modelle zusammen höchstens 15 MB im Build (Prüfung im Build). Das Gesamtbudget von 300 MB gilt weiter.
- **Leistung:**
  - Fahrzeuge und Props bleiben Thin Instances bzw. wenige Draw Calls.
  - Die Figur ist das einzige animierte Skelett.
  - NPC-Figuren sind auf gebackene Vertex-Animation vorbereitet.
  - Messung auf dem iPad Pro 1. Gen.
