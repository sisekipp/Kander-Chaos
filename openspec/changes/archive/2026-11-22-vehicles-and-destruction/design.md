# Design: Fahrzeuge und Zerstörung

## Context

Motivation und Umfang stehen in `proposal.md`, die Anforderungen in den Specs `vehicles`, `vehicle-damage`, `destructible-props` und der Ergänzung zu `world-data-pipeline`.

Vorhandene Bausteine aus den Grundlagen:
- **Havok** (Physics V2), referenzgezählt in `engine/physics/havok.ts`, auf dem iPad Pro 1. Gen abgenommen.
- **Kachel-Streaming**: `TileManager` mit zeitgestückeltem Upload, Ring 0 hat Kollision (Heightfield plus Gebäude-Mesh-Shape), `heightAt()`.
- **Spielfigur**: `Player` mit Havok-Character-Controller, Eingabe über das veränderliche Objekt `player/input.ts`, Touch-Joystick in `ui/TouchControls.tsx`.
- **Kachelformat**: Leser überspringen unbekannte Abschnitte, neue optionale Abschnitte brauchen keine neue Formatversion.
- **Wichtige Lehre aus Phase 0**: Thin Instances brauchen eine eigene Geometrie je Mesh und keinen eingefrorenen Elternknoten, sonst überschreiben sich die Instanzpuffer bzw. werden nicht gezeichnet.

## Goals / Non-Goals

**Goals:**
- Fahrgefühl „sofort Spaß“ für 8- bis 12-Jährige: verzeihend, gut lenkbar, kein Simulationsanspruch.
- Kosten bleiben vorhersagbar: harte Obergrenzen für Fahrzeuge, dynamische Körper, Trümmer und Draw Calls.
- Alle Modelle prozedural im Code (keine Modelldateien, keine Lizenzfragen, winzige Downloads).

**Non-Goals:**
- Keine realistische Reifen- oder Motorsimulation, keine Gangschaltung.
- Kein Verformen von Fahrzeug-Meshes (zu teuer für den A9X). Schaden besteht aus Farbe, abfallenden Teilen und Partikeln.
- Kein Verkehr und keine KI-Fahrer. Fahrzeuge bewegen sich nur, wenn der Spieler sie fährt oder anstößt.
- Kein Audio (nur Platzhalter-Hooks).

## Decisions

### D1 Eigenes Raycast-Fahrzeug auf Havok (Arcade)

Jedes Fahrzeug mit voller Physik besteht aus einem dynamischen Havok-Körper (Box-Shape, tiefer Schwerpunkt) und **Raycasts je Rad** (`physicsEngine.raycastToRef`):

```
  Pro Physikschritt und Rad:
  Raycast nach unten (Federweg) -> Treffer?
     ja:  Federkraft  F = k * Einfederung - d * Federgeschwindigkeit   (am Radpunkt)
          Antrieb     F = Gas * Motorkraft(Geschwindigkeit)             (Antriebsräder, in Radrichtung)
          Seitenhalt  F = -Seitengeschwindigkeit * Grip                (verhindert Rutschen)
          Bremse      F = -Längsgeschwindigkeit * Bremskraft
     nein: nichts (Rad in der Luft)
  Lenkung: Vorderrad-Richtung = Lenkwinkel * (1 - Geschwindigkeitsanteil * 0.6)
  Begrenzung: Höchstgeschwindigkeit je Art, Drehgeschwindigkeit um die Hochachse
```

Arcade-Hilfen: zusätzlicher Abtrieb proportional zur Geschwindigkeit, gedämpfte Rollbewegung, **Selbstaufrichten** nach 2 s ohne Bodenkontakt der Räder (sanftes Drehmoment, bei Bedarf Teleport um 1 m nach oben in aufrechter Lage).

**Zweiräder** nutzen dasselbe Modell mit 2 Rädern plus einem „virtuellen Stabilisator“: Die Rollachse wird per Drehmoment auf einen Zielneigungswinkel geregelt (proportional zu Lenkung × Geschwindigkeit). Damit bleiben sie aufrecht und neigen sich sichtbar in die Kurve.

