import type { Terrain } from '../core/types';
import { random } from '../core/world';
import { canopy, curve, ellipse, line, polygon, shade } from './draw';
import type { Ctx, Vertex } from './draw';

export const TREE_VARIANTS = 8;
const DIAMOND: Vertex[] = [
  [40, 0],
  [76, 18],
  [40, 36],
  [4, 18],
];
function clipDiamond(c: Ctx) {
  c.beginPath();
  DIAMOND.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.clip();
}
function lotusPad(c: Ctx, x: number, y: number, r: number, water: string) {
  ellipse(c, x, y + 0.6, r, r * 0.5, '#1d6f5a55');
  ellipse(c, x, y, r, r * 0.5, '#5fae5a', '#2f7444', 0.6);
  polygon(
    c,
    [
      [x, y],
      [x + r, y - r * 0.18],
      [x + r, y + r * 0.18],
    ],
    water,
  );
  ellipse(c, x - r * 0.3, y - r * 0.15, r * 0.32, r * 0.12, '#a7da7d');
}
export function lotusFlower(c: Ctx, x: number, y: number, size = 1) {
  ellipse(c, x, y + 1.2 * size, 3.4 * size, 1.4 * size, '#1d4f4030');
  for (const [dx, dy, color] of [
    [-2.4, 0, '#e98bb0'],
    [2.4, 0, '#e98bb0'],
    [-1.3, -1.6, '#f6b7cf'],
    [1.3, -1.6, '#f6b7cf'],
    [0, -2.4, '#ffd9e6'],
  ] as [number, number, string][]) {
    c.beginPath();
    c.ellipse(x + dx * size, y + dy * size, 1.5 * size, 2.8 * size, dx * 0.25, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  }
  ellipse(c, x, y - 0.6 * size, 0.9 * size, 0.6 * size, '#ffd85e');
}

export function tile(c: Ctx, terrain: Terrain | 'flood', variant: number) {
  const rand = random(variant + 41 + terrain.length * 7);
  const grass = ['#a1c978', '#a7cf7b', '#9bc572', '#acd37e', '#a0cb75'][variant]!;
  const water = ['#4fb3bc', '#55b8c0', '#4cb0ba', '#5abcc3', '#50b2b9'][variant]!;
  const wet = ['water', 'moat', 'canal', 'reservoir', 'bridge', 'flood'].includes(terrain);
  const top = wet
    ? terrain === 'reservoir'
      ? shade(water, -0.08)
      : water
    : terrain === 'road'
      ? '#e6c590'
      : terrain === 'forest'
        ? '#8ab664'
        : grass;
  polygon(
    c,
    [
      [4, 18],
      [40, 36],
      [40, 43],
      [4, 25],
    ],
    wet ? '#378b97' : terrain === 'road' ? '#b39566' : '#7b9f55',
  );
  polygon(
    c,
    [
      [40, 36],
      [76, 18],
      [76, 25],
      [40, 43],
    ],
    wet ? '#2f8192' : terrain === 'road' ? '#9a7f56' : '#688e4c',
  );
  polygon(c, DIAMOND, top);
  c.save();
  clipDiamond(c);
  const light = c.createLinearGradient(8, 0, 65, 36);
  light.addColorStop(0, wet ? '#d6f6ec30' : '#f3e6b024');
  light.addColorStop(1, '#173d2414');
  c.fillStyle = light;
  c.fillRect(0, 0, 80, 40);
  for (let i = 0; i < 70; i++) {
    c.fillStyle = i % 2 ? '#fff8d013' : '#1834210d';
    c.fillRect(rand() * 80, rand() * 36, 1 + rand() * 2, 0.6);
  }
  if (wet) {
    // Deep centre, bright shallows, and a few lazy ripples.
    const depth = c.createRadialGradient(42, 20, 2, 40, 18, 34);
    depth.addColorStop(0, '#2f8c9a30');
    depth.addColorStop(1, '#bff3e600');
    c.fillStyle = depth;
    c.fillRect(0, 0, 80, 40);
    for (let i = 0; i < 4; i++) {
      const x = 18 + rand() * 40;
      const y = 9 + rand() * 16;
      curve(c, [x, y], [x + 5, y - 3], [x + 10, y - 1], '#c4f1e6aa', 0.8);
    }
    if (terrain === 'water' && variant % 2) {
      lotusPad(c, 26 + rand() * 8, 17 + rand() * 4, 4.5, top);
      lotusPad(c, 46 + rand() * 6, 21 + rand() * 4, 3.4, top);
      if (variant === 3) lotusFlower(c, 30, 15, 0.9);
    }
  } else if (terrain === 'road') {
    line(
      c,
      [
        [14, 20],
        [42, 6],
      ],
      '#c79f6a',
      1.2,
    );
    line(
      c,
      [
        [38, 30],
        [66, 16],
      ],
      '#c79f6a',
      1.2,
    );
    for (let i = 0; i < 7; i++)
      ellipse(c, 18 + rand() * 44, 10 + rand() * 16, 1.4, 0.8, i % 2 ? '#bca076' : '#f4dbac');
  } else {
    const tuft = terrain === 'forest' ? ['#5d8f45', '#b7d77d'] : ['#7fae56', '#cde69a'];
    for (let i = 0; i < 8; i++) {
      const x = 14 + rand() * 50;
      const y = 8 + rand() * 20;
      line(
        c,
        [
          [x - 1.5, y - 2.5],
          [x, y],
          [x + 1.5, y - 2.8],
        ],
        tuft[i % 2]!,
        0.9,
      );
    }
    if (terrain === 'forest')
      for (let i = 0; i < 6; i++)
        ellipse(c, 14 + rand() * 50, 8 + rand() * 20, 1.6, 0.8, i % 2 ? '#a5844f88' : '#6f8f3e88');
    else if (variant === 1 || variant === 3)
      for (let i = 0; i < 3; i++) {
        const x = 20 + rand() * 40;
        const y = 10 + rand() * 16;
        const petal = ['#fff6dc', '#ffd86b', '#f4a3c4'][(i + variant) % 3]!;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -0.7],
          [0, 0.7],
        ] as Vertex[])
          ellipse(c, x + dx, y + dy, 0.9, 0.7, petal);
        ellipse(c, x, y, 0.5, 0.4, '#e2913f');
      }
  }
  c.restore();
  if (terrain === 'canal' || terrain === 'moat') {
    // Fitted stone banks along the two upper edges.
    const stone = terrain === 'canal' ? '#d9cfae' : '#c98c66';
    for (const [[x0, y0], [x1, y1]] of [
      [
        [4, 18],
        [40, 0],
      ],
      [
        [40, 0],
        [76, 18],
      ],
    ] as [Vertex, Vertex][])
      for (let t = 0.06; t < 1; t += 0.16)
        ellipse(
          c,
          x0 + (x1 - x0) * t,
          y0 + (y1 - y0) * t + 1,
          3.2,
          1.6,
          stone,
          shade(stone, -0.35),
          0.6,
        );
    line(
      c,
      [
        [4, 18],
        [40, 36],
        [76, 18],
      ],
      '#9caa80',
      1.2,
    );
  }
  if (wet && terrain !== 'flood')
    line(
      c,
      [
        [5, 18],
        [40, 0.5],
        [75, 18],
      ],
      '#e3fbf366',
      1,
    );
}

