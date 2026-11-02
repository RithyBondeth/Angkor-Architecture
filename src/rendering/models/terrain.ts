import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Color } from 'three';
import type { Material, Object3D } from 'three';
import type { Terrain } from '../../core/types';
import { ball, cachedTexture, canvasTexture, cone, cyl, mat, noise, rng } from './studio';
import type { V3 } from './studio';

export type TileKind = Terrain | 'flood';
/** Tile depth below the grass line, matching the painted tiles' 7 px skirt. */
const DEPTH = 0.16;
/** Water sits a little below the land so every bank shows a lip of earth. */
const WATER_LEVEL = -0.045;
/** Tiles are a hair wider than a grid cell so neighbours overlap instead of leaving seams. */
const OVERLAP = 1.03;

const GRASS_TONES = ['#6fb244', '#74b647', '#6aad41', '#78ba4a', '#71b345'];

function grassTexture(variant: number, forest: boolean) {
  return cachedTexture(`terrain-grass-${variant}-${forest}`, () =>
    canvasTexture(256, (c) => {
      const base = forest ? '#5c9a3a' : GRASS_TONES[variant]!;
      c.fillStyle = base;
      c.fillRect(0, 0, 256, 256);
      const rand = rng(variant * 13 + (forest ? 101 : 7));
      // Broad patches of lighter and deeper turf.
      for (let i = 0; i < 18; i++) {
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 40 + rand() * 40);
        g.addColorStop(0, rand() < 0.5 ? '#c6e88a33' : '#2f6a2a2a');
        g.addColorStop(1, '#00000000');
        c.save();
        c.translate(rand() * 256, rand() * 256);
        c.fillStyle = g;
        c.fillRect(-80, -80, 160, 160);
        c.restore();
      }
      // Thousands of short blades.
      const blades = forest
        ? ['#4f8a38', '#7cb556', '#3d7330', '#9fcc6a']
        : ['#5f9e3e', '#a6d872', '#4d8a34', '#c4e88e', '#78b34e'];
      c.lineCap = 'round';
      for (let i = 0; i < 2200; i++) {
        const x = rand() * 256;
        const y = rand() * 256;
        c.strokeStyle = blades[i % blades.length]!;
        c.lineWidth = 0.8 + rand() * 0.8;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (rand() - 0.5) * 4, y - 3 - rand() * 4);
        c.stroke();
      }
      if (forest)
        for (let i = 0; i < 90; i++) {
          c.fillStyle = ['#b9874a', '#d9a04a', '#8a6a3a', '#c4703a'][i % 4]!;
          c.beginPath();
          c.ellipse(rand() * 256, rand() * 256, 3, 1.8, rand() * 3, 0, Math.PI * 2);
          c.fill();
        }
      else
        for (let i = 0; i < 26; i++) {
          // Clover and daisies
          const x = rand() * 256;
          const y = rand() * 256;
          c.fillStyle = i % 3 ? '#4f9a3a' : '#fff6dc';
          for (let p = 0; p < 4; p++) {
            c.beginPath();
            c.arc(x + Math.cos(p * 1.57) * 2.2, y + Math.sin(p * 1.57) * 2.2, 1.8, 0, Math.PI * 2);
            c.fill();
          }
        }
    }),
  );
}
function soilTexture() {
  return cachedTexture('terrain-soil', () =>
    canvasTexture(128, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, '#5c8f3a');
      g.addColorStop(0.16, '#4b7a30');
      g.addColorStop(0.2, '#8a5f38');
      g.addColorStop(1, '#5e3e24');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      noise(c, 128, '#ffffff14', '#00000020', 600);
      const rand = rng(5);
      for (let i = 0; i < 24; i++) {
        c.fillStyle = i % 2 ? '#a88464' : '#6e5038';
        c.beginPath();
        c.ellipse(
          rand() * 128,
          34 + rand() * 90,
          3 + rand() * 4,
          2 + rand() * 2,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }),
  );
}
function sandTexture() {
  return cachedTexture('terrain-sand', () =>
    canvasTexture(128, (c) => {
      c.fillStyle = '#d8c08a';
      c.fillRect(0, 0, 128, 128);
      noise(c, 128, '#fff2c844', '#8a6a3a33', 900);
      const rand = rng(9);
      for (let i = 0; i < 30; i++) {
        c.fillStyle = ['#b7a27a', '#9c8a6a', '#e9dcb4'][i % 3]!;
        c.beginPath();
        c.ellipse(
          rand() * 128,
          rand() * 128,
          2 + rand() * 3,
          1.5 + rand() * 2,
          rand() * 3,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }),
  );
}
function rippleTexture() {
  return cachedTexture('terrain-ripple', () =>
    canvasTexture(256, (c) => {
      c.fillStyle = '#808080';
      c.fillRect(0, 0, 256, 256);
      const rand = rng(17);
      c.lineCap = 'round';
      for (let i = 0; i < 120; i++) {
        const x = rand() * 256;
        const y = rand() * 256;
        c.strokeStyle = i % 2 ? '#b0b0b0' : '#5a5a5a';
        c.lineWidth = 1.5 + rand() * 2;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 8, y - 4, x + 16 + rand() * 10, y);
        c.stroke();
      }
    }),
  );
}
function earthTexture() {
  return cachedTexture('terrain-road', () =>
    canvasTexture(256, (c) => {
      c.fillStyle = '#d9b47a';
      c.fillRect(0, 0, 256, 256);
      noise(c, 256, '#f6dca844', '#9a74462e', 2600);
      c.strokeStyle = '#b48a5466';
      c.lineWidth = 10;
      for (const offset of [80, 176]) {
        c.beginPath();
        c.moveTo(0, offset);
        c.lineTo(256, offset);
        c.stroke();
      }
    }),
  );
}

function block(parent: Object3D, top: Material, side: Material, height = DEPTH, y = -DEPTH) {
  // Face order: +X, −X, +Y, −Y, +Z, −Z. Only +X, +Z, and the top are ever seen.
  const mesh = new Mesh(new BoxGeometry(OVERLAP, height, OVERLAP), [
    side,
    side,
    top,
    side,
    side,
    side,
  ]);
  mesh.position.set(0, y + height / 2, 0);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function tuft(parent: Object3D, at: V3, seed: number, colors = ['#5aa040', '#8cc860', '#3f8432']) {
  const rand = rng(seed);
  for (let i = 0; i < 6; i++) {
    const blade = cone(
      parent,
      0.012,
      0.07 + rand() * 0.06,
      [at[0] + (rand() - 0.5) * 0.05, at[1], at[2] + (rand() - 0.5) * 0.05],
      mat(colors[i % colors.length]!, { shine: 20, flat: true }),
      4,
    );
    blade.rotation.set((rand() - 0.5) * 0.7, 0, (rand() - 0.5) * 0.7);
  }
}
function flower(parent: Object3D, at: V3, petal: string) {
  cyl(parent, 0.004, 0.004, 0.05, at, mat('#4f8a38'), 4);
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    ball(
      parent,
      0.013,
      [at[0] + Math.cos(a) * 0.014, at[1] + 0.05, at[2] + Math.sin(a) * 0.014],
      mat(petal, { shine: 30 }),
      [1, 0.5, 1],
      6,
    );
  }
  ball(parent, 0.009, [at[0], at[1] + 0.055, at[2]], mat('#ffcf3a', { shine: 40 }), [1, 1, 1], 6);
}
function pebble(parent: Object3D, at: V3, r: number, color = '#b9b19a') {
  ball(parent, r, at, mat(color, { shine: 30 }), [1, 0.5, 0.85], 8);
}
function lily(parent: Object3D, at: V3, r: number, flowerToo: boolean) {
  const pad = cyl(parent, r, r, 0.008, at, mat('#4fa24e', { shine: 40 }), 18);
  pad.castShadow = false;
  if (flowerToo) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = ball(
        parent,
        0.022,
        [at[0] + Math.cos(a) * 0.02, at[1] + 0.03, at[2] + Math.sin(a) * 0.02],
        mat(i % 2 ? '#f39bc0' : '#ffd3e4', { shine: 35 }),
        [0.6, 1.2, 0.6],
        8,
      );
      petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    ball(parent, 0.012, [at[0], at[1] + 0.04, at[2]], mat('#ffd34a'));
  }
}
export function waterTexture(color: string) {
  return cachedTexture(`terrain-water-${color}`, () =>
    canvasTexture(256, (c) => {
      c.fillStyle = color;
      c.fillRect(0, 0, 256, 256);
      const rand = rng(color.length * 3 + 11);
      for (let i = 0; i < 14; i++) {
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 50 + rand() * 50);
        g.addColorStop(0, rand() < 0.5 ? '#7fe0e044' : '#0a4a5a33');
        g.addColorStop(1, '#00000000');
        c.save();
        c.translate(rand() * 256, rand() * 256);
        c.fillStyle = g;
        c.fillRect(-100, -100, 200, 200);
        c.restore();
      }
      c.lineCap = 'round';
      for (let i = 0; i < 90; i++) {
        const x = rand() * 256;
        const y = rand() * 256;
        c.strokeStyle = i % 3 ? '#c8f6ee66' : '#ffffffaa';
        c.lineWidth = 1 + rand() * 1.5;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 8, y - 3, x + 14 + rand() * 10, y);
        c.stroke();
      }
    }),
  );
}
function waterMaterial(color: string) {
  return new MeshStandardMaterial({
    color: new Color('#ffffff'),
    map: waterTexture(color),
    roughness: 0.12,
    metalness: 0.05,
    bumpMap: rippleTexture(),
    bumpScale: 1.2,
  });
}

