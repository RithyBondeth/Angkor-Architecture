import type { BuildingKind } from '../core/types';
import { random } from '../core/world';
import { box, canopy, curve, ellipse, gableRoof, line, pad, polygon, shade } from './draw';
import type { Ctx, Vertex } from './draw';

const INK = '#3a2614';
const STONE = '#e6cf98';
const GOLD = '#f4c54d';
const CRIMSON = '#c8352b';

function bronze(c: Ctx, x: number, y: number, rx: number, ry: number) {
  const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.4, 1, x, y, Math.max(rx, ry));
  g.addColorStop(0, '#fff0a6');
  g.addColorStop(0.35, '#e9b23f');
  g.addColorStop(1, '#8a5a1a');
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.3;
  c.stroke();
}
function moss(c: Ctx, rand: () => number, x: number, y: number, spread: number, count = 6) {
  for (let i = 0; i < count; i++)
    ellipse(
      c,
      x + (rand() - 0.5) * spread,
      y + (rand() - 0.5) * spread * 0.4,
      1.6 + rand() * 2,
      1 + rand(),
      i % 2 ? '#7fae4c' : '#5d8f3a',
    );
}
function flag(c: Ctx, x: number, y: number, color: string) {
  line(
    c,
    [
      [x, y],
      [x, y - 44],
    ],
    '#6a4a28',
    2,
  );
  polygon(
    c,
    [
      [x, y - 44],
      [x + 16, y - 40],
      [x + 12, y - 35],
      [x + 16, y - 30],
      [x, y - 32],
    ],
    color,
    INK,
    1,
  );
  ellipse(c, x, y - 46, 2, 2, GOLD, INK, 0.8);
}
/** A calm Bayon face drawn flat, then sheared onto an isometric wall by the caller. */
function face(c: Ctx, scale: number) {
  c.save();
  c.scale(scale, scale);
  polygon(
    c,
    [
      [-11, -15],
      [11, -15],
      [11, -11],
      [-11, -11],
    ],
    '#d8b874',
    '#6e5a36',
    0.8,
  );
  for (let i = -9; i <= 9; i += 4.5) ellipse(c, i, -13, 1.2, 1.2, '#f6dc94');
  curve(c, [-9, -6], [-6, -8.5], [-2.5, -6.5], '#6e5a36', 1);
  curve(c, [9, -6], [6, -8.5], [2.5, -6.5], '#6e5a36', 1);
  curve(c, [-8.5, -3], [-6, -1.5], [-3, -3], '#4f4028', 1.2);
  curve(c, [8.5, -3], [6, -1.5], [3, -3], '#4f4028', 1.2);
  polygon(
    c,
    [
      [0, -4],
      [2.5, 4],
      [-2.5, 4],
    ],
    '#c9a866',
    '#6e5a36',
    0.6,
  );
  curve(c, [-5, 8], [0, 11], [5, 8], '#7a4e32', 1.6);
  curve(c, [-3.5, 9.6], [0, 10.6], [3.5, 9.6], '#b77a5a', 0.8);
  polygon(
    c,
    [
      [-13, -8],
      [-11, -9],
      [-11, 6],
      [-13, 4],
    ],
    '#c9a866',
    '#6e5a36',
    0.6,
  );
  polygon(
    c,
    [
      [13, -8],
      [11, -9],
      [11, 6],
      [13, 4],
    ],
    '#c9a866',
    '#6e5a36',
    0.6,
  );
  c.restore();
}
function shear(c: Ctx, x: number, y: number, slope: number, draw: () => void) {
  c.save();
  c.transform(1, slope, 0, 1, x, y);
  draw();
  c.restore();
}
function tieredTop(c: Ctx, x: number, y: number, w: number, tiers: number, color: string) {
  for (let i = 0; i < tiers; i++) {
    const s = w * (1 - i * 0.2);
    box(c, x, y - i * 9, s, s / 2, 9, shade(color, 0.1), shade(color, 0), shade(color, -0.18));
  }
  const top = y - tiers * 9;
  c.beginPath();
  c.moveTo(x - w * 0.36, top);
  c.quadraticCurveTo(x - w * 0.4, top - w * 0.7, x, top - w * 1.05);
  c.quadraticCurveTo(x + w * 0.4, top - w * 0.7, x + w * 0.36, top);
  c.closePath();
  c.fillStyle = shade(color, 0.08);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.3;
  c.stroke();
  c.beginPath();
  c.moveTo(x, top);
  c.quadraticCurveTo(x + w * 0.4, top - w * 0.7, x, top - w * 1.05);
  c.quadraticCurveTo(x + w * 0.3, top - w * 0.5, x + w * 0.36, top);
  c.fillStyle = shade(color, -0.2);
  c.fill();
  ellipse(c, x, top - w * 1.08, 2.4, 3.2, GOLD, INK, 0.8);
}
function apsara(c: Ctx, x: number, y: number, cloth: string, mirror = 1) {
  ellipse(c, x, y + 1, 5, 1.8, '#2d3b2233');
  polygon(
    c,
    [
      [x - 4, y - 8],
      [x + 4, y - 8],
      [x + 6, y],
      [x - 6, y],
    ],
    cloth,
    INK,
    0.8,
  );
  polygon(
    c,
    [
      [x - 2.5, y - 15],
      [x + 2.5, y - 15],
      [x + 3, y - 8],
      [x - 3, y - 8],
    ],
    '#d79a6a',
    INK,
    0.7,
  );
  line(
    c,
    [
      [x - 2.5, y - 13],
      [x - 8 * mirror, y - 16],
      [x - 6 * mirror, y - 22],
    ],
    '#d79a6a',
    1.6,
  );
  line(
    c,
    [
      [x + 2.5, y - 13],
      [x + 7 * mirror, y - 10],
      [x + 11 * mirror, y - 13],
    ],
    '#d79a6a',
    1.6,
  );
  ellipse(c, x, y - 18.5, 2.8, 3, '#d79a6a', INK, 0.7);
  polygon(
    c,
    [
      [x - 2.6, y - 20.5],
      [x + 2.6, y - 20.5],
      [x, y - 28],
    ],
    GOLD,
    INK,
    0.7,
  );
  ellipse(c, x, y - 8, 4.6, 1.2, GOLD);
}

