import { buildModel } from './models';
import type { ModelKey } from './models';
import { ModelStudio } from './studio';

/** Trim transparent margins so each piece fills its showcase frame. */
function crop(source: HTMLCanvasElement): string {
  const { width, height } = source;
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const context = scratch.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width,
    top = height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < height; y += 2)
    for (let x = 0; x < width; x += 2)
      if (pixels[(y * width + x) * 4 + 3]! > 24) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  const pad = 12;
  const w = right - left + pad * 2;
  const h = bottom - top + pad * 2;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(scratch, left - pad, top - pad, w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}

/** Rendered pieces for the main menu, or null when WebGL is unavailable. */
export function renderShowcase(pieces: { key: ModelKey; size: number }[]): string[] | null {
  const studio = ModelStudio.create();
  if (!studio) return null;
  try {
    return pieces.map(({ key, size }) => crop(studio.render(buildModel(key), size)));
  } catch {
    return null;
  } finally {
    studio.dispose();
  }
}
