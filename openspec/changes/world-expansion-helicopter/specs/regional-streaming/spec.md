# Spec Delta

## Purpose

Regelt, wie das große regionale Spielgebiet ausgeliefert wird: Die Kernregion um Kandern ist immer offline verfügbar, weitere Regionen werden bei Bedarf von Cloudflare nachgeladen, auf dem Gerät begrenzt zwischengespeichert und ohne Netz sauber begrenzt.

## ADDED Requirements

### Requirement: Kern- und Nachladeregionen
Die Welt SHALL in eine Kernregion und Nachladeregionen eingeteilt sein. Die Kernregion MUST die Gemeinde Kandern mit einem Randstreifen von mindestens 500 m umfassen und wird wie bisher beim ersten Besuch vollständig vorgeladen. Alle übrigen Regionen MUST vom Cloudflare-Speicher (R2) über HTTPS abrufbar sein und sind nicht Teil des Vorladens.

#### Scenario: Erster Besuch
- **WHEN** die App zum ersten Mal geöffnet wird
- **THEN** lädt sie nur die Kernregion vor und meldet danach „Bereit zum Offline-Spielen“ für Kandern

#### Scenario: Region liegt nur im Netz
- **WHEN** eine Kachel außerhalb der Kernregion gebraucht wird
- **THEN** lädt das Spiel das zugehörige Regionspaket von Cloudflare nach

### Requirement: Nachladen in Bewegungsrichtung
Das Spiel SHALL Nachladeregionen rechtzeitig vor dem Spieler anfordern, mindestens für alle Kacheln, die in den nächsten 20 Sekunden bei aktueller Geschwindigkeit erreicht werden. Während des Nachladens MUST das Spiel flüssig bleiben.

#### Scenario: Flug Richtung Basel
- **WHEN** der Spieler mit dem Hubschrauber mit Höchstgeschwindigkeit von Kandern nach Basel fliegt und eine Verbindung von mindestens 10 Mbit/s besteht
- **THEN** ist unter dem Hubschrauber jederzeit Gelände geladen
- **AND** es gibt kein Einzelbild über 100 ms durch das Nachladen

### Requirement: Zwischenspeicher mit Budget
Nachgeladene Regionen SHALL auf dem Gerät zwischengespeichert werden, damit ein erneuter Besuch ohne Netz funktioniert. Der Zwischenspeicher MUST höchstens 400 MB belegen. Wird das Budget überschritten, MUST die am längsten nicht besuchte Region zuerst entfernt werden. Die Kernregion wird nie entfernt.

#### Scenario: Budget voll
- **WHEN** der Zwischenspeicher 400 MB erreicht und eine neue Region geladen wird
- **THEN** wird die am längsten nicht besuchte Nachladeregion gelöscht
- **AND** die Kernregion bleibt vollständig erhalten

#### Scenario: Erneuter Besuch offline
- **WHEN** der Spieler eine bereits besuchte, noch zwischengespeicherte Region ohne Netz erneut besucht
- **THEN** wird sie aus dem Zwischenspeicher geladen

### Requirement: Rand der geladenen Welt ohne Netz
Ist eine benötigte Region weder zwischengespeichert noch erreichbar, SHALL das Spiel den Spieler am Rand der geladenen Welt sanft aufhalten und einen kindgerechten Hinweis zeigen. Es MUST dabei weder abstürzen noch Löcher im Gelände zeigen.

#### Scenario: Offline an der Grenze
- **WHEN** der Spieler ohne Netz auf eine nicht geladene Region zufährt oder zufliegt
- **THEN** bremst das Fahrzeug vor dem Rand ab
- **AND** erscheint der Hinweis „Hier geht es nur mit Internet weiter“

### Requirement: Ladezustand sichtbar
Das Spiel SHALL anzeigen, wenn gerade eine Region nachgeladen wird, und in den Einstellungen anzeigen, wie viel Speicher die zwischengespeicherten Regionen belegen. Der Spieler MUST den Zwischenspeicher dort leeren können, ohne Spielstand und Kernregion zu verlieren.

#### Scenario: Speicher leeren
- **WHEN** der Spieler in den Einstellungen „Gespeicherte Regionen löschen“ wählt
- **THEN** sind alle Nachladeregionen entfernt
- **AND** Spielstand und Kernregion bleiben erhalten

### Requirement: Datenstand passt zusammen
Nachladeregionen und Kernregion SHALL zum selben Datenstand gehören. Erscheint ein neuer Datenstand, MUST das Spiel veraltete zwischengespeicherte Regionen verwerfen und nicht mit neuen Kacheln mischen.

#### Scenario: Neuer Datenstand
- **WHEN** nach einem Update ein neuer Datenstand gilt
- **THEN** lädt das Spiel Nachladeregionen nur noch in der neuen Version
- **AND** löscht zwischengespeicherte Regionen des alten Stands
