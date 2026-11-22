"""Erzeugt die App-Icons (stilisierte Hügel, Sonne, Haus mit Giebel) ohne externe Bibliotheken."""
import math, struct, sys, zlib, os

def png(path, size):
    px = bytearray()
    for y in range(size):
        px.append(0)
        for x in range(size):
            u, v = x / size, y / size
            # Himmel-Verlauf
            r, g, b = 0.98 - 0.2 * v, 0.78 - 0.1 * v, 0.42 + 0.1 * v
            # Sonne
            if (u - 0.72) ** 2 + (v - 0.28) ** 2 < 0.012:
                r, g, b = 1.0, 0.93, 0.55
            # Hügel hinten
            if v > 0.55 + 0.08 * math.sin(u * 6.0 + 0.5):
                r, g, b = 0.36, 0.6, 0.34
            # Hügel vorne
            if v > 0.7 + 0.06 * math.sin(u * 4.0 + 2.0):
                r, g, b = 0.45, 0.72, 0.36
            # Haus: Wand + Giebeldach
            if 0.26 < u < 0.52 and 0.52 < v < 0.74:
                r, g, b = 0.97, 0.94, 0.86
                if 0.33 < u < 0.4 and 0.6 < v < 0.68:
                    r, g, b = 0.3, 0.42, 0.52
                if 0.44 < u < 0.49 and 0.62 < v < 0.74:
                    r, g, b = 0.45, 0.28, 0.16
            if 0.36 < v <= 0.52 and abs(u - 0.39) < (v - 0.36) * 1.0 + 0.0 and abs(u - 0.39) < 0.16:
                r, g, b = 0.72, 0.3, 0.22
            # Abgerundete Ecken (Maske nur für "any"-Icons sinnvoll; hier voll deckend)
            px += bytes((int(max(0, min(1, r)) * 255), int(max(0, min(1, g)) * 255), int(max(0, min(1, b)) * 255)))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(px), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

out = sys.argv[1]
for s in (180, 192, 512):
    png(os.path.join(out, f'icon-{s}.png'), s)
