# Quellmodelle

Originaldateien der Modellpakete, je Paket ein Unterordner (z. B. `<paketname>/`). Diese Dateien kommen nicht in den Build. Ins Spiel gelangt nur, was ein Rezept in `assets/recipes/` auswählt und die Asset-Pipeline optimiert.

Jedes verwendete Modell braucht einen Eintrag in `assets/registry.json` (Quelle, Paket, Lizenz, Abrufdatum, Stilprüfung, Änderungen). Ohne Eintrag bricht der Build ab.

## Versionierte Quellen

- Derzeit keine: Alle Modelle sind eigene Modelle aus der Blender-Kommandozeile und liegen unter `assets/own/`. Neu erzeugen mit `blender -b --python-exit-code 1 -P tools/asset-pipeline/blender/<skript>.py -- assets/own` (`props.py`, `vehicles.py`, `cars.py`).
