import {
  BufferAttribute,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  Shape,
  ShapeGeometry,
} from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ball, cone, cyl, mat, ring, rng, tube, vertexMat } from './studio';
import type { V3 } from './studio';

export const TREE_MODELS = 8;

/** Smooth layered value noise from sines; deterministic for a seed. */
function wobble(x: number, y: number, z: number, seed: number) {
  return (
    Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 1.3) * Math.sin(z * 3.3 + seed * 0.7) +
    0.5 *
      Math.sin(x * 7.3 + seed * 2.1) *
      Math.sin(y * 6.1 + seed) *
      Math.sin(z * 6.9 + seed * 1.7) +
    0.25 * Math.sin(x * 15.7 + seed) * Math.sin(z * 13.1 + seed * 0.3)
  );
}

/**
 * A lumpy foliage mass: an icosphere pushed in and out by noise, shaded dark underneath and
 * sunlit on top, with speckled leaf colour so it never reads as a flat ball.
 */
function foliageGeometry(
  radius: number,
  seed: number,
  tones: { dark: string; mid: string; light: string; speck?: string },
  squash = 0.82,
  bumpiness = 0.22,
): BufferGeometry {
  const geometry = mergeVertices(new IcosahedronGeometry(radius, 4));
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const dark = new Color(tones.dark);
  const mid = new Color(tones.mid);
  const light = new Color(tones.light);
  const speck = new Color(tones.speck ?? tones.light);
  const rand = rng(seed * 7 + 3);
  const c = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / radius;
    const y = position.getY(i) / radius;
    const z = position.getZ(i) / radius;
    // Clumps of leaves: a broad wobble plus fine bumps.
    const n = wobble(x * 1.4, y * 1.4, z * 1.4, seed);
    const scale = 1 + bumpiness * n;
    position.setXYZ(i, x * radius * scale, y * radius * scale * squash, z * radius * scale);
    const height = (y + 1) / 2;
    if (height < 0.55) c.copy(dark).lerp(mid, height / 0.55);
    else c.copy(mid).lerp(light, (height - 0.55) / 0.45);
    // Bumps that stick out catch the light; hollows sink into shadow.
    c.offsetHSL(0, 0, n * 0.06);
    if (rand() < 0.08) c.lerp(speck, 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
export function foliage(
  parent: Object3D,
  at: V3,
  radius: number,
  seed: number,
  tones: Tones = GREENS,
  squash = 0.82,
) {
  const mesh = new Mesh(foliageGeometry(radius, seed, tones, squash), vertexMat(0.85));
  mesh.position.set(...at);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const GREENS: Tones = { dark: '#1f5a2e', mid: '#3f9440', light: '#9bd65a', speck: '#c8ef86' };
type Tones = { dark: string; mid: string; light: string; speck?: string };
const DEEP: Tones = { dark: '#163f28', mid: '#2f7a3e', light: '#78bf55', speck: '#a6dc74' };
const BARK = '#7a5232';

function trunk(parent: Object3D, points: V3[], radius: number, color = BARK) {
  const bark = mat(color, { shine: 10 });
  tube(parent, points, radius, bark);
  // Root flare
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    tube(
      parent,
      [
        [points[0]![0], 0.12, points[0]![2]],
        [
          points[0]![0] + Math.cos(a) * radius * 1.6,
          0.03,
          points[0]![2] + Math.sin(a) * radius * 1.6,
        ],
        [points[0]![0] + Math.cos(a) * radius * 2.6, 0, points[0]![2] + Math.sin(a) * radius * 2.6],
      ],
      radius * 0.45,
      bark,
    );
  }
}
/** A long frond: a feather-edged leaf blade, bent to droop from its base. */
function frondGeometry(length: number, width: number, droop: number, ragged = true) {
  const shape = new Shape();
  shape.moveTo(0, 0);
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const w = width * Math.sin(t * Math.PI) * (1 - t * 0.35);
    shape.lineTo(t * length, (ragged && i % 2 ? w * 1.25 : w) + 0.002);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const w = width * Math.sin(t * Math.PI) * (1 - t * 0.35);
    shape.lineTo(t * length, -(ragged && i % 2 ? w * 1.25 : w) - 0.002);
  }
  const geometry = new ShapeGeometry(shape, 1);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    // Lay the blade flat (y → z), then let it arc downward along its length.
    position.setXYZ(i, x, -droop * (x / length) ** 2 + Math.abs(y) * 0.25, y);
  }
  geometry.computeVertexNormals();
  return geometry;
}
function fronds(
  parent: Object3D,
  crown: V3,
  count: number,
  length: number,
  width: number,
  droop: number,
  colors: string[],
  seed: number,
) {
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.3;
    const lift = 0.35 - rand() * 0.6;
    const geometry = frondGeometry(length * (0.85 + rand() * 0.3), width, droop);
    const blade = new Mesh(
      geometry,
      mat(colors[i % colors.length]!, { shine: 25, side: 'double' }),
    );
    blade.position.set(...crown);
    blade.rotation.set(0, -a, lift);
    blade.castShadow = blade.receiveShadow = true;
    parent.add(blade);
    // Midrib
    tube(
      parent,
      [
        crown,
        [
          crown[0] + Math.cos(a) * length * 0.5,
          crown[1] + Math.sin(lift) * length * 0.5 - droop * 0.2,
          crown[2] + Math.sin(a) * length * 0.5,
        ],
      ],
      0.012,
      mat('#c9b46a', { shine: 15 }),
    );
  }
}
function fanLeafGeometry(radius: number) {
  const shape = new Shape();
  shape.moveTo(0, 0);
  const fingers = 11;
  for (let i = 0; i <= fingers * 2; i++) {
    const a = -1.1 + (i / (fingers * 2)) * 2.2;
    const r = i % 2 ? radius : radius * 0.78;
    shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.lineTo(0, 0);
  const geometry = new ShapeGeometry(shape, 1);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    position.setXYZ(i, x, -0.25 * (x / radius) ** 2 * radius, y);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function broadleaf(
  g: Group,
  seed: number,
  tones: Tones = GREENS,
  fruit?: string,
  blossom?: string,
) {
  trunk(
    g,
    [
      [0, 0, 0],
      [0.02, 0.6, 0.01],
      [-0.03, 1.15, 0],
    ],
    0.11,
  );
  tube(
    g,
    [
      [0, 0.85, 0],
      [0.28, 1.25, 0.1],
      [0.42, 1.5, 0.12],
    ],
    0.05,
    mat(BARK, { shine: 10 }),
  );
  tube(
    g,
    [
      [0, 0.95, 0],
      [-0.3, 1.35, -0.12],
      [-0.38, 1.6, -0.16],
    ],
    0.05,
    mat(BARK, { shine: 10 }),
  );
  const rand = rng(seed);
  const clumps: [V3, number][] = [
    [[0, 1.95, 0], 0.72],
    [[0.42, 1.7, 0.18], 0.5],
    [[-0.45, 1.75, -0.12], 0.52],
    [[0.05, 1.62, 0.45], 0.48],
    [[-0.1, 2.35, -0.05], 0.42],
  ];
  for (const [i, [at, r]] of clumps.entries()) foliage(g, at, r, seed + i * 11, tones);
  if (fruit)
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      const h = 1.45 + rand() * 0.55;
      const r = 0.55 + rand() * 0.2;
      ball(
        g,
        0.055,
        [Math.cos(a) * r, h, Math.sin(a) * r],
        mat(fruit, { shine: 55 }),
        [0.9, 1.2, 0.9],
      );
    }
  if (blossom)
    for (let i = 0; i < 70; i++) {
      const a = rand() * Math.PI * 2;
      const up = rand() * 1.3 - 0.2;
      const r = 0.62 + rand() * 0.18;
      ball(
        g,
        0.035 + rand() * 0.02,
        [
          Math.cos(a) * r * Math.cos(up),
          1.95 + Math.sin(up) * r * 0.75,
          Math.sin(a) * r * Math.cos(up),
        ],
        mat(i % 3 ? blossom : '#fff2f6', { shine: 30 }),
        [1, 0.6, 1],
        8,
      );
    }
}
function coconut(g: Group) {
  const bark = mat('#9c7a4e', { shine: 10 });
  const path: V3[] = [
    [0, 0, 0],
    [0.12, 0.9, 0.05],
    [0.08, 1.8, 0.02],
    [-0.12, 2.5, 0],
  ];
  tube(g, path, 0.075, bark);
  for (let t = 0.06; t < 0.96; t += 0.06) {
    const y = t * 2.5;
    const x = 0.12 * Math.sin(t * Math.PI) - 0.14 * t * t;
    ring(g, 0.078 - t * 0.012, 0.012, [x, y, 0.03 - t * 0.03], mat('#6e5232'));
  }
  const crown: V3 = [-0.12, 2.5, 0];
  fronds(g, crown, 11, 1.05, 0.13, 0.55, ['#3f8f45', '#5aa84c', '#2f7a3c', '#7cc15a'], 5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ball(
      g,
      0.07,
      [crown[0] + Math.cos(a) * 0.08, crown[1] - 0.1, crown[2] + Math.sin(a) * 0.08],
      mat('#7a5a2e', { shine: 40 }),
    );
  }
}
function sugarPalm(g: Group) {
  const bark = mat('#5e4128', { shine: 8 });
  cyl(g, 0.065, 0.09, 2.5, [0, 0, 0], bark, 14);
  for (let y = 0.15; y < 2.4; y += 0.12)
    ring(g, 0.08 - y * 0.008, 0.012, [0, y, 0], mat('#3f2a18'));
  const crown: V3 = [0, 2.55, 0];
  const rand = rng(9);
  for (let i = 0; i < 26; i++) {
    const yaw = rand() * Math.PI * 2;
    const pitch = -0.9 + rand() * 1.9;
    // Long stalk, then a pleated fan.
    const reach = 0.38;
    const end: V3 = [
      crown[0] + Math.cos(yaw) * Math.cos(pitch) * reach,
      crown[1] + Math.sin(pitch) * reach,
      crown[2] + Math.sin(yaw) * Math.cos(pitch) * reach,
    ];
    tube(g, [crown, end], 0.012, mat('#6f8a3a'));
    const fan = new Mesh(
      fanLeafGeometry(0.34),
      mat(['#3b8a44', '#57a64c', '#2c6f3a', '#7cbf58'][i % 4]!, { shine: 25, side: 'double' }),
    );
    fan.position.set(...end);
    fan.rotation.set(0, -yaw, pitch);
    fan.castShadow = fan.receiveShadow = true;
    g.add(fan);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    tube(
      g,
      [
        [0, 2.45, 0],
        [Math.cos(a) * 0.18, 2.25, Math.sin(a) * 0.18],
        [Math.cos(a) * 0.22, 1.85, Math.sin(a) * 0.22],
      ],
      0.025,
      mat('#a4834e', { shine: 10 }),
    );
  }
  ball(g, 0.12, crown, mat('#2f5a2a'));
}
function banyan(g: Group) {
  const bark = mat('#8a6a4a', { shine: 10 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    tube(
      g,
      [
        [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3],
        [Math.cos(a) * 0.12, 0.5, Math.sin(a) * 0.12],
        [0, 1.2, 0],
      ],
      0.09,
      bark,
    );
  }
  cyl(g, 0.16, 0.2, 1.3, [0, 0, 0], bark, 14);
  const wide = { ...DEEP, light: '#8ccb5e' };
  foliage(g, [0, 1.65, 0], 0.95, 61, wide, 0.55);
  foliage(g, [0.55, 1.5, 0.3], 0.5, 62, wide, 0.6);
  foliage(g, [-0.55, 1.55, -0.25], 0.55, 63, wide, 0.6);
  const rand = rng(64);
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.45 + rand() * 0.5;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    tube(
      g,
      [
        [x, 1.35, z],
        [x + 0.02, 0.7, z],
        [x, 0, z],
      ],
      0.012 + rand() * 0.01,
      mat('#9a7a58', { shine: 8 }),
    );
  }
}
function bamboo(g: Group) {
  const rand = rng(77);
  for (let i = 0; i < 11; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.22;
    const base: V3 = [Math.cos(a) * r, 0, Math.sin(a) * r];
    const lean = 0.25 + rand() * 0.35;
    const height = 2.1 + rand() * 0.9;
    const top: V3 = [base[0] + Math.cos(a) * lean, height, base[2] + Math.sin(a) * lean];
    const culm = mat(i % 3 ? '#6ea83f' : '#9cc65a', { shine: 45 });
    tube(
      g,
      [
        base,
        [base[0] + Math.cos(a) * lean * 0.3, height * 0.5, base[2] + Math.sin(a) * lean * 0.3],
        top,
      ],
      0.035,
      culm,
    );
    for (let t = 0.12; t < 0.95; t += 0.1) {
      const p: V3 = [
        base[0] + Math.cos(a) * lean * t * t,
        height * t,
        base[2] + Math.sin(a) * lean * t * t,
      ];
      ring(g, 0.037, 0.008, p, mat('#3f6a2a'));
      if (t > 0.45)
        for (let k = 0; k < 3; k++) {
          const leafYaw = rand() * Math.PI * 2;
          const leaf = new Mesh(
            frondGeometry(0.32, 0.035, 0.08, false),
            mat(k % 2 ? '#5aa84c' : '#8cc860', { shine: 25, side: 'double' }),
          );
          leaf.position.set(...p);
          leaf.rotation.set(0, leafYaw, -0.4);
          leaf.castShadow = true;
          g.add(leaf);
        }
    }
  }
}

export function buildTree(variant: number): Group {
  const g = new Group();
  // A soft patch of grass and leaf litter around the trunk ties the tree to its tile.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    cone(
      g,
      0.03,
      0.12,
      [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3],
      mat('#4f9a3e', { flat: true }),
      4,
    );
  }
  if (variant === 0) broadleaf(g, 1);
  else if (variant === 1) {
    trunk(
      g,
      [
        [0, 0, 0],
        [0, 1.1, 0],
        [0.02, 1.7, 0],
      ],
      0.09,
      '#6a4a2e',
    );
    foliage(g, [0, 1.6, 0], 0.55, 21, DEEP);
    foliage(g, [0.05, 2.2, 0.02], 0.48, 22, DEEP);
    foliage(g, [0, 2.7, 0], 0.32, 23, DEEP);
  } else if (variant === 2) broadleaf(g, 31, GREENS, '#f2a33a');
  else if (variant === 3) coconut(g);
  else if (variant === 4) sugarPalm(g);
  else if (variant === 5)
    broadleaf(g, 51, { dark: '#3d6a32', mid: '#6fa851', light: '#c4e28a' }, undefined, '#f48fb8');
  else if (variant === 6) banyan(g);
  else bamboo(g);
  return g;
}
