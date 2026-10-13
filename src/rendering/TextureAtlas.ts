import { Rectangle, Texture } from 'pixi.js';
import type { BuildingKind, Terrain } from '../core/types';
import { random } from '../core/world';

type Ctx = CanvasRenderingContext2D;
type Vertex = [number, number];
export function polygon(c: Ctx, points: Vertex[], fill: string, stroke?: string) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 0.7;
    c.stroke();
  }
}
function box(
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
}
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}
function line(c: Ctx, points: Vertex[], color: string, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function tower(c: Ctx, x: number, y: number, scale = 1) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  box(c, 0, 0, 25, 12, 12, '#e7d8b2', '#b5a180', '#9a896d');
  box(c, 0, -12, 21, 10, 25, '#d3bd92', '#d2be96', '#a49373');
  c.fillStyle = '#645f4d';
  c.fillRect(-5, -32, 10, 20);
  line(
    c,
    [
      [-9, -12],
      [-9, -34],
      [0, -42],
      [9, -34],
      [9, -12],
    ],
    '#e5cfa5',
    3,
  );
  const outline: Vertex[] = [
    [-23, -36],
    [-21, -44],
    [-18, -44],
    [-18, -57],
    [-15, -63],
    [-15, -73],
    [-11, -79],
    [-10, -89],
    [-6, -96],
    [-5, -104],
    [0, -115],
    [5, -104],
    [6, -96],
    [10, -89],
    [11, -79],
    [15, -73],
    [15, -63],
    [18, -57],
    [18, -44],
    [21, -44],
    [23, -36],
  ];
  polygon(c, outline, '#dcc8a1', '#9a8a6e');
  polygon(
    c,
    [
      [0, -114],
      [5, -104],
      [6, -96],
      [10, -89],
      [11, -79],
      [15, -73],
      [15, -63],
      [18, -57],
      [18, -44],
      [21, -44],
      [23, -36],
      [0, -36],
    ],
    '#b8a27b',
  );
  for (let i = 0; i < 7; i++) {
    const yy = -43 - i * 9;
    const w = 18 - i * 1.9;
    line(
      c,
      [
        [-w, yy],
        [0, yy + 4],
        [w, yy],
      ],
      '#f0dcaf',
      2,
    );
    line(
      c,
      [
        [-w, yy + 3],
        [0, yy + 7],
        [w, yy + 3],
      ],
      '#9b8968',
      0.7,
    );
  }
  line(
    c,
    [
      [0, -112],
      [0, -39],
    ],
    '#ead7ad',
    1.4,
  );
  c.restore();
}
function dwelling(c: Ctx, x: number, y: number, scale = 1, roof = '#9b6541') {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  for (const dx of [-24, 0, 24]) {
    line(
      c,
      [
        [dx, 0],
        [dx, 22],
      ],
      '#776c50',
      4,
    );
  }
  box(c, 0, 0, 30, 15, 6, '#b5a179', '#867d60', '#726c54');
  box(c, 0, -6, 26, 13, 28, '#cbb58b', '#c5ac7b', '#a59168');
  for (let i = 0; i < 4; i++)
    line(
      c,
      [
        [-26, -10 - i * 6],
        [0, 3 - i * 6],
        [26, -10 - i * 6],
      ],
      '#8e7958',
      0.6,
    );
  polygon(
    c,
    [
      [-36, -35],
      [-5, -62],
      [34, -43],
      [4, -19],
    ],
    roof,
  );
  polygon(
    c,
    [
      [34, -43],
      [4, -19],
      [36, -23],
      [39, -29],
    ],
    '#744d35',
  );
  polygon(
    c,
    [
      [-36, -35],
      [-5, -62],
      [-9, -35],
    ],
    '#b37e4e',
  );
  line(
    c,
    [
      [-5, -62],
      [34, -43],
    ],
    '#d7b57c',
    2,
  );
  for (let i = 0; i < 7; i++)
    line(
      c,
      [
        [-30 + i * 5, -36 - i * 3.4],
        [7 + i * 4.1, -21 - i * 3.2],
      ],
      '#d2a573',
      0.7,
    );
  polygon(
    c,
    [
      [-5, -27],
      [4, -22],
      [4, -7],
      [-5, -12],
    ],
    '#514f3e',
  );
  line(
    c,
    [
      [4, 0],
      [18, 12],
      [18, 25],
    ],
    '#b4a483',
    3,
  );
  for (let i = 0; i < 4; i++)
    line(
      c,
      [
        [5 + i * 4, 2 + i * 4],
        [13 + i * 4, 2 + i * 4],
      ],
      '#ded0a4',
      1.5,
    );
  c.restore();
}

