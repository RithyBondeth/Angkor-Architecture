import { CylinderGeometry, ExtrudeGeometry, Group, Mesh, Shape, Vector3 } from 'three';
import type { Object3D } from 'three';
import {
  BRONZE,
  GOLD,
  ball,
  capsule,
  cone,
  cyl,
  glowSprite,
  lathe,
  mat,
  pad,
  rbox,
  ring,
  cachedTexture,
  canvasTexture,
  noise,
  rng,
  roof,
  tex,
  tube,
} from './studio';
import type { V3 } from './studio';
import { waterTexture } from './terrain';

/** Sprites with a 3D model; everything else keeps its painted art. */
export const MODEL_KEYS = [
  'house',
  'house-b',
  'garden',
  'palmgrove',
  'shrine',
  'naga',
  'lotuspond',
  'market',
  'singha',
  'parasol',
  'brazier',
  'gong',
  'gopura',
  'pavilion',
  'elephant',
  'facetower',
  'temple',
  'temple-towers',
  'temple-foundation',
  'baray',
  'paddy',
  'quarry',
  'lateritepit',
  'lumber',
  'dock',
  'gate',
  'bridge',
  'granary',
  'workshop',
  'warehouse',
  'stilthouse',
  'fishery',
  'royalbarge',
  'lotusraft',
  'life-boat',
  'life-egret',
  'life-egret-fly',
  'life-buffalo',
] as const;
export type ModelKey = (typeof MODEL_KEYS)[number];

const WOOD = '#8a5a34';
const SAND = '#e6cf98';
const RED = '#c8352b';
const LEAF = '#4f9a42';
const SKIN = '#c98a5c';

// ---------- Small reusable props ----------
function leafCluster(
  parent: Object3D,
  at: V3,
  radius: number,
  seed: number,
  tones = [LEAF, '#6cb84f', '#3d7f3a'],
) {
  const rand = rng(seed);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const d = i === 0 ? 0 : radius * 0.55;
    ball(
      parent,
      radius * (0.48 + rand() * 0.18),
      [at[0] + Math.cos(a) * d, at[1] + (rand() - 0.3) * radius * 0.5, at[2] + Math.sin(a) * d],
      mat(tones[i % tones.length]!, { shine: 12 }),
      [1, 0.85, 1],
      14,
    );
  }
}
function flower(parent: Object3D, at: V3, size: number, petal = '#f6a3c4', centre = '#ffd85e') {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ball(
      parent,
      size,
      [at[0] + Math.cos(a) * size, at[1], at[2] + Math.sin(a) * size],
      mat(petal, { shine: 30 }),
      [1, 0.45, 1],
      10,
    );
  }
  ball(
    parent,
    size * 0.6,
    [at[0], at[1] + size * 0.2, at[2]],
    mat(centre, { shine: 40 }),
    [1, 1, 1],
    10,
  );
}
function lotus(parent: Object3D, at: V3, size: number) {
  const pink = mat('#f08db3', { shine: 35 });
  const pale = mat('#ffd3e4', { shine: 35 });
  for (let ringIndex = 0; ringIndex < 2; ringIndex++)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + ringIndex * 0.5;
      const d = size * (ringIndex ? 0.45 : 0.75);
      const petal = ball(
        parent,
        size * 0.45,
        [at[0] + Math.cos(a) * d, at[1] + size * (0.35 + ringIndex * 0.3), at[2] + Math.sin(a) * d],
        ringIndex ? pale : pink,
        [0.55, 1.2, 0.55],
        10,
      );
      petal.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    }
  ball(parent, size * 0.28, [at[0], at[1] + size * 0.55, at[2]], mat('#ffd34a', { shine: 40 }));
}
function lilyPad(parent: Object3D, at: V3, radius: number) {
  const pad = cyl(parent, radius, radius, 0.012, at, mat('#5fae5a', { shine: 25 }), 22);
  pad.scale.set(1, 1, 1);
}
function villager(parent: Object3D, at: V3, cloth: string, hair = '#2e2118') {
  capsule(parent, 0.055, 0.12, [at[0], at[1] + 0.13, at[2]], mat(cloth, { shine: 20 }));
  cone(parent, 0.08, 0.12, at, mat(cloth, { shine: 20 }));
  ball(parent, 0.055, [at[0], at[1] + 0.3, at[2]], mat(SKIN, { shine: 25 }));
  ball(parent, 0.058, [at[0], at[1] + 0.325, at[2] - 0.01], mat(hair), [1, 0.6, 1]);
}
function dancer(parent: Object3D, at: V3, cloth: string, lean = 0.3) {
  const body = new Group();
  body.position.set(...at);
  body.rotation.z = lean;
  parent.add(body);
  cone(body, 0.09, 0.16, [0, 0, 0], mat(cloth, { shine: 25 }));
  capsule(body, 0.045, 0.1, [0, 0.22, 0], mat(SKIN, { shine: 25 }));
  ball(body, 0.05, [0, 0.36, 0], mat(SKIN, { shine: 25 }));
  cone(body, 0.04, 0.1, [0, 0.39, 0], GOLD(), 10);
  tube(
    body,
    [
      [-0.04, 0.26, 0],
      [-0.13, 0.32, 0.02],
      [-0.12, 0.42, 0.02],
    ],
    0.015,
    mat(SKIN),
  );
  tube(
    body,
    [
      [0.04, 0.26, 0],
      [0.12, 0.22, 0.02],
      [0.18, 0.28, 0.02],
    ],
    0.015,
    mat(SKIN),
  );
  ring(body, 0.08, 0.012, [0, 0.16, 0], GOLD());
}
function lantern(parent: Object3D, at: V3) {
  cyl(parent, 0.004, 0.004, 0.08, [at[0], at[1], at[2]], mat('#3a2614'), 6);
  ball(
    parent,
    0.05,
    [at[0], at[1] - 0.04, at[2]],
    mat('#e2483b', { emissive: '#ff5a2a', glow: 0.6, shine: 50 }),
    [1, 1.3, 1],
  );
  glowSprite(parent, [at[0], at[1] - 0.04, at[2]], 0.3);
}
function pot(parent: Object3D, at: V3, color = '#a8573a', scale = 1) {
  lathe(
    parent,
    [
      [0, 0],
      [0.06 * scale, 0],
      [0.09 * scale, 0.06 * scale],
      [0.08 * scale, 0.12 * scale],
      [0.05 * scale, 0.15 * scale],
      [0.055 * scale, 0.17 * scale],
    ],
    at,
    mat(color, { shine: 35 }),
  );
}
function banana(parent: Object3D, at: V3, height = 0.45) {
  cyl(parent, 0.025, 0.035, height, at, mat('#7a9a3e'), 10);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = ball(
      parent,
      0.16,
      [at[0] + Math.cos(a) * 0.12, at[1] + height + 0.02, at[2] + Math.sin(a) * 0.12],
      mat(i % 2 ? '#6cbf4f' : '#4f9a3a', { shine: 15 }),
      [1, 0.12, 0.38],
      12,
    );
    leaf.rotation.set(0, -a, -0.5);
  }
}
function sugarPalm(parent: Object3D, at: V3, height: number, seed: number) {
  const rand = rng(seed);
  cyl(parent, 0.035, 0.05, height, at, mat('#7a5634', { shine: 10 }), 12);
  for (let y = 0.1; y < height - 0.05; y += 0.09)
    ring(parent, 0.045 - y * 0.008, 0.009, [at[0], at[1] + y, at[2]], mat('#5b3e24'));
  const top: V3 = [at[0], at[1] + height, at[2]];
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2;
    const tilt = 0.3 + rand() * 1.4;
    const leaf = cone(
      parent,
      0.07,
      0.3,
      [top[0], top[1] - 0.02, top[2]],
      mat(rand() < 0.5 ? '#4f9a42' : '#7ec259', { shine: 15, flat: true }),
      5,
    );
    leaf.geometry.translate(0, 0.15, 0);
    leaf.position.set(...top);
    leaf.rotation.set(Math.sin(a) * tilt, 0, Math.cos(a) * tilt);
    leaf.scale.set(1, 1, 0.25);
  }
  ball(parent, 0.08, top, mat('#2f6a3c'));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    tube(
      parent,
      [
        top,
        [top[0] + Math.cos(a) * 0.1, top[1] - 0.08, top[2] + Math.sin(a) * 0.1],
        [top[0] + Math.cos(a) * 0.12, top[1] - 0.26, top[2] + Math.sin(a) * 0.12],
      ],
      0.018,
      mat('#b08a52'),
    );
  }
}
function flag(parent: Object3D, at: V3, color: string) {
  cyl(parent, 0.012, 0.016, 0.7, at, mat(WOOD), 8);
  const cloth = rbox(
    parent,
    [0.005, 0.16, 0.24],
    [at[0], at[1] + 0.48, at[2] + 0.12],
    mat(color, { shine: 25, side: 'double' }),
    0.002,
  );
  cloth.rotation.x = 0.08;
  ball(parent, 0.025, [at[0], at[1] + 0.71, at[2]], GOLD());
}
function lotusBud(parent: Object3D, at: V3, radius: number, color: string) {
  lathe(
    parent,
    [
      [0, 0],
      [radius, 0],
      [radius * 1.08, radius * 0.6],
      [radius * 0.85, radius * 1.4],
      [radius * 0.4, radius * 2],
      [0, radius * 2.35],
    ],
    at,
    mat(color, { map: tex.stone(color), shine: 20 }),
  );
  ball(parent, radius * 0.18, [at[0], at[1] + radius * 2.4, at[2]], GOLD());
}

// ---------- Homes ----------
function stiltHouse(parent: Object3D, at: V3, scale: number, roofColor: string, walls = '#d9b07a') {
  const g = new Group();
  g.position.set(...at);
  g.scale.setScalar(scale);
  parent.add(g);
  const post = mat('#6b4428', { shine: 10 });
  for (const x of [-0.42, 0, 0.42])
    for (const z of [-0.32, 0.32]) cyl(g, 0.035, 0.04, 0.62, [x, 0, z], post, 10);
  rbox(g, [1.0, 0.07, 0.8], [0, 0.62, 0], mat('#a8703f', { map: tex.planks('#a8703f') }), 0.02);
  rbox(g, [0.86, 0.5, 0.64], [0, 0.69, 0], mat(walls, { map: tex.planks(walls) }), 0.02);
  // Door on the sunlit front, window with shutters and a flower box on the side.
  rbox(g, [0.2, 0.3, 0.03], [-0.12, 0.69, 0.32], mat('#5b3a22'), 0.01);
  rbox(g, [0.24, 0.04, 0.035], [-0.12, 0.99, 0.32], GOLD(), 0.01);
  rbox(g, [0.03, 0.18, 0.22], [0.43, 0.82, 0], mat('#3b2a1c'), 0.008);
  for (const z of [-0.15, 0.15])
    rbox(g, [0.025, 0.18, 0.08], [0.44, 0.82, z], mat('#2f8f8a', { shine: 30 }), 0.008);
  rbox(g, [0.06, 0.05, 0.26], [0.45, 0.76, 0], mat('#7a4a28'), 0.01);
  for (let i = 0; i < 4; i++)
    ball(
      g,
      0.028,
      [0.47, 0.82, -0.09 + i * 0.06],
      mat(i % 2 ? '#f07fa8' : '#ffd25e', { shine: 30 }),
    );
  roof(g, 1.08, 0.86, 0.42, [0, 1.19, 0], roofColor);
  // A hammock slung between the stilts, where the family rests in the shade.
  tube(
    g,
    [
      [0.42, 0.42, 0.33],
      [0.21, 0.24, 0.35],
      [0, 0.42, 0.33],
    ],
    0.035,
    mat('#c4553a', { shine: 20 }),
  );
  // Ladder to the yard.
  const ladder = mat('#7c5a38');
  tube(
    g,
    [
      [-0.3, 0.65, 0.42],
      [-0.34, 0, 0.78],
    ],
    0.014,
    ladder,
  );
  tube(
    g,
    [
      [-0.12, 0.65, 0.42],
      [-0.16, 0, 0.78],
    ],
    0.014,
    ladder,
  );
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    tube(
      g,
      [
        [-0.3 - t * 0.04, 0.65 * (1 - t), 0.42 + t * 0.36],
        [-0.12 - t * 0.04, 0.65 * (1 - t), 0.42 + t * 0.36],
      ],
      0.01,
      mat('#c9a873'),
    );
  }
}
function house(parent: Object3D, alternate: boolean) {
  const y = pad(parent, 2, 'grass');
  if (!alternate) {
    stiltHouse(parent, [-0.2, y, -0.18], 1, '#c4562f');
    oxCart(parent, [-0.62, y, -0.3], -Math.PI / 4);
    pot(parent, [0.42, y, 0.62]);
    pot(parent, [0.58, y, 0.5], '#8a5a3a', 0.8);
    banana(parent, [-0.72, y, 0.52]);
    rbox(
      parent,
      [0.34, 0.3, 0.3],
      [0.6, y, -0.55],
      mat('#c9a06a', { map: tex.planks('#c9a06a') }),
      0.02,
    );
    roof(parent, 0.4, 0.36, 0.2, [0.6, y + 0.3, -0.55], '#e09a52', '#f1d9a0', false);
    ball(parent, 0.13, [0.7, y + 0.08, 0.05], mat('#e8c25a', { shine: 10 }), [1, 0.7, 1]);
    for (let i = 0; i < 3; i++) {
      ball(
        parent,
        0.04,
        [0.25 + i * 0.12, y + 0.04, 0.72 - i * 0.05],
        mat('#fffaf0', { shine: 30 }),
        [1.2, 1, 1],
      );
      ball(parent, 0.012, [0.25 + i * 0.12, y + 0.085, 0.72 - i * 0.05], mat(RED));
    }
  } else {
    stiltHouse(parent, [0.15, y, -0.2], 1, '#9a6a3a', '#e6c08a');
    waterBuffalo(parent, [-0.55, y, -0.2], Math.PI / 3);
    banana(parent, [-0.7, y, -0.45], 0.55);
    banana(parent, [-0.55, y, 0.1], 0.4);
    tube(
      parent,
      [
        [-0.75, y + 0.35, 0.68],
        [0.1, y + 0.32, 0.72],
      ],
      0.006,
      mat('#5b4630'),
    );
    for (const x of [-0.75, 0.1])
      cyl(parent, 0.012, 0.012, 0.36, [x, y, x < 0 ? 0.68 : 0.72], mat(WOOD), 6);
    ['#e2553f', '#3f8cc0', '#f2c13a', '#f2f0e2'].forEach((color, i) =>
      rbox(
        parent,
        [0.14, 0.18, 0.01],
        [-0.6 + i * 0.18, y + 0.15, 0.69 + i * 0.008],
        mat(color, { side: 'double' }),
        0.004,
      ),
    );
    pot(parent, [0.65, y, 0.55], '#9a5a3a', 1.1);
    for (let i = 0; i < 4; i++)
      cyl(
        parent,
        0.035,
        0.035,
        0.36,
        [0.62, y + 0.035 + Math.floor(i / 2) * 0.07, 0.15 + (i % 2) * 0.08],
        mat('#9a6a3e'),
        10,
      ).rotation.set(0, 0, Math.PI / 2);
  }
}