function trunk(c: Ctx, base: Vertex, top: Vertex, width: number, color = '#a9814f') {
  const [bx, by] = base;
  const [tx, ty] = top;
  polygon(
    c,
    [
      [bx - width, by],
      [tx - width * 0.45, ty],
      [tx + width * 0.45, ty],
      [bx + width, by],
    ],
    color,
    '#4a321c66',
    1,
  );
  line(
    c,
    [
      [bx - width * 0.4, by - 2],
      [tx - width * 0.2, ty + 2],
    ],
    shade(color, 0.3),
    1.2,
  );
}
/** The thnot sugar palm: a ringed straight trunk under a round crown of fan leaves. */
export function sugarPalm(c: Ctx, x: number, y: number, height: number, seed: number) {
  const rand = random(seed);
  const top = y - height;
  trunk(c, [x, y], [x + 1, top + 6], 4.2, '#8b6a46');
  for (let ring = y - 6; ring > top + 8; ring -= 5)
    line(
      c,
      [
        [x - 3, ring],
        [x + 3.5, ring - 1],
      ],
      '#5d4630',
      0.8,
    );
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1;
    curve(c, [x, top + 6], [x + side * 12, top + 10], [x + side * 10, top + 24], '#a88a52', 2);
  }
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const length = 15 + rand() * 4;
    const tipX = x + Math.cos(angle) * length;
    const tipY = top + Math.sin(angle) * length * 0.75;
    polygon(
      c,
      [
        [x, top],
        [tipX + Math.sin(angle) * 4, tipY - Math.cos(angle) * 3],
        [tipX - Math.sin(angle) * 4, tipY + Math.cos(angle) * 3],
      ],
      Math.sin(angle) < 0 ? '#86c45a' : i % 2 ? '#3f8a4b' : '#5ca54d',
      '#24553266',
    );
  }
  ellipse(c, x, top, 6, 5, '#2f6a3c');
  ellipse(c, x - 2, top - 2, 2.5, 2, '#9fd76d');
}
function coconutPalm(c: Ctx, rand: () => number) {
  c.beginPath();
  c.moveTo(60, 144);
  c.quadraticCurveTo(56, 96, 76, 46);
  c.lineTo(83, 48);
  c.quadraticCurveTo(66, 98, 72, 144);
  c.closePath();
  c.fillStyle = '#c29a5e';
  c.fill();
  c.strokeStyle = '#5f4325';
  c.lineWidth = 1;
  c.stroke();
  for (let t = 0.1; t < 0.95; t += 0.08) {
    const y = 144 - t * 96;
    const x = 64 + Math.pow(t, 1.6) * 16;
    line(
      c,
      [
        [x - 4, y],
        [x + 5, y - 1.5],
      ],
      '#8a6a3f',
      0.9,
    );
  }
  const crown: Vertex = [79, 46];
  for (let i = 0; i < 9; i++) {
    const angle = -Math.PI + (i / 8) * Math.PI * 2 + rand() * 0.2;
    const tip: Vertex = [crown[0] + Math.cos(angle) * 48, crown[1] + Math.sin(angle) * 18 + 14];
    const mid: Vertex = [
      (crown[0] + tip[0]) / 2,
      Math.min(crown[1], tip[1]) - 14 + Math.abs(Math.cos(angle)) * 4,
    ];
    c.beginPath();
    c.moveTo(...crown);
    c.quadraticCurveTo(mid[0], mid[1] - 6, tip[0], tip[1]);
    c.quadraticCurveTo(mid[0], mid[1] + 7, ...crown);
    c.fillStyle = Math.sin(angle) < 0 ? '#86c451' : i % 2 ? '#3a8a50' : '#5aa74c';
    c.fill();
    c.strokeStyle = '#225232';
    c.lineWidth = 0.8;
    c.stroke();
    curve(c, crown, mid, tip, '#cfe99a88', 0.8);
  }
  for (const [x, y] of [
    [74, 52],
    [81, 54],
    [77, 57],
  ])
    ellipse(c, x!, y!, 3.4, 3.4, '#7a5a2e', '#3e2a14', 0.7);
}

