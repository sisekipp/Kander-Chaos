# Proposal: Grafik der Welt

## Why

Die Welt von Kandern Chaos hat echte Geometrie, sieht aber noch nicht schön aus: Alle Straßen sind gleiche graue Bänder (Autobahn wie Feldweg), Gehwege und Markierungen fehlen, Kreuzungen sind übereinanderliegende Streifen, Brücken folgen dem Gelände, der Boden ist einfarbig, und Häuser wie Kirchen wirken nicht wie im Markgräflerland. Das ist der größte Hebel für den Spielspaß. Außerdem ist es Voraussetzung für die Welterweiterung nach Lörrach, Weil am Rhein, Basel und zum EuroAirport, wo Autobahnen, Rheinbrücken und Stadtstraßen das Bild prägen.

## What Changes

- **Straßen nach Typ unterscheidbar:**
  - Autobahn mit Mittelstreifen und Leitplanken
  - Bundes- und Hauptstraßen mit Mittellinie und Randlinien
  - schmale Wohnstraßen
  - Feldwege (Fahrspuren mit Grasstreifen)
  - Fuß- und Radwege in eigener Farbe
  - Treppen
- **Fahrbahnmarkierungen und Zebrastreifen** prozedural im Shader, ohne Texturdateien.
- **Gehwege mit Bordstein** entlang innerörtlicher Straßen (aus OSM-Angaben, sonst nach Regeln).
- **Saubere Kreuzungsflächen** statt übereinanderliegender Bänder, berechnet in der Pipeline.
- **Brücken mit eigener Fahrbahnhöhe** (Geländer, Pfeiler) und **Tunnelportale**. Das bereitet Rhein- und Autobahnbrücken vor.
- **Licht und Himmel:**
  - Himmelsverlauf, warmes Sonnenlicht, Umgebungslicht nach Himmel und Boden
  - Tone-Mapping
  - Nebel in Himmelsfarbe
  - eingebackene Verschattung (Gebäude auf Boden, Bäume)
- **Boden mit Mustern statt Einheitsfarben:**
  - Acker mit Furchen
  - Wiese mit Farbrauschen
  - Waldboden, Kies und Plätze
  - weiche Übergänge zwischen Flächen
- **Gebäude im regionalen Stil:**
  - Dachüberstand, Fensterläden, Haustüren im Erdgeschoss, Schornsteine
  - Markgräfler Fachwerk und Putzfarben
  - **Kirchen mit Turm und Turmhelm**
- **Natur:** abwechslungsreichere Bäume (mehrere Formen und Grüntöne), Hecken, Wasser mit bewegter Oberfläche.

**Nicht in diesem Change:**
- neue Modelle für Figur, Fahrzeuge, Gegenstände und Wahrzeichen (folgt in `graphics-assets`)
- Welterweiterung und neue Komprimierung der Weltdaten (folgen danach)
- NPCs

## Capabilities

### New Capabilities

- `road-rendering`: Darstellung des Straßennetzes: Straßentypen, Markierungen, Zebrastreifen, Gehwege, Kreuzungen, Brücken und Tunnel.
- `world-visuals`: Gesamtbild der Welt: Licht, Himmel, Tone-Mapping, Nebel, Bodenmuster, Gebäude im regionalen Stil inklusive Kirchen, Vegetation und Wasser, jeweils innerhalb des Leistungsbudgets.

### Modified Capabilities

- `world-streaming`: Die Anforderung „Straßen auf dem Gelände“ bekommt eine Ausnahme für Brücken und Tunnel.
- `world-data-pipeline`: neue Straßenattribute (Fahrstreifen, Einbahn, Gehweg, Belag, Brücken-/Tunnelhöhe), Kreuzungsflächen, Zebrastreifen-Knoten und Kirchturm-Lage in einem neuen optionalen Kachelabschnitt.

## Impact

- **Pipeline:**
  - neue Module für Straßenattribute, Kreuzungsgeometrie, Brückenhöhen und Kirchenerkennung
  - Erweiterung der Props-Abfrage um Zebrastreifen-Knoten
  - Weltdaten müssen neu gebaut werden
- **Kachelformat:** neuer optionaler Abschnitt, `FORMAT_VERSION` bleibt gleich.
- **Spiel:** neue Generatoren für Straßen, Kreuzungen und Brücken im Worker, ein Straßen-Shader mit Markierungen, erweiterter Gebäude-Shader und -Generator (Kirchen, Fensterläden, Türen), Boden-Shader, Licht- und Himmelsaufbau, Wasser-Shader.
- **Leistung:** Alles muss auf dem iPad Pro 1. Gen weiter 30 fps schaffen. Mehr Shader-Arbeit pro Pixel wird durch Verzicht auf Alpha-Blending und Echtzeitschatten sowie durch eingefrorene Materialien ausgeglichen. Neu gemessen wird auf dem Gerät.