// ---------- Gardens & decor ----------
function garden(g: Group) {
  const y = pad(g, 1, 'grass');
  for (const [x, z] of [
    [-0.25, 0.25],
    [0.02, 0.33],
    [0.25, 0.2],
  ])
    cyl(g, 0.07, 0.075, 0.025, [x!, y, z!], mat('#cfc6a8', { map: tex.stone('#cfc6a8') }), 16);
  rbox(g, [0.32, 0.14, 0.12], [0.18, y, -0.28], mat('#3f8a3a', { shine: 10 }), 0.05);
  rbox(g, [0.12, 0.12, 0.3], [-0.33, y, -0.12], mat('#3f8a3a', { shine: 10 }), 0.05);
  for (const [x, z, c] of [
    [-0.3, 0.05, '#f27aa6'],
    [-0.22, 0.12, '#ffd45c'],
    [0.32, 0.02, '#b88df0'],
    [0.3, -0.08, '#fff1f6'],
    [-0.1, -0.32, '#f27aa6'],
  ] as [number, number, string][])
    flower(g, [x, y + 0.03, z], 0.025, c);
  tube(
    g,
    [
      [0, y, 0],
      [0.02, y + 0.25, -0.02],
      [-0.08, y + 0.42, 0],
      [-0.14, y + 0.5, 0.02],
    ],
    0.03,
    mat('#8a6a46'),
  );
  tube(
    g,
    [
      [0.02, y + 0.25, -0.02],
      [0.12, y + 0.4, -0.04],
      [0.16, y + 0.5, -0.02],
    ],
    0.022,
    mat('#8a6a46'),
  );
  leafCluster(g, [-0.02, y + 0.55, -0.01], 0.22, 4, ['#4b8a45', '#6fb257', '#3d7a3a']);
  const rand = rng(17);
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.12 + rand() * 0.14;
    flower(
      g,
      [-0.02 + Math.cos(a) * r, y + 0.6 + rand() * 0.12, -0.01 + Math.sin(a) * r],
      0.022,
      '#fff7ee',
      '#f6c33b',
    );
  }
}
function palmgrove(g: Group) {
  const y = pad(g, 1, 'grass');
  sugarPalm(g, [0.15, y, -0.12], 1.25, 3);
  sugarPalm(g, [-0.2, y, 0.05], 0.95, 5);
  sugarPalm(g, [0.12, y, 0.25], 0.75, 9);
  const rand = rng(23);
  for (let i = 0; i < 9; i++)
    cone(
      g,
      0.025,
      0.1 + rand() * 0.06,
      [-0.35 + rand() * 0.7, y, -0.3 + rand() * 0.6],
      mat('#5f9a44', { flat: true }),
      4,
    );
}
function shrine(g: Group) {
  const y = pad(g, 1, 'grass');
  rbox(g, [0.4, 0.08, 0.4], [0, y, 0], mat('#e4d4ac', { map: tex.stone('#e4d4ac') }), 0.02);
  cyl(g, 0.05, 0.06, 0.42, [0, y + 0.08, 0], mat('#d9c49a', { map: tex.stone('#d9c49a') }), 12);
  rbox(g, [0.3, 0.04, 0.3], [0, y + 0.5, 0], mat('#c9a050'), 0.01);
  rbox(g, [0.2, 0.2, 0.2], [0, y + 0.54, 0], mat('#f2c85e', { shine: 60 }), 0.015);
  rbox(g, [0.07, 0.11, 0.01], [-0.02, y + 0.56, 0.1], mat('#7a2a1c'), 0.004);
  roof(g, 0.28, 0.28, 0.17, [0, y + 0.74, 0], '#d9472f', '#f2c35b');
  for (const x of [-0.36, 0.36]) {
    cyl(g, 0.012, 0.015, 0.55, [x, y, x < 0 ? 0.2 : -0.2], mat(WOOD), 8);
    lantern(g, [x, y + 0.5, x < 0 ? 0.2 : -0.2]);
  }
  tube(
    g,
    [
      [-0.36, y + 0.52, 0.2],
      [0, y + 0.42, 0.05],
      [0.36, y + 0.52, -0.2],
    ],
    0.01,
    mat('#f2a93b'),
  );
  for (let i = 0; i < 7; i++) {
    const t = (i + 1) / 8;
    ball(
      g,
      0.022,
      [-0.36 + t * 0.72, y + 0.52 - Math.sin(t * Math.PI) * 0.1, 0.2 - t * 0.4],
      mat('#f6a13a', { shine: 20 }),
    );
  }
  ['#ffe07a', '#f05a7a', '#9fd26b'].forEach((c, i) =>
    ball(g, 0.03, [-0.08 + i * 0.08, y + 0.11, 0.18], mat(c, { shine: 30 })),
  );
}
function naga(g: Group) {
  const y = pad(g, 1, 'stone', '#d7c9a3');
  rbox(g, [0.4, 0.1, 0.4], [0, y, 0], mat('#e8d6a8', { map: tex.stone('#e8d6a8') }), 0.02);
  const stone = mat(SAND, { shine: 30 });
  const scales = mat('#d9b673', { shine: 25 });
  // Coils on the plinth, a rearing neck, then a seven-headed hood turned toward the viewer.
  ring(g, 0.13, 0.045, [0, y + 0.15, 0], stone, [Math.PI / 2, 0, 0]);
  ring(g, 0.09, 0.04, [0, y + 0.22, 0], stone, [Math.PI / 2, 0, 0]);
  tube(
    g,
    [
      [-0.12, y + 0.15, 0.05],
      [-0.25, y + 0.13, 0.15],
      [-0.32, y + 0.12, 0.3],
    ],
    0.035,
    stone,
  );
  const n = new Group();
  n.position.set(0, y + 0.22, 0);
  n.rotation.y = Math.PI / 4;
  g.add(n);
  tube(
    n,
    [
      [0, 0, 0],
      [0, 0.18, 0.02],
      [0, 0.36, 0.04],
    ],
    0.06,
    stone,
  );
  for (let i = 0; i < 5; i++)
    rbox(n, [0.08, 0.03, 0.02], [0, 0.06 + i * 0.065, 0.07], scales, 0.01);
  ball(n, 0.28, [0, 0.5, -0.04], scales, [1, 0.95, 0.16]);
  ball(n, 0.22, [0, 0.48, -0.01], stone, [1, 0.9, 0.14]);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.1 + (i / 6) * 0.8);
    const at: V3 = [Math.cos(a) * 0.25, 0.48 + Math.sin(a) * 0.26, 0.1];
    const r = i === 3 ? 0.085 : 0.068;
    tube(
      n,
      [[at[0] * 0.3, 0.4, 0.02], [at[0] * 0.7, (0.4 + at[1]) / 2 + 0.03, 0.06], at],
      r * 0.45,
      stone,
    );
    ball(n, r, at, stone, [0.95, 0.8, 1.3]);
    ball(n, r * 0.6, [at[0], at[1] + r * 0.5, at[2] - r * 0.1], scales, [1.2, 0.45, 1.1]);
    for (const dx of [-1, 1])
      ball(
        n,
        r * 0.2,
        [at[0] + dx * r * 0.45, at[1] + r * 0.18, at[2] + r * 1.1],
        mat('#2a1a0c', { shine: 60 }),
      );
  }
  ball(n, 0.045, [0, 0.82, 0.08], GOLD());
}
function lotuspond(g: Group) {
  const y = pad(g, 2, 'stone', '#c98d68');
  lathe(
    g,
    [
      [0, 0],
      [0.8, 0],
      [0.8, 0.02],
      [0, 0.02],
    ],
    [0, y - 0.02, 0],
    mat('#2b7f8c'),
  );
  const water = rbox(
    g,
    [1.56, 0.03, 1.56],
    [0, y, 0],
    mat('#3fb3c2', { shine: 110, opacity: 0.88 }),
    0.01,
  );
  water.receiveShadow = true;
  const rand = rng(31);
  for (let i = 0; i < 10; i++)
    lilyPad(g, [-0.65 + rand() * 1.3, y + 0.03, -0.65 + rand() * 1.3], 0.07 + rand() * 0.05);
  for (const [x, z, s] of [
    [-0.35, -0.2, 0.09],
    [0.2, 0.3, 0.1],
    [0.45, -0.35, 0.08],
    [-0.15, 0.45, 0.075],
    [0.05, -0.05, 0.085],
  ] as [number, number, number][]) {
    lilyPad(g, [x, y + 0.03, z], s * 1.2);
    lotus(g, [x, y + 0.04, z], s);
  }
  for (let i = 0; i < 3; i++)
    rbox(
      g,
      [0.4, 0.04, 0.12],
      [-0.45 + i * 0.02, y - 0.02 - i * 0.03, 0.85 + i * 0.06],
      mat('#e7c8a0', { map: tex.stone('#e7c8a0') }),
      0.015,
    );
  ball(g, 0.06, [0.72, y + 0.06, 0.55], mat('#6ab04f', { shine: 50 }), [1.2, 0.8, 1]);
  for (const dz of [-0.03, 0.03])
    ball(g, 0.018, [0.75, y + 0.11, 0.55 + dz], mat('#ffffff', { shine: 60 }));
}
function market(g: Group) {
  const y = pad(g, 2, 'earth', '#cdb48a');
  const stalls: [number, number, string, string][] = [
    [-0.45, -0.4, '#e3553f', '#f39b3a'],
    [0.4, -0.45, '#2fa3a0', '#7bc96a'],
    [-0.4, 0.42, '#f2b632', '#b65fcf'],
    [0.45, 0.4, '#d9477a', '#f2d06b'],
  ];
  for (const [x, z, cloth, fruit] of stalls) {
    rbox(g, [0.42, 0.18, 0.26], [x, y, z], mat('#c49a62', { map: tex.planks('#c49a62') }), 0.02);
    for (const dx of [-0.1, 0.1]) {
      lathe(
        g,
        [
          [0, 0],
          [0.07, 0],
          [0.1, 0.05],
          [0.1, 0.06],
        ],
        [x + dx, y + 0.18, z],
        mat('#b48a52', { shine: 10 }),
      );
      for (let i = 0; i < 5; i++)
        ball(
          g,
          0.03,
          [
            x + dx + Math.cos(i * 1.3) * 0.04,
            y + 0.25 + (i > 3 ? 0.03 : 0),
            z + Math.sin(i * 1.3) * 0.04,
          ],
          mat(dx < 0 ? fruit : '#7bbf4f', { shine: 50 }),
        );
    }
    cyl(g, 0.015, 0.015, 0.62, [x, y, z - 0.14], mat(WOOD), 8);
    const shade = cone(g, 0.36, 0.16, [x, y + 0.6, z - 0.14], mat(cloth, { shine: 30 }), 8);
    shade.rotation.y = Math.PI / 8;
    ring(g, 0.36, 0.012, [x, y + 0.6, z - 0.14], mat('#fff3c8'), [Math.PI / 2, 0, 0]);
  }
  villager(g, [-0.05, y, 0.05], '#3f7cc0');
  villager(g, [0.15, y, -0.1], '#c4553a');
  villager(g, [0.0, y, 0.68], '#5a9a4c');
  rbox(
    g,
    [0.16, 0.12, 0.16],
    [0.78, y, -0.05],
    mat('#a87a48', { map: tex.planks('#a87a48') }),
    0.015,
  );
  rbox(
    g,
    [0.14, 0.1, 0.14],
    [0.76, y + 0.12, -0.05],
    mat('#b98a58', { map: tex.planks('#b98a58') }),
    0.015,
  );
}