Fahrwerte je Art (Startwerte, werden im Spiel abgestimmt):

| Art | v_max | 0→50 km/h | Masse | Räder |
|---|---|---|---|---|
| Auto | 80 km/h | ~4 s | 1000 kg | 4 (Heck- oder Allrad) |
| Motorrad | 90 km/h | ~3 s | 250 kg | 2 |
| Fahrrad | 30 km/h | ~5 s bis v_max | 90 kg | 2 |

*Alternativen:* Havok-Constraints mit echten Radkörpern (instabil bei kleinen Zeitschritten, teurer); rein kinematische Fahrzeuge (keine glaubwürdigen Zusammenstöße). Verworfen.

### D2 Prozedurale Low-Poly-Fahrzeuge mit lösbaren Teilen

Fahrzeuge werden aus wenigen Grundkörpern gebaut (Karosserie, Kabine, Räder, Stoßstangen, Spiegel bzw. Lenker, Schutzbleche). Teile, die abfallen können, sind eigene Kind-Meshes. Farben kommen aus einer kindgerechten Palette, deterministisch aus der Parkpositions-ID. Ein Material je Fahrzeug (max. 24) erlaubt Schadensfärbung ohne Shader-Varianten.

### D3 Fahrzeug-Manager mit Physik-LOD

```
  Parkpositionen (Ring-0-Kacheln) --> VehicleManager
     |  max. 24 aktive Fahrzeuge, nächste zuerst
     v
  ruhend  : STATIC-Körper (billig), Mesh eingefroren
     | getroffen (Kollisionsereignis) oder Spieler steigt ein
     v
  dynamisch: volle Raycast-Physik (max. 8, nächste zum Spieler)
     | 5 s ruhig und weit vom Spieler
     v
  ruhend  (an neuer Stelle)
```

Bewegte Fahrzeuge werden im Manager mit Position gemerkt. Das zuletzt gefahrene bleibt bis 1 km Entfernung erhalten, auch wenn seine Kachel entladen wird. Zerstörte Parkpositionen merkt sich der Manager mit Zeitstempel, damit sie erst nach 60 s außer Sicht oder nach dem Neuladen der Kachel wieder besetzt werden.

### D4 Schaden über Kollisionsereignisse

Havok-Kollisionsereignisse (`body.setCollisionCallbackEnabled(true)`, `getCollisionObservable()`) liefern Kontaktpunkt und Partner. Die Aufprallgeschwindigkeit ist die Relativgeschwindigkeit entlang der Kontaktnormalen:

```
  Schaden = 0                               für v < 10 km/h
  Schaden = a * (v - 10 km/h)^1.4           sonst (a so gewählt, dass 60 km/h gegen Wand ≈ 35 %)
  Partner = Kleinobjekt -> Schaden = min(Schaden, 2 %)
```

Pro Fahrzeug höchstens ein Schadensereignis je 150 ms (Kontakte prellen). Stufen 70/40/15 % schalten Färbung, abfallende Teile (Teil abkoppeln: Elternknoten lösen, kleiner dynamischer Körper mit Startimpuls) und Partikel. Bei 0 % folgen „Puff“ (Partikelstoß), Wrack (dunkle Farbe, Räder ab, Steuerung gesperrt) und automatisches Aussteigen über dieselbe Logik wie in D7.

### D5 Kleinobjekte: statisch zeichnen, geometrisch treffen, erst dann Physik

Ruhende Kleinobjekte haben **keine** Physikkörper: Sie werden als Thin Instances je Art und Kachel gezeichnet, mit eigener Geometrie je Mesh (siehe Context). Getroffen wird über ein 2D-Raster (4-m-Zellen) je Ring-0-Kachel:

