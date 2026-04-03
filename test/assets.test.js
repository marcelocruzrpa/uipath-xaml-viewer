import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const LISTING_PATH = join(ROOT, 'store', 'LISTING.md');
const SCREENSHOTS_DIR = join(ROOT, 'store', 'screenshots');

function readPngDimensions(filePath) {
  const buffer = readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString('hex');

  expect(signature).toBe('89504e470d0a1a0a');

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe('Chrome Web Store assets', () => {
  it('keeps the summary within Chrome Web Store length limits', () => {
    const listing = readFileSync(LISTING_PATH, 'utf8');
    const match = listing.match(/## Summary \(132 chars max\)\r?\n(.+)/);

    expect(match).not.toBeNull();
    expect(match[1].length).toBeLessThanOrEqual(132);
  });

  it('includes support and privacy URLs in the listing draft', () => {
    const listing = readFileSync(LISTING_PATH, 'utf8');

    expect(listing).toContain('## Support URL');
    expect(listing).toContain('https://github.com/marcelocruzrpa/uipath-xaml-viewer/issues');
    expect(listing).toContain('## Privacy Policy URL');
  });

  it.each([
    ['screenshot-1-sequence.png', 1280, 800],
    ['screenshot-2-statemachine.png', 1280, 800],
    ['screenshot-3-visual-diff.png', 1280, 800],
    ['screenshot-4-dark-mode.png', 1280, 800],
    ['screenshot-5-shortcuts.png', 1280, 800],
  ])('validates screenshot asset %s', (fileName, width, height) => {
    const filePath = join(SCREENSHOTS_DIR, fileName);

    expect(existsSync(filePath)).toBe(true);
    expect(readPngDimensions(filePath)).toEqual({ width, height });
  });

  it.each([
    ['promo-small-440x280.png', 440, 280],
    ['marquee-1400x560.png', 1400, 560],
  ])('validates promotional asset %s', (fileName, width, height) => {
    const filePath = join(ROOT, 'store', fileName);

    expect(existsSync(filePath)).toBe(true);
    expect(readPngDimensions(filePath)).toEqual({ width, height });
  });

  it.each([
    ['icon16.png', 16, 16],
    ['icon48.png', 48, 48],
    ['icon128.png', 128, 128],
  ])('validates extension icon %s', (fileName, width, height) => {
    const filePath = join(ROOT, 'icons', fileName);

    expect(existsSync(filePath)).toBe(true);
    expect(readPngDimensions(filePath)).toEqual({ width, height });
  });
});
