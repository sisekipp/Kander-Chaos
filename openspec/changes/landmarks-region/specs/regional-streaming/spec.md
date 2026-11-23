# Spec Delta

## ADDED Requirements

### Requirement: Modelle der Region nachladen
Die Modelldateien der Wahrzeichen in Nachladeregionen SHALL nicht zum Offline-Kern gehören. Sie MUST erst bei Annäherung geladen werden und im selben Zwischenspeicher wie die Regionspakete liegen; sie zählen zu dessen Budget von 400 MB. Fehlt ein Modell ohne Netz, MUST das generierte Gebäude stehen bleiben, statt dass eine Lücke entsteht.

#### Scenario: Erster Besuch lädt keine Regionsmodelle
- **WHEN** das Spiel zum ersten Mal geladen wird
- **THEN** werden keine Modelle von Wahrzeichen außerhalb der Kernregion geladen
- **AND** das Offline-Budget von 300 MB ist eingehalten

#### Scenario: Modell kommt mit der Region
- **WHEN** der Spieler sich mit Netz dem Basler Münster nähert
- **THEN** ist dessen Modell geladen, bevor seine Kachel Ring 1 erreicht

#### Scenario: Offline ohne Modell
- **WHEN** eine Region aus dem Zwischenspeicher geladen wird, deren Wahrzeichen-Modell fehlt, und kein Netz da ist
- **THEN** steht an dieser Stelle das generierte Gebäude
