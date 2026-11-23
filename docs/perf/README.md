# Messungen auf dem Referenzgerät

Referenzgerät: **iPad Pro 1. Generation** (A9X, 4 GB RAM), iPadOS 16, Safari 16. Die Ziele stehen in der Spec `performance-budget`.

## Vorbereitung

1. Spiel in Safari auf dem iPad öffnen (Cloudflare-URL oder im WLAN `http://<Mac-IP>:4173` nach `pnpm --filter @kandern/game exec vp build && pnpm --filter @kandern/game exec vp preview --host`).
2. Einmal komplett laden lassen, bis „Bereit zum Offline-Spielen“ erscheint.
3. Für Speichermessungen: iPad per Kabel an den Mac, auf dem iPad *Einstellungen → Safari → Erweitert → Web-Inspektor* einschalten, am Mac *Safari → Entwickler → [iPad] → Kandern Chaos* öffnen und im Tab *Zeitachsen* die Aufnahme „Speicher“ starten.
4. Andere Apps schließen, Bildschirmhelligkeit mittel, Gerät am Ladekabel (keine Drosselung durch Stromsparmodus).

## Spike (Aufgaben 2.3–2.5)

Menü → **Spike-Werkzeuge**:

1. **Stress-Szene zeigen**: 400 Gebäude, 2000 Bäume, 2-m-Gelände auf 250 × 250 m.
2. **Messlauf 20 s**: lädt `messung-stress-….json` herunter (Dateien-App).
3. **Physik-Test (50 Körper)** starten, sofort danach erneut **Messlauf 20 s**. Der Bericht enthält `extra.havokWasmStartMs`.
4. Ergebnisse in `docs/perf/<datum>-spike.md` eintragen (Vorlage unten). Ziel: Ø ≥ 30 fps, 1-%-Low ≥ 20 fps, auch mit Physik.

Verfehlt Havok die Ziele, gilt der Fallback aus Design D10 (eigener kinematischer Controller). Die Entscheidung kommt ins Protokoll.

## Abnahme (Aufgaben 10.2, 10.3)

Menü → **Testmodus**:

1. **Testroute** (Kandern → Holzen → Riedlingen, 80 km/h, ca. 4 min) dreimal hintereinander fahren. Jeder Lauf lädt `messung-testroute-….json` herunter. Parallel läuft die Speicher-Zeitachse im Web-Inspektor.
2. **Lange Fahrt** (Feuerbach → Kandern → Wollbach) einmal fahren. Dabei auf die Leistungsanzeige (FPS-Knopf) achten: Die Kachelzahl darf nicht wachsen, und es dürfen keine Löcher in der Nähe der Figur auftauchen.
3. **Kaltstart**: App vom Home-Bildschirm im Flugmodus starten und die Zeit bis zur steuerbaren Figur stoppen (Ziel ≤ 15 s).
4. Kachel-Erzeugung: `extra.maxTileGenMs` / `extra.maxTileBuildMs` aus dem Bericht (Ziel ≤ 3000 ms für die dichteste Kachel).

## Fahrzeuge und Zerstörung (Change `vehicles-and-destruction`, Aufgabe 7.3)

Menü → **Testmodus** (Qualität „Niedrig“):

1. **Autofahrt**: Neben ein geparktes Auto gehen, **Einsteigen**, im Testmodus **Messlauf 60 s** starten und dabei durch die Kernstadt Richtung Holzen fahren. Dabei auch Büsche, Mülleimer und Zäune umfahren. Bericht: `messung-messlauf-….json`.
2. **Chaos-Test**: Am Blumenplatz zu Fuß **Chaos-Test** antippen. 30 s lang werden laufend Kleinobjekte ausgelöst. Bericht: `messung-chaostest-….json` mit `extra.maxBodies` (Ziel ≤ 80) und `extra.maxDebris` (Ziel ≤ 60).
3. **Bedienung**: Einfach-Modus (nur lenken) und normaler Modus (Gas-Knopf) ausprobieren. Ein-/Aussteigen, Hupe und Bremse/Rückwärts müssen mit Kinderhänden gut treffbar sein.