/** One map tile with a 3D surface. The tile's top is the y = 0 plane, centred on the origin. */
export function buildTile(kind: TileKind, variant: number): { group: Group; extra: Material[] } {
  const g = new Group();
  const extra: Material[] = [];
  const rand = rng(variant * 31 + kind.length * 7);
  const soil = mat('#ffffff', { map: soilTexture(), shine: 10 });
  const wet = ['water', 'canal', 'moat', 'reservoir', 'bridge', 'flood'].includes(kind);
  if (kind === 'flood') {
    const water = waterMaterial('#3fa6b8');
    extra.push(water);
    const surface = new Mesh(new PlaneGeometry(OVERLAP, OVERLAP), water);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.004;
    g.add(surface);
    return { group: g, extra };
  }
  if (wet) {
    const bed = mat('#ffffff', { map: sandTexture(), shine: 15 });
    const wall = mat('#2f7f8f', { shine: 30 });
    block(g, bed, wall, DEPTH + WATER_LEVEL - 0.08, -DEPTH);
    const deep = kind === 'reservoir' ? '#1d7d93' : kind === 'moat' ? '#2a8a8c' : '#2a9cb0';
    const water = waterMaterial(deep);
    extra.push(water);
    const body = new Mesh(new BoxGeometry(OVERLAP, 0.08, OVERLAP), water);
    body.position.y = WATER_LEVEL - 0.04;
    g.add(body);
    if (kind === 'water' && variant % 2)
      for (let i = 0; i < 3; i++)
        lily(
          g,
          [-0.3 + rand() * 0.6, WATER_LEVEL + 0.002, -0.3 + rand() * 0.6],
          0.06 + rand() * 0.04,
          variant === 3 && i === 0,
        );
    if (kind === 'canal' || kind === 'moat') {
      const stone = kind === 'canal' ? '#d7cfb2' : '#c98a64';
      for (let i = 0; i < 6; i++) {
        const t = -0.42 + i * 0.168;
        pebble(g, [t, WATER_LEVEL + 0.02, -0.46], 0.06, stone);
        pebble(g, [-0.46, WATER_LEVEL + 0.02, t], 0.06, stone);
      }
    }
    return { group: g, extra };
  }
  if (kind === 'road') {
    const top = mat('#ffffff', { map: earthTexture(), shine: 12 });
    block(g, top, soil);
    for (let i = 0; i < 14; i++)
      pebble(
        g,
        [-0.42 + rand() * 0.84, 0.004, -0.42 + rand() * 0.84],
        0.03 + rand() * 0.025,
        ['#c9b48e', '#a89a80', '#e2d2ae'][i % 3],
      );
    for (let i = 0; i < 3; i++)
      tuft(g, [-0.44 + rand() * 0.1, 0, 0.3 + rand() * 0.12], variant * 5 + i);
    return { group: g, extra };
  }
  const forest = kind === 'forest';
  const top = mat('#ffffff', { map: grassTexture(variant, forest), shine: 12 });
  block(g, top, soil);
  const tufts = forest ? 5 : 7;
  for (let i = 0; i < tufts; i++)
    tuft(
      g,
      [-0.4 + rand() * 0.8, 0, -0.4 + rand() * 0.8],
      variant * 17 + i,
      forest ? ['#4a8a36', '#76b052', '#356f2a'] : undefined,
    );
  if (forest) {
    for (let i = 0; i < 3; i++) {
      // Ferns: a fan of drooping fronds.
      const at: V3 = [-0.35 + rand() * 0.7, 0, -0.35 + rand() * 0.7];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const leaf = cone(
          g,
          0.02,
          0.16,
          at,
          mat(k % 2 ? '#3f8a3a' : '#62a84a', { flat: true, shine: 20 }),
          3,
        );
        leaf.rotation.set(Math.sin(a) * 1.0, 0, Math.cos(a) * 1.0);
      }
    }
    if (variant % 2) {
      const at: V3 = [-0.2 + rand() * 0.4, 0, -0.2 + rand() * 0.4];
      cyl(g, 0.01, 0.012, 0.04, at, mat('#f2ead6'), 6);
      ball(g, 0.03, [at[0], at[1] + 0.045, at[2]], mat('#d2482f', { shine: 40 }), [1, 0.55, 1], 10);
    }
  } else {
    if (variant === 1 || variant === 3)
      for (let i = 0; i < 4; i++)
        flower(
          g,
          [-0.38 + rand() * 0.76, 0, -0.38 + rand() * 0.76],
          ['#fff6ec', '#ffd86b', '#f6a3c4', '#c9a2f2'][(i + variant) % 4]!,
        );
    if (variant === 2 || variant === 4)
      for (let i = 0; i < 3; i++)
        pebble(g, [-0.4 + rand() * 0.8, 0.005, -0.4 + rand() * 0.8], 0.02 + rand() * 0.025);
  }
  return { group: g, extra };
}
