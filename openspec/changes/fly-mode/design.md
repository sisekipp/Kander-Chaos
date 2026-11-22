# Design: Flugmodus

## Context

Motivation und Umfang: siehe `proposal.md`. Anforderungen: Spec `fly-mode` und die Änderung an `world-streaming`.

Heutiger Stand im Code:
- Kamera: eine `ArcRotateCamera` aus `engine/Game.ts`, gesteuert von `camera/CameraRig.ts` (Modi `walk` und `chase`, Ziel = Figur bzw. Fahrzeug). FXAA, Himmelskuppel (`infiniteDistance`) und Panorama hängen an dieser Kamera bzw. folgen der Figur.
- Eingabe: gemeinsames Objekt `player/input.ts` (Joystick `moveX/moveY`, Blick `lookDX/lookDY`, `fast`, Tastatur WASD/Pfeile/Leertaste/Umschalt).
- Streaming: `TileManager.update(x, z, vx, vz)` aus `World.update` mit der Figurposition; `StreamingPlanner` vergibt Ring 0/1/2 nach Kachelabstand.
- Figur: `PlayerController` mit `teleport(x, z)` (setzt die Figur ein und wartet auf die Kollision der Kachel, `isFrozen`).

## Goals / Non-Goals

**Goals:**
- Einfach zu bedienender Flug für Kinder, ohne neue Kamera-Infrastruktur.
- Streaming folgt dem Flug, ohne die Bildrate auf dem iPad zu gefährden.
- Reine Rechenlogik testbar ohne Babylon.

**Non-Goals:** Flugfahrzeuge mit Physik, Kollision der Kamera mit Gebäuden, Fotomodus.

## Decisions

### D1 Vorhandene ArcRotateCamera weiterverwenden
Statt einer zweiten Kamera (FreeCamera) bleibt die `ArcRotateCamera` aktiv. Im Flug ist ihr Ziel die Flugposition und der Radius klein (0,5 m), sodass sie wie eine Ich-Kamera wirkt; `alpha`/`beta` sind Gier- und Nickwinkel. Vorteil: FXAA, Himmel, Leistungsanzeige, Messlauf und Kamera-Einstellungen bleiben unverändert gebunden. Beim Ein- und Ausschalten wird `lowerRadiusLimit` umgestellt und der Übergang über 0,5 s weich geblendet (Radius und Ziel).

*Alternative:* eigene `UniversalCamera` – müsste FXAA, Himmel und Messungen umhängen; mehr Risiko ohne Nutzen.

### D2 Reine Flug-Rechnung `fly/flyMath.ts`
Zustand `{ x, y, z, vx, vy, vz }`, ein Schritt `stepFlight(state, input, dt, env)`:
- Wunschgeschwindigkeit aus Joystick (vorwärts/seitwärts relativ zum Gierwinkel, waagerecht), Hoch/Runter (senkrecht) und „Schnell“
- exponentielle Annäherung an die Wunschgeschwindigkeit (Beschleunigen/Abbremsen in ≤ 1 s)
- Grenzen aus `env`: Geländehöhe unter der Kamera (`groundAt`), Bodenabstand ≥ 2 m (hebt sanft an), Höhe ≤ 400 m über Gelände, Weltgrenzen (Kachelraster aus dem Index)
- höhenabhängige Höchstgeschwindigkeit: unter 120 m höchstens 25 m/s (damit Ring 0 nachkommt, Spec-Grenze 80 km/h), darüber bis 50 m/s
Keine Babylon-Abhängigkeit, vollständig mit Unit-Tests abgedeckt.

### D3 Babylon-Adapter `fly/FlyController.ts`
Liest pro Bild `input` (Bewegung, Blick, neue Felder `flyUp`/`flyDown`, `fast`), ruft `stepFlight` und setzt Ziel und Winkel der Kamera. Geländehöhe über `TileManager.heightAt`; ist an der Stelle keine Kachel geladen, gilt die zuletzt bekannte Höhe (Ring 2 liefert grobe Höhen schnell nach).