```
  pro Bild: für Spielfigur und dynamische Fahrzeuge
     Kreis-gegen-Kreis-Test gegen Props in den Nachbarzellen
     Geschwindigkeit > Schwelle(Art)?  -> Prop "auslösen":
        Instanz ausblenden (Matrix mit Skalierung 0, Puffer-Update)
        Mülleimer/Bank: Ersatzkörper (dynamisch) mit Impuls aus Fahrzeuggeschwindigkeit
        Busch/Zaun/Schild: 3–8 vorgefertigte Trümmerteile (dynamisch, klein)
        Laterne: Ersatzkörper, der um den Fuß kippt (Gelenkpunkt per Startdrehimpuls)
     unter Schwelle und Art blockiert (Laterne, Schild, Bank):
        wird über statische Kapsel-Collider im Umkreis von 30 m um den Spieler gelöst
```

Die blockierenden Collider (nur Laternen, Schilder, Bänke im Nahbereich) halten die Zahl statischer Körper klein. Büsche und Zäune blockieren zu Fuß nicht, das ist bewusst verzeihend.

*Alternative:* ein statischer Körper pro Prop (bis ca. 1000 in Ring 0). Verworfen wegen Ladezeit und Speicher auf dem A9X.

### D6 Physik-Budget-Manager

Ein zentrales Register aller dynamischen Körper (Fahrzeuge, ausgelöste Props, Trümmer, Fahrzeugteile) mit Erstellzeit und Ruhezustand. Bei mehr als 80 Körpern werden zuerst die ältesten ruhenden Trümmer entfernt, dann ruhende Props zu STATIC eingefroren. Trümmer verschwinden nach 8 s Ruhe, Fahrzeugteile nach 10 s, Wracks nach 20 s, jeweils mit kurzem Ausblenden (Skalierung gegen 0). Höchstens 60 Trümmerteile gleichzeitig.

### D7 Ein- und Aussteigen, Modus-Wechsel

`PlayerController` bekommt die Zustände `walking` und `driving(vehicle)`. Einsteigen blendet die Figur aus und parkt den Character Controller an der Fahrzeugposition, wo er keine Kollisionen erzeugt. Aussteigen prüft Kandidatenpunkte (links, rechts, hinten, vorne; 1,8 m vom Fahrzeug) per Shape-Cast bzw. Raycast auf freien Platz und Boden. Der erste freie Punkt gewinnt, sonst wird der Punkt 3 m über dem Fahrzeug gewählt. Über 15 km/h wird zuerst automatisch gebremst.

### D8 Eingabe, Touch-Layout und Kamera

`input` wird um `gas`, `brake`, `horn` und das einmalige Ereignis `action` erweitert. Die Touch-UI wechselt mit dem Modus:

```
  Laufen:  [Joystick]                                  [Einsteigen*] [Springen]
  Fahren:  [Joystick = Lenken]          [Hupe] [Bremse/Rück] [GAS]   [Aussteigen]
           * nur wenn ein Fahrzeug ≤ 3 m entfernt ist
```

Der „Einfach“-Modus (Einstellung, Standard an) gibt automatisch Gas, solange der Joystick ausgelenkt ist. Die Kamera bekommt einen gemeinsamen `CameraRig`: Zu Fuß dreht man frei, beim Fahren folgt die Kamera hinter dem Fahrzeug. Der Abstand wächst mit der Geschwindigkeit, nach einem Wisch schwenkt sie innerhalb von 2 s zurück.

### D9 Pipeline: Straßenmöbel, Grenzen, Parkpositionen

- **Zusätzlicher fortsetzbarer Overpass-Abruf** in denselben Teilstücken: `highway=street_lamp|traffic_signals`, `amenity=waste_basket|bench|parking|bicycle_parking`, `traffic_sign=*`, `barrier=fence|hedge|wall`, `leisure=playground`. Ablage unter `data/raw/osm-props-chunks/`.
- **Neuer Kachelabschnitt 6 „Props“**: `u32 n`, je Prop `u8 kind, f32 x, f32 z, f32 rot, u8 variant`; `u32 m`, je Parkposition `f32 x, f32 z, f32 heading, u8 kind, f64 id`. Zäune und Hecken werden in der Pipeline in Felder von 2,5 m Länge zerlegt (je Feld ein Prop).
- **Deterministische Ergänzung** (Zufall aus Weg-ID bzw. Gebäude-ID):
  - Laternen alle ca. 30 m entlang von Wohn- und Nebenstraßen, wechselseitig, versetzt um Breite/2 + 1,6 m (1,2 m kollidierte mit dem Sicherheitsabstand zur Fahrbahn).
  - Mülleimer und Bänke an Plätzen, Bushaltestellen, Spielplätzen und in Parks.
  - Büsche in Gärten: 1–3 je Wohngebäude, 2–5 m vor der Fassade, nicht auf Straßen.
  - Zaunfelder in Wohngebieten entlang des Straßenrands mit Lücken für Einfahrten (ca. 40 % Abdeckung).
  - Parkpositionen am Rand von Wohn- und Nebenstraßen (Abstand 6–10 m, Wahrscheinlichkeit 25 %, nicht näher als 15 m an Kreuzungen) sowie als Raster in `amenity=parking`-Flächen; ca. 10 % Zweiräder.
