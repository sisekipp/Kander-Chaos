# Proposal: Fahrzeuge und Zerstörung

## Why

Kandern Chaos hat eine begehbare Welt, aber noch kein Spiel darin. Fahrzeuge sind der größte Spielspaß-Sprung und die Grundlage für spätere Changes: Verkehr, Rennen nach Tannenkirch, Lieferaufgaben. Zerstörbare Kleinobjekte machen das „Chaos“ im Namen erlebbar. Havok läuft laut Abnahme stabil auf dem iPad Pro 1. Gen, damit ist die Voraussetzung erfüllt.

## What Changes

- **Drei Fahrzeugarten** mit kindgerechter Arcade-Fahrphysik auf Havok-Basis: Auto, Fahrrad, Motorrad. Jede Art fühlt sich unterscheidbar an (Tempo, Beschleunigung, Lenkung, Neigen in Kurven bei Zweirädern).
- **Ein- und Aussteigen** per Aktionsknopf in der Nähe eines Fahrzeugs. Kamera und Touch-Steuerung wechseln automatisch zwischen Laufen und Fahren (Lenken links, Gas/Bremse rechts, optional Auto-Gas im „Einfach“-Modus).
- **Parkende Fahrzeuge** entlang der Straßen, die mit den Kacheln geladen werden. Jedes kann man benutzen.
- **Zerstörbare Kleinobjekte**: Büsche, Mülleimer, Zäune, Schilder, Laternen, Bänke. Sie fallen beim Anfahren um oder zerbrechen in vorgefertigte Teile, die nach einigen Sekunden verschwinden. Später stehen sie wieder da.
- **Fahrzeugschaden** in Stufen: Dellen, abfallende Teile, Rauch, Totalschaden als kindgerechter „Puff“ mit Rauchwolke, ohne Feuer und ohne Verletzte. Die Spielfigur steigt dann unverletzt aus, und das Fahrzeug erscheint später wieder.
- **Pipeline-Erweiterung**: Straßenmöbel und Grenzlinien (Laternen, Mülleimer, Bänke, Schilder, Zäune, Hecken) aus OSM plus deterministische Ergänzung entlang der Straßen und Grundstücke. Dazu Parkplatz-Positionen für Fahrzeuge.

**Nicht in diesem Change:** Verkehr und NPCs, Spaßwaffen, Innenräume, Aufgaben und Rennen, Tankstellen oder Reparaturwerkstätten, Gamepad-Steuerung.

## Capabilities

### New Capabilities

- `vehicles`: Fahrzeugarten, Fahrverhalten, Ein- und Aussteigen, Fahrsteuerung (Touch und Tastatur), Fahrkamera, parkende Fahrzeuge und ihr Erscheinen und Verschwinden mit dem Streaming.
- `vehicle-damage`: Schadensstufen, sichtbare Schäden, Totalschaden und Wiedererscheinen von Fahrzeugen.
- `destructible-props`: Zerstörbare Kleinobjekte in der Welt, ihr Verhalten beim Anfahren, Aufräumen der Trümmer, Wiederaufbau und Physik-Budget.

### Modified Capabilities

- `world-data-pipeline`: Neue Anforderung: Die Kacheln enthalten Straßenmöbel, Grenzlinien und Parkpositionen. Das Format bleibt abwärtskompatibel über einen neuen, optionalen Abschnitt.

## Impact

- **Spiel (`apps/game`)**: neue Module für Fahrzeuge, Schaden und Props, Erweiterung von Spielfigur und Eingabe (Aktionsknopf, Fahrmodus), Touch-UI, Upload von Props und Fahrzeugen im Kachel-Manager, Partikel (Rauch, Funken).
- **Kachelformat (`packages/world-format`)**: neuer optionaler Abschnitt „Props“. `FORMAT_VERSION` bleibt gleich, alte Spiele überspringen den Abschnitt.
- **Pipeline (`tools/world-pipeline`)**: zusätzliche Overpass-Abfrage für Straßenmöbel und Barrieren, Regeln für prozedurale Ergänzung und Parkpositionen. Danach müssen die Weltdaten neu gebaut und committet werden.
- **Assets**: Low-Poly-Fahrzeug- und Prop-Modelle, prozedural im Code gebaut (keine externen Modelldateien, keine Lizenzfragen).
- **Leistung**: Mehr aktive Physikkörper. Das Budget aus der Spec `performance-budget` (30 fps auf dem iPad Pro 1. Gen) gilt weiter und muss erneut gemessen werden.
