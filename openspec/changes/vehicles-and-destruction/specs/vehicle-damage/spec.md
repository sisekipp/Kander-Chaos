# Spec Delta

## Purpose

Macht Unfälle sichtbar und lustig: Fahrzeuge nehmen bei Zusammenstößen in Stufen Schaden bis zum kindgerechten Totalschaden und erscheinen danach wieder. Niemand wird dabei verletzt.

## ADDED Requirements

### Requirement: Schaden aus Aufprallstärke
Jedes Fahrzeug SHALL einen Zustand von 100 % (heil) bis 0 % (Totalschaden) haben. Ein Aufprall MUST abhängig von der Aufprallgeschwindigkeit Schaden verursachen. Unter 10 km/h entsteht kein Schaden, damit Rangieren und leichtes Anstupsen folgenlos bleiben.

#### Scenario: Leichtes Anstupsen
- **WHEN** ein Auto mit 5 km/h gegen eine Wand rollt
- **THEN** bleibt sein Zustand unverändert

#### Scenario: Harter Aufprall
- **WHEN** ein Auto mit 60 km/h frontal gegen eine Hauswand fährt
- **THEN** sinkt sein Zustand um mindestens 30 Prozentpunkte

### Requirement: Kleinobjekte schaden kaum
Zusammenstöße mit zerstörbaren Kleinobjekten (Büsche, Mülleimer, Zäune, Schilder) SHALL höchstens 2 Prozentpunkte Schaden pro Objekt verursachen, damit das Umfahren Spaß macht, ohne das Fahrzeug sofort zu zerstören.

#### Scenario: Durch eine Reihe Büsche fahren
- **WHEN** ein heiles Auto mit 50 km/h durch 10 Büsche fährt
- **THEN** hat es danach noch mindestens 80 % Zustand

### Requirement: Sichtbare Schadensstufen
Der Schaden SHALL in Stufen sichtbar sein: ab 70 % dunklere Flecken und Dellen, ab 40 % fallen Teile ab (z. B. Stoßstange, Spiegel, Schutzblech) und es steigt dünner Rauch auf, ab 15 % dichter Rauch. Abgefallene Teile MUST als Physikobjekte herumfliegen und nach 10 Sekunden verschwinden.

#### Scenario: Teile fallen ab
- **WHEN** der Zustand eines Autos unter 40 % fällt
- **THEN** löst sich mindestens ein Teil sichtbar vom Auto und fällt zu Boden

#### Scenario: Trümmer verschwinden
- **WHEN** ein abgefallenes Teil 10 Sekunden am Boden liegt
- **THEN** wird es ausgeblendet und entfernt

### Requirement: Kindgerechter Totalschaden
Bei 0 % SHALL das Fahrzeug mit einem „Puff“ (Rauchwolke, Funken, lustiger Sound-Platzhalter, kleiner Hüpfer) zum fahruntüchtigen Wrack werden. Es MUST NOT Feuer, Explosionen mit Flammen oder Verletzte geben. Sitzt die Spielfigur darin, steigt sie automatisch unverletzt aus.

#### Scenario: Totalschaden mit Spieler
- **GIVEN** die Spielfigur fährt ein Auto mit 5 % Zustand
- **WHEN** das Auto erneut hart aufprallt
- **THEN** gibt es eine Rauchwolke ohne Feuer, die Figur steht unverletzt neben dem Wrack, und das Wrack lässt sich nicht mehr fahren

### Requirement: Wrack verschwindet, Fahrzeug erscheint wieder
Ein Wrack SHALL nach 20 Sekunden mit einer Rauchwolke verschwinden. An seiner ursprünglichen Parkposition MUST später wieder ein heiles Fahrzeug stehen, sobald die Kachel neu geladen wird oder die Position mindestens 60 Sekunden außer Sicht war.

#### Scenario: Wiedererscheinen
- **WHEN** ein geparktes Auto zerstört wurde und der Spieler sich mehr als 60 Sekunden lang so bewegt, dass die Parkposition außer Sicht ist
- **THEN** steht beim nächsten Vorbeikommen dort wieder ein heiles Auto

### Requirement: Zustand anzeigen
Im Fahrzeug SHALL ein einfacher Zustandsbalken (Herz- oder Schraubenschlüssel-Symbol, grün → gelb → rot) angezeigt werden, damit Kinder den Schaden ohne Zahlen verstehen.

#### Scenario: Balken färbt sich
- **WHEN** der Zustand eines Fahrzeugs unter 40 % fällt
- **THEN** wird der Zustandsbalken rot