export function wonder(c: Ctx, kind: BuildingKind) {
  const rand = random(kind.length * 53 + kind.charCodeAt(0));
  if (kind === 'singha') {
    pad(c, 48, 24);
    box(c, 0, 0, 22, 11, 12, '#efe0b6', '#c9b385', '#a8936a');
    for (let i = 0; i < 3; i++)
      line(
        c,
        [
          [-22, -4 - i * 3],
          [0, 7 - i * 3],
        ],
        '#a8936a66',
        0.8,
      );
    // Haunch, chest, and planted forelegs.
    ellipse(c, 6, -20, 13, 10, STONE, INK, 1.4);
    ellipse(c, -4, -26, 10, 13, shade(STONE, 0.08), INK, 1.4);
    box(c, -9, -12, 3, 1.5, 12, STONE, shade(STONE, -0.08), shade(STONE, -0.2));
    box(c, -1, -9, 3, 1.5, 11, STONE, shade(STONE, -0.08), shade(STONE, -0.2));
    curve(c, [16, -20], [26, -26], [20, -38], INK, 4);
    curve(c, [16, -20], [26, -26], [20, -38], STONE, 2.4);
    ellipse(c, 20, -40, 4, 4, '#d9a95a', INK, 1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ellipse(c, -7 + Math.cos(a) * 11, -40 + Math.sin(a) * 10, 4.6, 4.6, '#d9a95a', INK, 1);
    }
    ellipse(c, -7, -40, 9.5, 9, shade(STONE, 0.12), INK, 1.2);
    ellipse(c, -10.5, -43, 1.9, 2.2, '#fff');
    ellipse(c, -3.5, -43, 1.9, 2.2, '#fff');
    ellipse(c, -10.2, -42.6, 1, 1.2, INK);
    ellipse(c, -3.2, -42.6, 1, 1.2, INK);
    ellipse(c, -7, -36, 4.6, 3.2, '#8c2a1e', INK, 0.8);
    line(
      c,
      [
        [-10, -37.4],
        [-4, -37.4],
      ],
      '#fff',
      1.1,
    );
    ellipse(c, -7, -39.8, 2, 1.4, '#6e4a2a');
    ellipse(c, -11, -30, 3, 1.6, '#fff8dc66');
    moss(c, rand, 0, -2, 30, 5);
  } else if (kind === 'parasol') {
    pad(c, 46, 23);
    box(c, 0, 0, 10, 5, 8, '#efe0b6', '#c9b385', '#a8936a');
    line(
      c,
      [
        [0, -6],
        [0, -96],
      ],
      INK,
      4.6,
    );
    line(
      c,
      [
        [0, -6],
        [0, -96],
      ],
      GOLD,
      2.6,
    );
    for (let tier = 0; tier < 4; tier++) {
      const y = -34 - tier * 16;
      const r = 30 - tier * 6;
      c.beginPath();
      c.moveTo(-r, y);
      c.quadraticCurveTo(0, y - r * 0.7, r, y);
      c.quadraticCurveTo(0, y + r * 0.32, -r, y);
      c.closePath();
      c.fillStyle = tier % 2 ? '#e4573b' : CRIMSON;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1.4;
      c.stroke();
      curve(
        c,
        [-r * 0.7, y - r * 0.18],
        [0, y - r * 0.7],
        [r * 0.3, y - r * 0.4],
        '#ffb59a99',
        1.4,
      );
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const fx = -r + t * r * 2;
        const fy = y + Math.sin(t * Math.PI) * r * 0.24;
        ellipse(c, fx, fy + 2, 1.6, 2.2, GOLD, INK, 0.5);
      }
    }
    ellipse(c, 0, -100, 4.6, 5.6, GOLD, INK, 1.2);
    ellipse(c, -1.4, -102, 1.6, 2, '#fff7c8');
  } else if (kind === 'brazier') {
    pad(c, 46, 23, '#cdbb98');
    box(c, 0, 0, 14, 7, 6, '#bba680', '#94815e', '#7a6a4c');
    box(c, 0, -6, 7, 3.5, 18, '#d9c497', '#b39f77', '#93805d');
    for (const side of [-1, 1])
      curve(c, [side * 10, -30], [side * 22, -32], [side * 18, -22], '#7a4a1a', 2.6);
    bronze(c, 0, -30, 20, 8);
    c.beginPath();
    c.moveTo(-20, -30);
    c.quadraticCurveTo(0, -12, 20, -30);
    c.fillStyle = '#9a6420';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.3;
    c.stroke();
    ellipse(c, 0, -31, 16, 5.6, '#3a1a0c');
    const glow = c.createRadialGradient(0, -44, 2, 0, -44, 34);
    glow.addColorStop(0, '#ffd56baa');
    glow.addColorStop(1, '#ff8a1f00');
    c.fillStyle = glow;
    c.fillRect(-36, -80, 72, 60);
    for (let i = 0; i < 7; i++)
      ellipse(c, -11 + i * 3.6, -31 + (i % 2), 2.6, 1.6, i % 2 ? '#ff7a1a' : '#ffb43a');
    const flame = (x: number, h: number, w: number, color: string) => {
      c.beginPath();
      c.moveTo(x - w, -32);
      c.quadraticCurveTo(x - w * 1.1, -32 - h * 0.6, x, -32 - h);
      c.quadraticCurveTo(x + w * 1.2, -32 - h * 0.55, x + w, -32);
      c.closePath();
      c.fillStyle = color;
      c.fill();
    };
    flame(-6, 26, 6, '#ff6a1a');
    flame(6, 22, 6, '#ff6a1a');
    flame(0, 38, 10, '#ff8a1f');
    flame(0, 28, 7, '#ffc23a');
    flame(0, 16, 4, '#fff2a8');
  } else if (kind === 'gong') {
    pad(c, 48, 24);
    for (const [x, y] of [
      [-24, 2],
      [24, -2],
    ] as Vertex[]) {
      box(c, x, y + 2, 5, 2.5, 4, '#d8c8a2', '#b5a27c', '#978561');
      line(
        c,
        [
          [x, y],
          [x, y - 64],
        ],
        INK,
        6,
      );
      line(
        c,
        [
          [x, y],
          [x, y - 64],
        ],
        '#a8432f',
        4,
      );
      line(
        c,
        [
          [x - 1, y - 2],
          [x - 1, y - 62],
        ],
        '#e3735a',
        1,
      );
    }
    c.beginPath();
    c.moveTo(-36, -58);
    c.quadraticCurveTo(0, -80, 36, -64);
    c.lineTo(36, -58);
    c.quadraticCurveTo(0, -74, -36, -52);
    c.closePath();
    c.fillStyle = '#b23a2a';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.4;
    c.stroke();
    curve(c, [-36, -56], [-42, -60], [-41, -68], GOLD, 2.4);
    curve(c, [36, -62], [42, -66], [41, -74], GOLD, 2.4);
    line(
      c,
      [
        [-8, -66],
        [-8, -52],
      ],
      '#5a3a20',
      1,
    );
    line(
      c,
      [
        [8, -68],
        [8, -54],
      ],
      '#5a3a20',
      1,
    );
    bronze(c, 0, -36, 17, 17);
    ellipse(c, 0, -36, 11, 11, 'transparent', '#8a5a1a99', 1);
    ellipse(c, 0, -36, 6, 6, '#f6c75a', INK, 1);
    ellipse(c, -1.5, -38, 2.4, 2, '#fff6c4');
    line(
      c,
      [
        [30, 8],
        [16, -16],
      ],
      '#7a5230',
      2.4,
    );
    ellipse(c, 16, -17, 4, 4, '#e7d8b0', INK, 1);
  } else if (kind === 'gopura') {
    pad(c, 72, 36, '#d6c79c', '#b9d68a');
    for (const side of [-1, 1]) {
      box(c, side * 46, 4 + side * -4, 18, 9, 16, '#d9c18a', '#b49a68', '#957f55');
      for (let i = 0; i < 3; i++)
        box(c, side * 46 - 10 + i * 10, -12 + side * -4 + i * 0, 3, 1.5, 5, '#eddbac');
    }
    box(c, 0, 0, 30, 15, 42, '#ead39c', '#d7b97b', '#b49558');
    polygon(
      c,
      [
        [-24, -6],
        [-8, 2],
        [-8, -26],
        [-16, -34],
        [-24, -30],
      ],
      '#3d2a1a',
      INK,
      1.2,
    );
    for (let i = 0; i < 4; i++)
      line(
        c,
        [
          [6 + i * 6, 5 - i * 3],
          [6 + i * 6, -26 - i * 3],
        ],
        '#a0844e88',
        1,
      );
    box(c, 0, -42, 34, 17, 5, '#f4dfa8', '#d6b77a', '#b39456');
    tieredTop(c, 0, -47, 24, 3, '#e3c788');
    for (const [x, y, color] of [
      [-64, 8, CRIMSON],
      [64, 0, '#2f8f6a'],
    ] as [number, number, string][])
      flag(c, x, y, color);
    moss(c, rand, -40, 16, 40);
  } else if (kind === 'pavilion') {
    pad(c, 72, 36, '#e2cfa0');
    for (let i = 0; i < 3; i++)
      box(c, -30 - i * 4, 24 + i * 2, 12, 6, 2, '#f0dfb4', '#c9b385', '#a8936a');
    box(c, 0, -2, 58, 29, 7, '#c98b4f', '#a36a38', '#84542c');
    const top = -9;
    const columns: Vertex[] = [
      [0, top - 25],
      [-50, top],
      [50, top],
      [0, top + 25],
    ];
    const column = ([x, y]: Vertex) => {
      line(
        c,
        [
          [x, y],
          [x, y - 46],
        ],
        INK,
        6,
      );
      line(
        c,
        [
          [x, y],
          [x, y - 46],
        ],
        '#b8402c',
        4,
      );
      ellipse(c, x, y - 46, 4.4, 2, GOLD, INK, 0.8);
      ellipse(c, x, y - 1, 4, 1.8, GOLD, INK, 0.8);
    };
    column(columns[0]!);
    // Musician with drum at the back, two dancers in front.
    ellipse(c, 18, -20, 6, 4, '#8a4a2a', INK, 1);
    apsara(c, 24, -14, '#2f6f9a');
    apsara(c, -14, -2, '#d9477a');
    apsara(c, 10, 6, '#e8a02a', -1);
    column(columns[1]!);
    column(columns[2]!);
    column(columns[3]!);
    gableRoof(c, 0, -55, 52, 26, 30, '#c8452f', '#f0c25a');
    for (const [x, y] of [
      [-30, -48],
      [30, -48],
    ] as Vertex[]) {
      line(
        c,
        [
          [x, y],
          [x, y + 6],
        ],
        INK,
        0.8,
      );
      ellipse(c, x, y + 10, 3, 4, CRIMSON, INK, 0.8);
      ellipse(c, x, y + 10, 6, 6, '#ffcf6a33');
    }
  } else if (kind === 'elephant') {
    pad(c, 72, 36, '#d0b58a', '#b9d68a');
    box(c, 0, 2, 60, 30, 18, '#c99a6c', '#a87a50', '#8c623e');
    // Relief frieze of marching elephants along the front faces.
    for (let i = 0; i < 4; i++) {
      const x = -54 + i * 13;
      const y = -2 + i * 6.5;
      ellipse(c, x + 4, y + 2, 4.5, 3, '#8c623e');
      line(
        c,
        [
          [x, y + 2],
          [x - 1, y + 7],
        ],
        '#8c623e',
        1.6,
      );
    }
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 13;
      const y = 22 - i * 6.5;
      ellipse(c, x + 4, y - 2, 4.5, 3, '#6f4c30');
      line(
        c,
        [
          [x + 9, y - 2],
          [x + 10, y + 3],
        ],
        '#6f4c30',
        1.6,
      );
    }
    box(c, 0, -16, 48, 24, 4, '#e6cf98', '#c8ad74', '#a88e58');
    const grey = '#b3aea6';
    const legs: Vertex[] = [
      [-10, -20],
      [18, -26],
      [-2, -14],
      [26, -20],
    ];
    for (const [x, y] of legs.slice(0, 2))
      box(c, x, y, 5, 2.5, 18, shade(grey, -0.1), shade(grey, -0.18), shade(grey, -0.3));
    ellipse(c, 8, -46, 30, 20, grey, INK, 1.6);
    ellipse(c, 0, -54, 18, 8, '#d5d0c8');
    for (const [x, y] of legs.slice(2))
      box(c, x, y, 5.5, 2.75, 20, grey, shade(grey, -0.08), shade(grey, -0.22));
    // Caparison and howdah
    polygon(
      c,
      [
        [-6, -64],
        [24, -62],
        [28, -40],
        [-8, -42],
      ],
      CRIMSON,
      INK,
      1.2,
    );
    for (let i = 0; i < 6; i++) ellipse(c, -6 + i * 6.6, -41 + i * 0.3, 2, 2, GOLD, INK, 0.5);
    box(c, 10, -64, 12, 6, 10, '#f2c85e', '#d29a32', '#a8741e');
    line(
      c,
      [
        [10, -74],
        [10, -96],
      ],
      INK,
      1.6,
    );
    c.beginPath();
    c.moveTo(-6, -92);
    c.quadraticCurveTo(10, -106, 26, -92);
    c.quadraticCurveTo(10, -88, -6, -92);
    c.fillStyle = CRIMSON;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.stroke();
    // Head, ear, tusks, and a curled trunk.
    ellipse(c, -26, -50, 16, 15, grey, INK, 1.6);
    ellipse(c, -17, -50, 10, 13, shade(grey, -0.12), INK, 1.3);
    curve(c, [-36, -44], [-46, -24], [-34, -16], INK, 8);
    curve(c, [-36, -44], [-46, -24], [-34, -16], grey, 5.4);
    curve(c, [-34, -16], [-30, -14], [-31, -20], INK, 4);
    curve(c, [-30, -40], [-40, -32], [-44, -38], '#fff9e8', 3.4);
    ellipse(c, -30, -54, 2, 2.4, INK);
    ellipse(c, -30.6, -54.8, 0.7, 0.7, '#fff');
    polygon(
      c,
      [
        [-34, -64],
        [-22, -66],
        [-26, -58],
      ],
      GOLD,
      INK,
      0.8,
    );
    ellipse(c, -28, -64, 3, 3, CRIMSON, INK, 0.6);
    curve(c, [32, -44], [40, -36], [36, -26], INK, 2);
  } else if (kind === 'facetower') {
    pad(c, 72, 36, '#c9c3a6', '#9fc477');
    box(c, 0, 2, 60, 30, 10, '#d8d0ae', '#b5ad8a', '#958d6c');
    box(c, 0, -8, 46, 23, 10, '#dfd6b2', '#bdb38f', '#9b9270');
    box(c, 0, -18, 34, 17, 62, '#e2d6a8', '#cbbb86', '#a49464');
    // Calm faces on both visible walls of the tower.
    shear(c, -17, -46, 0.5, () => face(c, 1.35));
    shear(c, 17, -46, -0.5, () => face(c, 1.35));
    box(c, 0, -80, 38, 19, 5, '#efe3b6', '#cfbf8a', '#a99966');
    tieredTop(c, 0, -85, 28, 3, '#ddd0a0');
    // Strangler fig roots creep over the old stone and spill onto the terrace.
    const root = (points: Vertex[], width: number) => {
      c.beginPath();
      c.moveTo(...points[0]!);
      for (let k = 1; k + 1 < points.length; k += 2)
        c.quadraticCurveTo(...points[k]!, ...points[k + 1]!);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = INK;
      c.lineWidth = width + 2.2;
      c.stroke();
      c.strokeStyle = '#a7835a';
      c.lineWidth = width;
      c.stroke();
      c.strokeStyle = '#d2b088';
      c.lineWidth = width * 0.3;
      c.stroke();
    };
    root(
      [
        [30, -78],
        [36, -60],
        [30, -44],
        [24, -26],
        [34, -14],
        [44, -4],
        [56, 4],
      ],
      4.4,
    );
    root(
      [
        [32, -60],
        [22, -36],
        [26, -18],
        [28, -8],
        [18, 8],
      ],
      2.6,
    );
    root(
      [
        [-34, -50],
        [-40, -30],
        [-36, -16],
        [-34, -6],
        [-50, 4],
      ],
      3.4,
    );
    canopy(c, 30, -92, 13, rand, {
      ink: '#24502f',
      dark: '#3a7d43',
      mid: '#5fa84b',
      light: '#a5d867',
    });
    moss(c, rand, -22, -4, 50, 8);
    moss(c, rand, 22, -70, 24, 4);
    moss(c, rand, -24, -74, 20, 3);
  }
}
