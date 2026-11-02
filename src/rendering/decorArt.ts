import type { BuildingKind } from '../core/types';
import { random } from '../core/world';
import { box, canopy, curve, ellipse, gableRoof, line, polygon, shade } from './draw';
import type { Ctx, Vertex } from './draw';
import { lotusFlower, sugarPalm } from './natureArt';

/** A raised Khmer stilt house: timber walls, carved gable roof, ladder, and a flower box. */
export function dwelling(c: Ctx, x: number, y: number, scale = 1, roof = '#cd784f') {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  ellipse(c, 0, 18, 34, 12, '#2d3b2230');
  for (const [px, py] of [
    [-27, 1],
    [0, 14],
    [27, 1],
    [-13, 8],
    [13, 8],
  ] as Vertex[]) {
    line(
      c,
      [
        [px, py],
        [px, py + 18],
      ],
      '#5f4a30',
      4,
    );
    line(
      c,
      [
        [px - 1, py],
        [px - 1, py + 17],
      ],
      '#a3845a',
      1.2,
    );
  }
  box(c, 0, 0, 30, 15, 5, '#c7a877', '#8f7450', '#76603f');
  box(c, 0, -5, 25, 12.5, 24, '#dcc290', '#e6c995', '#bb9862');
  for (let k = 4; k < 24; k += 4) {
    line(
      c,
      [
        [-25, -5 - k],
        [0, 7.5 - k],
      ],
      '#a4845560',
      0.7,
    );
    line(
      c,
      [
        [0, 7.5 - k],
        [25, -5 - k],
      ],
      '#7d5f3a55',
      0.7,
    );
  }
  polygon(
    c,
    [
      [-16, -0.5],
      [-9, 3],
      [-9, -10],
      [-16, -13.5],
    ],
    '#5b4630',
    '#f3d9a4',
    1,
  );
  polygon(
    c,
    [
      [8, -14.5],
      [17, -19],
      [17, -12],
      [8, -7.5],
    ],
    '#4a3a28',
    '#f3d9a4',
    1,
  );
  line(
    c,
    [
      [12.5, -16.7],
      [12.5, -9.7],
    ],
    '#f3d9a4',
    0.8,
  );
  polygon(
    c,
    [
      [7, -7],
      [18, -12.5],
      [18, -10],
      [7, -4.5],
    ],
    '#7c5a36',
  );
  for (let i = 0; i < 4; i++)
    ellipse(c, 9 + i * 2.7, -8.6 - i * 1.35, 1.4, 1.1, i % 2 ? '#f07fa8' : '#ffd25e');
  gableRoof(c, 0, -29, 25, 12.5, 26, roof);
  // Ladder down to the yard, a water jar, and a potted plant.
  line(
    c,
    [
      [-21, 3],
      [-27, 22],
    ],
    '#7c613d',
    2,
  );
  line(
    c,
    [
      [-14, 6.5],
      [-20, 25.5],
    ],
    '#7c613d',
    2,
  );
  for (let i = 0; i < 4; i++)
    line(
      c,
      [
        [-22 - i * 1.5, 7 + i * 4.5],
        [-15 - i * 1.5, 10.5 + i * 4.5],
      ],
      '#c9a873',
      1.5,
    );
  ellipse(c, 22, 22, 5.5, 6, '#8a5a3a', '#4b2e1c', 0.8);
  ellipse(c, 22, 16.5, 3.4, 1.4, '#3d2a1c');
  ellipse(c, 33, 20, 4, 3, '#b0623e', '#5b2f1c', 0.7);
  for (let i = 0; i < 5; i++)
    curve(c, [33, 18], [31 + i * 1.5, 10], [28 + i * 2.5, 8 + (i % 2) * 2], '#5aa448', 1.6);
  c.restore();
}

