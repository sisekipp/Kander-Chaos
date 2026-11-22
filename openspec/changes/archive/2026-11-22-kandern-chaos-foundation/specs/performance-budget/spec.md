# Spec Delta

## Purpose

Legt verbindliche, messbare Leistungsziele für das schwächste Zielgerät fest (iPad Pro 1. Generation mit Safari 16) und beschreibt, wie sie gemessen und eingehalten werden.

## ADDED Requirements

### Requirement: Referenzgerät
Das Referenzgerät für alle Leistungsziele SHALL ein iPad Pro der 1. Generation (A9X, 4 GB RAM) mit iPadOS 16 und Safari 16 sein. Die App MUST nur Browser-Funktionen voraussetzen, die Safari 16 bietet (insbesondere WebGL2, kein WebGPU).

#### Scenario: Start auf dem Referenzgerät
- **WHEN** die App auf dem Referenzgerät in Safari 16 geöffnet wird
- **THEN** startet sie ohne Hinweis auf fehlende Browser-Funktionen

### Requirement: Bildrate
Auf dem Referenzgerät SHALL das Spiel in der Testroute im Mittel mindestens 30 Bilder pro Sekunde erreichen. Das 1-%-Perzentil MUST bei mindestens 20 Bildern pro Sekunde liegen.

#### Scenario: Testroute durch die Kernstadt
- **WHEN** die festgelegte Testroute (Kernstadt -> Landstraße -> Ortsteil) auf dem Referenzgerät abgefahren wird
- **THEN** liegt die mittlere Bildrate bei mindestens 30 fps und das 1-%-Perzentil bei mindestens 20 fps

### Requirement: Speicherobergrenze
Der Speicherverbrauch der Seite auf dem Referenzgerät SHALL während der Testroute unter 900 MB bleiben, damit Safari den Tab nicht beendet.

#### Scenario: Keine Tab-Beendigung
- **WHEN** die Testroute dreimal hintereinander abgefahren wird
- **THEN** wird der Tab nicht von Safari neu geladen oder beendet
- **AND** der gemessene Speicherverbrauch bleibt unter 900 MB

### Requirement: Kachel-Erzeugungszeit
Die Erzeugung einer Kachel in voller Detailstufe SHALL auf dem Referenzgerät für die dichteste Kernstadt-Kachel höchstens 3 Sekunden dauern.

#### Scenario: Dichteste Kachel
- **WHEN** die Kachel mit den meisten Gebäuden in der Kernstadt auf dem Referenzgerät erzeugt wird
- **THEN** ist sie in höchstens 3 Sekunden bereit zur Anzeige

### Requirement: Startzeit
Nach dem ersten vollständigen Laden SHALL ein Offline-Start auf dem Referenzgerät bis zur spielbaren Welt höchstens 15 Sekunden dauern.

#### Scenario: Offline-Kaltstart
- **WHEN** die App auf dem Referenzgerät offline vom Home-Bildschirm gestartet wird
- **THEN** ist die Spielfigur nach höchstens 15 Sekunden steuerbar

### Requirement: Auflösungsskalierung
Die App SHALL die interne Render-Auflösung unabhängig von der Bildschirmauflösung skalieren und sie automatisch absenken, wenn die Bildrate dauerhaft unter das Ziel fällt. UI-Elemente MUST in voller Bildschirmauflösung scharf bleiben.

#### Scenario: Automatische Absenkung
- **WHEN** die Bildrate länger als 3 Sekunden unter 28 fps liegt
- **THEN** senkt die App die Render-Auflösung stufenweise bis zu einer festgelegten Untergrenze
- **AND** die Bedienelemente bleiben scharf

### Requirement: Grafikqualitätsstufen
Die App SHALL mindestens zwei Qualitätsstufen bieten ("Niedrig" für das Referenzgerät, "Hoch" für stärkere Geräte) und auf dem Referenzgerät standardmäßig "Niedrig" wählen.

#### Scenario: Standard auf schwachem Gerät
- **WHEN** die App zum ersten Mal auf dem Referenzgerät startet
- **THEN** ist die Qualitätsstufe "Niedrig" aktiv

### Requirement: Leistungsanzeige
Die App SHALL eine einblendbare Leistungsanzeige mit Bildrate, Bildzeit, Draw Calls, geladenen Kacheln und – soweit verfügbar – Speicherverbrauch bieten, die auch auf dem iPad bedienbar ist.

#### Scenario: Anzeige einblenden
- **WHEN** der Nutzer im Testmodus die Leistungsanzeige einschaltet
- **THEN** werden Bildrate, Draw Calls und Anzahl geladener Kacheln laufend angezeigt

### Requirement: Machbarkeitsnachweis Physik
Vor Folge-Changes, die Physik nutzen, SHALL auf dem Referenzgerät nachgewiesen sein, dass die gewählte Physik-Engine in Safari 16 läuft und mindestens 50 aktive, sich bewegende Physikkörper bei 30 fps zusammen mit einer Detailkachel simuliert. Das Ergebnis MUST dokumentiert sein.

#### Scenario: Physik-Stresstest
- **WHEN** im Testmodus 50 Physikkörper in einer Kernstadt-Kachel auf dem Referenzgerät fallen gelassen werden
- **THEN** bleibt die Bildrate im Mittel bei mindestens 30 fps
- **AND** das Messergebnis wird im Projekt festgehalten