### D4 Figur einfrieren, Zurück und Landen
`PlayerController.suspend()` hält Figur und Kamera-Rig an (keine Eingabe, kein Charakter-Controller-Schritt; die Figur bleibt sichtbar stehen). Da die Ring-0-Kachel der Figur beim Wegfliegen entladen werden kann, steht die Figur während des Flugs ohne Physik still und wird bei „Zurück“ wie bei einem Teleport an ihrer Stelle neu eingesetzt (`teleport` wartet auf die Kollision). „Hier landen“ nutzt `teleport(x, z)` mit der Flugposition; die vorhandene Suche nach einem freien Platz verhindert Landen in Gebäuden.

### D5 Streaming-Mittelpunkt und Höhenregel
`World.update` übergibt dem `TileManager` im Flug die Flugposition und -geschwindigkeit. Neue Option `fullDetail: boolean` für `StreamingPlanner.plan`: bei `false` wird aus Ring 0 Ring 1. Umschalten mit Hysterese (aus über 120 m, wieder an unter 100 m über Gelände), damit Kacheln an der Grenze nicht flackern. Kleinobjekte, Fahrzeuge und Kollision hängen bereits an Ring 0 und verschwinden damit automatisch in der Höhe. Das Panorama-Band folgt der Kamera statt der Figur.

### D6 Eingabe und UI
- `input.flyUp`, `input.flyDown` (Knöpfe bzw. Leertaste/Umschalt). Im Flug haben Leertaste und Umschalt keine Fahr-/Sprungbedeutung.
- `ui/controls/FlyControls.tsx`: Joystick links (vorhanden), Blickfeld (vorhanden), Hold-Knöpfe „Hoch“/„Runter“/„Schnell“ rechts, oben „Zurück“ und „Hier landen“. Große Treffflächen wie bei den Fahrknöpfen.
- Knopf „Fliegen“ in der Laufsteuerung (nicht beim Fahren); Store-Feld `flying`.

### D7 Modulstruktur
```
apps/game/src/fly/
  flyMath.ts (+ test)       Flugschritt, Grenzen, Höchstgeschwindigkeit nach Höhe
  detailRule.ts (+ test)    Hysterese für die volle Detailstufe nach Flughöhe
  FlyController.ts          Babylon-Adapter auf die ArcRotateCamera
apps/game/src/ui/controls/FlyControls.tsx
```
Änderungen: `World.ts` (Moduswechsel, Streaming-Mittelpunkt), `PlayerController.ts` (`suspend`/`resume`), `StreamingPlanner.ts` (`fullDetail`), `player/input.ts` (`flyUp`/`flyDown`), `state/store.ts` (`flying`), `ui/controls/index.tsx`. Höchstens 300 Zeilen je Datei, Rechenlogik ohne Babylon-Import, Tests daneben.

## Risks / Trade-offs

- **[Schnelles Fliegen überholt das Nachladen]** → höhenabhängige Höchstgeschwindigkeit; in der Höhe nur Ring 1/2 (billiger); E2E-Test prüft, dass unter der Kamera immer Gelände geladen ist.
- **[Weite Sicht aus der Höhe kostet Fill-Rate]** → Sichtweite bleibt die der Qualitätsstufe; Nebel und Panorama verdecken den Rand; Messflug auf dem iPad.
- **[Figur fällt durch, wenn ihre Kachel entladen wird]** → Figur steht im Flug ohne Physik und wird beim Zurückkehren wie beim Teleport neu eingesetzt.
- **[Kinder verlieren die Orientierung]** → „Zurück“ immer sichtbar; Start des Flugs aus der aktuellen Blickposition.

## Migration Plan

Reine Spielfunktion ohne Daten- oder Formatänderung; Auslieferung über das normale Update („Update bereit“).

## Open Questions

- Ob „Hier landen“ zusätzlich eine kleine Landeanimation bekommt, entscheiden wir nach der ersten Sichtprüfung; die Spec verlangt nur, dass die Figur am Boden steht.
