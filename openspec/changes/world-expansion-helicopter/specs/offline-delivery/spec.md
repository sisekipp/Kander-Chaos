# Spec Delta

## MODIFIED Requirements

### Requirement: Vollständiges Vorladen beim ersten Besuch
Beim ersten Besuch SHALL die App alle Dateien laden und lokal speichern, die zum Spielen in der Kernregion nötig sind (Code, Weltkacheln der Kernregion, Texturen, Modelle, Audio). Nachladeregionen gehören nicht dazu. Der Fortschritt MUST sichtbar sein, und die App MUST melden, wann die Kernregion vollständig offline spielbar ist.

#### Scenario: Fortschrittsanzeige beim ersten Laden
- **WHEN** ein Gerät die App zum ersten Mal öffnet
- **THEN** zeigt die App den Download-Fortschritt in Prozent an
- **AND** meldet nach Abschluss deutlich "Bereit zum Offline-Spielen"

#### Scenario: Unterbrochener Download
- **WHEN** die Verbindung während des ersten Ladens abbricht
- **THEN** bleiben die bereits geladenen Dateien erhalten
- **AND** der Download setzt beim nächsten Online-Start dort fort, wo er abgebrochen ist

### Requirement: Speicher-Budget
Die vorgeladene Datenmenge der App (Code, Kernregion, Assets) SHALL höchstens 300 MB betragen. Der Build MUST fehlschlagen, wenn dieses Budget überschritten wird. Zusätzlich darf der Zwischenspeicher für Nachladeregionen höchstens 400 MB belegen, sodass die App insgesamt unter 700 MB bleibt.

#### Scenario: Budget überschritten
- **WHEN** ein Build mehr als 300 MB an vorzuladenden Dateien erzeugt
- **THEN** bricht der Build mit einer Meldung ab, welche Dateigruppen wie viel Platz belegen

#### Scenario: Gesamtspeicher auf dem Gerät
- **WHEN** der Spieler viele Regionen besucht hat
- **THEN** belegt die App insgesamt höchstens 700 MB