// ---------- Statues & wonders ----------
function singha(g: Group) {
  const y = pad(g, 1, 'stone', '#a99f86');
  redented(g, 0.42, 0.08, [0, y, 0], weathered('#9c917a'));
  rbox(
    g,
    [0.34, 0.12, 0.34],
    [0, y + 0.08, 0],
    mat('#ffffff', { map: tex.kbach('#b3a584', '#f6ecd055', '#2a221655') }),
    0.012,
  );
  redented(g, 0.38, 0.04, [0, y + 0.2, 0], weathered('#a99d82'));
  khmerLion(g, [0, y + 0.24, 0], 1.15, -Math.PI / 4 + 0.55);
}
function parasol(g: Group) {
  const y = pad(g, 1, 'grass');
  rbox(g, [0.18, 0.08, 0.18], [0, y, 0], mat('#efe0b6', { map: tex.stone('#efe0b6') }), 0.02);
  cyl(g, 0.018, 0.022, 1.25, [0, y + 0.08, 0], GOLD(), 10);
  for (let tier = 0; tier < 4; tier++) {
    const r = 0.38 - tier * 0.07;
    const at: V3 = [0, y + 0.5 + tier * 0.2, 0];
    cone(g, r, 0.14, at, mat(tier % 2 ? '#e4573b' : RED, { shine: 45 }), 24);
    ring(g, r, 0.014, [at[0], at[1] + 0.005, at[2]], GOLD());
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ball(g, 0.016, [Math.cos(a) * r, at[1] - 0.03, Math.sin(a) * r], GOLD(), [1, 1.4, 1], 8);
    }
  }
  ball(g, 0.05, [0, y + 1.38, 0], GOLD());
  cone(g, 0.015, 0.1, [0, y + 1.41, 0], GOLD(), 8);
}
function brazier(g: Group) {
  const y = pad(g, 1, 'stone', '#cdbb98');
  lathe(
    g,
    [
      [0, 0],
      [0.16, 0],
      [0.16, 0.05],
      [0.08, 0.08],
      [0.06, 0.3],
      [0.1, 0.34],
      [0, 0.34],
    ],
    [0, y, 0],
    mat('#d9c497', { map: tex.stone('#d9c497') }),
  );
  lathe(
    g,
    [
      [0, 0],
      [0.08, 0],
      [0.22, 0.1],
      [0.27, 0.16],
      [0.25, 0.17],
      [0.2, 0.12],
      [0, 0.1],
    ],
    [0, y + 0.32, 0],
    BRONZE(),
  );
  for (const a of [Math.PI / 4, (Math.PI * 5) / 4])
    ring(g, 0.05, 0.012, [Math.cos(a) * 0.27, y + 0.45, Math.sin(a) * 0.27], BRONZE(), [0, -a, 0]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ball(
      g,
      0.05,
      [Math.cos(a) * 0.1, y + 0.45, Math.sin(a) * 0.1],
      mat('#ff7a1a', { emissive: '#ff4a0a', glow: 0.9 }),
      [1, 0.6, 1],
      8,
    );
  }
  const flameMat = (color: string) => mat(color, { emissive: color, glow: 1, opacity: 0.92 });
  cone(g, 0.15, 0.42, [0, y + 0.45, 0], flameMat('#ff7a1a'), 10);
  cone(g, 0.1, 0.32, [0.06, y + 0.45, -0.04], flameMat('#ff9a2a'), 10);
  cone(g, 0.1, 0.3, [-0.06, y + 0.45, 0.05], flameMat('#ff9a2a'), 10);
  cone(g, 0.07, 0.28, [0, y + 0.46, 0], flameMat('#ffd04a'), 10);
  cone(g, 0.035, 0.16, [0, y + 0.47, 0], flameMat('#fff4b0'), 8);
  glowSprite(g, [0, y + 0.62, 0], 1.0);
}
function gong(g: Group) {
  const y = pad(g, 1, 'grass');
  const frame = new Group();
  frame.position.set(0, y, 0);
  frame.rotation.y = Math.PI / 4;
  g.add(frame);
  const lacquer = mat('#b23a2a', { shine: 55 });
  for (const x of [-0.32, 0.32]) {
    rbox(frame, [0.1, 0.06, 0.1], [x, 0, 0], mat('#d8c8a2', { map: tex.stone('#d8c8a2') }), 0.015);
    cyl(frame, 0.035, 0.04, 0.85, [x, 0.06, 0], lacquer, 12);
  }
  tube(
    frame,
    [
      [-0.42, 0.86, 0],
      [-0.2, 0.96, 0],
      [0.2, 0.96, 0],
      [0.42, 0.86, 0],
    ],
    0.04,
    lacquer,
  );
  for (const x of [-0.44, 0.44])
    tube(
      frame,
      [
        [x, 0.86, 0],
        [x * 1.1, 0.92, 0],
        [x * 1.08, 1.0, 0],
      ],
      0.022,
      GOLD(),
    );
  for (const x of [-0.1, 0.1]) cyl(frame, 0.006, 0.006, 0.18, [x, 0.75, 0], mat('#5a3a20'), 6);
  const disc = cyl(frame, 0.24, 0.24, 0.04, [0, 0.5, 0], BRONZE(), 32);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 0.48;
  ring(frame, 0.15, 0.008, [0, 0.48, 0.022], mat('#8a5a1a', { shine: 60 }), [0, 0, 0]);
  ball(frame, 0.07, [0, 0.48, 0.02], GOLD(), [1, 1, 0.6]);
  tube(
    frame,
    [
      [0.45, 0.06, 0.2],
      [0.3, 0.35, 0.18],
    ],
    0.014,
    mat('#7a5230'),
  );
  ball(frame, 0.05, [0.3, 0.37, 0.18], mat('#e7d8b0', { shine: 20 }));
}
function gopura(g: Group) {
  const y = pad(g, 2, 'stone', '#a99f86');
  const stone = (c: string) => weathered(c);
  for (const side of [-1, 1]) {
    rbox(g, [0.5, 0.36, 0.26], [side * 0.62, y, -side * 0.0], stone('#ab9f84'), 0.025);
    for (let i = 0; i < 3; i++)
      rbox(
        g,
        [0.08, 0.08, 0.1],
        [side * 0.62 - 0.16 + i * 0.16, y + 0.36, 0],
        stone('#c2b597'),
        0.015,
      );
  }
  rbox(g, [0.8, 1.1, 0.72], [0, y, 0], stone('#b8aa8a'), 0.035);
  rbox(g, [0.32, 0.6, 0.04], [0, y, 0.35], mat('#2e2014'), 0.02);
  const arch = cyl(g, 0.16, 0.16, 0.04, [0, y + 0.6, 0.35], mat('#2e2014'), 20);
  arch.rotation.x = Math.PI / 2;
  arch.position.y = y + 0.6;
  angkorTower(g, [0, y + 1.1, 0], 0.5, 1.5);
  flag(g, [-0.88, y, 0.55], RED);
  flag(g, [0.88, y, -0.5], '#2f8f6a');
  for (const x of [-0.25, 0.25]) {
    rbox(g, [0.12, 0.1, 0.12], [x, y, 0.55], stone('#bcae90'), 0.02);
    ball(g, 0.06, [x, y + 0.16, 0.55], mat(SAND, { shine: 25 }));
  }
}
function pavilion(g: Group) {
  const y = pad(g, 2, 'stone', '#e2cfa0');
  for (let i = 0; i < 3; i++)
    rbox(
      g,
      [0.4, 0.04, 0.14],
      [-0.15, y - 0.02 - i * 0.03, 0.86 + i * 0.07],
      mat('#f0dfb4', { map: tex.stone('#f0dfb4') }),
      0.012,
    );
  rbox(
    g,
    [1.5, 0.12, 1.4],
    [0, y, 0],
    mat('#c98b4f', { map: tex.planks('#c98b4f'), shine: 45 }),
    0.03,
  );
  const top = y + 0.12;
  const lacquer = mat('#b8402c', { shine: 60 });
  for (const x of [-0.62, 0.62])
    for (const z of [-0.55, 0.55]) {
      cyl(g, 0.045, 0.05, 0.72, [x, top, z], lacquer, 14);
      cyl(g, 0.07, 0.07, 0.05, [x, top + 0.7, z], GOLD(), 14);
      cyl(g, 0.07, 0.07, 0.04, [x, top, z], GOLD(), 14);
    }
  roof(g, 1.6, 1.42, 0.52, [0, top + 0.75, 0], '#c8452f', '#f0c25a');
  roof(g, 0.9, 0.8, 0.32, [0, top + 1.18, 0], '#d9572f', '#f0c25a');
  dancer(g, [-0.2, top, 0.2], '#d9477a', 0.25);
  dancer(g, [0.25, top, 0.3], '#e8a02a', -0.3);
  villager(g, [0.2, top, -0.3], '#2f6f9a');
  cyl(g, 0.08, 0.08, 0.1, [0.05, top, -0.25], mat('#8a4a2a', { shine: 40 }), 14);
  for (const x of [-0.4, 0.4]) lantern(g, [x, top + 0.66, 0.55]);
}
function elephant(g: Group) {
  const y = pad(g, 2, 'stone', '#d0b58a');
  rbox(g, [1.6, 0.34, 1.4], [0, y, 0], mat('#ffffff', { map: tex.elephantFrieze() }), 0.03);
  rbox(
    g,
    [1.68, 0.06, 1.48],
    [0, y + 0.34, 0],
    mat('#e6cf98', { map: tex.stone('#e6cf98') }),
    0.025,
  );
  const t = y + 0.4;
  const grey = mat('#a9a49d', { shine: 25 });
  const elephantGroup = new Group();
  elephantGroup.position.set(0.05, t, -0.05);
  elephantGroup.scale.setScalar(1.3);
  elephantGroup.rotation.y = Math.PI / 4 + 0.25;
  g.add(elephantGroup);
  for (const [x, z] of [
    [-0.25, -0.13],
    [-0.25, 0.13],
    [0.22, -0.13],
    [0.22, 0.13],
  ])
    cyl(elephantGroup, 0.07, 0.08, 0.36, [x!, 0, z!], grey, 14);
  ball(elephantGroup, 0.36, [0, 0.55, 0], grey, [1.15, 0.78, 0.72]);
  ball(elephantGroup, 0.2, [0.44, 0.65, 0], grey);
  for (const side of [-1, 1]) {
    const ear = ball(
      elephantGroup,
      0.17,
      [0.36, 0.66, side * 0.17],
      mat('#9c968e', { shine: 20 }),
      [0.3, 1, 0.8],
    );
    ear.rotation.y = side * 0.4;
    tube(
      elephantGroup,
      [
        [0.55, 0.55, side * 0.07],
        [0.68, 0.5, side * 0.09],
        [0.74, 0.58, side * 0.08],
      ],
      0.022,
      mat('#fffaf0', { shine: 60 }),
    );
    ball(elephantGroup, 0.022, [0.58, 0.72, side * 0.12], mat('#1e1a16'));
  }
  tube(
    elephantGroup,
    [
      [0.6, 0.6, 0],
      [0.72, 0.42, 0],
      [0.7, 0.18, 0],
      [0.78, 0.08, 0],
      [0.84, 0.14, 0],
    ],
    0.05,
    grey,
  );
  rbox(elephantGroup, [0.5, 0.06, 0.6], [-0.02, 0.78, 0], mat(RED, { shine: 40 }), 0.02);
  for (const side of [-1, 1])
    rbox(
      elephantGroup,
      [0.46, 0.2, 0.02],
      [-0.02, 0.6, side * 0.3],
      mat(RED, { shine: 40 }),
      0.008,
    );
  for (const side of [-1, 1])
    rbox(elephantGroup, [0.48, 0.03, 0.025], [-0.02, 0.58, side * 0.305], GOLD(), 0.008);
  rbox(elephantGroup, [0.3, 0.18, 0.32], [-0.04, 0.84, 0], mat('#f2c85e', { shine: 70 }), 0.025);
  cyl(elephantGroup, 0.012, 0.012, 0.3, [-0.04, 1.02, 0], mat(WOOD), 6);
  cone(elephantGroup, 0.2, 0.08, [-0.04, 1.28, 0], mat(RED, { shine: 40 }), 18);
  ring(elephantGroup, 0.2, 0.01, [-0.04, 1.28, 0], GOLD());
  rbox(elephantGroup, [0.06, 0.06, 0.24], [0.5, 0.8, 0], GOLD(), 0.02);
}
function facetower(g: Group) {
  const y = pad(g, 2, 'stone', '#a39a82');
  const stone = (c: string) => weathered(c);
  rbox(g, [1.6, 0.16, 1.6], [0, y, 0], stone('#a59b82'), 0.03);
  rbox(g, [1.3, 0.16, 1.3], [0, y + 0.16, 0], stone('#b0a68c'), 0.03);
  const base = y + 0.32;
  // Calm faces look out from both walls toward the viewer.
  const faceMat = mat('#ffffff', { map: tex.face(), shine: 15 });
  rbox(g, [1.0, 1.15, 1.0], [0, base, 0], stone('#bcb092'), 0.035);
  for (const [x, z, ry] of [
    [0.505, 0, Math.PI / 2],
    [0, 0.505, 0],
  ] as V3[]) {
    const panel = rbox(g, [0.86, 0.92, 0.012], [x, base + 0.1, z], faceMat, 0.004);
    panel.rotation.y = ry;
  }
  rbox(g, [1.14, 0.1, 1.14], [0, base + 1.15, 0], stone('#c4b89a'), 0.03);
  for (let tier = 0; tier < 3; tier++) {
    const w = 0.86 - tier * 0.2;
    rbox(
      g,
      [w, 0.18, w],
      [0, base + 1.25 + tier * 0.18, 0],
      stone(tier % 2 ? '#b6aa8c' : '#a99c7e'),
      0.03,
    );
  }
  lotusBud(g, [0, base + 1.79, 0], 0.17, '#b2a586');
  const root = mat('#9c7a52', { shine: 10 });
  tube(
    g,
    [
      [0.5, base + 1.0, -0.4],
      [0.56, base + 0.55, -0.35],
      [0.54, base + 0.1, -0.42],
      [0.7, y + 0.2, -0.55],
      [0.8, y, -0.62],
    ],
    0.05,
    root,
  );
  tube(
    g,
    [
      [-0.4, base + 1.05, 0.5],
      [-0.36, base + 0.5, 0.56],
      [-0.5, y + 0.3, 0.68],
      [-0.72, y, 0.76],
    ],
    0.045,
    root,
  );
  tube(
    g,
    [
      [0.5, base + 0.8, 0.3],
      [0.56, base + 0.3, 0.42],
      [0.68, y + 0.16, 0.62],
    ],
    0.03,
    root,
  );
  leafCluster(g, [0.42, base + 1.4, -0.4], 0.26, 8);
  const rand = rng(41);
  for (let i = 0; i < 16; i++)
    ball(
      g,
      0.04 + rand() * 0.03,
      [-0.75 + rand() * 1.5, y + 0.16 + (rand() < 0.4 ? 0.16 : 0), -0.75 + rand() * 1.5],
      mat(i % 2 ? '#7fae4c' : '#5d8f3a', { shine: 10 }),
      [1, 0.4, 1],
      10,
    );
}

