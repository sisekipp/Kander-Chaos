# Spec Delta

## Purpose

Legt das Gesamtbild der Welt fest: Licht, Himmel, Farben, Boden, Gebäude im Stil des Markgräflerlands inklusive Kirchen, Vegetation und Wasser. Ziel ist ein stimmiger, warmer, stilisierter Look, der auf dem iPad Pro 1. Gen flüssig läuft.

## ADDED Requirements

### Requirement: Himmel und Licht
Die Welt SHALL einen Himmelsverlauf (Horizont hell, Zenit kräftiger), warmes Sonnenlicht und ein Umgebungslicht zeigen, das sich nach Himmel (oben) und Boden (unten) färbt. Der Nebel MUST die Farbe des Horizonts haben, sodass die Sichtgrenze unsichtbar bleibt.

#### Scenario: Blick zum Horizont
- **WHEN** der Spieler über offenes Feld zum Horizont blickt
- **THEN** geht das Gelände ohne harte Kante in den Himmel über

### Requirement: Tone-Mapping und Farbgebung
Das Bild SHALL per Tone-Mapping und einer festgelegten Farbpalette satte, aber nicht grelle Farben haben. Weiße Flächen MUST hell bleiben (kein Grauschleier).

#### Scenario: Weiße Fassade in der Sonne
- **WHEN** eine weiß verputzte Fassade in der Sonne steht
- **THEN** erscheint sie hell und nicht grau

### Requirement: Eingebackene Verschattung
Gebäude SHALL am Boden einen weichen dunkleren Saum werfen (eingebackene Umgebungsverdeckung), Bäume einen Schattenfleck am Stamm. Echtzeitschatten MUST in der Qualitätsstufe „Niedrig“ nicht nötig sein, um räumliche Tiefe zu erzeugen.

#### Scenario: Haus auf der Wiese
- **WHEN** ein Haus auf einer Wiese steht
- **THEN** ist der Boden direkt am Haus etwas dunkler als die freie Wiese

### Requirement: Bodenmuster statt Einheitsfarben
Landnutzungsflächen SHALL feine, zur Fläche passende Muster zeigen: Acker mit Furchen in einer Richtung je Feld, Wiese mit Farbrauschen, Waldboden dunkler und fleckig, Plätze und Höfe gepflastert bzw. gekiest. Übergänge zwischen Flächen MUST weich verlaufen. Muster entstehen im Shader (keine Texturdateien).

#### Scenario: Acker neben Wiese
- **WHEN** ein Acker an eine Wiese grenzt
- **THEN** zeigt der Acker Furchen, die Wiese nicht, und die Grenze verläuft weich

### Requirement: Gebäude im regionalen Stil
Wohn- und Fachwerkhäuser SHALL Merkmale des Markgräflerlands tragen: steile Ziegeldächer mit Dachüberstand, helle Putz- und Fachwerkfassaden, Fensterläden an einem Teil der Fenster, eine Haustür im Erdgeschoss zur Straße hin und Schornsteine auf einem Teil der Dächer. Die Auswahl je Gebäude MUST deterministisch aus der Gebäude-ID folgen.

#### Scenario: Altstadtgasse
- **WHEN** der Spieler durch die Kernstadt Kandern geht
- **THEN** sieht er Häuser mit Dachüberstand, Fensterläden und Haustüren, und die Häuser wiederholen sich nicht erkennbar

#### Scenario: Gleiches Haus beim Zurückkommen
- **WHEN** eine Kachel entladen und erneut geladen wird
- **THEN** haben alle Häuser wieder dieselben Türen, Fensterläden und Schornsteine

### Requirement: Kirchen mit Turm
Kirchen SHALL als Kirchenschiff mit steilem Dach und einem Turm mit spitzem Turmhelm dargestellt werden, angelehnt an die Dorfkirchen der Region. Der Turm steht an der Stelle aus den Kartendaten (Turm-Teil) oder, falls nicht vorhanden, an einer Schmalseite des Kirchenschiffs. Kirchen MUST aus der Ferne als Kirche erkennbar sein.

#### Scenario: Kirche in Kandern
- **WHEN** der Spieler auf die evangelische Kirche in Kandern zufährt
- **THEN** ist ein Kirchturm mit Spitzhelm zu sehen, der die umliegenden Häuser überragt

### Requirement: Abwechslungsreiche Vegetation
Bäume SHALL in mindestens fünf Formen (z. B. runde Laubbäume, hohe Laubbäume, Nadelbäume, Obstbäume, Büsche) und mehreren Grüntönen vorkommen und leicht unterschiedlich gedreht und skaliert sein. Hecken an Grundstücken SHALL als zusammenhängende Hecke erscheinen.

#### Scenario: Waldrand
- **WHEN** der Spieler auf einen Mischwald blickt
- **THEN** stehen dort verschiedene Baumformen in verschiedenen Grüntönen

### Requirement: Bewegtes Wasser
Flüsse, Bäche und Wasserflächen SHALL eine leicht bewegte Oberfläche mit Glanzlichtern zeigen, ohne Alpha-Blending und ohne Spiegelung der Szene.

#### Scenario: Die Kander
- **WHEN** der Spieler an der Kander steht
- **THEN** bewegt sich die Wasseroberfläche sichtbar in Fließrichtung

### Requirement: Leistung bleibt im Budget
Mit allen Verbesserungen dieses Changes SHALL das Spiel auf dem Referenzgerät in Qualitätsstufe „Niedrig“ die Ziele aus `performance-budget` einhalten (Ø ≥ 30 fps, 1-%-Low ≥ 20 fps). Neue Materialien MUST ohne Alpha-Blending auskommen und nach dem Aufbau eingefroren werden.

#### Scenario: Testroute nach der Überarbeitung
- **WHEN** die Testroute auf dem iPad Pro 1. Gen gefahren wird
- **THEN** werden die Bildratenziele weiterhin erreicht
