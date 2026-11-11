import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { contestantQr, withDisplayOrigin } from '../../client/src/game/qr';

/** Rasterize the encoder's horizontal SVG strokes, then decode with an independent library. */
function decodeSvg(dataUrl: string) {
  const doc = new DOMParser().parseFromString(decodeURIComponent(dataUrl.split(',')[1]), 'image/svg+xml');
  const dimension = Number(doc.documentElement.getAttribute('viewBox')!.split(' ')[2]); const scale = 5; const width = dimension * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  const path = doc.querySelector('path[stroke="#000000"]')!.getAttribute('d')!;
  let x = 0; let y = 0;
  for (const token of path.matchAll(/([Mmh])([\d.]+)(?: ([\d.]+))?/g)) {
    const a = Number(token[2]); const b = Number(token[3] ?? 0);
    if (token[1] === 'M') { x = a; y = b; }
    else if (token[1] === 'm') { x += a; y += b; }
    else {
      for (let row = Math.floor(y) * scale; row < (Math.floor(y) + 1) * scale; row++) for (let column = x * scale; column < (x + a) * scale; column++) {
        const index = (row * width + column) * 4; pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
      }
      x += a;
    }
  }
  return jsQR(pixels, width, width)?.data;
}
describe('locally encoded contestant QR payload', () => {
  it.each(['http://192.0.2.10:5173', 'https://192.0.2.11:8443'])('round-trip decodes the exact full displayed link for %s', async (origin) => {
    const sessionId = randomUUID(); const fragment = new URLSearchParams({ display: randomUUID(), token: 'b'.repeat(64), epoch: randomUUID() });
    const local = `http://localhost:5173/display/${sessionId}#${fragment}`;
    const displayed = withDisplayOrigin(local, origin); expect(displayed).toBe(`${origin}/display/${sessionId}#${fragment}`);
    const encoded = await contestantQr(displayed); expect(encoded).toMatch(/^data:image\/svg\+xml/);
    expect(decodeSvg(encoded)).toBe(displayed);
    const svg = decodeURIComponent(encoded.split(',')[1]); expect(svg).toContain('fill="#ffffff"'); expect(svg).not.toContain('http://localhost');
  });
});