// ---------- The prasat temple, in its three construction stages ----------
function reliefTexture() {
  return cachedTexture('relief', () =>
    canvasTexture(256, (c) => {
      c.fillStyle = '#d9bf86';
      c.fillRect(0, 0, 256, 256);
      noise(c, 256, '#ffffff22', '#00000022', 1600);
      c.fillStyle = '#00000024';
      c.fillRect(0, 0, 256, 22);
      c.fillRect(0, 234, 256, 22);
      // A procession of dancing apsaras in low relief.
      for (let i = 0; i < 4; i++) {
        const x = 32 + i * 64;
        c.fillStyle = '#b49862';
        c.beginPath();
        c.ellipse(x, 86, 10, 11, 0, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(x - 18, 70);
        c.lineTo(x, 46);
        c.lineTo(x + 18, 70);
        c.closePath();
        c.fill();
        c.fillRect(x - 9, 96, 18, 44);
        c.beginPath();
        c.moveTo(x - 24, 200);
        c.quadraticCurveTo(x - 30, 140, x - 10, 136);
        c.lineTo(x + 10, 136);
        c.quadraticCurveTo(x + 30, 140, x + 24, 200);
        c.closePath();
        c.fill();
        c.strokeStyle = '#b49862';
        c.lineWidth = 7;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x - 8, 104);
        c.quadraticCurveTo(x - 30, 100, x - 30, 76);
        c.moveTo(x + 8, 104);
        c.quadraticCurveTo(x + 30, 116, x + 28, 136);
        c.stroke();
        c.strokeStyle = '#fff1c444';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x - 7, 98);
        c.lineTo(x - 7, 140);
        c.stroke();
      }
    }),
  );
}
const ANGKOR_STONE = '#b8aa8a';
function weathered(color: string) {
  return mat('#ffffff', { map: tex.lichen(color), shine: 15 });
}
/** A redented block: a square with stepped-in corners, the Khmer tower plan. */
function redented(
  parent: Object3D,
  w: number,
  h: number,
  at: V3,
  material: ReturnType<typeof mat>,
) {
  rbox(parent, [w, h, w * 0.62], at, material, 0.01);
  rbox(parent, [w * 0.62, h, w], at, material, 0.01);
  rbox(parent, [w * 0.84, h, w * 0.84], at, material, 0.01);
}
/** A flame-shaped pediment over a false door, filled with kbach carving. */
function pediment(parent: Object3D, at: V3, width: number, rotateY: number) {
  const shape = new Shape();
  const h = width * 0.95;
  shape.moveTo(-width / 2, 0);
  shape.bezierCurveTo(-width * 0.55, h * 0.45, -width * 0.12, h * 0.55, 0, h);
  shape.bezierCurveTo(width * 0.12, h * 0.55, width * 0.55, h * 0.45, width / 2, 0);
  shape.lineTo(width * 0.62, -h * 0.08);
  shape.lineTo(-width * 0.62, -h * 0.08);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    bevelSegments: 1,
  });
  // Planar UVs so the carving fills the pediment.
  const uv = geometry.attributes.uv!;
  const position = geometry.attributes.position!;
  for (let k = 0; k < uv.count; k++)
    uv.setXY(k, position.getX(k) / width + 0.5, position.getY(k) / h);
  const mesh = new Mesh(
    geometry,
    mat('#ffffff', { map: tex.kbach('#c9b48a', '#fff1c855', '#3a2a1655'), shine: 20 }),
  );
  mesh.position.set(...at);
  mesh.rotation.y = rotateY;
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
}
/**
 * An Angkor tower: a tall cella with false doors under flame pediments, then a corn-cob crown of
 * redented tiers fringed with antefixes, swelling slightly before tapering to a lotus finial.
 */
function angkorTower(parent: Object3D, at: V3, w: number, height: number) {
  const [x, y, z] = at;
  const stone = weathered(ANGKOR_STONE);
  const dark = weathered('#a3977a');
  redented(parent, w * 1.25, w * 0.16, [x, y, z], dark);
  redented(parent, w, w * 1.0, [x, y + w * 0.16, z], stone);
  for (const [dx, dz, ry] of [
    [w / 2 + 0.004, 0, Math.PI / 2],
    [0, w / 2 + 0.004, 0],
  ] as V3[]) {
    const door = rbox(
      parent,
      [w * 0.3, w * 0.5, 0.025],
      [x + dx, y + w * 0.18, z + dz],
      mat('#2c241a'),
      0.008,
    );
    door.rotation.y = ry;
    for (const side of [-1, 1]) {
      const column = cyl(
        parent,
        w * 0.03,
        w * 0.03,
        w * 0.52,
        [x + dx + (ry ? 0 : side * w * 0.2), y + w * 0.17, z + dz + (ry ? side * w * 0.2 : 0)],
        stone,
        8,
      );
      column.castShadow = true;
    }
    pediment(parent, [x + dx * 1.04, y + w * 0.7, z + dz * 1.04], w * 0.62, ry);
  }
  const crownBase = y + w * 1.16;
  const tiers = 7;
  const crownHeight = height - w * 1.16;
  const tierH = (crownHeight * 0.78) / tiers;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    // Ogive: barely narrowing at first, then drawing in toward the tip.
    const s = w * (0.98 - 0.62 * Math.pow(t, 1.6));
    const ty = crownBase + i * tierH;
    redented(parent, s, tierH * 0.72, [x, ty, z], i % 2 ? stone : dark);
    for (const [cx, cz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [1, 0],
      [0, 1],
    ] as [number, number][]) {
      const antefix = lathe(
        parent,
        [
          [0, 0],
          [s * 0.07, 0],
          [s * 0.08, tierH * 0.4],
          [0, tierH * 1.1],
        ],
        [x + (cx * s) / 2.15, ty + tierH * 0.6, z + (cz * s) / 2.15],
        stone,
      );
      antefix.castShadow = true;
    }
  }
  const tip = crownBase + tiers * tierH;
  const r = w * 0.2;
  lathe(
    parent,
    [
      [0, 0],
      [r, 0],
      [r * 1.1, r * 0.8],
      [r * 0.7, r * 1.8],
      [r * 0.25, r * 2.6],
      [0, r * 3],
    ],
    [x, tip, z],
    stone,
  );
  cone(parent, 0.02, 0.14, [x, tip + r * 2.9, z], GOLD(), 8);
}
/** A saffron-robed monk, one shoulder bare, sometimes under a yellow umbrella. */
function monk(parent: Object3D, at: V3, umbrella = false) {
  const robe = mat('#e8862a', { shine: 25 });
  cone(parent, 0.085, 0.2, at, robe, 14);
  capsule(parent, 0.05, 0.1, [at[0], at[1] + 0.22, at[2]], robe);
  rbox(
    parent,
    [0.11, 0.025, 0.05],
    [at[0], at[1] + 0.26, at[2] + 0.01],
    mat('#c4621a'),
    0.01,
  ).rotation.z = 0.6;
  ball(parent, 0.05, [at[0], at[1] + 0.36, at[2]], mat(SKIN, { shine: 30 }));
  if (umbrella) {
    cyl(parent, 0.006, 0.006, 0.3, [at[0] + 0.06, at[1] + 0.2, at[2]], mat(WOOD), 6);
    cone(
      parent,
      0.16,
      0.07,
      [at[0] + 0.06, at[1] + 0.48, at[2]],
      mat('#f2c13a', { shine: 30 }),
      14,
    );
  }
}
function waterBuffalo(parent: Object3D, at: V3, facing = 0) {
  const b = new Group();
  b.position.set(...at);
  b.rotation.y = facing;
  parent.add(b);
  const hide = mat('#5a544e', { shine: 30 });
  for (const [x, z] of [
    [-0.13, -0.07],
    [-0.13, 0.07],
    [0.13, -0.07],
    [0.13, 0.07],
  ])
    cyl(b, 0.03, 0.035, 0.14, [x!, 0, z!], hide, 8);
  ball(b, 0.15, [0, 0.22, 0], hide, [1.45, 0.85, 0.9]);
  ball(b, 0.08, [0.24, 0.24, 0], hide, [1.2, 0.9, 0.9]);
  ball(b, 0.04, [0.32, 0.21, 0], mat('#3a3632', { shine: 30 }));
  for (const side of [-1, 1])
    tube(
      b,
      [
        [0.24, 0.3, side * 0.05],
        [0.2, 0.36, side * 0.17],
        [0.12, 0.34, side * 0.2],
        [0.1, 0.3, side * 0.15],
      ],
      0.014,
      mat('#e8dcc4', { shine: 40 }),
    );
  tube(
    b,
    [
      [-0.2, 0.26, 0],
      [-0.26, 0.18, 0],
      [-0.25, 0.1, 0],
    ],
    0.01,
    hide,
  );
}
function oxCart(parent: Object3D, at: V3, facing = 0) {
  const c = new Group();
  c.position.set(...at);
  c.rotation.y = facing;
  parent.add(c);
  const wood = mat('#8a5a34', { map: tex.planks('#8a5a34') });
  for (const side of [-1, 1]) {
    ring(c, 0.15, 0.018, [0, 0.15, side * 0.16], mat('#5e3e22'), [0, 0, 0]);
    for (let k = 0; k < 6; k++) {
      const spoke = cyl(c, 0.008, 0.008, 0.28, [0, 0.01, side * 0.16], mat('#6e4a2a'), 6);
      spoke.position.y = 0.15;
      spoke.rotation.x = Math.PI / 2;
      spoke.rotation.y = (k / 6) * Math.PI;
      spoke.rotation.z = Math.PI / 2;
    }
  }
  rbox(c, [0.42, 0.04, 0.3], [0, 0.22, 0], wood, 0.01);
  const hood = new Mesh(
    new CylinderGeometry(0.15, 0.15, 0.3, 14, 1, true, 0, Math.PI),
    mat('#c9a35a', { shine: 15, side: 'double' }),
  );
  hood.rotation.z = Math.PI / 2;
  hood.rotation.y = Math.PI / 2;
  hood.position.set(-0.04, 0.26, 0);
  hood.castShadow = true;
  c.add(hood);
  tube(
    c,
    [
      [0.2, 0.22, 0],
      [0.42, 0.16, 0],
      [0.55, 0.14, 0],
    ],
    0.014,
    wood,
  );
}
function nagaHeadFan(parent: Object3D, at: V3, facing: number) {
  const n = new Group();
  n.position.set(...at);
  n.rotation.y = facing;
  parent.add(n);
  const stone = weathered('#c2b28e');
  ball(n, 0.14, [0, 0.18, 0], stone, [0.25, 1, 1.05]);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + (i / 6) * 0.76);
    ball(n, 0.035, [0.03, 0.14 + Math.sin(a) * 0.14, Math.cos(a) * 0.14], stone, [1.4, 0.9, 0.9]);
  }
}
/**
 * A Khmer singha: seated upright with a puffed chest and straight forelegs, a mane of carved
 * spiral curls, bulging eyes under heavy brows, an open fanged mouth, and a flame-tipped tail.
 * Faces +X before `facing` turns it.
 */
