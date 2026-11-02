/** Canvas primitives shared by the procedural sprite painters. All art faces upper-left sunlight. */
export type Ctx = CanvasRenderingContext2D;
export type Vertex = [number, number];

export function polygon(c: Ctx, points: Vertex[], fill: string, stroke?: string, width = 0.7) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.lineJoin = 'round';
    c.stroke();
  }
}
export function ellipse(
  c: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke?: string,
  width = 1,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
}
export function line(c: Ctx, points: Vertex[], color: string, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}
export function curve(c: Ctx, from: Vertex, control: Vertex, to: Vertex, color: string, width = 1) {
  c.beginPath();
  c.moveTo(...from);
  c.quadraticCurveTo(...control, ...to);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.stroke();
}
/** Lighten (positive) or darken (negative) a #rrggbb colour by a fraction. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const channel = (v: number) =>
    Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(n >> 16)}${channel((n >> 8) & 255)}${channel(n & 255)}`;
}
export function lerp(a: Vertex, b: Vertex, t: number): Vertex {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** An isometric block centred on its bottom-front diamond, with a soft cartoon outline. */
export function box(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  top = '#d5c5a2',
  left = '#b4a17e',
  right = '#8e8369',
) {
  polygon(
    c,
    [
      [x - w, y - h],
      [x, y + d - h],
      [x, y + d],
      [x - w, y],
    ],
    left,
  );
  polygon(
    c,
    [
      [x, y + d - h],
      [x + w, y - h],
      [x + w, y],
      [x, y + d],
    ],
    right,
  );
  polygon(
    c,
    [
      [x, y - d - h],
      [x + w, y - h],
      [x, y + d - h],
      [x - w, y - h],
    ],
    top,
  );
  c.save();
  c.beginPath();
  c.moveTo(x - w, y - h);
  c.lineTo(x, y + d - h);
  c.lineTo(x, y + d);
  c.lineTo(x - w, y);
  c.closePath();
  c.clip();
  const sunlight = c.createLinearGradient(x - w, y - h, x, y + d);
  sunlight.addColorStop(0, '#ffe3a42b');
  sunlight.addColorStop(1, '#283b2b12');
  c.fillStyle = sunlight;
  c.fillRect(x - w, y - h, w, d + h);
  if (w > 45) {
    for (let row = 5; row < h; row += 6) {
      line(
        c,
        [
          [x - w, y - h + row],
          [x, y + d - h + row],
        ],
        '#6e62482b',
        0.7,
      );
      for (let col = row % 12 ? 8 : 0; col < w; col += 15) {
        const yy = y - h + row + (col / w) * d;
        line(
          c,
          [
            [x - w + col, yy],
            [x - w + col, yy - 5],
          ],
          '#6e624826',
          0.7,
        );
      }
    }
  }
  c.restore();
  if (w < 6) return;
  // A sunlit rim on the top edges and a soft ink silhouette give every block a crisp cartoon read.
  line(
    c,
    [
      [x - w, y - h],
      [x, y + d - h],
      [x + w, y - h],
    ],
    '#fff8e070',
    1,
  );
  polygon(
    c,
    [
      [x - w, y - h],
      [x, y - d - h],
      [x + w, y - h],
      [x + w, y],
      [x, y + d],
      [x - w, y],
    ],
    'transparent',
    '#3b2c1a3a',
    1,
  );
}

/** Overlapping rounded leaves: outline pass, body, then sunlit highlights. */
export function canopy(
  c: Ctx,
  cx: number,
  cy: number,
  r: number,
  rand: () => number,
  palette: { ink: string; dark: string; mid: string; light: string },
  squash = 0.85,
) {
  const lobes = Array.from({ length: 9 }, (_, i) => {
    const angle = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const distance = i === 0 ? 0 : r * (0.42 + rand() * 0.18);
    return {
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance * squash,
      r: r * (0.42 + rand() * 0.16),
    };
  });
  for (const l of lobes) ellipse(c, l.x, l.y, l.r + 2.2, (l.r + 2.2) * squash, palette.ink);
  for (const l of lobes) ellipse(c, l.x, l.y + 2, l.r, l.r * squash, palette.dark);
  for (const l of lobes)
    ellipse(c, l.x - 1.5, l.y - 1, l.r * 0.86, l.r * 0.86 * squash, palette.mid);
  for (const l of lobes)
    if (l.y < cy + r * 0.2)
      ellipse(c, l.x - l.r * 0.28, l.y - l.r * 0.3, l.r * 0.42, l.r * 0.32 * squash, palette.light);
  for (let i = 0; i < 12; i++)
    ellipse(
      c,
      cx - r + rand() * r * 2,
      cy - r * 0.8 + rand() * r * 1.5,
      1 + rand() * 1.4,
      0.8,
      i % 3 ? '#ffffff2a' : '#0b2a1a26',
    );
}

/** A gable roof over a wall block (same w, d, top height) with Khmer upturned finials. */
export function gableRoof(
  c: Ctx,
  x: number,
  top: number,
  w: number,
  d: number,
  rise: number,
  color: string,
  gable = '#d9b27a',
) {
  const grow = 1.24;
  const left: Vertex = [x - w * grow, top + 3];
  const front: Vertex = [x, top + d * grow + 3];
  const right: Vertex = [x + w * grow, top + 3];
  const back: Vertex = [x, top - d * grow + 3];
  const m1 = lerp(left, back, 0.5);
  const m2 = lerp(front, right, 0.5);
  const a: Vertex = [m1[0], m1[1] - rise];
  const b: Vertex = [m2[0], m2[1] - rise];
  polygon(c, [back, right, b, a], shade(color, -0.32), '#3b22163a');
  polygon(c, [front, right, b], gable, '#3b22163a');
  for (let i = 1; i < 4; i++)
    line(c, [lerp(front, b, i / 4), lerp(right, b, i / 4)], shade(gable, -0.18), 0.7);
  polygon(c, [left, front, b, a], color, '#3b221650');
  c.save();
  c.beginPath();
  [left, front, b, a].forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.closePath();
  c.clip();
  const glow = c.createLinearGradient(left[0], a[1], front[0], front[1]);
  glow.addColorStop(0, '#fff1c040');
  glow.addColorStop(1, '#5a1f0c26');
  c.fillStyle = glow;
  c.fillRect(left[0], a[1], right[0] - left[0], front[1] - a[1]);
  for (let t = 0.14; t < 0.95; t += 0.14)
    line(c, [lerp(left, a, t), lerp(front, b, t)], shade(color, 0.22), 0.9);
  c.restore();
  line(c, [left, front], shade(color, -0.42), 1.6);
  line(c, [a, b], shade(color, -0.45), 3.2);
  line(c, [a, b], shade(color, 0.35), 1);
  // Upturned horn finials at both ridge ends and the gable foot.
  const horn = '#f1c76f';
  curve(c, a, [a[0] - 2, a[1] - 5], [a[0] - 6, a[1] - 6], horn, 2.2);
  curve(c, b, [b[0] + 2, b[1] - 5], [b[0] + 6, b[1] - 6], horn, 2.2);
  curve(c, right, [right[0] + 3, right[1] - 1], [right[0] + 4, right[1] - 5], horn, 1.6);
}
