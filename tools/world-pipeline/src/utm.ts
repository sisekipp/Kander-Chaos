/**
 * WGS84/ETRS89 (GRS80) -> UTM, Krüger-Reihe 6. Ordnung (Karney 2011), Genauigkeit < 1 mm
 * innerhalb der Zone. ETRS89 und WGS84 unterscheiden sich in Europa um < 1 m; für OSM-Daten
 * (selbst ~1 m genau) ist das vernachlässigbar.
 */
const a = 6378137;
const f = 1 / 298.257222101; // GRS80
const k0 = 0.9996;
const n = f / (2 - f);
const n2 = n * n,
  n3 = n2 * n,
  n4 = n3 * n,
  n5 = n4 * n,
  n6 = n5 * n;
const A = (a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
const alpha = [
  n / 2 - (2 / 3) * n2 + (5 / 16) * n3 + (41 / 180) * n4 - (127 / 288) * n5 + (7891 / 37800) * n6,
  (13 / 48) * n2 - (3 / 5) * n3 + (557 / 1440) * n4 + (281 / 630) * n5 - (1983433 / 1935360) * n6,
  (61 / 240) * n3 - (103 / 140) * n4 + (15061 / 26880) * n5 + (167603 / 181440) * n6,
  (49561 / 161280) * n4 - (179 / 168) * n5 + (6601661 / 7257600) * n6,
  (34729 / 80640) * n5 - (3418889 / 1995840) * n6,
  (212378941 / 319334400) * n6,
];
const e = Math.sqrt(f * (2 - f));

export interface Utm {
  easting: number;
  northing: number;
}

export function toUtm(lat: number, lon: number, zone = 32): Utm {
  const lon0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
  const phi = lat * (Math.PI / 180);
  const lam = lon * (Math.PI / 180) - lon0;
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xiP = Math.atan2(t, Math.cos(lam));
  const etaP = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let xi = xiP,
    eta = etaP;
  for (let j = 1; j <= 6; j++) {
    xi += alpha[j - 1] * Math.sin(2 * j * xiP) * Math.cosh(2 * j * etaP);
    eta += alpha[j - 1] * Math.cos(2 * j * xiP) * Math.sinh(2 * j * etaP);
  }
  return { easting: 500000 + k0 * A * eta, northing: k0 * A * xi };
}