function khmerLion(parent: Object3D, at: V3, scale: number, facing: number) {
  const l = new Group();
  l.position.set(...at);
  l.scale.setScalar(scale);
  l.rotation.y = facing;
  parent.add(l);
  // Curls aim outward with lookAt, which works in world space.
  l.updateWorldMatrix(true, false);
  const stone = mat('#ffffff', { map: tex.lichen('#b8aa8a'), shine: 25 });
  const deep = mat('#ffffff', { map: tex.lichen('#8a7d64'), shine: 25 });
  const curl = (at: V3, r: number, facingOut: V3, material = deep) => {
    const mesh = ring(l, r, r * 0.42, at, material);
    mesh.lookAt(l.localToWorld(new Vector3(...facingOut)));
    return mesh;
  };
  // Haunches, hind paws, and an upright torso leaning back so the chest swells forward.
  for (const side of [-1, 1]) {
    ball(l, 0.11, [-0.08, 0.11, side * 0.075], stone, [1.15, 1, 0.9]);
    ball(l, 0.05, [0.03, 0.03, side * 0.12], stone, [1.3, 0.6, 1]);
  }
  capsule(l, 0.095, 0.15, [0.0, 0.25, 0], stone, [0, 0, -0.28]);
  for (let row = 0; row < 3; row++)
    for (const z of [-0.035, 0, 0.035])
      curl([0.085 - row * 0.012, 0.3 - row * 0.05, z + (row % 2) * 0.012], 0.018, [
        1,
        0.3 - row * 0.05,
        z * 3,
      ]);
  for (const side of [-1, 1]) {
    cyl(l, 0.03, 0.034, 0.22, [0.09, 0.02, side * 0.05], stone, 10);
    ball(l, 0.042, [0.115, 0.025, side * 0.05], stone, [1.3, 0.6, 1]);
    for (const toe of [-0.018, 0, 0.018]) ball(l, 0.013, [0.155, 0.02, side * 0.05 + toe], deep);
  }
  ring(l, 0.085, 0.014, [0.03, 0.36, 0], deep, [Math.PI / 2, 0.35, 0]);
  ball(l, 0.022, [0.105, 0.33, 0], deep, [0.6, 1.3, 1]);
  // Head: brow, bulging eyes, broad muzzle, open mouth with fangs.
  const head: V3 = [0.07, 0.47, 0];
  ball(l, 0.11, head, stone);
  rbox(l, [0.11, 0.075, 0.13], [0.15, 0.4, 0], stone, 0.03);
  ball(l, 0.026, [0.21, 0.455, 0], deep, [1, 0.8, 1.3]);
  rbox(l, [0.07, 0.034, 0.1], [0.18, 0.37, 0], mat('#4a2a1e', { shine: 20 }), 0.01);
  for (const side of [-1, 1]) {
    const fang = cone(
      l,
      0.009,
      0.03,
      [0.205, 0.37, side * 0.032],
      mat('#efe6cc', { shine: 40 }),
      6,
    );
    fang.rotation.z = Math.PI;
    ball(l, 0.03, [0.16, 0.5, side * 0.046], stone);
    ball(l, 0.013, [0.188, 0.5, side * 0.048], mat('#2a2018', { shine: 50 }));
    rbox(l, [0.05, 0.018, 0.045], [0.155, 0.53, side * 0.048], deep, 0.008).rotation.x =
      side * 0.25;
    cone(l, 0.022, 0.05, [0.03, 0.56, side * 0.075], stone, 8).rotation.x = side * -0.35;
  }
  // Mane: rows of spiral curls over the crown, cheeks, and neck.
  for (let row = 0; row < 4; row++) {
    const elevation = -0.6 + row * 0.42;
    const count = 7 - Math.abs(row - 1);
    for (let k = 0; k < count; k++) {
      const around = Math.PI * 0.55 + (k / (count - 1)) * Math.PI * 0.9;
      const dir: V3 = [
        Math.cos(around) * Math.cos(elevation),
        Math.sin(elevation),
        Math.sin(around) * Math.cos(elevation),
      ];
      // Curls sit on the back and sides of the head, sweeping around to the cheeks.
      const flip = dir[0] > 0.2 ? -1 : 1;
      const p: V3 = [
        head[0] + dir[0] * 0.12 * flip,
        head[1] + dir[1] * 0.12,
        head[2] + dir[2] * 0.12,
      ];
      curl(p, 0.03, [p[0] + dir[0] * flip, p[1] + dir[1], p[2] + dir[2]]);
    }
  }
  for (let k = 0; k < 4; k++) curl([-0.045, 0.38 - k * 0.055, 0], 0.022, [-1, 0.38 - k * 0.055, 0]);
  // Tail curling up behind, ending in a carved flame.
  tube(
    l,
    [
      [-0.17, 0.06, 0],
      [-0.26, 0.16, 0],
      [-0.24, 0.32, 0],
      [-0.17, 0.4, 0],
    ],
    0.02,
    stone,
  );
  cone(l, 0.035, 0.09, [-0.17, 0.39, 0], deep, 8).rotation.z = -0.5;
}
function singhaGuard(parent: Object3D, at: V3, facing: number) {
  redented(parent, 0.16, 0.06, at, weathered('#a99d82'));
  khmerLion(parent, [at[0], at[1] + 0.06, at[2]], 0.42, facing);
}

/** A gallery face: a cornice, then a row of window openings filled with turned balusters. */
function galleryTexture(base: string, repeat: number) {
  return cachedTexture(`gallery${base}${repeat}`, () => {
    const texture = canvasTexture(256, (c) => {
      c.fillStyle = base;
      c.fillRect(0, 0, 256, 256);
      noise(c, 256, '#ffffff18', '#00000024', 1600);
      c.fillStyle = '#00000038';
      c.fillRect(0, 0, 256, 34);
      c.fillStyle = '#ffffff22';
      c.fillRect(0, 34, 256, 6);
      for (let w = 0; w < 4; w++) {
        const x = 14 + w * 64;
        c.fillStyle = '#231d16';
        c.fillRect(x, 70, 38, 130);
        c.fillStyle = shadeHex(base, 0.1);
        for (let b = 0; b < 4; b++) {
          const bx = x + 5 + b * 9;
          c.beginPath();
          c.ellipse(bx, 100, 3.2, 7, 0, 0, Math.PI * 2);
          c.ellipse(bx, 135, 3.6, 8, 0, 0, Math.PI * 2);
          c.ellipse(bx, 170, 3.2, 7, 0, 0, Math.PI * 2);
          c.fill();
          c.fillRect(bx - 1.6, 90, 3.2, 92);
        }
      }
      c.fillStyle = '#0000002c';
      c.fillRect(0, 222, 256, 34);
    });
    texture.repeat.set(repeat, 1);
    return texture;
  });
}
function shadeHex(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) =>
    Math.round(Math.min(255, v + (255 - v) * amount))
      .toString(16)
      .padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
const GALLERY_STONE = '#9f957e';
/**
 * One straight gallery between two points: a pierced, balustered wall under a corbelled stone roof
 * with a ridge. Only axis-aligned runs are needed.
 */
function galleryRun(parent: Object3D, from: V3, to: V3, y: number, height: number, depth: number) {
  const alongX = Math.abs(to[0] - from[0]) > Math.abs(to[2] - from[2]);
  const length = alongX ? Math.abs(to[0] - from[0]) : Math.abs(to[2] - from[2]);
  if (length < 0.05) return;
  const mid: V3 = [(from[0] + to[0]) / 2, y, (from[2] + to[2]) / 2];
  const wall = mat('#ffffff', {
    map: galleryTexture(GALLERY_STONE, Math.max(1, Math.round(length / 0.3))),
    shine: 15,
  });
  rbox(parent, alongX ? [length, height, depth] : [depth, height, length], mid, wall, 0.01);
  const roofMat = weathered('#7f7666');
  const vault = new Mesh(
    new CylinderGeometry(depth * 0.62, depth * 0.62, length + 0.02, 12, 1, false, 0, Math.PI),
    roofMat,
  );
  vault.rotation.set(0, alongX ? 0 : Math.PI / 2, Math.PI / 2);
  vault.rotation.order = 'YZX';
  vault.position.set(mid[0], y + height, mid[2]);
  vault.castShadow = vault.receiveShadow = true;
  parent.add(vault);
  rbox(
    parent,
    alongX ? [length + 0.02, 0.03, 0.04] : [0.04, 0.03, length + 0.02],
    [mid[0], y + height + depth * 0.58, mid[2]],
    roofMat,
    0.01,
  );
}
/** A square ring of galleries, open in the middle of every side for its gates. */
function enclosure(
  parent: Object3D,
  half: number,
  y: number,
  height: number,
  depth: number,
  gap: number,
) {
  const g2 = gap / 2;
  for (const s of [-1, 1]) {
    galleryRun(parent, [-half, 0, s * half], [-g2, 0, s * half], y, height, depth);
    galleryRun(parent, [g2, 0, s * half], [half, 0, s * half], y, height, depth);
    galleryRun(parent, [s * half, 0, -half], [s * half, 0, -g2], y, height, depth);
    galleryRun(parent, [s * half, 0, g2], [s * half, 0, half], y, height, depth);
  }
}
/** Straight steep steps rising toward the centre along one axis. */
function stairs(
  parent: Object3D,
  axis: 'x' | 'z',
  edge: number,
  base: number,
  height: number,
  width: number,
  run: number,
  material: ReturnType<typeof mat>,
) {
  const steps = Math.max(3, Math.round(height / 0.035));
  const tread = run / steps;
  // The outermost step is lowest; each step inward rises toward the terrace.
  for (let i = 0; i < steps; i++) {
    const h = (height / steps) * (i + 1);
    const at = edge - i * tread;
    rbox(
      parent,
      axis === 'z' ? [width, h, tread + 0.008] : [tread + 0.008, h, width],
      axis === 'z' ? [0, base, at] : [at, base, 0],
      material,
      0.004,
    );
  }
}
/** A gate or corner pavilion: a redented hall with pediments under a small Angkor tower. */
function pavilionTower(parent: Object3D, at: V3, w: number, tower: number) {
  redented(parent, w, w * 0.7, at, weathered(GALLERY_STONE));
  angkorTower(parent, [at[0], at[1] + w * 0.7, at[2]], w * 0.62, tower);
}
/**
 * Angkor Wat in miniature: an outer gallery around a lawn with corner pavilions and towered gates,
 * a cruciform terrace and causeway at the front, a raised second enclosure with corner towers, and
 * the steep central sanctuary crowned by five towers.
 */
