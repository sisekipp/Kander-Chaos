/**
 * Selbstaufrichten (reine Logik): liegt ein Fahrzeug länger als `delaySec` ohne Radkontakt bzw. stark
 * geneigt (Dach/Seite), wird es aufgerichtet.
 */
export class SelfRightTimer {
  private stuck = 0;

  constructor(private readonly delaySec = 2) {}

  /** `upDot`: Skalarprodukt Fahrzeug-Oben mit Welt-Oben (1 = aufrecht, -1 = auf dem Dach). */
  update(dtSec: number, groundedWheels: number, upDot: number, speed: number): boolean {
    const tipped = upDot < 0.5;
    const lost = groundedWheels === 0 && speed < 1.5;
    if (tipped || lost) this.stuck += dtSec;
    else this.stuck = 0;
    if (this.stuck >= this.delaySec) {
      this.stuck = 0;
      return true;
    }
    return false;
  }
}