- **Konflikte** werden mit dem vorhandenen Belegungsraster geprüft (Straßenbreiten, Gebäude), erweitert um bereits gesetzte Props.

### D10 Partikel ohne Texturdateien

Rauch, Funken und „Puff“ nutzen Babylons `ParticleSystem` mit einer einmal erzeugten `DynamicTexture` (weicher Kreis). Feste Obergrenzen: höchstens 3 Rauchsysteme gleichzeitig, je höchstens 60 Partikel. In der Qualitätsstufe „Niedrig“ halbe Partikelzahl.

### D11 Codestruktur: kleine Module, Logik getrennt von Babylon, Tests daneben

Ziel: keine „Riesen-Dateien“. Jede Datei hat eine Aufgabe und ist ohne Scrollen überschaubar.

**Regeln (gelten für diesen und alle weiteren Changes):**
- **Höchstens 300 Zeilen je Datei** (ohne Leer- und Kommentarzeilen; Tests ausgenommen). Der Linter (`max-lines`) erzwingt das im Projekt, `vp check` schlägt sonst fehl.
- **Logik getrennt von Babylon**: Rechenlogik (Fahrphysik-Kräfte, Schadensmodell, Budget, Trefferprüfung, Auswahl der Parkpositionen, Absetzstelle beim Aussteigen) liegt in reinen TypeScript-Modulen ohne Babylon-Import und ist dadurch per Unit-Test prüfbar. Babylon-Klassen sind dünne Adapter, die diese Logik aufrufen.
- **Tests neben dem Code**: `modul.ts` + `modul.test.ts` im selben Ordner. Jede Aufgabe liefert ihre Tests mit (siehe tasks.md). Spieler-Abläufe werden zusätzlich per Playwright/WebKit getestet.
- **Ein Ordner je Feature** mit kleiner öffentlicher Schnittstelle (`index.ts`). Features greifen nicht in die Innereien anderer Features.

**Zielstruktur `apps/game/src`** (neu oder umgebaut ist mit `*` markiert):

```
engine/            Game, Qualität, Assets, Perf (unverändert)
  physics/         havok.ts, *stepper.ts (feste Teilschritte), *budget/ (Budget-Manager: logic.ts + adapter.ts)
  fx/              *particles.ts (Rauch, Funken, Puff)
world/
  tiles/           *TileManager.ts (nur Lebenszyklus: anfragen, tauschen, entladen)
                   *TileUploader.ts (zeitgestückelter Upload), *TileCollision.ts (Heightfield, Gebäude-Shapes)
                   *layers.ts (Schnittstelle TileLayer: onTileReady/onTileUnload)
  gen/             Geometrie-Generatoren im Worker (unverändert, ggf. aufgeteilt)
  vegetation/      *TreeLayer.ts (Bäume als TileLayer, aus TileManager herausgelöst)
props/             *models/ (je Prop-Art eine Datei), *PropLayer.ts (TileLayer), *hitGrid.ts (+ test),
                   *triggers.ts (Auslöse-Regeln, + test), *rebuild.ts (Wiederaufbau-Regel, + test)
vehicles/          *models/ (car.ts, bike.ts, motorbike.ts, parts.ts), *physics/ (forces.ts + test, raycastVehicle.ts,
                   stabilizer.ts + test, selfRight.ts), *specs.ts (Fahrwerte je Art), *VehicleManager.ts,
                   *selection.ts (+ test, Parkpositionen/Physik-LOD), *ParkingLayer.ts (TileLayer)
damage/            *model.ts (+ test), *stages.ts (+ test), *VehicleDamage.ts (Adapter an Kollisionsereignisse)
player/            *PlayerController.ts (Zustände walking/driving), *Walker.ts (bisheriger Player-Inhalt),
                   *enterExit.ts (+ test, Absetzstelle), input.ts, *autoGas.ts (+ test), route.ts
camera/            *CameraRig.ts, *followMath.ts (+ test)
ui/                pro Bildschirm/Bedienelement eine Komponente; *controls/ (WalkControls, DriveControls, ActionButton),
                   *hud/ (HealthBar)
```