export function tree(c: Ctx, variant: number) {
  const rand = random(variant + 19);
  ellipse(c, 66, 145, 40, 11, '#173c2740');
  const green = { ink: '#24502f', dark: '#3a7d43', mid: '#5fa84b', light: '#a5d867' };
  if (variant === 0) {
    trunk(c, [66, 145], [66, 86], 6);
    canopy(c, 66, 62, 36, rand, green);
  } else if (variant === 1) {
    trunk(c, [64, 145], [64, 78], 5, '#9b764b');
    const deep = { ink: '#1f4a33', dark: '#2f6f45', mid: '#4b9a55', light: '#8acb68' };
    canopy(c, 68, 86, 28, rand, deep);
    canopy(c, 60, 52, 26, rand, deep);
  } else if (variant === 2) {
    trunk(c, [66, 145], [66, 92], 6.5);
    canopy(c, 66, 68, 38, rand, { ...green, mid: '#55a04a', light: '#9ad064' });
    for (let i = 0; i < 9; i++)
      ellipse(c, 40 + rand() * 52, 62 + rand() * 30, 2.6, 3.2, '#f2a33a', '#9a5a1a', 0.6);
  } else if (variant === 3) {
    coconutPalm(c, rand);
  } else if (variant === 4) {
    sugarPalm(c, 64, 145, 108, 7);
  } else if (variant === 5) {
    trunk(c, [66, 145], [66, 90], 5.5, '#9a7a5a');
    canopy(c, 66, 66, 34, rand, {
      ink: '#3d5a32',
      dark: '#5c8d4a',
      mid: '#86b85f',
      light: '#c4e28a',
    });
    for (let i = 0; i < 26; i++) {
      const x = 38 + rand() * 56;
      const y = 40 + rand() * 46;
      ellipse(c, x, y, 2.6, 2, i % 3 ? '#f39bc0' : '#fff2f6', '#b9547e55', 0.5);
    }
  } else if (variant === 6) {
    // Banyan: a buttressed trunk, wide crown, and hanging aerial roots.
    polygon(
      c,
      [
        [48, 145],
        [58, 120],
        [60, 88],
        [74, 88],
        [76, 120],
        [88, 145],
      ],
      '#9a7650',
      '#4a321c66',
      1,
    );
    canopy(c, 64, 64, 40, rand, green, 0.62);
    for (let i = 0; i < 9; i++) {
      const x = 32 + i * 8 + rand() * 4;
      line(
        c,
        [
          [x, 74 + rand() * 6],
          [x + rand() * 2 - 1, 104 + rand() * 30],
        ],
        '#8b6c48aa',
        1.2,
      );
    }
  } else {
    // Bamboo clump
    for (let i = 0; i < 8; i++) {
      const x = 48 + i * 4.5;
      const lean = (i - 3.5) * 4;
      const top: Vertex = [x + lean * 2, 26 + rand() * 18];
      curve(c, [x, 145], [x + lean * 0.4, 90], top, '#4f8a3a', 3.2);
      curve(c, [x, 145], [x + lean * 0.4, 90], top, '#9ccf68', 1);
      for (let t = 0.2; t < 0.95; t += 0.16) {
        const y = 145 - (145 - top[1]) * t;
        const nx = x + lean * 2 * t * t;
        line(
          c,
          [
            [nx - 2, y],
            [nx + 2, y],
          ],
          '#2f5a2a',
          1,
        );
      }
      for (let k = 0; k < 4; k++) {
        const t = 0.55 + k * 0.12;
        const y = 145 - (145 - top[1]) * t;
        const nx = x + lean * 2 * t * t;
        const dir = k % 2 ? 1 : -1;
        polygon(
          c,
          [
            [nx, y],
            [nx + dir * 13, y + 4],
            [nx + dir * 3, y + 2.5],
          ],
          k % 2 ? '#6db24f' : '#a3d66c',
          '#2f5a2a55',
        );
      }
    }
  }
}
