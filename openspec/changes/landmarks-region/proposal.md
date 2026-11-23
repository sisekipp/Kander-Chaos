# Proposal

## Why

Die Welt reicht jetzt bis Müllheim, Lörrach, Weil am Rhein, Basel und zum EuroAirport. Eigene Modelle haben aber bisher nur die 48 Wahrzeichen rund um Kandern. In der neuen Region stehen überall nur automatisch erzeugte Blöcke: Der Roche-Turm ist ein grauer Quader, das Basler Münster ein Haus mit Satteldach, und der Flughafen hat kein Terminal. Gerade beim Hubschrauberflug fällt das sofort auf. Die Kinder sollen Basel, Lörrach und den Flughafen von oben wiedererkennen.

## What Changes

- **Neue Wahrzeichen aus Blender** (nach Fotos, ohne Logos und Schriftzüge), rund 30 Modelle:
  - **Basel:**
    - Hochhäuser: Roche-Turm Bau 1 und Bau 2, Messeturm, BIZ-Turm, Claraturm
    - Münster, Rathaus, Spalentor, Mittlere Brücke
    - Bahnhof SBB, Badischer Bahnhof, Messe Basel mit dem Ring der Halle 1, St. Jakob-Park
  - **Weil am Rhein:**
    - Vitra-Bauten (Feuerwehrhaus, Dachpavillon, Rutschturm)
    - Dreiländerbrücke
  - **Lörrach:**
    - Burg Rötteln (Ruine), Rathaus-Hochhaus, Bahnhof
  - **Müllheim:**
    - Martinskirche, Bahnhof
  - **EuroAirport:**
    - Terminal mit Fluggastbrücken, Tower, Hangars
    - fünf geparkte Flugzeuge in Fantasie-Lackierung (stehen still, bewegen sich nicht)
- **Liste und Zuordnung:**
  - Die Pipeline ordnet die Wahrzeichen über eine gepflegte Liste (OSM-ID oder Koordinate, Name, Bauvorlage) den Gebäuden zu.
  - Freie Bauten ohne eigenen OSM-Grundriss (Flugzeuge, Brücken) werden über Koordinaten gesetzt.
- **Neue Bauvorlagen** für die Blender-Skripte:
  - Hochhaus: Turm mit Stufen, Glasfassade und Kern
  - Bahnhofshalle mit Gleisdach
  - Terminal, Tower, Hangar, Flugzeug
  - Brücke mit Bögen
  - Stadion, Messehalle
- **Fernsicht:**
  - Diese Wahrzeichen erscheinen jenseits der geladenen Kacheln als eigene grobe Silhouette (vereinfachte Form statt Quader). Basel ist dann von Kandern aus am Münster und an den Roche-Türmen zu erkennen.
- **Laden:**
  - Die Modelle der Region gehören nicht zum Offline-Kern.
  - Sie werden wie die Nachladeregionen erst bei Annäherung geladen und im Region-Cache gespeichert.
  - So bleibt das Offline-Budget von 300 MB unberührt.

## Capabilities

### New Capabilities

- `regional-landmarks`:
  - Wahrzeichen der Region: Auswahl über die gepflegte Liste, Blender-Modelle nach Fotos
  - Platzierung auf OSM-Grundrissen oder freien Koordinaten
  - Ersetzen des generierten Gebäudes im Nahbereich
  - Silhouetten in der Fernsicht
  - Nachladen der Modelle bei Annäherung

### Modified Capabilities

- `world-streaming`: Die Fernsicht zeigt für Wahrzeichen eine vereinfachte Form statt eines Quaders.
- `regional-streaming`: Außer Kachelpaketen werden auch die Modelldateien der Region nachgeladen, mit demselben Region-Cache und demselben Budget.

## Impact

- **Asset-Pipeline** (`tools/asset-pipeline/blender/`): neue Bauvorlagen, Handarbeit für die bekanntesten Bauten, Grenzen für die Dreiecke je Modell, Ausgabe nach `apps/game/public/models-remote/`.
- **Welt-Pipeline** (`tools/world-pipeline/src/landmarks/`): Liste der Region, Zuordnung zu OSM-Gebäuden, freie Wahrzeichen, Silhouetten-Formen in `skyline.json`.
- **Spiel:**
  - `LandmarkLayer` lädt Modelle bei Bedarf über den Region-Cache.
  - `world/far/` zeigt Silhouetten als einfache Formen.
  - Der Service Worker lädt `models-remote/` nicht vor.
- **Größe:** etwa 6–10 MB zusätzliche Modelldateien im Git und im Deploy. Der Offline-Kern wächst nicht.
- **Nicht enthalten:**
  - fahrende Züge (Change `trains`)
  - startende und landende Flugzeuge (Change `airport-planes`)
