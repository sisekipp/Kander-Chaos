# Spec Delta

## ADDED Requirements

### Requirement: Wahrzeichen der Region
Die bekanntesten Bauten in Basel, Weil am Rhein, Lörrach, Müllheim und am EuroAirport SHALL ein eigenes, nach Fotos gebautes Modell bekommen. Die Auswahl MUST mindestens umfassen:
- **Basel:** Roche-Turm Bau 1 und Bau 2, Messeturm, Münster, Rathaus, Spalentor, Mittlere Brücke, Bahnhof SBB, Badischer Bahnhof, Messe mit Halle 1, St. Jakob-Park
- **Weil am Rhein:** Vitra-Bauten, Dreiländerbrücke
- **Lörrach:** Burg Rötteln, Rathaus, Bahnhof
- **Müllheim:** Martinskirche, Bahnhof
- **EuroAirport:** Terminal, Tower

Die Modelle MUST ohne echte Logos, Markennamen und Schriftzüge auskommen und im Stil der übrigen Wahrzeichen bleiben: kindgerecht, klare Formen, Vertex-Farben.

#### Scenario: Basel ist erkennbar
- **WHEN** der Hubschrauber in 150 m Höhe über die Basler Innenstadt fliegt
- **THEN** stehen Münster, Rathaus, Mittlere Brücke und die beiden Roche-Türme als eigene Modelle an ihrer echten Stelle

#### Scenario: Keine Marken
- **WHEN** ein Wahrzeichen der Region geprüft wird
- **THEN** zeigt es keine Logos, Markennamen oder lesbare Schriftzüge

### Requirement: Echte Lage, Größe und Höhe
Jedes Wahrzeichen MUST an seiner echten Stelle stehen, mit Grundriss und Ausrichtung des OSM-Gebäudes. Seine Höhe MUST bis auf ±10 % der bekannten Höhe entsprechen (Roche Bau 2 ≈ 205 m, Bau 1 ≈ 178 m, Messeturm ≈ 105 m, Münstertürme ≈ 65 m). Wahrzeichen ohne eigenes OSM-Gebäude (Brücken, Flugzeuge) MUST über eine Koordinate und eine Ausrichtung platziert werden.

#### Scenario: Roche-Turm in echter Höhe
- **WHEN** das Modell von Roche Bau 2 gebaut wird
- **THEN** ist es zwischen 185 m und 225 m hoch und steht auf dem Grundriss des OSM-Gebäudes

#### Scenario: Freies Wahrzeichen
- **WHEN** ein geparktes Flugzeug am Terminal platziert wird
- **THEN** steht es an der angegebenen Koordinate auf dem Vorfeld, mit der angegebenen Ausrichtung, ohne ein Gebäude zu ersetzen

### Requirement: Wahrzeichen ersetzt das generierte Gebäude
Im Nahbereich (Ring 0 und 1) SHALL statt des generierten Gebäudes das Modell stehen, mit Kollision für Figur, Fahrzeuge und Hubschrauber. Es MUST nie beides gleichzeitig sichtbar sein.

#### Scenario: Kein doppeltes Gebäude
- **WHEN** die Kachel mit dem Basler Rathaus in Ring 0 geladen ist
- **THEN** steht dort nur das Rathaus-Modell und kein generierter Block

#### Scenario: Hubschrauber prallt ab
- **WHEN** der Hubschrauber gegen einen Roche-Turm fliegt
- **THEN** prallt er an der Fassade ab und fliegt nicht hindurch

### Requirement: Geparkte Flugzeuge am Flughafen
Am EuroAirport SHALL am Terminal mindestens fünf geparkte Flugzeuge stehen: mindestens zwei Größen, Fantasie-Lackierungen ohne echte Airlines. Sie bewegen sich in diesem Umfang nicht.

#### Scenario: Flugzeuge am Terminal
- **WHEN** der Spieler am Landeplatz EuroAirport aussteigt
- **THEN** sind am Terminal mindestens fünf Flugzeuge an den Fluggastbrücken zu sehen

### Requirement: Leistung der Wahrzeichen
Ein Wahrzeichen der Region MUST höchstens 8000 Dreiecke haben, Terminal und Hochhäuser höchstens 15000. Auch über der Basler Innenstadt MUST die Bildrate auf dem iPad Pro 1. Gen im Schnitt bei mindestens 30 fps bleiben, mit einem 1-%-Low von mindestens 20 fps.

#### Scenario: Dreiecksgrenze
- **WHEN** die Asset-Pipeline ein Wahrzeichen der Region baut
- **THEN** bricht sie mit Fehler ab, wenn die Grenze überschritten ist

#### Scenario: Flug über Basel
- **WHEN** die Messroute „Hubschrauber Basel“ auf dem iPad Pro 1. Gen läuft
- **THEN** liegt die Bildrate im Schnitt bei mindestens 30 fps und das 1-%-Low bei mindestens 20 fps