| Kennzahl | Ziel | Quelle |
|---|---|---|
| Ø Bildrate Autofahrt / Chaos-Test | ≥ 30 fps | `summary.avgFps` |
| 1-%-Low | ≥ 20 fps | `summary.p1LowFps` |
| dynamische Körper im Chaos-Test | ≤ 80 | `extra.maxBodies` |
| Trümmerteile im Chaos-Test | ≤ 60 | `extra.maxDebris` |

Ergebnisse in `docs/perf/<datum>-fahrzeuge.md` eintragen (Tabelle wie oben).

**Desktop-Vergleich** (Playwright-WebKit, keine Abnahme): Beim Chaos-Test wurden 533 Objekte in 30 s ausgelöst, höchstens 80 Körper und 60 Trümmer waren gleichzeitig aktiv, bei ~100 fps. Die Endgeschwindigkeiten lagen bei Auto 74,5, Motorrad 84,5 und Fahrrad 28,3 km/h.

## Flugmodus (Change `fly-mode`, Aufgabe 4.3)

Menü → **Testmodus** (Qualität „Niedrig“):

1. **Flug** antippen. Der Autopilot fliegt eine Runde in 100 m Höhe über der Kernstadt (25 m/s), dann in 150 m Höhe mit 50 m/s nach Wollbach und im Tiefflug (30 m, 25 m/s) zurück. Das dauert etwa 6 Minuten. Am Ende landet die Kamera wieder bei der Figur, und `messung-flug-….json` wird heruntergeladen.
2. Während des Flugs auf Löcher im Gelände unter und vor der Kamera achten (es darf keine geben) und auf die Kachelzahl in der Leistungsanzeige.
3. Ziel: Ø ≥ 30 fps, 1-%-Low ≥ 20 fps (`summary.avgFps`, `summary.p1LowFps`). Ergebnis in `docs/perf/<datum>-flug.md` eintragen.

**Desktop-Vergleich** (Playwright-WebKit, keine Abnahme): Die Messroute dauerte 357 s und lief mit Ø 99,7 fps, 1-%-Low 90,9 fps und max. 120 ms je Bild (1 Bild > 100 ms). Unter der Kamera gab es in 1748 Stichproben kein Loch im Gelände, die dichteste Kachel brauchte 1055 ms.

## Ziele (Spec `performance-budget`)

| Kennzahl | Ziel | Quelle |
|---|---|---|
| Ø Bildrate Testroute | ≥ 30 fps | `summary.avgFps` |
| 1-%-Low | ≥ 20 fps | `summary.p1LowFps` |
| Einzelbilder > 100 ms beim Nachladen | höchstens 1 je Kachelwechsel | `summary.framesOver100ms` |
| Speicher | < 900 MB, kein Tab-Neustart | Web-Inspektor |
| Dichteste Kachel | ≤ 3 s | `extra.maxTileBuildMs` |
| Offline-Kaltstart | ≤ 15 s | Stoppuhr |

## Vorlage `docs/perf/<datum>-<art>.md`

```markdown
# Messung <Datum> – <Spike | Abnahme>

- Gerät: iPad Pro 12,9" 1. Gen (A9X), iPadOS 16.x, Safari 16.x
- Build: <sw.js-Version aus „Über das Spiel“ bzw. Konsole>, Welt <buildVersion>
- Qualität: Niedrig, Renderauflösung <x %> (Leistungsanzeige)

| Lauf | Ø fps | 1-%-Low | max. Bild (ms) | > 100 ms | Speicher max. (MB) | Bemerkung |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

- Havok-WASM-Start: … ms
- Dichteste Kachel: … ms
- Kaltstart offline: … s

**Entscheidung:** <Havok bleibt / Fallback D10; Kachelgröße 250 m bleibt / angepasst auf …>
```