function grassPlinth(c: Ctx, w: number, d: number) {
  box(c, 0, 4, w, d, 4, '#a9d07c', '#86a85e', '#6f9150');
}
function hedge(c: Ctx, x: number, y: number, w: number, d: number) {
  box(c, x, y, w, d, 7, '#7cbf5a', '#4f9440', '#3f7a36');
  ellipse(c, x - w * 0.3, y - 8 - d * 0.2, w * 0.35, d * 0.4, '#a9dc78');
}
function lantern(c: Ctx, x: number, y: number) {
  line(
    c,
    [
      [x, y - 6],
      [x, y - 2],
    ],
    '#4d3826',
    0.8,
  );
  ellipse(c, x, y + 2, 5, 5, '#ffb34a33');
  ellipse(c, x, y + 2, 2.6, 3.4, '#e2483b', '#7a1f17', 0.6);
  line(
    c,
    [
      [x - 2.6, y + 2],
      [x + 2.6, y + 2],
    ],
    '#ffd36b',
    0.6,
  );
  line(
    c,
    [
      [x, y + 5.4],
      [x, y + 8],
    ],
    '#ffd36b',
    0.8,
  );
}
function umbrella(c: Ctx, x: number, y: number, r: number, color: string) {
  line(
    c,
    [
      [x, y],
      [x, y - 26],
    ],
    '#6a4f33',
    1.6,
  );
  polygon(
    c,
    [
      [x - r, y - 22],
      [x, y - 34],
      [x + r, y - 22],
      [x, y - 16],
    ],
    color,
    shade(color, -0.45),
    1,
  );
  polygon(
    c,
    [
      [x, y - 34],
      [x + r, y - 22],
      [x, y - 16],
    ],
    shade(color, -0.18),
  );
  for (const [ex, ey] of [
    [x - r, y - 22],
    [x, y - 16],
    [x + r, y - 22],
  ])
    ellipse(c, ex!, ey!, 1.4, 1, '#fff3c8');
}
function basket(c: Ctx, x: number, y: number, fruit: string) {
  ellipse(c, x, y, 6, 3, '#b48a52', '#5b3f22', 0.8);
  for (let i = 0; i < 5; i++)
    ellipse(c, x - 3 + (i % 3) * 3, y - 2 - Math.floor(i / 3) * 2, 1.8, 1.6, fruit);
}
function villager(c: Ctx, x: number, y: number, cloth: string) {
  ellipse(c, x, y + 1, 4, 1.5, '#2d3b2233');
  polygon(
    c,
    [
      [x - 3, y - 9],
      [x + 3, y - 9],
      [x + 3.5, y],
      [x - 3.5, y],
    ],
    cloth,
    shade(cloth, -0.45),
    0.6,
  );
  ellipse(c, x, y - 12, 2.8, 3, '#b57f55');
  ellipse(c, x, y - 14.3, 3.2, 1.3, '#2e2118');
}
function nagaHead(c: Ctx, x: number, y: number, r: number) {
  ellipse(c, x, y, r, r * 1.15, '#e9c98a', '#7a5a33', 1);
  ellipse(c, x - r * 0.25, y - r * 0.3, r * 0.4, r * 0.35, '#fff0c4');
  ellipse(c, x - r * 0.35, y + r * 0.1, r * 0.14, r * 0.14, '#4a3420');
  ellipse(c, x + r * 0.35, y + r * 0.1, r * 0.14, r * 0.14, '#4a3420');
}

