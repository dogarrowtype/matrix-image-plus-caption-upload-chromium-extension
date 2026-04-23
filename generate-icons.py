#!/usr/bin/env python3
"""Generate PNG icons for the Matrix Image + Caption extension."""
import os
import struct
import zlib

def make_png(size, bg, fg):
    """Create a PNG with a simple camera-body icon."""
    pixels = []
    s = size
    for y in range(s):
        row = []
        for x in range(s):
            nx = x / (s - 1)  # 0..1
            ny = y / (s - 1)

            # Outer rounded rectangle (camera body): 15%–85% of width, 25%–75% height
            body_x0, body_x1 = 0.10, 0.90
            body_y0, body_y1 = 0.25, 0.78
            # Viewfinder bump at top-left: 15%–40% x, 15%–28% y
            bump_x0, bump_x1 = 0.20, 0.48
            bump_y0, bump_y1 = 0.15, 0.28
            # Lens: circle centered at (0.5, 0.515), radius 0.195
            lx, ly, lr = 0.50, 0.515, 0.195
            # Shutter button (small circle top-right): center (0.75, 0.255), r=0.065
            sx, sy, sr = 0.75, 0.255, 0.065

            in_body = (body_x0 <= nx <= body_x1 and body_y0 <= ny <= body_y1)
            in_bump = (bump_x0 <= nx <= bump_x1 and bump_y0 <= ny <= bump_y1)
            in_lens = ((nx - lx) ** 2 + (ny - ly) ** 2) <= lr ** 2
            in_shutter = ((nx - sx) ** 2 + (ny - sy) ** 2) <= sr ** 2

            if in_lens:
                # Lens interior: slightly lighter fg
                r = min(255, fg[0] + 30)
                g = min(255, fg[1] + 30)
                b = min(255, fg[2] + 30)
                row.append((r, g, b))
            elif in_body or in_bump or in_shutter:
                row.append(fg)
            else:
                row.append(bg)
        pixels.append(row)

    # Build raw image bytes (filter byte 0 = None per row)
    raw = b""
    for row in pixels:
        raw += b"\x00"
        for r, g, b in row:
            raw += bytes([r, g, b])

    def make_chunk(name, data):
        crc = zlib.crc32(name + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", crc)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", s, s, 8, 2, 0, 0, 0)
    ihdr = make_chunk(b"IHDR", ihdr_data)
    idat = make_chunk(b"IDAT", zlib.compress(raw, 9))
    iend = make_chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


def main():
    os.makedirs("icons", exist_ok=True)
    bg = (30, 30, 46)    # dark navy background
    fg = (180, 190, 254)  # lavender-ish camera shape

    for size in [16, 48, 128]:
        data = make_png(size, bg, fg)
        path = f"icons/icon{size}.png"
        with open(path, "wb") as f:
            f.write(data)
        print(f"  wrote {path} ({len(data)} bytes)")

    print("Icons generated.")


if __name__ == "__main__":
    main()
