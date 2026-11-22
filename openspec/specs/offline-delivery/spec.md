# offline-delivery Specification

## Purpose

Liefert Kandern Chaos über Cloudflare als installierbare Web-App aus, die nach dem ersten vollständigen Laden ohne Internetverbindung startet und läuft und Spielstände lokal sichert.

## Requirements

### Requirement: Statische Auslieferung ohne Laufzeit-Server
Das Spiel SHALL ausschließlich aus statischen Dateien bestehen, die über Cloudflare ausgeliefert werden. Zur Laufzeit MUST es keine Server-Logik, kein Konto und keine Netzwerk-API benötigen.

#### Scenario: Spiel läuft ohne Backend
- **WHEN** das Spiel geladen ist und alle Netzwerkanfragen außer zu den eigenen statischen Dateien blockiert sind
- **THEN** startet und läuft das Spiel ohne Fehler

### Requirement: Vollständiges Vorladen beim ersten Besuch
Beim ersten Besuch SHALL die App alle Dateien laden und lokal speichern, die zum Spielen nötig sind (Code, Weltkacheln für die ganze Gemeinde, Texturen, Modelle, Audio). Der Fortschritt MUST sichtbar sein, und die App MUST melden, wann sie vollständig offline spielbar ist.

#### Scenario: Fortschrittsanzeige beim ersten Laden
- **WHEN** ein Gerät die App zum ersten Mal öffnet
- **THEN** zeigt die App den Download-Fortschritt in Prozent an
- **AND** meldet nach Abschluss deutlich "Bereit zum Offline-Spielen"

#### Scenario: Unterbrochener Download
- **WHEN** die Verbindung während des ersten Ladens abbricht
- **THEN** bleiben die bereits geladenen Dateien erhalten
- **AND** der Download setzt beim nächsten Online-Start dort fort, wo er abgebrochen ist

### Requirement: Offline-Start
Nach vollständigem Vorladen SHALL die App ohne Netzwerkverbindung starten, sowohl im Browser-Tab als auch vom Home-Bildschirm.

#### Scenario: Start im Flugmodus
- **GIVEN** die App wurde einmal vollständig geladen
- **WHEN** das Gerät im Flugmodus die App öffnet
- **THEN** startet das Spiel und die Welt der ganzen Gemeinde ist befahrbar bzw. begehbar

### Requirement: Installation auf dem Home-Bildschirm
Die App SHALL als Web-App auf dem Home-Bildschirm installierbar sein. Von dort gestartet MUST sie im Vollbild ohne Browser-Leisten, im Querformat und mit eigenem Namen und Icon ("Kandern Chaos") laufen.

#### Scenario: Start vom Home-Bildschirm
- **WHEN** der Nutzer die App über "Zum Home-Bildschirm" hinzufügt und von dort startet
- **THEN** läuft das Spiel im Vollbild ohne Safari-Leisten

### Requirement: Updates ohne Datenverlust
Ist online eine neue Version verfügbar, SHALL die App sie im Hintergrund laden und erst nach Bestätigung durch den Nutzer oder beim nächsten Start aktivieren. Spielstände MUST ein Update überstehen. Eine laufende Spielsitzung MUST NOT durch ein Update unterbrochen werden.

#### Scenario: Neue Version verfügbar
- **WHEN** die App online startet und eine neuere Version existiert
- **THEN** lädt sie die geänderten Dateien im Hintergrund
- **AND** zeigt einen Hinweis "Update bereit" an, ohne das laufende Spiel zu stoppen

#### Scenario: Spielstand nach Update
- **GIVEN** ein gespeicherter Spielstand
- **WHEN** eine neue Version aktiviert wird
- **THEN** ist der Spielstand weiterhin ladbar

### Requirement: Speicher-Budget
Die gesamte lokal gespeicherte Datenmenge der App SHALL höchstens 300 MB betragen. Der Build MUST fehlschlagen, wenn das Budget überschritten wird.

#### Scenario: Budget überschritten
- **WHEN** ein Build mehr als 300 MB an vorzuladenden Dateien erzeugt
- **THEN** bricht der Build mit einer Meldung ab, welche Dateigruppen wie viel Platz belegen

### Requirement: Lokale Spielstände
Die App SHALL Spielstände ausschließlich lokal auf dem Gerät speichern und automatisch in regelmäßigen Abständen sowie beim Verlassen des Spiels sichern.

#### Scenario: Automatisches Speichern
- **WHEN** der Nutzer die App schließt oder in den Hintergrund schickt
- **THEN** ist die aktuelle Spielerposition beim nächsten Start wiederhergestellt

### Requirement: Spielstand exportieren und importieren
Die App SHALL einen Spielstand als Datei exportieren und eine solche Datei wieder importieren können, damit Fortschritt nicht verloren geht, wenn der Browser lokale Daten löscht.

#### Scenario: Export und Import
- **WHEN** der Nutzer "Spielstand exportieren" wählt, die Daten der App gelöscht werden und er die Datei wieder importiert
- **THEN** ist der Fortschritt wiederhergestellt

#### Scenario: Ungültige Datei
- **WHEN** der Nutzer eine beschädigte oder fremde Datei importiert
- **THEN** zeigt die App eine verständliche Fehlermeldung
- **AND** der bestehende Spielstand bleibt unverändert

### Requirement: Quellenangaben im Spiel
Die App SHALL offline eine Seite mit Quellen- und Lizenzangaben aller verwendeten Daten und Bibliotheken anzeigen, mindestens "© OpenStreetMap-Mitwirkende" und die Namensnennung des LGL Baden-Württemberg.

#### Scenario: Lizenzseite offline erreichbar
- **WHEN** der Nutzer offline im Menü "Über das Spiel" öffnet
- **THEN** werden die Quellenangaben für OSM und LGL BW angezeigt
