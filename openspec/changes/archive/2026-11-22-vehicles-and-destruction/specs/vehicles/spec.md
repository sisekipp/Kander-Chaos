# Spec Delta

## Purpose

Lässt die Spielfigur in Autos, Fahrräder und Motorräder ein- und aussteigen und sie mit kindgerechter, gut kontrollierbarer Fahrphysik durch die Welt von Kandern steuern.

## ADDED Requirements

### Requirement: Drei Fahrzeugarten
Das Spiel SHALL drei Fahrzeugarten bieten: Auto, Fahrrad und Motorrad. Sie MUST sich in Höchstgeschwindigkeit, Beschleunigung und Wendigkeit spürbar unterscheiden. Richtwerte: Auto ca. 80 km/h, Motorrad ca. 90 km/h, Fahrrad ca. 30 km/h.

#### Scenario: Unterschiedliche Höchstgeschwindigkeit
- **WHEN** der Spieler mit jeder Fahrzeugart auf ebener Straße voll beschleunigt
- **THEN** erreicht das Fahrrad die niedrigste und das Motorrad die höchste Endgeschwindigkeit
- **AND** jede Endgeschwindigkeit liegt innerhalb von ±15 % ihres Richtwerts

### Requirement: Einsteigen
Steht die Spielfigur höchstens 3 m von einem freien Fahrzeug entfernt, SHALL ein Aktionsknopf „Einsteigen“ erscheinen. Ein Tipp darauf MUST die Figur in das Fahrzeug setzen und die Steuerung auf das Fahrzeug umschalten.

#### Scenario: Einsteigen in ein parkendes Auto
- **GIVEN** die Spielfigur steht 2 m neben einem parkenden Auto
- **WHEN** der Spieler „Einsteigen“ antippt
- **THEN** sitzt die Figur im Auto, und Joystick und Knöpfe steuern das Auto

#### Scenario: Zu weit weg
- **WHEN** das nächste Fahrzeug weiter als 3 m entfernt ist
- **THEN** wird kein „Einsteigen“-Knopf angezeigt

### Requirement: Aussteigen
Im Fahrzeug SHALL ein Knopf „Aussteigen“ verfügbar sein. Die Figur MUST an einer freien Stelle neben dem Fahrzeug abgesetzt werden, niemals in einer Wand, unter dem Gelände oder in einem anderen Fahrzeug. Fährt das Fahrzeug schneller als 15 km/h, bremst es vor dem Aussteigen automatisch ab.

#### Scenario: Aussteigen neben einer Hauswand
- **GIVEN** das Auto steht mit der Fahrerseite direkt an einer Hauswand
- **WHEN** der Spieler „Aussteigen“ antippt
- **THEN** steht die Figur auf der anderen Seite oder hinter dem Auto auf freiem Boden

#### Scenario: Aussteigen während der Fahrt
- **WHEN** der Spieler bei 60 km/h „Aussteigen“ antippt
- **THEN** bremst das Fahrzeug bis zum Stillstand ab, bevor die Figur aussteigt

### Requirement: Kindgerechte Fahrphysik
Fahrzeuge SHALL ein verzeihendes Arcade-Fahrverhalten haben: Sie überschlagen sich nicht dauerhaft, kommen nach einem Sprung oder Unfall wieder auf die Räder und bleiben an Hängen bis 35 % Steigung kontrollierbar. Fahrzeuge MUST mit Gelände, Gebäuden, anderen Fahrzeugen und Physikobjekten kollidieren.

#### Scenario: Fahrzeug liegt auf dem Dach
- **WHEN** ein Auto nach einem Unfall länger als 2 Sekunden auf dem Dach oder auf der Seite liegt
- **THEN** richtet es sich automatisch wieder auf die Räder auf

#### Scenario: Gegen eine Hauswand fahren
- **WHEN** ein Fahrzeug mit Tempo gegen eine Gebäudewand fährt
- **THEN** prallt es ab und fährt nicht durch die Wand

#### Scenario: Steile Straße
- **WHEN** ein Auto eine Straße mit 30 % Steigung hinauffährt
- **THEN** kommt es aus eigener Kraft oben an