function temple(g: Group, stage: 1 | 2 | 3) {
  const y = pad(g, 4, 'grass', '#8f8571');
  const fresh = stage === 1;
  const stone = weathered(fresh ? '#b9a98a' : '#a59a82');
  const dark = weathered(fresh ? '#a8987a' : '#8f8571');
  const paving = weathered('#b4aa92');
  // Outer enclosure plinth, causeway, and the cruciform Terrace of Honour before the west gate.
  for (const s of [-1, 1]) {
    rbox(g, [3.32, 0.05, 0.22], [0, y, s * 1.56], dark, 0.01);
    rbox(g, [0.22, 0.05, 3.32], [s * 1.56, y, 0], dark, 0.01);
  }
  rbox(g, [0.2, 0.03, 0.62], [0, y, 1.12], paving, 0.008);
  rbox(g, [0.62, 0.07, 0.16], [0, y, 1.78], paving, 0.01);
  rbox(g, [0.16, 0.07, 0.36], [0, y, 1.74], paving, 0.01);
  // Second enclosure terrace and the stepped central sanctuary.
  rbox(g, [2.1, 0.2, 2.1], [0, y, 0], stone, 0.02);
  const second = y + 0.2;
  rbox(g, [1.42, 0.2, 1.42], [0, second, 0], dark, 0.02);
  const thirdBase = second + 0.2;
  const sanctuaryFace = stage === 3 ? mat('#ffffff', { map: reliefTexture(), shine: 15 }) : stone;
  rbox(g, [1.22, 0.24, 1.22], [0, thirdBase, 0], sanctuaryFace, 0.02);
  const top = thirdBase + 0.24;
  for (const axis of ['z', 'x'] as const) {
    stairs(g, axis, 1.08, y, 0.2, 0.2, 0.06, stone);
    stairs(g, axis, 0.73, second, top - second, 0.16, 0.14, dark);
  }
  if (fresh) {
    // Builders still at work: cut blocks, bamboo scaffolds, and a buffalo hauling stone.
    for (let i = 0; i < 10; i++)
      rbox(
        g,
        [0.16, 0.1, 0.12],
        [-1.2 + (i % 5) * 0.18, y + Math.floor(i / 5) * 0.1, -1.25],
        weathered('#c2b294'),
        0.01,
      );
    const pole = mat('#b59a5a', { shine: 20 });
    for (const [x, z] of [
      [0.35, 0.35],
      [-0.35, 0.35],
      [0.35, -0.35],
      [-0.35, -0.35],
    ] as [number, number][])
      cyl(g, 0.015, 0.018, 0.9, [x, top, z], pole, 6);
    for (const h of [0.35, 0.7]) {
      tube(
        g,
        [
          [-0.35, top + h, 0.35],
          [0.35, top + h, 0.35],
        ],
        0.012,
        pole,
      );
      tube(
        g,
        [
          [0.35, top + h, -0.35],
          [0.35, top + h, 0.35],
        ],
        0.012,
        pole,
      );
    }
    waterBuffalo(g, [1.1, y, 1.3], -Math.PI / 4);
    farmer(g, [0.85, y, 1.45], '#3f6fa8');
    return;
  }
  // Outer gallery with corner pavilions and four towered gates.
  enclosure(g, 1.56, y + 0.05, 0.2, 0.13, 0.42);
  for (const [x, z] of [
    [1.56, 1.56],
    [-1.56, 1.56],
    [1.56, -1.56],
    [-1.56, -1.56],
  ] as [number, number][])
    pavilionTower(g, [x, y + 0.05, z], 0.26, 0.42);
  for (const [x, z] of [
    [0, 1.56],
    [1.56, 0],
    [0, -1.56],
    [-1.56, 0],
  ] as [number, number][])
    pavilionTower(g, [x, y + 0.05, z], 0.36, 0.62);
  // Second enclosure gallery and its four corner towers.
  enclosure(g, 1.0, second, 0.18, 0.1, 0.28);
  for (const [x, z] of [
    [1.0, 1.0],
    [-1.0, 1.0],
    [1.0, -1.0],
    [-1.0, -1.0],
  ] as [number, number][])
    angkorTower(g, [x, second, z], 0.2, 0.62);
  // The sanctuary: an inner gallery and the five-tower quincunx.
  enclosure(g, 0.58, top, 0.16, 0.09, 0.2);
  for (const [x, z] of [
    [0.5, 0.5],
    [-0.5, 0.5],
    [0.5, -0.5],
    [-0.5, -0.5],
  ] as [number, number][])
    angkorTower(g, [x, top, z], 0.26, 1.15);
  redented(g, 0.46, 0.12, [0, top, 0], dark);
  angkorTower(g, [0, top + 0.12, 0], 0.38, 1.75);
  if (stage === 3) {
    // Naga balustrades frame the terrace; lions guard the steps; monks walk the causeway.
    const naga = weathered('#c2b28e');
    for (const side of [-1, 1]) {
      tube(
        g,
        [
          [side * 0.31, y + 0.09, 1.86],
          [side * 0.31, y + 0.09, 1.7],
        ],
        0.025,
        naga,
      );
      nagaHeadFan(g, [side * 0.31, y + 0.02, 1.88], Math.PI / 2);
      singhaGuard(g, [side * 0.16, y + 0.07, 1.62], -Math.PI / 2);
    }
    monk(g, [0.05, y + 0.03, 1.2], true);
    monk(g, [-0.06, y + 0.03, 1.36]);
    flag(g, [1.75, y, -1.75], RED);
    flag(g, [-1.75, y, 1.75], '#f2b632');
    for (const [x, z] of [
      [1.25, 1.25],
      [-1.3, -1.2],
      [1.3, -1.25],
      [-1.25, 1.3],
    ] as [number, number][])
      leafCluster(g, [x, y + 0.14, z], 0.14, Math.round(x * 10 + z * 3 + 40));
  }
}