Der heutige `TileManager` (368 Zeilen) wird **vor** den neuen Features in Lebenszyklus, Upload, Kollision und `TreeLayer` zerlegt. Props und Parkplätze hängen sich dann als weitere `TileLayer` ein, statt den Manager zu vergrößern. Ebenso wird `Player` in `PlayerController` und `Walker` aufgeteilt, bevor der Fahrmodus dazukommt.

Pipeline und Kachelformat folgen denselben Regeln. Neue Pipeline-Schritte kommen in eigene Dateien (`props/osm.ts`, `props/fill.ts`, `props/parking.ts`, jeweils mit Test), `build.ts` ruft sie nur auf.

*Alternative:* Dateien erst bei Bedarf aufteilen. Verworfen, weil Fahrzeuge und Props genau die Dateien vergrößern würden, die schon an der Grenze sind.

## Risks / Trade-offs

- **[Raycast-Fahrzeug fühlt sich schwammig an oder zittert bei 30 fps]** → Physik in festen Teilschritten (1/60 s, höchstens 2 pro Bild), Kräfte über Masse normiert, frühe Testfahrten auf dem iPad mit einer Debug-Ansicht (Raycasts, Kräfte).
- **[Tunneln durch dünne Wände bei 90 km/h]** → Gebäude haben echte Mesh-Collider, die Höchstgeschwindigkeit ist begrenzt. Zusätzlich ein Vorwärts-Raycast je Schritt, der die Geschwindigkeit bei drohendem Durchdringen kappt.
- **[Zu viele dynamische Körper beim Chaos]** → Budget-Manager (D6), Trümmer-Obergrenze, Messung „Chaos-Test“ auf dem Referenzgerät.
- **[Prop-Trefferprüfung pro Bild kostet CPU]** → Raster je Kachel, nur Nachbarzellen, nur für Spielfigur und dynamische Fahrzeuge (max. 9 Akteure).
- **[OSM hat kaum Straßenmöbel erfasst]** → Die deterministische Ergänzung trägt die Hauptlast, OSM-Objekte haben Vorrang an ihren echten Positionen.
- **[Touch-Layout überlappt bei kleinen Händen]** → große Knöpfe (≥ 64 pt), Test mit dem Kind auf dem iPad, Layout in einer Datei anpassbar.
- **[Weltdaten müssen neu gebaut werden]** → Abwärtskompatibler Abschnitt. Alte Clients lesen neue Kacheln weiterhin, der Update-Mechanismus der PWA lädt nur geänderte Pakete.

## Migration Plan

1. Pipeline erweitern, Welt neu bauen, `check` (inkl. Budget, Determinismus), Weltdaten committen.
2. Spiel mit Props-Unterstützung deployen. Clients bekommen über den vorhandenen Update-Mechanismus („Update bereit“) neue App und neue Pakete.
3. Rückfall: vorherigen Commit erneut deployen. Ältere Clients ignorieren den Props-Abschnitt ohnehin.

## Open Questions

- Feinabstimmung der Fahrwerte (Motorkraft, Grip, Federn) erfolgt durch Testfahrten. Das ändert weder Specs noch Aufgaben.
- Sound (Motor, Hupe, „Puff“) kommt in einem späteren Change. Hier gibt es nur Platzhalter-Hooks.