### Requirement: Zweiräder bleiben aufrecht
Fahrrad und Motorrad SHALL beim Fahren und im Stand aufrecht bleiben. Sie MUST sich in Kurven sichtbar zur Kurveninnenseite neigen und dürfen ohne Unfall nicht umkippen.

#### Scenario: Enge Kurve mit dem Fahrrad
- **WHEN** der Spieler mit dem Fahrrad eine enge Kurve fährt
- **THEN** neigt sich das Fahrrad zur Kurveninnenseite und kippt nicht um

### Requirement: Fahrsteuerung per Touch
Im Fahrzeug SHALL der linke Joystick lenken, rechts liegen große Knöpfe für Gas, Bremse/Rückwärts und Hupe. Im „Einfach“-Modus MUST das Fahrzeug automatisch Gas geben, solange der Joystick bewegt wird, sodass nur gelenkt werden muss. Auf Desktop-Geräten SHALL die Tastatur (W/A/S/D bzw. Pfeiltasten, Leertaste = Bremse, E = Ein-/Aussteigen) funktionieren.

#### Scenario: Einfach-Modus
- **GIVEN** der Einfach-Modus ist eingeschaltet
- **WHEN** der Spieler im Auto nur den Joystick nach links drückt
- **THEN** fährt das Auto vorwärts und lenkt nach links

#### Scenario: Rückwärts fahren
- **WHEN** der Spieler im Stand die Bremse gedrückt hält
- **THEN** fährt das Fahrzeug langsam rückwärts

### Requirement: Fahrkamera
Im Fahrzeug SHALL die Kamera dem Fahrzeug von hinten folgen, sich mit der Geschwindigkeit leicht weiter herauszoomen und per Wischen kurzzeitig drehbar sein. Nach dem Loslassen MUST sie wieder hinter das Fahrzeug schwenken.

#### Scenario: Kamera schwenkt zurück
- **WHEN** der Spieler die Kamera während der Fahrt zur Seite wischt und loslässt
- **THEN** schwenkt die Kamera innerhalb von 2 Sekunden wieder hinter das Fahrzeug

### Requirement: Parkende Fahrzeuge
Entlang von Wohn- und Nebenstraßen sowie auf Parkplätzen SHALL das Spiel parkende Fahrzeuge aus den Parkpositionen der Kacheldaten zeigen, überwiegend Autos, dazu einige Fahrräder und Motorräder. Sie MUST mit den Ring-0-Kacheln erscheinen und verschwinden und dabei die Obergrenze aus dem Fahrzeug-Budget einhalten.

#### Scenario: Fahrzeuge in der Kernstadt
- **WHEN** der Spieler in der Kernstadt Kandern startet
- **THEN** stehen im Umkreis von 150 m mindestens 5 benutzbare Fahrzeuge, darunter mindestens ein Zweirad

#### Scenario: Gleiche Fahrzeuge am gleichen Ort
- **WHEN** der Spieler eine Kachel verlässt und später zurückkehrt
- **THEN** stehen dort wieder dieselben Fahrzeugarten in denselben Farben an denselben Stellen, sofern sie nicht bewegt oder zerstört wurden

### Requirement: Benutzte Fahrzeuge bleiben erhalten
Ein Fahrzeug, das der Spieler bewegt hat, SHALL dort stehen bleiben, wo er es verlassen hat, solange seine Kachel geladen ist. Das zuletzt gefahrene Fahrzeug MUST auch beim Entladen seiner Kachel erhalten bleiben, bis der Spieler mehr als 1 km entfernt ist.

#### Scenario: Auto abstellen und zurückkommen
- **WHEN** der Spieler ein Auto am Blumenplatz abstellt, 300 m weggeht und zurückkehrt
- **THEN** steht das Auto noch am Blumenplatz

### Requirement: Fahrzeug-Budget
Gleichzeitig aktive Fahrzeuge SHALL auf höchstens 24 begrenzt sein; davon höchstens 8 mit voller Physik (in der Nähe des Spielers), die übrigen ruhen als statische Objekte. Ruhende Fahrzeuge MUST beim Anstoßen sofort physikalisch werden.

#### Scenario: Viele Parkplätze
- **WHEN** im Umkreis mehr als 24 Parkpositionen liegen
- **THEN** werden nur die 24 nächsten mit Fahrzeugen besetzt