// ---------- Waterworks, fields, and workplaces ----------
function water(color: string) {
  return mat('#ffffff', { map: waterTexture(color), shine: 90 });
}
/** A farmer in a wide conical straw hat and a checked krama. */
function farmer(parent: Object3D, at: V3, cloth = '#3f6fa8', bend = 0) {
  const f = new Group();
  f.position.set(...at);
  f.rotation.z = bend;
  parent.add(f);
  villager(f, [0, 0, 0], cloth);
  cone(f, 0.11, 0.06, [0, 0.33, 0], mat('#e3c27a', { shine: 15 }), 16);
  rbox(f, [0.1, 0.02, 0.1], [0, 0.2, 0], mat('#c4553a'), 0.008);
}
function boat(parent: Object3D, at: V3, facing: number) {
  const b = new Group();
  b.position.set(...at);
  b.rotation.y = facing;
  parent.add(b);
  const hull = capsule(
    b,
    0.07,
    0.42,
    [0, 0.02, 0],
    mat('#7a4e2c', { map: tex.planks('#7a4e2c') }),
    [0, 0, Math.PI / 2],
  );
  hull.scale.set(1, 1, 0.75);
  rbox(b, [0.36, 0.02, 0.08], [0, 0.07, 0], mat('#a8703f', { map: tex.planks('#a8703f') }), 0.005);
  farmer(b, [0.12, 0.08, 0], '#c4553a');
  tube(
    b,
    [
      [0.05, 0.25, 0.02],
      [-0.2, 0.0, 0.08],
    ],
    0.008,
    mat('#6e4a2a'),
  );
}
function logs(parent: Object3D, at: V3, count: number) {
  const bark = mat('#6e4a2e', { shine: 8 });
  const grain = mat('#d9b07a', { shine: 15 });
  for (let i = 0; i < count; i++) {
    const row = i < 3 ? 0 : i < 5 ? 1 : 2;
    const k = row === 0 ? i : row === 1 ? i - 3 : 0;
    const log = new Mesh(new CylinderGeometry(0.06, 0.06, 0.5, 12), [bark, grain, grain]);
    log.rotation.z = Math.PI / 2;
    log.position.set(
      at[0],
      at[1] + 0.06 + row * 0.1,
      at[2] + (k - (row === 0 ? 1 : row === 1 ? 0.5 : 0)) * 0.12,
    );
    log.castShadow = log.receiveShadow = true;
    parent.add(log);
  }
}
function sacks(parent: Object3D, at: V3, count: number) {
  for (let i = 0; i < count; i++)
    ball(
      parent,
      0.08,
      [at[0] + (i % 3) * 0.12, at[1] + 0.06 + Math.floor(i / 3) * 0.1, at[2] + (i % 2) * 0.05],
      mat('#d9c08a', { shine: 10 }),
      [1, 0.8, 0.9],
      12,
    );
}
function crate(parent: Object3D, at: V3, size = 0.16) {
  rbox(parent, [size, size, size], at, mat('#a87a48', { map: tex.planks('#a87a48') }), 0.012);
}
function baray(g: Group) {
  const y = pad(g, 4, 'stone', '#a99f86');
  const bank = weathered('#9a8f76');
  const walk = weathered('#b2a68a');
  const rimTop = y + 0.2;
  // Stone embankments with a walkway, stepping down to the reservoir.
  for (const [w, d, x, z] of [
    [3.6, 0.32, 0, -1.64],
    [3.6, 0.32, 0, 1.64],
    [0.32, 3.0, -1.64, 0],
    [0.32, 3.0, 1.64, 0],
  ]) {
    rbox(g, [w!, 0.2, d!], [x!, y, z!], bank, 0.02);
    rbox(g, [w! - 0.02, 0.03, d! - 0.02], [x!, rimTop - 0.01, z!], walk, 0.01);
  }
  for (const [w, d, x, z] of [
    [3.0, 0.12, 0, -1.43],
    [3.0, 0.12, 0, 1.43],
    [0.12, 2.76, -1.43, 0],
    [0.12, 2.76, 1.43, 0],
  ])
    rbox(g, [w!, 0.1, d!], [x!, y, z!], weathered('#a59a80'), 0.015);
  const surface = y + 0.08;
  rbox(g, [2.8, 0.06, 2.8], [0, y + 0.02, 0], water('#2a9cb0'), 0.01);
  // The West Mebon: an island shrine in the middle of the water.
  redented(g, 0.8, 0.12, [0, surface, 0], weathered('#a3977a'));
  angkorTower(g, [0, surface + 0.12, 0], 0.34, 1.35);
  const rand = rng(91);
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.6 + rand() * 0.6;
    lilyPad(g, [Math.cos(a) * r, surface + 0.002, Math.sin(a) * r], 0.06 + rand() * 0.05);
    if (i % 2) lotus(g, [Math.cos(a) * r, surface + 0.01, Math.sin(a) * r], 0.06);
  }
  for (let i = 0; i < 4; i++)
    rbox(g, [0.5, 0.05, 0.1], [1.25 - i * 0.1, y + 0.15 - i * 0.04, 0.0], walk, 0.01);
  stiltHouse(g, [-0.9, rimTop, 1.62], 0.42, '#c4562f');
  boat(g, [0.75, surface, -0.65], 0.6);
  sugarPalm(g, [-1.66, rimTop, -1.66], 1.0, 3);
  sugarPalm(g, [1.66, rimTop, -1.5], 0.8, 7);
  monk(g, [1.64, rimTop, 0.9], true);
}
function paddy(g: Group) {
  const y = pad(g, 2, 'earth', '#9c8058');
  const bund = mat('#7f9a4a', { map: tex.grass(), shine: 10 });
  const pool = water('#5aa89a');
  const rand = rng(53);
  for (const [px, pz] of [
    [-0.43, -0.43],
    [0.43, -0.43],
    [-0.43, 0.43],
    [0.43, 0.43],
  ] as [number, number][]) {
    rbox(g, [0.8, 0.02, 0.8], [px, y - 0.01, pz], pool, 0.005);
    const ripe = px > 0 && pz < 0;
    for (let i = 0; i < 5; i++)
      for (let k = 0; k < 5; k++) {
        const at: V3 = [px - 0.32 + i * 0.16, y, pz - 0.32 + k * 0.16];
        for (let b = 0; b < 3; b++) {
          const blade = cone(
            g,
            0.01,
            0.12 + rand() * 0.06,
            at,
            mat(ripe ? (b ? '#d9c95a' : '#c9b14a') : b ? '#7fc04a' : '#a8d860', {
              flat: true,
              shine: 20,
            }),
            4,
          );
          blade.rotation.set((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
        }
      }
  }
  // Earthen bunds divide the field and carry the paths.
  for (const [w, d, x, z] of [
    [1.86, 0.07, 0, 0],
    [0.07, 1.86, 0, 0],
    [1.86, 0.07, 0, -0.86],
    [1.86, 0.07, 0, 0.86],
    [0.07, 1.86, -0.86, 0],
    [0.07, 1.86, 0.86, 0],
  ])
    rbox(g, [w!, 0.05, d!], [x!, y - 0.01, z!], bund, 0.02);
  farmer(g, [-0.4, y, 0.35], '#3f6fa8', 0.5);
  farmer(g, [0.5, y, 0.5], '#c4553a', -0.4);
  waterBuffalo(g, [-0.4, y, -0.4], 0.7);
  stiltHouse(g, [0.62, y, -0.62], 0.3, '#9a6a3a');
  sugarPalm(g, [-0.85, y, 0.85], 0.9, 11);
}
function quarry(g: Group) {
  const y = pad(g, 2, 'stone', '#a99f86');
  const fresh = (c: string) => mat(c, { map: tex.stone(c), shine: 15 });
  rbox(g, [1.5, 0.55, 0.8], [-0.1, y, -0.45], fresh('#cdb98e'), 0.03);
  rbox(g, [1.1, 0.35, 0.55], [-0.2, y + 0.55, -0.55], fresh('#d9c49a'), 0.03);
  rbox(g, [0.6, 0.25, 0.4], [-0.3, y + 0.9, -0.6], fresh('#c9b48a'), 0.03);
  rbox(g, [0.5, 0.3, 1.0], [-0.65, y, 0.2], fresh('#c4b088'), 0.03);
  for (let i = 0; i < 6; i++)
    rbox(
      g,
      [0.22, 0.14, 0.16],
      [0.25 + (i % 3) * 0.24, y + Math.floor(i / 3) * 0.14, 0.45],
      fresh('#e2cf9e'),
      0.012,
    );
  const pole = mat('#8a5a34', { shine: 10 });
  const apex: V3 = [0.4, y + 1.0, -0.05];
  for (const [x, z] of [
    [0.15, -0.3],
    [0.65, -0.3],
    [0.4, 0.25],
  ] as [number, number][])
    tube(g, [[x, y, z], apex], 0.025, pole);
  tube(g, [apex, [0.4, y + 0.5, -0.05]], 0.006, mat('#d9c08a'));
  rbox(g, [0.2, 0.12, 0.14], [0.4, y + 0.38, -0.05], fresh('#e2cf9e'), 0.01);
  farmer(g, [0.0, y + 0.55, -0.1], '#3f6fa8', 0.3);
  farmer(g, [0.75, y, 0.15], '#c4553a');
  rbox(g, [0.4, 0.04, 0.2], [0.1, y, 0.75], mat('#7a4e2c', { map: tex.planks('#7a4e2c') }), 0.01);
  rbox(g, [0.24, 0.14, 0.16], [0.1, y + 0.04, 0.75], fresh('#e2cf9e'), 0.012);
}
function lateritepit(g: Group) {
  const y = pad(g, 2, 'earth', '#9a6a4c');
  const red = (c: string) => mat(c, { map: tex.stone(c), shine: 12 });
  rbox(g, [1.0, 0.02, 0.8], [-0.25, y - 0.005, -0.3], mat('#5e3424', { shine: 5 }), 0.01);
  for (const [w, d, x, z] of [
    [1.1, 0.12, -0.25, -0.75],
    [1.1, 0.12, -0.25, 0.15],
    [0.12, 0.9, -0.82, -0.3],
    [0.12, 0.9, 0.32, -0.3],
  ])
    rbox(g, [w!, 0.12, d!], [x!, y, z!], red('#a85e3e'), 0.03);
  for (let i = 0; i < 9; i++)
    rbox(
      g,
      [0.2, 0.12, 0.14],
      [0.3 + (i % 3) * 0.22, y + Math.floor(i / 3) * 0.12, 0.55],
      red('#b2603c'),
      0.01,
    );
  tube(
    g,
    [
      [-0.6, y - 0.01, -0.45],
      [-0.58, y + 0.3, -0.25],
    ],
    0.012,
    mat('#8a5a34'),
  );
  tube(
    g,
    [
      [-0.5, y - 0.01, -0.45],
      [-0.48, y + 0.3, -0.25],
    ],
    0.012,
    mat('#8a5a34'),
  );
  farmer(g, [-0.2, y, -0.3], '#3f6fa8', 0.45);
  farmer(g, [0.5, y, 0.1], '#5a9a4c');
  stiltHouse(g, [0.62, y, -0.55], 0.45, '#9a6a3a');
  for (const x of [-0.2, 0])
    lathe(
      g,
      [
        [0, 0],
        [0.06, 0],
        [0.09, 0.08],
        [0.09, 0.09],
      ],
      [x, y, 0.55],
      mat('#b48a52'),
    );
}
function lumber(g: Group) {
  const y = pad(g, 2, 'grass');
  stiltHouse(g, [-0.3, y, -0.3], 0.8, '#6f8a3a', '#c9a06a');
  logs(g, [0.45, y, 0.35], 6);
  logs(g, [0.5, y, -0.4], 3);
  const stump = new Mesh(new CylinderGeometry(0.1, 0.12, 0.12, 14), [
    mat('#6e4a2e'),
    mat('#d9b07a', { shine: 15 }),
    mat('#d9b07a'),
  ]);
  stump.position.set(-0.5, y + 0.06, 0.55);
  stump.castShadow = true;
  g.add(stump);
  tube(
    g,
    [
      [-0.5, y + 0.12, 0.55],
      [-0.45, y + 0.3, 0.6],
    ],
    0.012,
    mat('#8a5a34'),
  );
  rbox(
    g,
    [0.08, 0.06, 0.02],
    [-0.44, y + 0.27, 0.6],
    mat('#9aa4ac', { shine: 70, metal: true }),
    0.005,
  );
  farmer(g, [-0.15, y, 0.6], '#5a9a4c');
  oxCart(g, [0.6, y, -0.0], Math.PI / 2);
  for (let i = 0; i < 12; i++)
    ball(g, 0.02, [-0.6 + i * 0.07, y + 0.01, 0.82], mat('#d9b07a'), [1, 0.4, 1], 6);
}
function dock(g: Group) {
  const y = pad(g, 2, 'stone', '#9c8f74');
  const deck = mat('#a8703f', { map: tex.planks('#a8703f'), shine: 20 });
  rbox(g, [1.3, 0.06, 0.9], [0.2, y + 0.1, 0.35], deck, 0.01);
  for (const [x, z] of [
    [-0.4, -0.05],
    [0.8, -0.05],
    [-0.4, 0.75],
    [0.8, 0.75],
    [0.2, 0.75],
  ] as [number, number][]) {
    cyl(g, 0.035, 0.04, 0.24, [x, y - 0.06, z], mat('#6b4428'), 8);
    ball(g, 0.04, [x, y + 0.19, z], mat('#6b4428'));
  }
  stiltHouse(g, [-0.45, y, -0.5], 0.62, '#c4562f');
  for (let i = 0; i < 6; i++)
    rbox(
      g,
      [0.2, 0.12, 0.14],
      [0.3 + (i % 3) * 0.22, y + 0.16 + Math.floor(i / 3) * 0.12, 0.2],
      weathered('#c9b48a'),
      0.01,
    );
  boat(g, [0.35, y + 0.03, 0.9], 0);
  farmer(g, [-0.2, y + 0.16, 0.45], '#3f6fa8');
  sacks(g, [0.55, y + 0.16, 0.55], 3);
}
function gate(g: Group) {
  const pillar = weathered('#a3765a');
  rbox(g, [1.0, 0.06, 0.4], [0, -0.04, 0], weathered('#9a8f76'), 0.01);
  for (const x of [-0.42, 0.42]) {
    rbox(g, [0.18, 0.75, 0.32], [x, 0, 0], pillar, 0.02);
    rbox(g, [0.24, 0.06, 0.38], [x, 0.75, 0], weathered('#b2a68a'), 0.015);
    lotusBud(g, [x, 0.81, 0], 0.06, '#b2a68a');
  }
  for (let i = 0; i < 5; i++)
    rbox(
      g,
      [0.66, 0.1, 0.05],
      [0, 0.04 + i * 0.105, 0],
      mat('#8a5a34', { map: tex.planks('#8a5a34') }),
      0.008,
    );
  rbox(g, [1.0, 0.07, 0.1], [0, 0.6, 0], mat('#6b4428'), 0.01);
  ring(g, 0.1, 0.012, [0.0, 0.72, 0.06], mat('#6b4428'), [0, 0, 0]);
  for (let k = 0; k < 4; k++)
    cyl(g, 0.006, 0.006, 0.2, [0, 0.62, 0.06], mat('#6b4428'), 6).rotation.z = (k * Math.PI) / 4;
}
function bridge(g: Group) {
  const post = mat('#6b4428', { shine: 10 });
  for (const x of [-0.42, 0, 0.42])
    for (const z of [-0.36, 0.36]) cyl(g, 0.03, 0.035, 0.3, [x, -0.18, z], post, 8);
  rbox(
    g,
    [1.02, 0.06, 0.8],
    [0, 0.1, 0],
    mat('#a8703f', { map: tex.planks('#a8703f'), shine: 20 }),
    0.01,
  );
  for (const z of [-0.37, 0.37]) {
    for (const x of [-0.45, -0.15, 0.15, 0.45]) cyl(g, 0.02, 0.02, 0.2, [x, 0.16, z], post, 6);
    rbox(g, [1.0, 0.035, 0.04], [0, 0.34, z], mat('#8a5a34'), 0.01);
  }
}
function granary(g: Group) {
  const y = pad(g, 2, 'earth', '#a0845c');
  const store = new Group();
  store.position.set(-0.15, y, -0.2);
  g.add(store);
  for (const x of [-0.4, 0, 0.4])
    for (const z of [-0.35, 0.35]) cyl(store, 0.045, 0.05, 0.4, [x, 0, z], mat('#6b4428'), 10);
  for (const x of [-0.4, 0, 0.4])
    for (const z of [-0.35, 0.35])
      cyl(store, 0.07, 0.07, 0.03, [x, 0.4, z], weathered('#a59a80'), 12);
  rbox(
    store,
    [1.0, 0.07, 0.86],
    [0, 0.42, 0],
    mat('#a8703f', { map: tex.planks('#a8703f') }),
    0.015,
  );
  rbox(
    store,
    [0.9, 0.55, 0.74],
    [0, 0.49, 0],
    mat('#c9a06a', { map: tex.tiles('#c9a06a'), shine: 10 }),
    0.02,
  );
  rbox(store, [0.2, 0.3, 0.02], [0.1, 0.5, 0.375], mat('#5b3a22'), 0.01);
  roof(store, 1.06, 0.92, 0.4, [0, 1.04, 0], '#a87a3a');
  sacks(g, [0.35, y, 0.45], 6);
  for (const [x, z] of [
    [-0.7, 0.55],
    [-0.5, 0.7],
  ] as [number, number][])
    pot(g, [x, y, z], '#8a5a3a', 1.6);
  farmer(g, [0.1, y, 0.65], '#c4553a');
}
function workshop(g: Group) {
  const y = pad(g, 2, 'stone', '#a99f86');
  const post = mat('#7a4e2c', { shine: 10 });
  for (const x of [-0.6, 0.6])
    for (const z of [-0.5, 0.5]) cyl(g, 0.04, 0.045, 0.7, [x, y, z], post, 10);
  roof(g, 1.4, 1.1, 0.4, [0, y + 0.7, 0], '#b8573a');
  rbox(g, [0.7, 0.2, 0.3], [-0.1, y, -0.1], mat('#7a4e2c', { map: tex.planks('#7a4e2c') }), 0.015);
  const lintel = rbox(
    g,
    [0.62, 0.16, 0.12],
    [-0.1, y + 0.2, -0.1],
    mat('#ffffff', { map: tex.kbach('#c9b48a', '#fff1c855', '#3a2a1655') }),
    0.01,
  );
  lintel.castShadow = true;
  nagaHeadFan(g, [0.4, y, 0.15], Math.PI / 4);
  singhaGuard(g, [-0.45, y, 0.35], Math.PI / 4);
  for (let i = 0; i < 4; i++)
    rbox(
      g,
      [0.2, 0.14, 0.16],
      [0.5 + (i % 2) * 0.22, y + Math.floor(i / 2) * 0.14, -0.6],
      weathered('#c9b48a'),
      0.012,
    );
  rbox(g, [0.3, 0.02, 0.2], [-0.55, y + 0.3, -0.45], mat('#f6ecd0'), 0.005);
  cyl(g, 0.02, 0.02, 0.3, [-0.55, y, -0.45], post, 6);
  farmer(g, [0.1, y, 0.2], '#3f6fa8', 0.3);
  villager(g, [-0.25, y, 0.6], '#5a9a4c');
}
function warehouse(g: Group) {
  const y = pad(g, 2, 'earth', '#a0845c');
  rbox(g, [1.3, 0.12, 0.95], [-0.15, y, -0.25], weathered('#a59a80'), 0.02);
  rbox(
    g,
    [1.2, 0.62, 0.85],
    [-0.15, y + 0.12, -0.25],
    mat('#b9875a', { map: tex.planks('#b9875a') }),
    0.02,
  );
  rbox(g, [0.36, 0.42, 0.02], [-0.15, y + 0.12, 0.185], mat('#4a3020'), 0.01);
  rbox(g, [0.02, 0.42, 0.3], [0.455, y + 0.12, -0.25], mat('#4a3020'), 0.01);
  roof(g, 1.32, 0.98, 0.42, [-0.15, y + 0.74, -0.25], '#c4562f');
  for (const [x, z] of [
    [0.5, 0.45],
    [0.68, 0.45],
    [0.59, 0.62],
    [0.6, 0.45],
  ] as [number, number][])
    crate(g, [x, y + (x === 0.6 ? 0.16 : 0), z]);
  sacks(g, [-0.75, y, 0.45], 5);
  oxCart(g, [-0.2, y, 0.62], 0.2);
}

// ---------- On the water ----------
function stilthouseModel(g: Group) {
  // Tall stilts rise from the river; a boat waits at the ladder.
  for (const [x, z] of [
    [-0.3, -0.25],
    [0.3, -0.25],
    [-0.3, 0.25],
    [0.3, 0.25],
  ] as [number, number][]) {
    cyl(g, 0.03, 0.035, 0.3, [x, -0.16, z], mat('#5e4128', { shine: 10 }), 8);
    ring(g, 0.05, 0.008, [x, -0.04, z], mat('#bfe9ef', { shine: 80 }));
  }
  stiltHouse(g, [0, -0.06, 0], 0.72, '#9a6a3a', '#c9a06a');
  boat(g, [0.05, -0.04, 0.48], 0.2);
  tube(
    g,
    [
      [-0.42, -0.04, 0.3],
      [-0.42, 0.5, 0.3],
    ],
    0.01,
    mat('#8a5a34'),
  );
  const net = rbox(
    g,
    [0.01, 0.22, 0.22],
    [-0.42, 0.24, 0.42],
    mat('#d9cfa8', { shine: 10, opacity: 0.7, side: 'double' }),
    0.002,
  );
  net.castShadow = false;
}
function fisheryModel(g: Group) {
  const y = pad(g, 2, 'earth', '#a0845c');
  const deck = mat('#a8703f', { map: tex.planks('#a8703f'), shine: 20 });
  rbox(g, [0.4, 0.05, 1.3], [0.62, y + 0.06, 0.1], deck, 0.01);
  rbox(g, [1.0, 0.05, 0.36], [0.2, y + 0.06, 0.72], deck, 0.01);
  for (const [x, z] of [
    [0.45, -0.5],
    [0.8, -0.5],
    [0.8, 0.7],
    [0.45, 0.7],
    [-0.25, 0.85],
    [0.65, 0.85],
  ] as [number, number][])
    cyl(g, 0.025, 0.03, 0.2, [x, y - 0.05, z], mat('#6b4428'), 8);
  stiltHouse(g, [-0.42, y, -0.38], 0.52, '#c4562f');
  // Conical bamboo fish traps and a drying rack of fish.
  for (const [x, z] of [
    [-0.1, 0.35],
    [0.05, 0.42],
    [-0.22, 0.48],
  ] as [number, number][]) {
    const trap = cone(g, 0.07, 0.2, [x, y, z], mat('#c9a35a', { shine: 15, flat: true }), 10);
    trap.rotation.z = Math.PI / 2.2;
  }
  for (const x of [-0.6, -0.1]) cyl(g, 0.012, 0.012, 0.36, [x, y, 0.05], mat('#8a5a34'), 6);
  tube(
    g,
    [
      [-0.6, y + 0.34, 0.05],
      [-0.1, y + 0.34, 0.05],
    ],
    0.008,
    mat('#8a5a34'),
  );
  for (let i = 0; i < 6; i++)
    ball(
      g,
      0.03,
      [-0.55 + i * 0.08, y + 0.26, 0.05],
      mat('#c9d2d6', { shine: 70 }),
      [0.6, 1.6, 0.5],
      8,
    );
  farmer(g, [0.62, y + 0.08, -0.3], '#3f6fa8');
  boat(g, [0.95, y - 0.02, 0.35], Math.PI / 2);
}
function royalBargeModel(g: Group) {
  const b = new Group();
  g.add(b);
  const lacquer = mat('#b8302a', { shine: 60 });
  const hull = capsule(b, 0.18, 1.4, [0, 0.02, 0], lacquer, [0, 0, Math.PI / 2]);
  hull.scale.set(1, 0.42, 0.7);
  rbox(
    b,
    [1.5, 0.04, 0.22],
    [0, 0.1, 0],
    mat('#a8703f', { map: tex.planks('#a8703f'), shine: 30 }),
    0.01,
  );
  rbox(b, [1.6, 0.03, 0.26], [0, 0.07, 0], GOLD(), 0.01);
  // A naga prow rising from the bow, its tail curling up at the stern.
  tube(
    b,
    [
      [0.8, 0.06, 0],
      [0.98, 0.2, 0],
      [1.02, 0.45, 0],
      [0.96, 0.58, 0],
    ],
    0.05,
    GOLD(),
  );
  nagaHeadFan(b, [0.95, 0.45, 0], Math.PI);
  tube(
    b,
    [
      [-0.8, 0.06, 0],
      [-0.95, 0.25, 0],
      [-0.9, 0.42, 0],
      [-0.82, 0.46, 0],
    ],
    0.04,
    GOLD(),
  );
  // Golden pavilion amidships.
  for (const [x, z] of [
    [-0.18, -0.08],
    [0.18, -0.08],
    [-0.18, 0.08],
    [0.18, 0.08],
  ] as [number, number][])
    cyl(b, 0.012, 0.012, 0.28, [x, 0.12, z], GOLD(), 8);
  roof(b, 0.46, 0.28, 0.14, [0, 0.4, 0], '#c8452f', '#f0c25a');
  for (let i = 0; i < 5; i++)
    for (const side of [-1, 1]) {
      const x = -0.6 + i * 0.3;
      if (Math.abs(x) < 0.25) continue;
      villager(b, [x, 0.12, side * 0.08], side > 0 ? '#c4553a' : '#3f6fa8');
      tube(
        b,
        [
          [x, 0.22, side * 0.1],
          [x - 0.08, -0.02, side * 0.32],
        ],
        0.008,
        mat('#8a5a34'),
      );
    }
  for (const x of [-0.45, 0.45]) {
    cyl(b, 0.008, 0.008, 0.4, [x, 0.12, 0], GOLD(), 6);
    cone(b, 0.1, 0.04, [x, 0.52, 0], mat('#f2c13a', { shine: 40 }), 12);
  }
}
function lotusRaftModel(g: Group) {
  const bamboo = mat('#c9b46a', { shine: 35 });
  for (let i = 0; i < 6; i++) {
    const log = cyl(g, 0.045, 0.045, 0.7, [0, -0.02, -0.25 + i * 0.1], bamboo, 10);
    log.rotation.z = Math.PI / 2;
    log.position.y = 0.0;
  }
  for (const x of [-0.25, 0.25])
    tube(
      g,
      [
        [x, 0.04, -0.3],
        [x, 0.04, 0.3],
      ],
      0.012,
      mat('#8a6a3a'),
    );
  for (const [x, z] of [
    [-0.15, -0.12],
    [0.15, 0.05],
    [-0.05, 0.18],
  ] as [number, number][]) {
    pot(g, [x, 0.04, z], '#a8573a', 0.9);
    lotus(g, [x, 0.2, z], 0.07);
  }
  for (const [x, z] of [
    [0.2, -0.18],
    [-0.22, 0.2],
  ] as [number, number][]) {
    ball(g, 0.035, [x, 0.08, z], mat('#ffd36b', { emissive: '#ffb43a', glow: 0.8 }));
    glowSprite(g, [x, 0.1, z], 0.28);
  }
}
function lifeBoat(g: Group) {
  boat(g, [0, 0, 0], 0);
  ball(g, 0.12, [0, -0.01, 0], mat('#bfe9ef', { opacity: 0.35 }), [2.4, 0.05, 1.2], 16);
}
function egret(g: Group, flying: boolean) {
  const white = mat('#fbfaf4', { shine: 40 });
  const leg = mat('#2a2622');
  if (!flying) {
    for (const z of [-0.025, 0.025]) cyl(g, 0.006, 0.006, 0.22, [0, 0, z], leg, 6);
    ring(g, 0.06, 0.006, [0, 0.002, 0], mat('#bfe9ef', { shine: 80 }));
  }
  const y = flying ? 0 : 0.22;
  ball(g, 0.07, [0, y + 0.06, 0], white, [1.5, 0.9, 0.9]);
  tube(
    g,
    [
      [0.08, y + 0.08, 0],
      [0.11, y + 0.2, 0],
      [0.07, y + 0.27, 0],
      [0.12, y + 0.31, 0],
    ],
    0.018,
    white,
  );
  ball(g, 0.028, [0.13, y + 0.32, 0], white);
  cone(g, 0.009, 0.08, [0.15, y + 0.31, 0], mat('#f2c13a', { shine: 40 }), 6).rotation.z =
    -Math.PI / 2;
  tube(
    g,
    [
      [-0.1, y + 0.06, 0],
      [-0.17, y + 0.03, 0],
    ],
    0.012,
    white,
  );
  if (flying)
    for (const side of [-1, 1]) {
      const wing = ball(g, 0.16, [0, y + 0.1, side * 0.16], white, [0.6, 0.08, 1.3], 12);
      wing.rotation.x = side * -0.35;
    }
}
function lifeBuffalo(g: Group) {
  waterBuffalo(g, [0, -0.1, 0], 0.4);
  // The river line hides the legs; ripples ring the body.
  ball(g, 0.34, [0, 0.04, 0], mat('#3fa6b8', { shine: 90 }), [1.2, 0.04, 0.85], 24);
  ring(g, 0.3, 0.008, [0, 0.06, 0], mat('#d9f6f2', { shine: 80 }));
}

const BUILDERS: Record<ModelKey, (g: Group) => void> = {
  stilthouse: stilthouseModel,
  fishery: fisheryModel,
  royalbarge: royalBargeModel,
  lotusraft: lotusRaftModel,
  'life-boat': lifeBoat,
  'life-egret': (g) => egret(g, false),
  'life-egret-fly': (g) => egret(g, true),
  'life-buffalo': lifeBuffalo,
  baray,
  paddy,
  quarry,
  lateritepit,
  lumber,
  dock,
  gate,
  bridge,
  granary,
  workshop,
  warehouse,
  temple: (g) => temple(g, 3),
  'temple-towers': (g) => temple(g, 2),
  'temple-foundation': (g) => temple(g, 1),
  house: (g) => house(g, false),
  'house-b': (g) => house(g, true),
  garden,
  palmgrove,
  shrine,
  naga,
  lotuspond,
  market,
  singha,
  parasol,
  brazier,
  gong,
  gopura,
  pavilion,
  elephant,
  facetower,
};

export function buildModel(key: ModelKey): Group {
  const group = new Group();
  BUILDERS[key](group);
  return group;
}
