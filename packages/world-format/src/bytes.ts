/** Wachsender Little-Endian-Puffer zum Schreiben. */
export class ByteWriter {
  private buf: ArrayBuffer;
  private view: DataView;
  private u8: Uint8Array;
  pos = 0;

  constructor(initial = 64 * 1024) {
    this.buf = new ArrayBuffer(initial);
    this.view = new DataView(this.buf);
    this.u8 = new Uint8Array(this.buf);
  }

  private ensure(n: number): void {
    if (this.pos + n <= this.buf.byteLength) return;
    let size = this.buf.byteLength * 2;
    while (size < this.pos + n) size *= 2;
    const next = new ArrayBuffer(size);
    new Uint8Array(next).set(this.u8.subarray(0, this.pos));
    this.buf = next;
    this.view = new DataView(next);
    this.u8 = new Uint8Array(next);
  }

  /** Auf Vielfaches von n auffüllen (für ausgerichtete Typed-Array-Views beim Lesen). */
  align(n: number): void {
    const pad = (n - (this.pos % n)) % n;
    this.ensure(pad);
    for (let i = 0; i < pad; i++) this.u8[this.pos++] = 0;
  }

  u8v(v: number): void {
    this.ensure(1);
    this.view.setUint8(this.pos, v);
    this.pos += 1;
  }
  u16(v: number): void {
    this.ensure(2);
    this.view.setUint16(this.pos, v, true);
    this.pos += 2;
  }
  u32(v: number): void {
    this.ensure(4);
    this.view.setUint32(this.pos, v, true);
    this.pos += 4;
  }
  i32(v: number): void {
    this.ensure(4);
    this.view.setInt32(this.pos, v, true);
    this.pos += 4;
  }
  f32(v: number): void {
    this.ensure(4);
    this.view.setFloat32(this.pos, v, true);
    this.pos += 4;
  }
  f64(v: number): void {
    this.ensure(8);
    this.view.setFloat64(this.pos, v, true);
    this.pos += 8;
  }

  str(s: string): void {
    const bytes = new TextEncoder().encode(s);
    this.u16(bytes.length);
    this.bytes(bytes);
  }

  bytes(b: Uint8Array): void {
    this.ensure(b.length);
    this.u8.set(b, this.pos);
    this.pos += b.length;
  }

  f32Array(a: Float32Array): void {
    this.u32(a.length);
    this.align(4);
    this.bytes(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
  }

  u16Array(a: Uint16Array): void {
    this.u32(a.length);
    this.align(2);
    this.bytes(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
  }

  finish(): Uint8Array {
    return this.u8.slice(0, this.pos);
  }
}

/** Gegenstück zu ByteWriter. Typed Arrays werden kopiert (Quelle ist evtl. nicht ausgerichtet). */
export class ByteReader {
  private view: DataView;
  pos = 0;

  constructor(private readonly u8: Uint8Array) {
    this.view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  }

  get remaining(): number {
    return this.u8.byteLength - this.pos;
  }

  private need(n: number): void {
    if (this.pos + n > this.u8.byteLength) throw new RangeError('Kacheldaten abgeschnitten');
  }

  align(n: number): void {
    this.pos += (n - (this.pos % n)) % n;
  }
  u8v(): number {
    this.need(1);
    return this.view.getUint8(this.pos++);
  }
  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  str(): string {
    const len = this.u16();
    this.need(len);
    const s = new TextDecoder().decode(this.u8.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }

  f32Array(): Float32Array {
    const n = this.u32();
    this.align(4);
    this.need(n * 4);
    const out = new Float32Array(n);
    new Uint8Array(out.buffer).set(this.u8.subarray(this.pos, this.pos + n * 4));
    this.pos += n * 4;
    return out;
  }

  u16Array(): Uint16Array {
    const n = this.u32();
    this.align(2);
    this.need(n * 2);
    const out = new Uint16Array(n);
    new Uint8Array(out.buffer).set(this.u8.subarray(this.pos, this.pos + n * 2));
    this.pos += n * 2;
    return out;
  }
}
