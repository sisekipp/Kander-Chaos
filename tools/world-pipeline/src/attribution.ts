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

/** Quellenangaben; Höhenquellen der Schweiz und Frankreichs nur, wenn sie im Build verwendet wurden. */
export function buildAttribution(
  osmDate: string,
  dgmDate: string,
  extra: { swisstopo?: string; ign?: string } = {},
): AttributionFile {
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
      ...(extra.swisstopo
        ? [
            {
              id: 'swisstopo-swissalti3d',
              name: 'swissALTI3D, Bundesamt für Landestopografie swisstopo',
              attribution: 'Quelle: Bundesamt für Landestopografie swisstopo',
              license: 'Nutzungsbedingungen für kostenlose Geodaten und Geodienste (OGD) von swisstopo',
              licenseUrl: 'https://www.swisstopo.admin.ch/de/nutzungsbedingungen-kostenlose-geodaten-und-geodienste',
              url: 'https://www.swisstopo.admin.ch/de/hoehenmodell-swissalti3d',
              retrieved: extra.swisstopo,
              note: 'Höhendaten der Schweiz (2 m), nach UTM 32N umgerechnet.',
            },
          ]
        : []),
      ...(extra.ign
        ? [
            {
              id: 'ign-rgealti',
              name: 'RGE ALTI®, Institut national de l’information géographique et forestière (IGN)',
              attribution: 'IGN – RGE ALTI®',
              license: 'Licence Ouverte / Open Licence 2.0 (Etalab)',
              licenseUrl: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
              url: 'https://geoservices.ign.fr/rgealti',
              retrieved: extra.ign,
              note: 'Höhendaten Frankreichs über die Géoplateforme, nach UTM 32N umgerechnet.',
            },
          ]
        : []),
    ],
  };
}
