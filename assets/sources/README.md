# Quellmodelle

Originaldateien der Modellpakete, je Paket ein Unterordner (z. B. `quaternius-ultimate-characters/`). Diese Dateien kommen nicht in den Build. Ins Spiel gelangt nur, was ein Rezept in `assets/recipes/` auswählt und die Asset-Pipeline optimiert.

Jedes verwendete Modell braucht einen Eintrag in `assets/registry.json` (Quelle, Paket, Lizenz, Abrufdatum, Stilprüfung, Änderungen). Ohne Eintrag bricht der Build ab.

## Versionierte Quellen

- `kenney-car-kit/`: Kenney Car Kit 3.1 (CC0, https://kenney.nl/assets/car-kit). Im Repository liegen nur die genutzten Modelle (`sedan`, `hatchback-sports`, `suv-luxury`, `van`), die Paletten-Textur und die Lizenz. Für weitere Modelle das Paket von kenney.nl laden und hier entpacken.
- Eigene Modelle liegen unter `assets/own/` und werden mit `blender -b --python-exit-code 1 -P tools/asset-pipeline/blender/props.py -- assets/own` neu erzeugt.
