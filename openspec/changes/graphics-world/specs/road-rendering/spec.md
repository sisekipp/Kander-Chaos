# Spec Delta

## Purpose

Stellt das Straßennetz so dar, dass man Straßentypen auf einen Blick unterscheidet. Dazu gehören Markierungen, Zebrastreifen, Gehwege, saubere Kreuzungen, Brücken und Tunnel im stilisierten Look, alles ohne Texturdateien und innerhalb des Leistungsbudgets.

## ADDED Requirements

### Requirement: Straßentypen unterscheidbar
Jede Straßenart SHALL ein eigenes Erscheinungsbild haben, mindestens:
- **Autobahn**: breite Fahrbahn je Richtung, grüner oder betonierter Mittelstreifen, Leitplanken
- **Bundes- und Hauptstraße**: dunkler Asphalt mit Mittellinie und Randlinien
- **Wohnstraße**: schmaler Asphalt ohne Mittellinie
- **Feldweg**: zwei Fahrspuren mit Grasstreifen in der Mitte
- **Fuß- und Radweg**: hell bzw. rötlich, schmal
- **Treppe**

#### Scenario: Autobahn und Feldweg nebeneinander
- **WHEN** im Bild eine Autobahn und ein Feldweg zu sehen sind
- **THEN** unterscheiden sie sich deutlich in Breite, Farbe und Ausstattung (Mittelstreifen/Leitplanke bzw. Grasstreifen)

#### Scenario: Hauptstraße und Wohnstraße
- **WHEN** eine Hauptstraße in eine Wohnstraße mündet
- **THEN** hat die Hauptstraße eine Mittellinie, die Wohnstraße nicht

### Requirement: Fahrbahnmarkierungen
Straßen mit mindestens zwei Fahrstreifen SHALL Markierungen tragen: Mittellinie (gestrichelt, auf Autobahnen Fahrstreifenbegrenzung), durchgehende Randlinien auf Haupt- und Bundesstraßen. Markierungen MUST im Shader aus Straßenkoordinaten entstehen (keine Texturdateien) und dürfen in der Nähe nicht flimmern oder verschwimmen.

#### Scenario: Gestrichelte Mittellinie
- **WHEN** der Spieler auf einer Hauptstraße fährt
- **THEN** sieht er eine gleichmäßig gestrichelte Mittellinie, die der Straßenkurve folgt

### Requirement: Zebrastreifen
An Fußgängerüberwegen aus den Kartendaten SHALL ein Zebrastreifen quer über die Fahrbahn dargestellt werden.

#### Scenario: Überweg in der Kernstadt
- **WHEN** in den Kartendaten an einer Straße der Kernstadt ein Fußgängerüberweg eingetragen ist
- **THEN** ist dort ein Zebrastreifen zu sehen

### Requirement: Gehwege mit Bordstein
Innerörtliche Straßen SHALL Gehwege mit leicht erhöhtem Bordstein haben: aus den Kartenangaben (`sidewalk=*`), sonst nach dokumentierten Regeln (Wohn- und Hauptstraßen im bebauten Umfeld beidseitig). Gehwege MUST NOT in Gebäude ragen.

#### Scenario: Wohnstraße im Ort
- **WHEN** der Spieler eine Wohnstraße in der Kernstadt entlanggeht
- **THEN** verläuft neben der Fahrbahn ein Gehweg mit Bordsteinkante

### Requirement: Saubere Kreuzungen
An Kreuzungen und Einmündungen SHALL eine zusammenhängende Kreuzungsfläche gezeichnet werden. Straßenbänder enden an ihrem Rand und überlappen nicht sichtbar. Markierungen enden vor der Kreuzungsfläche.

#### Scenario: Dreier-Einmündung
- **WHEN** der Spieler auf eine T-Kreuzung schaut
- **THEN** ist die Kreuzung eine einheitliche Fläche ohne Überlappungskanten oder durchlaufende Mittellinien

### Requirement: Brücken mit eigener Höhe
Als Brücke markierte Straßen SHALL ihre Fahrbahnhöhe zwischen den Brückenenden gleichmäßig verlaufen lassen statt dem Gelände darunter zu folgen. Sie MUST Geländer und, wo die Fahrbahn mehr als 3 m über dem Gelände liegt, Pfeiler haben und befahrbar sein (Kollision).

#### Scenario: Brücke über ein Tal
- **WHEN** eine Straßenbrücke über die Kander oder ein Tal führt
- **THEN** verläuft die Fahrbahn eben bzw. gleichmäßig geneigt über das Tal, mit Geländer, ohne ins Tal abzutauchen

#### Scenario: Über eine Brücke fahren
- **WHEN** der Spieler mit dem Auto über eine Brücke fährt
- **THEN** fährt er auf der Brückenfahrbahn und fällt nicht hindurch

### Requirement: Tunnel
Als Tunnel markierte Straßen SHALL an ihren Enden ein Tunnelportal zeigen und im Inneren nicht gezeichnet werden.

#### Scenario: Tunneleinfahrt
- **WHEN** eine Straße in einen Tunnel führt
- **THEN** ist am Übergang ein Portal im Hang zu sehen

### Requirement: Straßen-Draw-Calls
Straßen, Gehwege, Kreuzungen und Brücken einer Ring-0-Kachel SHALL zusammen höchstens 4 Draw Calls verursachen.

#### Scenario: Dichte Kernstadt-Kachel
- **WHEN** die Kachel am Blumenplatz geladen ist
- **THEN** verursachen ihre Straßenelemente höchstens 4 Draw Calls