## Desktop-Vergleichswerte (keine Abnahme)

Playwright-WebKit am Mac (`e2e/route.spec.ts`), Testroute vollständig: Ø 100 fps, 1-%-Low 83 fps, längstes Bild 63 ms, 0 Bilder über 100 ms, höchstens 90 Kacheln gleichzeitig, dichteste Kachel 180 Gebäude, Erzeugung 14 ms. Diese Werte zeigen nur, dass Streaming und Messkette funktionieren. Sie ersetzen nicht die Messung auf dem iPad.

**Vergleich vor/nach der Grafik-Überarbeitung (graphics-world), gleiche Testroute, Playwright-WebKit am Mac:**

| | vorher | nachher |
|---|---|---|
| Ø fps | 100 | 100 |
| 1-%-Low | 83 fps | 83 fps |
| längstes Bild | 63 ms | 31 ms |
| Bilder > 100 ms | 0 | 0 |
| Kacheln gleichzeitig | 90 | 78 |
| Erzeugung dichteste Kachel (Worker) | 14 ms | 29 ms |

Die Bildrate ist am Desktop durch die Bildwiederholrate begrenzt (100 fps) und sagt über das iPad wenig. Die Kachel-Erzeugung im Worker ist durch weiche Landnutzungs-Übergänge, Verschattung, Straßenquerschnitte und Kreuzungen etwa doppelt so teuer, liegt aber weit unter dem Ziel von 3 s. Entscheidend ist die Messung auf dem iPad Pro 1. Gen (`docs/perf/<datum>-grafik.md`).

Screenshots der Sichtprüfungs-Orte (Blumenplatz, Hauptstraße, Feldweg, Kirche, Brücke, Kreisverkehr) legt `e2e/screenshots.spec.ts` im Testlauf unter `apps/game/test-results/` ab.

## Vergleich Uniform-Buffer an/aus

Auf alten iOS-Geräten sind einzelne Uniforms manchmal schneller als Uniform-Buffer. So vergleichst du beides:

1. Im Testmodus den Knopf **UBO: an/aus** drücken. Die Seite lädt neu, die Einstellung bleibt gespeichert. Alternativ den URL-Parameter `?ubo=0` bzw. `?ubo=1` verwenden; er hat Vorrang vor der gespeicherten Einstellung.
2. An derselben Stelle (z. B. Blumenplatz, Kamera unverändert) **Messlauf 60 s** starten.
3. Umschalten und den Messlauf wiederholen. Im Bericht steht unter `extra.uniformBuffers`, mit welcher Einstellung gemessen wurde.

Die schnellere Einstellung wird nach der iPad-Messung als Standard übernommen.

## Messroute „Hubschrauber Basel“ (Desktop)

Route: Landeplatz Kandern → Lörrach → Basel Innenstadt → Landeplatz EuroAirport, Steigflug auf 150 m, dann Schnellflug (bis 60 m/s), Anflug in 40 m. Start im Testmodus über den Knopf **Heli Basel**; die Nachladeregionen kommen dabei aus dem Netz.

| Wert (Desktop, WebKit, E2E `helicopter.spec.ts`, 23.11.2026) | Ergebnis |
| --- | --- |
| Dauer | 522 s |
| Ø Bildrate | 98,7 fps |
| 1-%-Low | 83,3 fps |
| Längstes Bild | 281 ms (einmalig, beim Einsteigen) |
| Stichproben ohne Gelände unter dem Hubschrauber | 0 von 1025 |

Auch hier begrenzt die Bildwiederholrate (100 fps); maßgeblich ist die Messung auf dem iPad Pro 1. Gen (Ziel Ø ≥ 30 fps, 1-%-Low ≥ 20 fps). Screenshots von Piste und Autobahn legt `e2e/airport.spec.ts` unter `apps/game/test-results/` ab.