/** Every scene sprite shares one GPU texture. Artwork is generated once at startup. */
export class TextureAtlas {
  private readonly canvas = document.createElement('canvas');
  private readonly context: Ctx;
  private readonly frames = new Map<string, Rectangle>();
  private readonly thumbnails = new Map<string, string>();
  private readonly textures = new Map<string, Texture>();
  private x = 0;
  private y = 0;
  private rowHeight = 0;
  readonly texture: Texture;
  constructor() {
    this.canvas.width = 2048;
    this.canvas.height = 2048;
    this.context = this.canvas.getContext('2d')!;
    for (const terrain of [
      'grass',
      'forest',
      'water',
      'canal',
      'reservoir',
      'road',
      'bridge',
    ] as Terrain[])
      for (let v = 0; v < 5; v++)
        this.add(`${terrain}-${v}`, 80, 56, (c) => this.tile(c, terrain, v));
    for (let v = 0; v < 5; v++) this.add(`tree-${v}`, 128, 160, (c) => this.tree(c, v));
    for (const kind of [
      'baray',
      'canal',
      'paddy',
      'house',
      'quarry',
      'temple',
      'lumber',
      'dock',
      'gate',
      'road',
      'bridge',
    ] as BuildingKind[])
      this.add(kind, 384, 320, (c) => this.building(c, kind));
    this.add('temple-foundation', 384, 320, (c) => this.building(c, 'temple', 1));
    this.add('worker', 32, 48, (c) => {
      ellipse(c, 16, 42, 7, 3, '#3f4a3540');
      line(
        c,
        [
          [13, 31],
          [11, 41],
        ],
        '#5d5b42',
        3,
      );
      line(
        c,
        [
          [19, 31],
          [21, 41],
        ],
        '#5d5b42',
        3,
      );
      polygon(
        c,
        [
          [12, 20],
          [20, 20],
          [22, 32],
          [10, 32],
        ],
        '#d5ad73',
      );
      ellipse(c, 16, 16, 5, 6, '#ac7e55');
      ellipse(c, 16, 12, 9, 3, '#dfc994');
      c.fillStyle = '#8b6d45';
      c.fillRect(21, 23, 7, 9);
    });
    this.add('barge', 100, 70, (c) => {
      ellipse(c, 50, 45, 40, 13, '#386e6540');
      polygon(
        c,
        [
          [7, 36],
          [65, 7],
          [94, 22],
          [35, 52],
        ],
        '#b69a65',
      );
      polygon(
        c,
        [
          [7, 36],
          [35, 52],
          [35, 58],
          [11, 44],
        ],
        '#6f6648',
      );
      polygon(
        c,
        [
          [35, 52],
          [94, 22],
          [90, 31],
          [35, 58],
        ],
        '#887249',
      );
      for (let i = 0; i < 4; i++)
        box(c, 30 + i * 12, 33 - i * 6, 8, 4, 9, '#c6c1aa', '#a29d89', '#8d8d7d');
      line(
        c,
        [
          [78, 19],
          [86, 0],
        ],
        '#695b3f',
        2,
      );
      ellipse(c, 78, 12, 4, 5, '#b58c5c');
    });
    this.texture = Texture.from(this.canvas);
  }
  get(key: string): Texture {
    const cached = this.textures.get(key);
    if (cached) return cached;
    const frame = this.frames.get(key);
    if (!frame) throw new Error(`Missing atlas frame: ${key}`);
    const texture = new Texture({ source: this.texture.source, frame });
    this.textures.set(key, texture);
    return texture;
  }
  thumbnail(key: string) {
    return this.thumbnails.get(key) ?? '';
  }
  private add(key: string, width: number, height: number, draw: (c: Ctx) => void) {
    if (this.x + width > 2048) {
      this.x = 0;
      this.y += this.rowHeight + 2;
      this.rowHeight = 0;
    }
    if (this.y + height > 2048) throw new Error('Texture atlas overflow');
    this.context.save();
    this.context.translate(this.x, this.y);
    draw(this.context);
    this.context.restore();
    this.frames.set(key, new Rectangle(this.x, this.y, width, height));
    if (width === 384) {
      const thumb = document.createElement('canvas');
      thumb.width = 192;
      thumb.height = 160;
      if (key === 'bridge' || key === 'road')
        thumb
          .getContext('2d')!
          .drawImage(this.canvas, this.x + 140, this.y + 195, 104, 100, 0, 0, 192, 160);
      else
        thumb
          .getContext('2d')!
          .drawImage(this.canvas, this.x, this.y, width, height, 0, 0, 192, 160);
      this.thumbnails.set(key, thumb.toDataURL('image/png'));
    }
    this.x += width + 2;
    this.rowHeight = Math.max(this.rowHeight, height);
  }
  private tile(c: Ctx, terrain: Terrain, variant: number) {
    const rand = random(variant + 41);
    const grass = ['#b2c58d', '#b6c78f', '#b1c28b', '#bacb95', '#b4c58d'][variant]!;
    const water = ['#71a99b', '#77ad9e', '#74aa9c', '#7caf9e', '#73a797'][variant]!;
    const wet = ['water', 'canal', 'reservoir', 'bridge'].includes(terrain);
    const top = wet
      ? water
      : terrain === 'road'
        ? '#c5b995'
        : terrain === 'forest'
          ? '#9eb77d'
          : grass;
    polygon(
      c,
      [
        [4, 18],
        [40, 36],
        [40, 43],
        [4, 25],
      ],
      wet ? '#5f9484' : '#859367',
    );
    polygon(
      c,
      [
        [40, 36],
        [76, 18],
        [76, 25],
        [40, 43],
      ],
      wet ? '#548b7b' : '#79865e',
    );
    polygon(
      c,
      [
        [40, 0],
        [76, 18],
        [40, 36],
        [4, 18],
      ],
      top,
      wet ? '#80b7a4' : '#afc18a',
    );
    if (wet) {
      for (let i = 0; i < 4; i++) {
        const x = 22 + rand() * 35;
        const y = 10 + rand() * 14;
        line(
          c,
          [
            [x, y],
            [x + 8, y - 4],
          ],
          '#a5ceba',
          0.7,
        );
      }
      if (terrain === 'canal') {
        line(
          c,
          [
            [4, 18],
            [40, 0],
            [76, 18],
          ],
          '#c7c39e',
          2,
        );
        line(
          c,
          [
            [4, 18],
            [40, 36],
            [76, 18],
          ],
          '#9caa80',
          1.5,
        );
      }
    } else if (terrain === 'road') {
      for (let i = 0; i < 6; i++)
        ellipse(c, 20 + rand() * 40, 12 + rand() * 12, 1.5, 0.7, '#a7a181');
    } else {
      for (let i = 0; i < 9; i++) {
        const x = 18 + rand() * 40;
        const y = 12 + rand() * 12;
        line(
          c,
          [
            [x, y],
            [x - 1, y - 2],
          ],
          variant % 2 ? '#91aa73' : '#c4d09a',
          0.8,
        );
      }
    }
  }
  private tree(c: Ctx, variant: number) {
    const rand = random(variant + 19);
    const palm = variant === 3;
    ellipse(c, 65, 143, 38, 12, '#536d4d25');
    if (palm) {
      line(
        c,
        [
          [65, 140],
          [62, 92],
          [74, 45],
        ],
        '#8b8462',
        7,
      );
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const x = 74 + Math.cos(angle) * 49;
        const y = 45 + Math.sin(angle) * 20;
        c.beginPath();
        c.moveTo(74, 45);
        c.quadraticCurveTo(x, y - 16, x, y + 17);
        c.quadraticCurveTo((74 + x) / 2, y + 1, 74, 45);
        c.fillStyle = i % 2 ? '#567e4e' : '#71914e';
        c.fill();
      }
    } else {
      polygon(
        c,
        [
          [61, 144],
          [69, 144],
          [67, 73],
          [62, 73],
        ],
        '#7c7952',
      );
      for (let i = 0; i < 22; i++) {
        const x = 32 + rand() * 64;
        const y = 29 + rand() * 73;
        const r = 13 + rand() * 12;
        ellipse(
          c,
          x,
          y,
          r,
          r * 0.9,
          ['#4e7545', '#658749', '#76924f', '#85a05b', '#567c45'][i % 5]!,
        );
      }
      for (let i = 0; i < 9; i++)
        ellipse(c, 40 + rand() * 45, 36 + rand() * 32, 8 + rand() * 10, 9, '#91a962');
    }
  }
  private building(c: Ctx, kind: BuildingKind, level = 3) {
    c.save();
    c.translate(192, 252);
    if (kind === 'temple') {
      ellipse(c, 0, 8, 148, 69, '#56664b25');
      box(c, 0, 0, 145, 72, 8, '#cfc49e', '#9e9878', '#85876a');
      box(c, 0, -8, 126, 63, 10, '#e2d5b1', '#b8ac8b', '#a69c7d');
      for (let i = -100; i <= 100; i += 20) {
        box(c, i, -8 - Math.abs(i) * 0.05, 4, 2, 10, '#e4d7b4', '#a89b7d', '#93896b');
      }
      box(c, 0, -20, 103, 51, 17, '#c6b996', '#a49375', '#958669');
      if (level > 1)
        for (const [x, y] of [
          [0, -58],
          [-62, -27],
          [62, -27],
        ] as Vertex[])
          tower(c, x, y, 0.8);
      box(c, 0, -36, 65, 32, 17, '#e3d2aa', '#bdaa85', '#a49272');
      if (level > 1) {
        tower(c, -41, -9, 0.75);
        tower(c, 41, -9, 0.75);
        tower(c, 0, -30, 1.25);
      }
      for (let i = 0; i < 8; i++)
        box(c, 0, 29 + i * 4, 23 + i * 1.8, 11 + i * 0.9, 3, '#d1c29d', '#af9f7d', '#9b8f71');
      for (let side of [-1, 1])
        for (let i = 0; i < 5; i++) {
          const x = side * (70 + i * 12);
          const y = 23 - i * 6;
          box(c, x, y, 4, 2, 13, '#e5d7b1', '#b6a783', '#9d9475');
        }
    } else if (kind === 'baray') {
      box(c, 0, 0, 142, 71, 8, '#bbb99a', '#979c7d', '#848d70');
      polygon(
        c,
        [
          [0, -75],
          [130, -10],
          [0, 55],
          [-130, -10],
        ],
        '#75a898',
        '#bac3a0',
      );
      for (let i = 0; i < 14; i++) {
        const x = -95 + i * 15;
        const y = (i % 3) * 8 - 10;
        line(
          c,
          [
            [x, y],
            [x + 22, y - 11],
          ],
          '#add0b8',
          1,
        );
      }
      for (let i = -120; i <= 120; i += 24) {
        line(
          c,
          [
            [i, -74 + Math.abs(i) * 0.5],
            [i + 10, -69 + Math.abs(i) * 0.5],
          ],
          '#d5cfb1',
          2,
        );
      }
      box(c, 0, -18, 24, 12, 8, '#b9ae89', '#9c9474', '#8b8569');
      tower(c, 0, -27, 0.46);
      box(c, 0, 63, 24, 12, 7);
      dwelling(c, 0, 45, 0.5, '#93724b');
      for (let i = 0; i < 5; i++) box(c, 0, 68 + i * 4, 15, 7, 2);
    } else if (kind === 'paddy') {
      box(c, 0, 0, 68, 34, 4, '#bcb184', '#a39d72', '#898d65');
      polygon(
        c,
        [
          [0, -34],
          [64, -2],
          [0, 30],
          [-64, -2],
        ],
        '#88a36a',
      );
      for (let row = 0; row < 9; row++)
        for (let col = 0; col < 9; col++) {
          const x = (col - row) * 6.8;
          const y = (col + row) * 3.4 - 29;
          line(
            c,
            [
              [x, y],
              [x - 2, y - 9],
              [x, y - 6],
              [x + 2, y - 11],
            ],
            row % 2 ? '#c7c374' : '#aebe6b',
            1.4,
          );
        }
      line(
        c,
        [
          [0, -34],
          [64, -2],
          [0, 30],
          [-64, -2],
          [0, -34],
        ],
        '#cdc79b',
        3,
      );
      dwelling(c, 0, -38, 0.34, '#b99962');
    } else if (kind === 'house' || kind === 'lumber') {
      box(c, 0, 8, 64, 32, 3, '#b7bd8e', '#9ba37a', '#8e9871');
      dwelling(c, -14, -5, 1.15, kind === 'lumber' ? '#79815d' : '#a4774d');
      dwelling(c, 34, 9, 0.68, '#b18a55');
      for (let i = 0; i < 4; i++) {
        ellipse(c, -41 + i * 6, 27 - i * 3, 5, 3, '#d1bd8c');
      }
      if (kind === 'lumber')
        for (let i = 0; i < 7; i++) {
          line(
            c,
            [
              [-50 + i * 5, 14],
              [-25 + i * 5, 26],
            ],
            '#957650',
            5,
          );
          ellipse(c, -25 + i * 5, 26, 2.5, 2, '#c6ad77');
        }
      else {
        ellipse(c, 40, 28, 6, 4, '#b9a475');
        ellipse(c, 41, 25, 5, 4, '#d3c18d');
      }
    } else if (kind === 'quarry') {
      box(c, 0, 4, 65, 32, 5, '#a8aa8e', '#8f957b', '#7d866e');
      for (let i = 0; i < 5; i++)
        box(
          c,
          -20 + i * 13,
          -12 - i * 4,
          38 - i * 5,
          19 - i * 2.5,
          12 + i * 5,
          ['#c8c5af', '#d5d0ba', '#babba6'][i % 3],
          '#a8aa97',
          '#909885',
        );
      for (let i = 0; i < 8; i++)
        box(
          c,
          -42 + (i % 4) * 15,
          21 - Math.floor(i / 4) * 12,
          7,
          4,
          8,
          '#d1cbb5',
          '#b2ae97',
          '#9e9f8b',
        );
      line(
        c,
        [
          [14, 5],
          [14, -53],
          [45, -37],
          [45, 19],
        ],
        '#857b56',
        5,
      );
      line(
        c,
        [
          [14, -52],
          [45, -37],
        ],
        '#b09e70',
        3,
      );
      line(
        c,
        [
          [38, -39],
          [38, -5],
        ],
        '#746c50',
        1,
      );
    } else if (kind === 'dock') {
      box(c, 0, 0, 65, 32, 8, '#b8ac7f', '#8f8967', '#797f60');
      for (let i = 0; i < 10; i++)
        line(
          c,
          [
            [-59 + i * 6, -3 - i * 3],
            [i * 6, 26 - i * 3],
          ],
          '#d7c99a',
          1,
        );
      dwelling(c, -19, -18, 0.8, '#8a7954');
      for (let i = 0; i < 5; i++) box(c, 24 + (i % 3) * 11, 8 - Math.floor(i / 3) * 10, 6, 3, 7);
      line(
        c,
        [
          [45, 20],
          [58, 45],
        ],
        '#807957',
        4,
      );
      line(
        c,
        [
          [-15, 27],
          [-2, 53],
        ],
        '#807957',
        4,
      );
    } else if (kind === 'road') {
      box(c, 0, 0, 44, 22, 4, '#c8bc93', '#aaa27b', '#8f9471');
      for (let i = 0; i < 6; i++)
        line(
          c,
          [
            [-32 + i * 10, -4],
            [i * 10, 12],
          ],
          '#e4d9b2',
          1,
        );
    } else if (kind === 'bridge') {
      box(c, 0, -3, 36, 18, 5, '#bba478', '#8d7954', '#7e7151');
      for (let i = 0; i < 9; i++)
        line(
          c,
          [
            [-32 + i * 4, -5 - i * 2],
            [i * 4, 11 - i * 2],
          ],
          '#d8c399',
          1,
        );
      for (const sign of [-1, 1]) {
        line(
          c,
          [
            [sign * 34, -9],
            [0, -26],
          ],
          '#d3ba87',
          2,
        );
        line(
          c,
          [
            [sign * 34, -9],
            [0, 8],
          ],
          '#c3a775',
          2,
        );
        for (const [x, y] of [
          [0, -18],
          [sign * 34, 0],
          [0, 18],
        ] as Vertex[])
          line(
            c,
            [
              [x, y - 5],
              [x, y - 17],
            ],
            '#8d7850',
            2,
          );
      }
    } else if (kind === 'gate') {
      box(c, 0, 0, 33, 16, 5, '#aba685', '#8b906e', '#7b8362');
      box(c, -21, -7, 6, 3, 48);
      box(c, 21, -7, 6, 3, 48);
      polygon(
        c,
        [
          [-20, -6],
          [20, -26],
          [20, -53],
          [-20, -33],
        ],
        '#978665',
      );
      for (let i = 0; i < 5; i++)
        line(
          c,
          [
            [-20, -8 - i * 6],
            [20, -28 - i * 6],
          ],
          '#bead86',
          1,
        );
      line(
        c,
        [
          [-26, -47],
          [0, -60],
          [27, -47],
        ],
        '#d2c49d',
        5,
      );
    } else {
      box(c, 0, 0, 55, 27, 7, '#b9b895', '#909d7a', '#7e8b6b');
      polygon(
        c,
        [
          [0, -31],
          [48, -7],
          [0, 17],
          [-48, -7],
        ],
        '#7ba99a',
      );
      for (let i = 0; i < 4; i++)
        line(
          c,
          [
            [-20 + i * 10, -8],
            [i * 10, -18],
          ],
          '#b7d0b8',
          1,
        );
    }
    c.restore();
  }
}
