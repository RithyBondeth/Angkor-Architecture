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
  // One consistent sunlight direction gives the procedural architecture more depth.
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
  box(c, 0, 0, 25, 12, 12, '#ffdf9d', '#d5ac71', '#b78b5d');
  box(c, 0, -12, 21, 10, 25, '#f4cf8c', '#f1cb89', '#cfa16c');
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
  polygon(c, outline, '#f4d294', '#b58e60');
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
    '#d9af76',
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
      '#ffe9ac',
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
    '#ffe8ad',
    1.4,
  );
  c.restore();
}
function dwelling(c: Ctx, x: number, y: number, scale = 1, roof = '#cd784f') {
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
    '#a65840',
  );
  polygon(
    c,
    [
      [-36, -35],
      [-5, -62],
      [-9, -35],
    ],
    '#e6a16a',
  );
  line(
    c,
    [
      [-5, -62],
      [34, -43],
    ],
    '#ffcd8a',
    2,
  );
  for (let i = 0; i < 7; i++)
    line(
      c,
      [
        [-30 + i * 5, -36 - i * 3.4],
        [7 + i * 4.1, -21 - i * 3.2],
      ],
      '#f6be80',
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
      'moat',
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
      'moat',
      'paddy',
      'house',
      'quarry',
      'temple',
      'lumber',
      'dock',
      'gate',
      'road',
      'bridge',
      'granary',
      'workshop',
      'warehouse',
      'lateritepit',
    ] as BuildingKind[])
      this.add(kind, 384, 320, (c) => this.building(c, kind));
    this.add('temple-towers', 384, 320, (c) => this.building(c, 'temple', 2));
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
    const grass = ['#a1c978', '#a5ce7a', '#9bc572', '#a9d17c', '#a0cb75'][variant]!;
    const water = ['#48abb5', '#50b1ba', '#4caeb8', '#55b7bf', '#4aafb6'][variant]!;
    const wet = ['water', 'moat', 'canal', 'reservoir', 'bridge'].includes(terrain);
    const top = wet
      ? water
      : terrain === 'road'
        ? '#e3c18a'
        : terrain === 'forest'
          ? '#88b562'
          : grass;
    polygon(
      c,
      [
        [4, 18],
        [40, 36],
        [40, 43],
        [4, 25],
      ],
      wet ? '#378b97' : '#7b9f55',
    );
    polygon(
      c,
      [
        [40, 36],
        [76, 18],
        [76, 25],
        [40, 43],
      ],
      wet ? '#2f8192' : '#688e4c',
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
      undefined,
    );
    c.save();
    c.beginPath();
    c.moveTo(40, 0);
    c.lineTo(76, 18);
    c.lineTo(40, 36);
    c.lineTo(4, 18);
    c.closePath();
    c.clip();
    const light = c.createLinearGradient(8, 0, 65, 36);
    light.addColorStop(0, wet ? '#c1e2b512' : '#e6d7a319');
    light.addColorStop(1, '#173d2410');
    c.fillStyle = light;
    c.fillRect(0, 0, 80, 40);
    for (let i = 0; i < 85; i++) {
      c.fillStyle = i % 2 ? '#e1dcb011' : '#1834210c';
      c.fillRect(rand() * 80, rand() * 36, 1 + rand() * 2, 0.6);
    }
    c.restore();
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
          '#b4e6da',
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
          variant % 2 ? '#82af59' : '#c0df8d',
          0.8,
        );
      }
    }
  }
  private tree(c: Ctx, variant: number) {
    const rand = random(variant + 19);
    const palm = variant === 3;
    ellipse(c, 77, 143, 46, 13, '#173c2740');
    if (palm) {
      line(
        c,
        [
          [65, 140],
          [62, 92],
          [74, 45],
        ],
        '#bd9b62',
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
        c.fillStyle = i % 2 ? '#3f9457' : '#8ec451';
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
        '#b8935f',
      );
      const clusters = Array.from({ length: 22 }, () => ({
        x: 32 + rand() * 64,
        y: 29 + rand() * 73,
        r: 13 + rand() * 12,
      })).sort((a, b) => a.y - b.y);
      for (const { x, y, r } of clusters) {
        const canopy: Vertex[] = [];
        for (let i = 0; i < 14; i++) {
          const angle = (i / 14) * Math.PI * 2;
          const radius = r * (0.8 + rand() * 0.3);
          canopy.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.8]);
        }
        const tones = c.createRadialGradient(x - 6, y - 6, 1, x, y, r);
        tones.addColorStop(0, '#b0d96a');
        tones.addColorStop(0.5, '#71ad4c');
        tones.addColorStop(1, '#3b804b');
        polygon(c, canopy, '#559947');
        c.save();
        c.clip();
        c.fillStyle = tones;
        c.fillRect(x - r * 1.2, y - r, r * 2.4, r * 2);
        for (let i = 0; i < 16; i++) {
          ellipse(
            c,
            x - r + rand() * r * 2,
            y - r + rand() * r * 2,
            1.5 + rand() * 3,
            1.2,
            i % 2 ? '#d0c77d35' : '#163c2c30',
          );
        }
        c.restore();
      }
    }
  }
  private building(c: Ctx, kind: BuildingKind, level = 3) {
    c.save();
    c.translate(192, 252);
    if (kind === 'temple') {
      ellipse(c, 0, 8, 148, 69, '#56664b25');
      box(c, 0, 0, 145, 72, 8, '#e7c890', '#be9e70', '#a8875b');
      box(c, 0, -8, 126, 63, 10, '#ffe1a4', '#d5b580', '#bd9a6c');
      for (let i = -100; i <= 100; i += 20) {
        box(c, i, -8 - Math.abs(i) * 0.05, 4, 2, 10, '#e4d7b4', '#a89b7d', '#93896b');
      }
      box(c, 0, -20, 103, 51, 17, '#e2bc82', '#c39a65', '#ad825a');
      if (level > 1)
        for (const [x, y] of [
          [0, -58],
          [-62, -27],
          [62, -27],
        ] as Vertex[])
          tower(c, x, y, 0.8);
      box(c, 0, -36, 65, 32, 17, '#ffe1a2', '#d9b17b', '#c39b69');
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
      if (level >= 3) {
        // Relief bands use the same warm stone faces and upper-left light as civic buildings.
        for (let row = 0; row < 3; row++)
          line(
            c,
            [
              [-92, -14 + row * 5],
              [0, 32 + row * 5],
              [92, -14 + row * 5],
            ],
            '#9d805945',
            1,
          );
      }
      if (level >= 3)
        for (let i = 0; i < 7; i++) {
          line(
            c,
            [
              [42 + i * 12, 18 - i * 6],
              [42 + i * 12, 5 - i * 6],
              [48 + i * 12, 9 - i * 6],
            ],
            '#8d6d44',
            2,
          );
          ellipse(c, 45 + i * 12, 1 - i * 6, 2, 3, '#f2e2b9');
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
        '#52b4bc',
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
          '#b5ebe0',
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
        '#80b85f',
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
            row % 2 ? '#d9dd6d' : '#b8d866',
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
        '#f6d391',
        3,
      );
      dwelling(c, 0, -38, 0.34, '#b99962');
    } else if (kind === 'house' || kind === 'lumber') {
      box(c, 0, 8, 64, 32, 3, '#bbd28a', '#95b76c', '#80a362');
      dwelling(c, -14, -5, 1.15, kind === 'lumber' ? '#80a95b' : '#d98658');
      dwelling(c, 34, 9, 0.68, '#edac68');
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
    } else if (kind === 'warehouse') {
      box(c, 0, 8, 68, 34, 7, '#c3b69a', '#9d957a', '#87876a');
      dwelling(c, -12, -10, 1.35, '#88734d');
      for (let i = 0; i < 6; i++)
        box(
          c,
          20 + (i % 3) * 12,
          26 - Math.floor(i / 3) * 12,
          8,
          4,
          10,
          '#dac399',
          '#b39971',
          '#958460',
        );
      line(
        c,
        [
          [-55, 20],
          [-28, 34],
        ],
        '#826b46',
        6,
      );
      ellipse(c, -50, 29, 6, 8, '#74694c');
      ellipse(c, -24, 39, 6, 8, '#74694c');
    } else if (kind === 'lateritepit') {
      box(c, 0, 4, 65, 32, 5, '#bc9476', '#97745a', '#805f48');
      polygon(
        c,
        [
          [-35, -4],
          [0, -23],
          [38, -4],
          [0, 15],
        ],
        '#805b45',
        '#d6ab81',
      );
      for (let i = 0; i < 8; i++)
        box(
          c,
          -43 + (i % 4) * 16,
          21 - Math.floor(i / 4) * 11,
          8,
          4,
          9,
          '#cd966d',
          '#a76f50',
          '#8f5b40',
        );
      dwelling(c, 25, -25, 0.58, '#b08a53');
      line(
        c,
        [
          [-30, -2],
          [-8, -39],
          [15, -27],
        ],
        '#9a8155',
        4,
      );
    } else if (kind === 'granary') {
      box(c, 0, 8, 65, 32, 6, '#c4b887', '#a19b71', '#8d906b');
      dwelling(c, 0, -5, 1.25, '#a98a4f');
      for (let i = 0; i < 6; i++) {
        const x = -45 + (i % 3) * 12,
          y = 22 - Math.floor(i / 3) * 9;
        ellipse(c, x, y, 6, 4, '#c4ac73');
        ellipse(c, x, y - 5, 5, 7, '#dfcb92');
        line(
          c,
          [
            [x - 3, y - 10],
            [x + 3, y - 10],
          ],
          '#a58e5c',
          2,
        );
      }
      box(c, 42, 15, 12, 6, 15, '#e0d1a6', '#b8ab80', '#a0946e');
    } else if (kind === 'workshop') {
      box(c, 0, 8, 66, 33, 5, '#c4c1a0', '#a4aa86', '#8d9877');
      dwelling(c, -17, -10, 0.98, '#728168');
      box(c, 26, 12, 25, 12, 12, '#dcd4b4', '#b7ad8d', '#9e967a');
      for (let i = 0; i < 3; i++) box(c, 15 + i * 13, -4 + i * 6, 7, 3.5, 9);
      line(
        c,
        [
          [15, 7],
          [42, 20],
        ],
        '#806c47',
        3,
      );
      line(
        c,
        [
          [28, 3],
          [15, 18],
        ],
        '#b5955e',
        3,
      );
      for (let i = 0; i < 4; i++)
        line(
          c,
          [
            [-46 + i * 6, 22],
            [-24 + i * 6, 33],
          ],
          '#a08458',
          4,
        );
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
