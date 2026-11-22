# Spec Delta

## ADDED Requirements

### Requirement: Kleinobjekte im deutschen Stil
Kleinobjekte SHALL Modelle aus der Asset-Pipeline nutzen, die zu einer deutschen Kleinstadt passen: Mülleimer, Parkbank, Straßenlaterne, Verkehrsschilder in StVO-Form und -Farbe (ohne Text), Gartenzaun und Büsche in mehreren Formen. Die Trümmerteile MUST zum jeweiligen Objekt passen (Farbe und Material).

#### Scenario: Verkehrsschild
- **WHEN** der Spieler vor einem Verkehrsschild steht
- **THEN** hat es die Form und Farben eines StVO-Schildes

#### Scenario: Zerbrochener Zaun
- **WHEN** ein Gartenzaun zerbricht
- **THEN** sind die Trümmer Holzlatten in der Farbe des Zauns

### Requirement: Weitere Kleinobjekte im Ortsbild
Die Welt SHALL zusätzlich Briefkästen, Hydranten, Poller, Fahrradbügel, Litfaßsäulen und Blumenkübel enthalten, dazu Verkehrsschilder „Vorfahrt gewähren“ (Dreieck), „Fußgängerüberweg“ (blaues Quadrat) und Haltestellenschilder. Die Positionen MUST aus OSM stammen (`amenity=post_box`, `emergency=fire_hydrant`, `barrier=bollard`, `amenity=bicycle_parking`, `advertising=column`, `traffic_sign=DE:205`/`DE:206`, `DE:350`, `highway=bus_stop`); Blumenkübel setzen Ergänzungsregeln an Plätzen und Fußgängerbereichen. Auch diese Modelle tragen keinen Text und keine Logos.

#### Scenario: Briefkasten
- **WHEN** an einer Stelle in OSM ein Briefkasten eingetragen ist
- **THEN** steht dort im Spiel ein gelber Briefkasten ohne Schriftzug

#### Scenario: Dreieckiges Vorfahrtsschild
- **WHEN** an einer Einmündung in OSM „Vorfahrt gewähren“ eingetragen ist
- **THEN** steht dort ein weißes, rot umrandetes, auf der Spitze stehendes Dreieck

## MODIFIED Requirements

### Requirement: Verhalten beim Anfahren
Kleinobjekte SHALL im Ruhezustand statisch und billig sein. Wird ein Objekt von einem Fahrzeug oder der Spielfigur über einer artabhängigen Schwelle getroffen, MUST es reagieren: Mülleimer, Bänke und Briefkästen werden zu Physikkörpern und kippen oder fliegen weg, Büsche, Zaunfelder, Schilder, Fahrradbügel und Blumenkübel zerbrechen in 3–8 vorgefertigte Teile, Laternen, Poller, Hydranten und Litfaßsäulen knicken bzw. kippen um. Hydranten, Poller und Litfaßsäulen halten die Spielfigur zu Fuß auf.

#### Scenario: Mülleimer anfahren
- **WHEN** ein Auto mit 30 km/h einen Mülleimer trifft
- **THEN** fliegt der Mülleimer physikalisch weg und das Auto fährt weiter

#### Scenario: Busch durchfahren
- **WHEN** ein Fahrrad mit 20 km/h durch einen Busch fährt
- **THEN** zerfällt der Busch in Teile, und das Fahrrad wird nur leicht abgebremst

#### Scenario: Zu Fuß gegen eine Laterne laufen
- **WHEN** die Spielfigur zu Fuß gegen eine Laterne läuft
- **THEN** bleibt die Laterne stehen und hält die Figur auf

#### Scenario: Poller anfahren
- **WHEN** ein Auto mit 40 km/h einen Poller trifft
- **THEN** knickt der Poller um und das Auto wird deutlich abgebremst

### Requirement: Kleinobjekte stören das Streaming nicht
Kleinobjekte SHALL nur in Ring-0-Kacheln geladen werden und als Thin Instances bzw. zusammengeführte Meshes gezeichnet werden. Pro Kachel MUST ihr Beitrag zu den Draw Calls höchstens 12 betragen (eine sichtbare Form je Draw Call). Die Pipeline MUST prüfen, dass keine Kachel mehr als 12 verschiedene Formen enthält.

#### Scenario: Draw Calls einer dichten Kachel
- **WHEN** die Kachel am Blumenplatz mit allen Kleinobjekten geladen ist
- **THEN** zeigt die Leistungsanzeige durch die Kleinobjekte höchstens 12 zusätzliche Draw Calls für diese Kachel

