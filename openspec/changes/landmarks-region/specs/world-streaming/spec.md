# Spec Delta

## MODIFIED Requirements

### Requirement: Fernsicht über die Region
Die Welt SHALL im Flug eine Fernsicht bis mindestens 12 km darstellen: grobes Gelände der ganzen Region und Silhouetten von Hochhäusern und Wahrzeichen aus den Fernsicht-Listen. Wahrzeichen MUST dabei eine vereinfachte Form ihres Modells zeigen (z. B. Türme des Münsters, Stufen der Roche-Türme) statt eines Quaders. Die Fernsicht MUST mit wenigen Draw Calls auskommen (höchstens 30 zusätzliche) und darf keine Detailkacheln voraussetzen.

#### Scenario: Silhouette von Basel
- **WHEN** die Kamera über Kandern in 300 m Höhe nach Süden blickt
- **THEN** sind Basler Hochhäuser als Silhouetten zu sehen, obwohl ihre Kacheln nicht geladen sind

#### Scenario: Wahrzeichen in der Ferne erkennbar
- **WHEN** die Kamera aus 5 km Entfernung auf das Basler Münster blickt
- **THEN** zeigt die Silhouette die beiden Türme und nicht nur einen Quader

#### Scenario: Silhouette weicht Detail
- **WHEN** eine Kachel mit Hochhaus oder Wahrzeichen in Ring 1 oder näher geladen wird
- **THEN** verschwindet dessen Silhouette und das Detailgebäude steht an derselben Stelle
