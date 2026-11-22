# Spec Delta

## ADDED Requirements

### Requirement: Fernsicht über die Region
Die Welt SHALL im Flug eine Fernsicht bis mindestens 12 km darstellen: grobes Gelände der ganzen Region und Silhouetten von Hochhäusern und Wahrzeichen aus den Fernsicht-Listen. Die Fernsicht MUST mit wenigen Draw Calls auskommen (höchstens 30 zusätzliche) und darf keine Detailkacheln voraussetzen.

#### Scenario: Silhouette von Basel
- **WHEN** die Kamera über Kandern in 300 m Höhe nach Süden blickt
- **THEN** sind Basler Hochhäuser als Silhouetten zu sehen, obwohl ihre Kacheln nicht geladen sind

#### Scenario: Silhouette weicht Detail
- **WHEN** eine Kachel mit Hochhaus in Ring 1 oder näher geladen wird
- **THEN** verschwindet dessen Silhouette und das Detailgebäude steht an derselben Stelle

### Requirement: Streaming folgt dem Hubschrauber
Fliegt der Spieler Hubschrauber, SHALL das Streaming dem Hubschrauber folgen, mit Vorausladen in Flugrichtung entsprechend der Geschwindigkeit. Über 120 m Flughöhe MUST die volle Detailstufe wie im Flugmodus abgeschaltet werden und unter 100 m wieder angehen.

#### Scenario: Steigflug
- **WHEN** der Hubschrauber über 120 m steigt
- **THEN** werden keine Kacheln in voller Detailstufe mehr geladen, die mittlere Stufe bleibt
