/**
 * Koordinaten-Umrechnungen für die Höhendaten der Nachbarländer (Design D2):
 * UTM 32N -> WGS84 (Krüger-Reihe, Karney 2011), WGS84 -> LV95 (Schweiz, Näherungsformeln von swisstopo,
 * Genauigkeit ca. 1 m) und WGS84 -> Lambert-93 (Frankreich, konforme Kegelprojektion auf GRS80, exakt).
 * ETRS89 und WGS84 werden gleichgesetzt (Unterschied < 1 m, für Höhen unerheblich).
 */
const a = 6378137;
const f = 1 / 298.257222101; // GRS80
const e = Math.sqrt(f * (2 - f));
const k0 = 0.9996;
const n = f / (2 - f);
const n2 = n * n,
  n3 = n2 * n,
  n4 = n3 * n,
  n5 = n4 * n,
  n6 = n5 * n;
const A = (a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
const beta = [
  n / 2 - (2 / 3) * n2 + (37 / 96) * n3 - (1 / 360) * n4 - (81 / 512) * n5 + (96199 / 604800) * n6,
  (1 / 48) * n2 + (1 / 15) * n3 - (437 / 1440) * n4 + (46 / 105) * n5 - (1118711 / 3870720) * n6,
  (17 / 480) * n3 - (37 / 840) * n4 - (209 / 4480) * n5 + (5569 / 90720) * n6,
  (4397 / 161280) * n4 - (11 / 504) * n5 - (830251 / 7257600) * n6,
  (4583 / 161280) * n5 - (108847 / 3991680) * n6,
  (20648693 / 638668800) * n6,
];
const RAD = Math.PI / 180;

export interface LatLon {
  lat: number;
  lon: number;
}

/** UTM (Zone 32N) -> WGS84. */
export function fromUtm(easting: number, northing: number, zone = 32): LatLon {
  const xi = northing / (k0 * A);
  const eta = (easting - 500000) / (k0 * A);
  let xiP = xi,
    etaP = eta;
  for (let j = 1; j <= 6; j++) {
    xiP -= beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaP -= beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const tauP = Math.sin(xiP) / Math.sqrt(Math.sinh(etaP) ** 2 + Math.cos(xiP) ** 2);
  // tau aus tau' iterativ (Newton, Karney)
  let tau = tauP;
  for (let i = 0; i < 6; i++) {
    const s = Math.sinh(e * Math.atanh((e * tau) / Math.sqrt(1 + tau * tau)));
    const tp = tau * Math.sqrt(1 + s * s) - s * Math.sqrt(1 + tau * tau);
    const d =
      ((tauP - tp) / Math.sqrt(1 + tp * tp)) *
      ((1 + (1 - e * e) * tau * tau) / ((1 - e * e) * Math.sqrt(1 + tau * tau)));
    tau += d;
    if (Math.abs(d) < 1e-12) break;
  }
  const lon0 = ((zone - 1) * 6 - 180 + 3) * RAD;
  return { lat: Math.atan(tau) / RAD, lon: (lon0 + Math.atan2(Math.sinh(etaP), Math.cos(xiP))) / RAD };
}

/** WGS84 -> LV95 (E, N) nach den Näherungsformeln von swisstopo (Genauigkeit ca. 1 m). */
export function toLv95(lat: number, lon: number): { e: number; n: number } {
  const p = (lat * 3600 - 169028.66) / 10000;
  const l = (lon * 3600 - 26782.5) / 10000;
  const e = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l * l * l;
  const nn = 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p * p * p;
  return { e, n: nn };
}

// Lambert-93: Kegel mit Standardparallelen 44° und 49°, Ursprung 46,5° N / 3° O, (700000, 6600000)
const L93 = (() => {
  const phi1 = 44 * RAD,
    phi2 = 49 * RAD,
    phi0 = 46.5 * RAD;
  const m = (phi: number) => Math.cos(phi) / Math.sqrt(1 - e * e * Math.sin(phi) ** 2);
  const t = (phi: number) =>
    Math.tan(Math.PI / 4 - phi / 2) / ((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi))) ** (e / 2);
  const nn = (Math.log(m(phi1)) - Math.log(m(phi2))) / (Math.log(t(phi1)) - Math.log(t(phi2)));
  const F = m(phi1) / (nn * t(phi1) ** nn);
  return { nn, F, rho0: a * F * t(phi0) ** nn, t, lon0: 3 * RAD };
})();

/** WGS84 -> Lambert-93 (x, y). */
export function toLambert93(lat: number, lon: number): { x: number; y: number } {
  const rho = a * L93.F * L93.t(lat * RAD) ** L93.nn;
  const theta = L93.nn * (lon * RAD - L93.lon0);
  return { x: 700000 + rho * Math.sin(theta), y: 6600000 + L93.rho0 - rho * Math.cos(theta) };
}
