# Spec Delta

## Purpose

Regelt den Hubschrauber als Fahrzeug, mit dem Kinder über die ganze Region fliegen: Aussehen, Ein- und Aussteigen, Flugsteuerung, Kamera, Landen, Landeplätze und die Abstimmung des Tempos auf das Nachladen der Welt.

## ADDED Requirements

### Requirement: Hubschrauber-Modell
Das Spiel SHALL einen Hubschrauber als detailliertes, stilisiertes Modell zeigen: ziviler Hubschrauber mit verglaster Kabine, Kufen, Hauptrotor mit mindestens vier Blättern, Heckausleger mit Heckrotor, Positionslichtern und einer Lackzone. Echte Logos, Kennungen mit echten Zeichen oder Militärmerkmale MUST NOT vorkommen. Haupt- und Heckrotor MUST sich sichtbar drehen, schneller mit steigender Leistung.

#### Scenario: Rotoren laufen an
- **WHEN** der Spieler einsteigt
- **THEN** beginnen Haupt- und Heckrotor sich zu drehen und erreichen innerhalb von 3 s die volle Drehzahl

#### Scenario: Keine Logos
- **WHEN** das Modell in der Sichtprüfung betrachtet wird
- **THEN** zeigt es keine Schrift und keine Markenzeichen

### Requirement: Landeplätze
Das Spiel SHALL Landeplätze mit einem bereitstehenden Hubschrauber anbieten, mindestens in Kandern, Lörrach, Basel und am Flughafen. Ein Landeplatz MUST gut erkennbar markiert sein (H-Markierung).

#### Scenario: Hubschrauber in Kandern
- **WHEN** der Spieler zum Landeplatz in Kandern geht
- **THEN** steht dort ein Hubschrauber, in den er einsteigen kann

### Requirement: Ein- und Aussteigen
Der Spieler SHALL zu Fuß in Reichweite eines stehenden Hubschraubers über denselben Knopf wie bei anderen Fahrzeugen einsteigen. Aussteigen MUST nur am Boden oder knapp darüber (höchstens 1 m) möglich sein; in der Luft ist der Knopf ausgeblendet.

#### Scenario: Aussteigen in der Luft
- **WHEN** der Hubschrauber 20 m über dem Boden schwebt
- **THEN** ist kein Knopf „Aussteigen“ zu sehen

#### Scenario: Aussteigen nach der Landung
- **WHEN** der Hubschrauber auf einer Wiese gelandet ist
- **THEN** kann der Spieler aussteigen und steht neben dem Hubschrauber

### Requirement: Kindgerechte Flugsteuerung
Die Flugsteuerung SHALL per Touch (Joystick für Richtung in Blickrichtung, Knöpfe „Hoch“ und „Runter“, Knopf „Schnell“) und per Tastatur funktionieren. Der Hubschrauber MUST beim Loslassen von selbst in den Schwebeflug gehen, sich in Flugrichtung neigen und in die Kurve legen. Er MUST NOT abstürzen oder sich überschlagen; Berührungen mit Gebäuden oder Gelände bremsen ihn ab und schieben ihn zurück.

#### Scenario: Loslassen
- **WHEN** der Spieler im Flug alle Bedienelemente loslässt
- **THEN** bremst der Hubschrauber innerhalb von 2 s ab und schwebt auf der Stelle

#### Scenario: Gegen ein Hochhaus
- **WHEN** der Spieler mit voller Geschwindigkeit gegen ein Hochhaus fliegt
- **THEN** prallt der Hubschrauber sanft ab, bleibt aufrecht und flugfähig

### Requirement: Flughöhe und Tempo
Der Hubschrauber SHALL mindestens 1 m und höchstens 600 m über dem Gelände fliegen. Die Höchstgeschwindigkeit MUST von der Flughöhe abhängen, damit das Gelände rechtzeitig nachgeladen wird: unter 120 m höchstens 30 m/s (ca. 110 km/h), darüber höchstens 60 m/s (ca. 215 km/h).

#### Scenario: Tiefflug über Kandern
- **WHEN** der Spieler in 50 m Höhe mit „Schnell“ fliegt
- **THEN** überschreitet der Hubschrauber 30 m/s nicht

#### Scenario: Höhenflug nach Basel
- **WHEN** der Spieler in 300 m Höhe mit „Schnell“ fliegt
- **THEN** erreicht er bis zu 60 m/s, und unter ihm ist immer Gelände geladen

### Requirement: Landen
Der Spieler SHALL auf jeder ausreichend ebenen, freien Fläche landen können (Landeplatz, Wiese, Platz, Parkplatz, Straße), indem er „Runter“ hält. Kurz über dem Boden MUST der Hubschrauber automatisch abbremsen und sanft aufsetzen. Auf Dächern oder zu steilem Gelände MUST er nicht aufsetzen, sondern knapp darüber schweben.

#### Scenario: Landung auf dem Blumenplatz
- **WHEN** der Spieler über dem Blumenplatz „Runter“ hält
- **THEN** setzt der Hubschrauber sanft auf und die Rotoren laufen im Leerlauf weiter

### Requirement: Verfolgerkamera
Die Kamera SHALL dem Hubschrauber von hinten oben folgen, sich in Kurven sanft mitdrehen und per Wischen frei umsehen lassen. Nach dem Loslassen MUST sie innerhalb von 2 s hinter den Hubschrauber zurückschwenken. Die Sichtweite MUST im Flug so groß sein, dass Basel aus Kandern in 300 m Höhe als Silhouette zu sehen ist.

#### Scenario: Blick nach Basel
- **WHEN** der Spieler über Kandern in 300 m Höhe Richtung Süden schaut
- **THEN** sind die Basler Hochhäuser als Silhouetten am Horizont zu sehen

### Requirement: Leistung im Hubschrauber
Auf dem iPad Pro 1. Gen MUST der Hubschrauberflug im Durchschnitt mindestens 30 fps und im 1-%-Low mindestens 20 fps erreichen, auch über der Basler Innenstadt.

#### Scenario: Messflug Basel
- **WHEN** die Messroute „Hubschrauber Basel“ (Kandern → Lörrach → Basel Innenstadt → Flughafen) abgespielt wird
- **THEN** liegen Ø-Bildrate und 1-%-Low im Ziel