export function decor(c: Ctx, kind: BuildingKind) {
  const rand = random(kind.length * 31);
  if (kind === 'garden') {
    grassPlinth(c, 50, 25);
    for (const [x, y] of [
      [-30, -2],
      [-8, 9],
      [16, 21],
    ] as Vertex[])
      ellipse(c, x, y, 5, 2.4, '#d8cba6', '#8e8061', 0.6);
    hedge(c, 28, -6, 14, 7);
    hedge(c, -28, 10, 12, 6);
    for (let i = 0; i < 14; i++) {
      const x = -36 + rand() * 30;
      const y = -10 + rand() * 12;
      ellipse(c, x, y, 2, 1.6, ['#f27aa6', '#ffd45c', '#fff1f6', '#b88df0'][i % 4]!);
    }
    line(
      c,
      [
        [6, 6],
        [3, -24],
      ],
      '#8a6a46',
      3,
    );
    curve(c, [4, -16], [-6, -26], [-12, -28], '#8a6a46', 2);
    curve(c, [4, -18], [14, -28], [18, -30], '#8a6a46', 2);
    canopy(c, 3, -38, 18, rand, {
      ink: '#2f5a33',
      dark: '#4b8a45',
      mid: '#6fb257',
      light: '#b5e07a',
    });
    for (let i = 0; i < 12; i++) {
      const x = -12 + rand() * 30;
      const y = -50 + rand() * 22;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ellipse(c, x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.2, 1.3, 1, '#fff7ee');
      }
      ellipse(c, x, y, 0.9, 0.8, '#f6c33b');
    }
  } else if (kind === 'palmgrove') {
    grassPlinth(c, 50, 25);
    for (let i = 0; i < 9; i++)
      line(
        c,
        [
          [-34 + rand() * 66, 2 + rand() * 12],
          [-35 + rand() * 66, -2 + rand() * 12],
        ],
        '#5f9a44',
        1,
      );
    sugarPalm(c, 16, -6, 92, 3);
    sugarPalm(c, -22, 2, 74, 5);
    sugarPalm(c, 4, 14, 60, 9);
  } else if (kind === 'shrine') {
    grassPlinth(c, 48, 24);
    box(c, 0, 4, 22, 11, 6, '#e4d4ac', '#bba982', '#9c8c6a');
    box(c, 0, -2, 4, 2, 30, '#d9c49a', '#c1a77a', '#9e8662');
    box(c, 0, -32, 16, 8, 3, '#d9b06c', '#b38a4e', '#956f3c');
    box(c, 0, -35, 12, 6, 13, '#f3d38e', '#f0c46c', '#c99a48');
    polygon(
      c,
      [
        [-3, -40],
        [3, -37],
        [3, -45],
        [-3, -48],
      ],
      '#7a2a1c',
      '#ffd36b',
      0.7,
    );
    gableRoof(c, 0, -48, 12, 6, 14, '#d9472f', '#f2c35b');
    ellipse(c, 0, -76, 2.2, 3.6, '#ffd75e', '#a5761d', 0.6);
    lantern(c, -24, -20);
    lantern(c, 24, -20);
    line(
      c,
      [
        [-24, -26],
        [-24, 6],
      ],
      '#6a4f33',
      1.4,
    );
    line(
      c,
      [
        [24, -26],
        [24, 6],
      ],
      '#6a4f33',
      1.4,
    );
    curve(c, [-24, -24], [0, -14], [24, -24], '#f2a93b', 1.6);
    for (let i = 0; i < 7; i++)
      ellipse(c, -18 + i * 6, -19 + Math.abs(i - 3) * -1, 1.6, 1.6, '#f6a13a');
    for (let i = 0; i < 3; i++)
      ellipse(c, -6 + i * 6, 6, 2.2, 1.4, ['#ffe07a', '#f05a7a', '#9fd26b'][i]!);
    curve(c, [9, 4], [12, -4], [9, -12], '#ffffff55', 1);
  } else if (kind === 'naga') {
    box(c, 0, 6, 50, 25, 5, '#d7c9a3', '#ad9f7c', '#958866');
    box(c, 0, 0, 30, 15, 8, '#e8d6a8', '#c4ae80', '#a89268');
    // Body balustrade sweeping back from the hood.
    c.beginPath();
    c.moveTo(-6, -12);
    c.bezierCurveTo(-30, -6, -40, 2, -46, 14);
    c.lineTo(-40, 17);
    c.bezierCurveTo(-34, 6, -24, -1, -4, -6);
    c.closePath();
    c.fillStyle = '#e1bf7e';
    c.fill();
    c.strokeStyle = '#7a5a33';
    c.lineWidth = 1;
    c.stroke();
    for (let i = 0; i < 6; i++) ellipse(c, -12 - i * 5.6, -6 + i * 3.6, 1.6, 1, '#b48f55');
    polygon(
      c,
      [
        [-8, -10],
        [8, -10],
        [10, -40],
        [-10, -40],
      ],
      '#e3c387',
      '#7a5a33',
      1,
    );
    c.beginPath();
    c.moveTo(-30, -44);
    c.quadraticCurveTo(0, -96, 30, -44);
    c.quadraticCurveTo(0, -50, -30, -44);
    c.fillStyle = '#d9b673';
    c.fill();
    c.strokeStyle = '#7a5a33';
    c.stroke();
    const heads: [number, number, number][] = [
      [-24, -48, 5.5],
      [24, -48, 5.5],
      [-17, -60, 6],
      [17, -60, 6],
      [-9, -68, 6.5],
      [9, -68, 6.5],
      [0, -73, 7.5],
    ];
    for (const [hx, hy, r] of heads) nagaHead(c, hx, hy, r);
    ellipse(c, 0, -83, 3, 4, '#f6d06a', '#9a6f22', 0.7);
    for (let i = 0; i < 4; i++)
      line(
        c,
        [
          [-6, -14 - i * 7],
          [6, -14 - i * 7],
        ],
        '#b58f5544',
        1,
      );
  } else if (kind === 'lotuspond') {
    box(c, 0, 4, 72, 36, 7, '#c99a72', '#a6765a', '#8c6248');
    polygon(
      c,
      [
        [0, -30],
        [62, 1],
        [0, 32],
        [-62, 1],
      ],
      '#52b7bf',
      '#e6c7a0',
      2,
    );
    c.save();
    c.beginPath();
    c.moveTo(0, -30);
    c.lineTo(62, 1);
    c.lineTo(0, 32);
    c.lineTo(-62, 1);
    c.closePath();
    c.clip();
    const depth = c.createRadialGradient(4, 4, 6, 0, 0, 64);
    depth.addColorStop(0, '#2d8f9c');
    depth.addColorStop(1, '#7ad6d2');
    c.fillStyle = depth;
    c.fillRect(-64, -32, 128, 66);
    for (let i = 0; i < 6; i++) {
      const x = -40 + rand() * 80;
      const y = -12 + rand() * 24;
      curve(c, [x, y], [x + 6, y - 3], [x + 12, y - 1], '#c4f1e6aa', 0.9);
    }
    c.restore();
    for (let i = 0; i < 9; i++) {
      const x = -42 + rand() * 84;
      const y = -10 + rand() * 22;
      const r = 4 + rand() * 3;
      ellipse(c, x, y, r, r * 0.5, '#5fae5a', '#2f7444', 0.6);
      polygon(
        c,
        [
          [x, y],
          [x + r, y - r * 0.2],
          [x + r, y + r * 0.2],
        ],
        '#3b9ca8',
      );
    }
    for (const [x, y, s] of [
      [-20, -4, 1.5],
      [14, 8, 1.7],
      [32, -6, 1.3],
      [-6, 14, 1.2],
    ] as [number, number, number][]) {
      line(
        c,
        [
          [x, y + 3],
          [x, y + 6],
        ],
        '#3d7a43',
        1,
      );
      lotusFlower(c, x, y, s);
    }
    for (let i = 0; i < 4; i++) box(c, -36 + i * -4, 26 - i * 2, 12, 6, 2, '#e7c8a0');
    ellipse(c, 44, 16, 4, 3, '#6ab04f', '#2d5c2a', 0.6);
    ellipse(c, 43, 14, 1, 1, '#fff');
    ellipse(c, 45, 14, 1, 1, '#fff');
  } else if (kind === 'market') {
    box(c, 0, 6, 70, 35, 5, '#e4c995', '#bfa06b', '#a38555');
    for (let i = 0; i < 18; i++)
      ellipse(c, -50 + rand() * 100, -10 + rand() * 30, 1.6, 0.8, '#c9a8739a');
    const stalls: [number, number, string, string][] = [
      [-30, -8, '#e3553f', '#f39b3a'],
      [22, -14, '#2fa3a0', '#7bc96a'],
      [-4, 14, '#f2b632', '#b65fcf'],
      [34, 12, '#d9477a', '#f2d06b'],
    ];
    for (const [x, y, cloth, fruit] of stalls) {
      box(c, x, y, 13, 6.5, 8, '#c49a62', '#9a7448', '#7f5f3a');
      basket(c, x - 5, y - 9, fruit);
      basket(c, x + 5, y - 6, shade(fruit, -0.2));
      umbrella(c, x, y - 2, 18, cloth);
    }
    villager(c, -14, 24, '#3f7cc0');
    villager(c, 10, 30, '#c4553a');
    villager(c, 44, -2, '#5a9a4c');
    villager(c, -44, 8, '#e0a33a');
  }
}
