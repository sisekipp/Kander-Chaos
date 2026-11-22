export interface AttributionSource {
  id: string;
  name: string;
  /** Pflicht-Namensnennung, wie sie im Spiel angezeigt werden muss. */
  attribution: string;
  license: string;
  licenseUrl: string;
  url: string;
  retrieved: string;
  note?: string;
}

export interface AttributionFile {
  generatedFor: string;
  sources: AttributionSource[];
}

export function buildAttribution(osmDate: string, dgmDate: string): AttributionFile {
  return {
    generatedFor: 'Kandern Chaos – Weltdaten',
    sources: [
      {
        id: 'osm',
        name: 'OpenStreetMap',
        attribution: '© OpenStreetMap-Mitwirkende',
        license: 'Open Database License (ODbL) 1.0',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
        url: 'https://www.openstreetmap.org/copyright',
        retrieved: osmDate,
        note: 'Gebäude, Straßen, Landnutzung und Gewässer. Die abgeleiteten Kacheldaten stehen auf Anfrage unter der ODbL zur Verfügung.',
      },
      {
        id: 'lgl-dgm1',
        name: 'Digitales Geländemodell DGM1, Landesamt für Geoinformation und Landentwicklung Baden-Württemberg',
        attribution: 'Datenquelle: LGL, www.lgl-bw.de',
        license: 'Datenlizenz Deutschland – Namensnennung – Version 2.0',
        licenseUrl: 'https://www.govdata.de/dl-de/by-2-0',
        url: 'https://opengeodata.lgl-bw.de/',
        retrieved: dgmDate,
        note: 'Höhendaten, auf 2-m-Raster gemittelt.',
      },
    ],
  };
}
