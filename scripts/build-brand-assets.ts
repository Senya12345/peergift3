import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Turns the two master PNGs in brand/ into every derivative the site links to.
 *
 * The masters come out of an image generator at 1254x1254 with the drawing floating in the
 * middle of a lot of empty canvas, which is fine for a preview and wrong for everything
 * else: a header mark rendered from an untrimmed square is mostly padding, and a favicon
 * built from one is a speck. So the geometry is derived here rather than eyeballed — find
 * the real content, trim to it, then place it deliberately per output.
 *
 * Run it after replacing either master. The outputs are committed, because the deploy box
 * only runs `npm run build`, and sharp's platform binaries are not something the build
 * should have to resolve at render time.
 */
const root = process.cwd();
const INK_900 = { r: 0x0e, g: 0x11, b: 0x14, alpha: 1 };

const LOCKUP_SOURCE = path.join(root, 'brand/lockup-source.png');
const MARK_SOURCE = path.join(root, 'brand/mark-source.png');

for (const f of [LOCKUP_SOURCE, MARK_SOURCE]) {
  if (!fs.existsSync(f)) {
    console.error(`build-brand-assets: missing ${path.relative(root, f)}`);
    process.exit(1);
  }
}

/**
 * Bounding box of everything that is not fully transparent.
 *
 * sharp's own `.trim()` works off a corner colour and a threshold, which would also bite
 * into the artwork's anti-aliased edges; this only drops pixels that carry no ink at all.
 */
async function contentBox(file: string): Promise<{
  left: number;
  top: number;
  width: number;
  height: number;
}> {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let x0 = info.width;
  let y0 = info.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if ((data[(y * info.width + x) * 4 + 3] ?? 0) > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error(`build-brand-assets: ${path.relative(root, file)} is fully transparent`);
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * PNG-in-ICO. sharp has no .ico encoder and the container is trivial: a 6-byte header, a
 * 16-byte directory entry per size, then the PNG payloads back to back. Every browser
 * still asking for /favicon.ico reads this form.
 */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries: Buffer[] = [];
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette size: 0 for a true-colour image
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const written: string[] = [];
function write(rel: string, buf: Buffer): void {
  const out = path.join(root, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  written.push(`${rel} — ${(buf.length / 1024).toFixed(1)} KB`);
}

// --- lockup: boat, dotted course, wheel. Header mark and social card. ---

const lockupBox = await contentBox(LOCKUP_SOURCE);
const lockup = await sharp(LOCKUP_SOURCE)
  .extract(lockupBox)
  .png({ compressionLevel: 9 })
  .toBuffer();

write('src/assets/brand/lockup.png', lockup);

// Social card. og:title already carries the words, so the image stays wordless rather than
// depending on a font being installed wherever this script runs.
const OG = { width: 1200, height: 630 };
write(
  'public/og-image.png',
  await sharp({ create: { ...OG, channels: 4, background: INK_900 } })
    .composite([
      {
        input: await sharp(lockup).resize({ width: Math.round(OG.width * 0.56), fit: 'inside' }).toBuffer(),
        gravity: 'centre',
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer(),
);

// --- mark: the wheel alone. Favicons and app icons. ---

const markBox = await contentBox(MARK_SOURCE);
const mark = await sharp(MARK_SOURCE).extract(markBox).png().toBuffer();

/**
 * Icon tiles are drawn on ink-900 rather than left transparent. The wheel's segments are
 * ink-900 themselves, so the dark field is what makes them read as segments at all; on a
 * transparent tile a light browser tab would flood through them and the centre pin would
 * vanish into the background.
 */
async function tile(size: number, padding: number): Promise<Buffer> {
  const inner = Math.round(size * (1 - padding * 2));
  return sharp({ create: { width: size, height: size, channels: 4, background: INK_900 } })
    .composite([
      {
        input: await sharp(mark).resize({ width: inner, height: inner, fit: 'inside' }).toBuffer(),
        gravity: 'centre',
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// A browser tab renders at 16-32px, where breathing room is just wasted pixels. A home
// screen icon is shown large and in a grid of others, where it is not.
const favicon16 = await tile(16, 0.03);
const favicon32 = await tile(32, 0.04);
const favicon48 = await tile(48, 0.04);

write('public/favicon-16.png', favicon16);
write('public/favicon-32.png', favicon32);
write(
  'public/favicon.ico',
  ico([
    { size: 16, png: favicon16 },
    { size: 32, png: favicon32 },
    { size: 48, png: favicon48 },
  ]),
);
write('public/apple-touch-icon.png', await tile(180, 0.1));
write('public/icon-192.png', await tile(192, 0.08));
write('public/icon-512.png', await tile(512, 0.08));

console.log(
  `build-brand-assets: lockup ${lockupBox.width}x${lockupBox.height}, mark ${markBox.width}x${markBox.height}`,
);
for (const line of written) console.log(`  ${line}`);
