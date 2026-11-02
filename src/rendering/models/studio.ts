import {
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  Object3D,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material, Texture } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type V3 = [number, number, number];
/** Sprite frames are 384 × 320 with the ground origin at (192, 252), rendered at 2× then reduced. */
export interface Frame {
  width: number;
  height: number;
  originX: number;
  originY: number;
  /** Pixels per tile unit in the frame's logical size. */
  scale: number;
  supersample: number;
}
/** Pixels per tile unit so a footprint matches the 2D tiles (1 × 1 art is drawn at 0.72 scale). */
const PIXELS_PER_UNIT: Record<number, number> = { 1: 70.7, 2: 50.9 };
export const FRAMES = {
  building: (size: number): Frame => ({
    width: 384,
    height: 320,
    originX: 192,
    originY: 252,
    scale: PIXELS_PER_UNIT[size] ?? PIXELS_PER_UNIT[2]!,
    supersample: 2,
  }),
  /** A map tile: top diamond centred at (40, 34) of an 80 × 72 frame, leaving room for tufts. */
  tile: { width: 80, height: 72, originX: 40, originY: 34, scale: 50.9, supersample: 2 } as Frame,
  tree: {
    width: 128,
    height: 160,
    originX: 64,
    originY: 145,
    scale: 50.9,
    supersample: 2,
  } as Frame,
};

// ---------- Procedural textures ----------
export function canvasTexture(
  size: number,
  paint: (c: CanvasRenderingContext2D) => void,
  repeat = 1,
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d')!);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
export function noise(
  c: CanvasRenderingContext2D,
  size: number,
  light: string,
  dark: string,
  n = 500,
) {
  const rand = seeded(size + n);
  for (let i = 0; i < n; i++) {
    c.fillStyle = i % 2 ? light : dark;
    c.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
}
const textures = new Map<string, Texture>();
export function cachedTexture(key: string, make: () => Texture) {
  let texture = textures.get(key);
  if (!texture) textures.set(key, (texture = make()));
  return texture;
}
/** One kbach motif: a flame-tipped leaf rising between two curling scrolls, carved in relief. */
function kbachMotif(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  ink: string,
  light: string,
) {
  const draw = (color: string, dx: number, dy: number) => {
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 2.2 * s;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x + dx, y + dy + 26 * s);
    c.bezierCurveTo(
      x + dx - 12 * s,
      y + dy + 8 * s,
      x + dx - 4 * s,
      y + dy - 10 * s,
      x + dx + 2 * s,
      y + dy - 24 * s,
    );
    c.bezierCurveTo(
      x + dx + 6 * s,
      y + dy - 10 * s,
      x + dx + 12 * s,
      y + dy + 8 * s,
      x + dx,
      y + dy + 26 * s,
    );
    c.fill();
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(x + dx, y + dy + 24 * s);
      c.bezierCurveTo(
        x + dx + side * 10 * s,
        y + dy + 26 * s,
        x + dx + side * 20 * s,
        y + dy + 14 * s,
        x + dx + side * 16 * s,
        y + dy + 4 * s,
      );
      c.bezierCurveTo(
        x + dx + side * 12 * s,
        y + dy - 4 * s,
        x + dx + side * 6 * s,
        y + dy + 4 * s,
        x + dx + side * 11 * s,
        y + dy + 8 * s,
      );
      c.stroke();
    }
  };
  draw(ink, 1.5 * s, 1.5 * s);
  draw(light, 0, 0);
}
export const tex = {
  /** A carved frieze of kbach flames, the signature Khmer ornament. */
  kbach: (base: string, light = '#ffffff3a', ink = '#00000040', repeat = 1) =>
    cachedTexture(`kbach${base}${light}${repeat}`, () =>
      canvasTexture(
        256,
        (c) => {
          c.fillStyle = base;
          c.fillRect(0, 0, 256, 256);
          noise(c, 256, '#ffffff18', '#00000018', 900);
          c.fillStyle = ink;
          c.fillRect(0, 0, 256, 10);
          c.fillRect(0, 246, 256, 10);
          c.fillStyle = light;
          c.fillRect(0, 10, 256, 3);
          for (let row = 0; row < 2; row++)
            for (let i = 0; i < 4; i++)
              kbachMotif(c, 32 + i * 64, 70 + row * 116, 1.35, ink, light);
          for (let i = 0; i < 16; i++) {
            c.fillStyle = light;
            c.beginPath();
            c.arc(8 + i * 16, 128, 4, 0, Math.PI * 2);
            c.fill();
          }
        },
        repeat,
      ),
    ),
  /** Weathered Angkor sandstone: grey-ochre blocks with lichen and dark rain streaks. */
  lichen: (base: string, repeat = 1) =>
    cachedTexture(`lichen${base}${repeat}`, () =>
      canvasTexture(
        256,
        (c) => {
          c.fillStyle = base;
          c.fillRect(0, 0, 256, 256);
          noise(c, 256, '#ffffff1c', '#00000022', 2400);
          const rand = seeded(base.length * 97 + repeat);
          for (let i = 0; i < 16; i++) {
            const g = c.createRadialGradient(0, 0, 0, 0, 0, 10 + rand() * 26);
            g.addColorStop(0, i % 3 ? '#5f7a4a55' : '#2e2a2244');
            g.addColorStop(1, '#00000000');
            c.save();
            c.translate(rand() * 256, rand() * 256);
            c.fillStyle = g;
            c.fillRect(-40, -40, 80, 80);
            c.restore();
          }
          for (let i = 0; i < 10; i++) {
            const x = rand() * 256;
            const g = c.createLinearGradient(x, 0, x, 256);
            g.addColorStop(0, '#2a241c38');
            g.addColorStop(1, '#2a241c00');
            c.fillStyle = g;
            c.fillRect(x, rand() * 60, 3 + rand() * 6, 120 + rand() * 120);
          }
          c.strokeStyle = '#00000038';
          c.lineWidth = 2;
          for (let row = 0; row < 8; row++) {
            const y = row * 32;
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(256, y);
            c.stroke();
            for (let col = 0; col < 5; col++) {
              const x = col * 56 + (row % 2) * 28;
              c.beginPath();
              c.moveTo(x, y);
              c.lineTo(x, y + 32);
              c.stroke();
            }
          }
        },
        repeat,
      ),
    ),
  stone: (base: string, repeat = 1) =>
    cachedTexture(`stone${base}${repeat}`, () =>
      canvasTexture(
        128,
        (c) => {
          c.fillStyle = base;
          c.fillRect(0, 0, 128, 128);
          noise(c, 128, '#ffffff22', '#00000018', 700);
          c.strokeStyle = '#00000030';
          c.lineWidth = 2;
          for (let row = 0; row < 4; row++) {
            const y = row * 32;
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(128, y);
            c.stroke();
            for (let col = 0; col < 3; col++) {
              const x = col * 48 + (row % 2) * 24;
              c.beginPath();
              c.moveTo(x, y);
              c.lineTo(x, y + 32);
              c.stroke();
            }
          }
          c.strokeStyle = '#ffffff2a';
          c.lineWidth = 1;
          for (let row = 0; row < 4; row++) {
            c.beginPath();
            c.moveTo(0, row * 32 + 2);
            c.lineTo(128, row * 32 + 2);
            c.stroke();
          }
        },
        repeat,
      ),
    ),
  planks: (base: string) =>
    cachedTexture(`planks${base}`, () =>
      canvasTexture(128, (c) => {
        c.fillStyle = base;
        c.fillRect(0, 0, 128, 128);
        noise(c, 128, '#ffffff1c', '#00000016', 400);
        for (let y = 0; y < 128; y += 16) {
          c.fillStyle = '#00000028';
          c.fillRect(0, y, 128, 2);
          c.fillStyle = '#ffffff22';
          c.fillRect(0, y + 2, 128, 1);
        }
      }),
    ),
  tiles: (base: string) =>
    cachedTexture(`tiles${base}`, () =>
      canvasTexture(
        128,
        (c) => {
          c.fillStyle = base;
          c.fillRect(0, 0, 128, 128);
          for (let row = 0; row < 8; row++)
            for (let col = 0; col < 9; col++) {
              const x = col * 16 + (row % 2) * 8;
              const y = row * 16;
              const g = c.createLinearGradient(0, y, 0, y + 16);
              g.addColorStop(0, '#ffffff30');
              g.addColorStop(1, '#00000038');
              c.fillStyle = g;
              c.beginPath();
              c.ellipse(x, y + 8, 8, 9, 0, 0, Math.PI);
              c.fill();
            }
        },
        2,
      ),
    ),
  grass: () =>
    cachedTexture('grass', () =>
      canvasTexture(
        128,
        (c) => {
          c.fillStyle = '#8fc760';
          c.fillRect(0, 0, 128, 128);
          noise(c, 128, '#c3e68a', '#5f9a3e', 900);
        },
        2,
      ),
    ),
  earth: () =>
    cachedTexture('earth', () =>
      canvasTexture(
        128,
        (c) => {
          c.fillStyle = '#e2c38e';
          c.fillRect(0, 0, 128, 128);
          noise(c, 128, '#f4dcae', '#b9935f', 700);
        },
        2,
      ),
    ),
  /** A serene carved face on old sandstone. */
  face: () =>
    cachedTexture('face', () =>
      canvasTexture(256, (c) => {
        c.fillStyle = '#d9cb9a';
        c.fillRect(0, 0, 256, 256);
        noise(c, 256, '#ffffff22', '#00000022', 1500);
        c.strokeStyle = '#3b2f1c';
        c.lineCap = 'round';
        // Soft relief shading around the cheeks and brow.
        const cheek = c.createRadialGradient(128, 140, 30, 128, 140, 120);
        cheek.addColorStop(0, '#ffffff18');
        cheek.addColorStop(1, '#00000040');
        c.fillStyle = cheek;
        c.fillRect(0, 60, 256, 196);
        const stroke = (w: number, path: () => void) => {
          c.lineWidth = w;
          c.beginPath();
          path();
          c.stroke();
        };
        c.fillStyle = '#c9b67e';
        c.fillRect(30, 26, 196, 30);
        for (let x = 46; x < 220; x += 26) {
          c.fillStyle = '#ead9a4';
          c.beginPath();
          c.arc(x, 41, 8, 0, Math.PI * 2);
          c.fill();
        }
        stroke(8, () => {
          c.moveTo(62, 92);
          c.quadraticCurveTo(90, 76, 116, 92);
          c.moveTo(194, 92);
          c.quadraticCurveTo(166, 76, 140, 92);
        });
        stroke(9, () => {
          c.moveTo(66, 118);
          c.quadraticCurveTo(90, 132, 112, 118);
          c.moveTo(190, 118);
          c.quadraticCurveTo(166, 132, 144, 118);
        });
        c.fillStyle = '#b9a56c';
        c.beginPath();
        c.moveTo(128, 108);
        c.lineTo(146, 168);
        c.lineTo(110, 168);
        c.closePath();
        c.fill();
        stroke(3, () => {
          c.moveTo(110, 168);
          c.lineTo(146, 168);
        });
        stroke(11, () => {
          c.moveTo(96, 196);
          c.quadraticCurveTo(128, 218, 160, 196);
        });
        c.fillStyle = '#00000020';
        c.fillRect(0, 236, 256, 20);
      }),
    ),
  elephantFrieze: () =>
    cachedTexture('frieze', () =>
      canvasTexture(256, (c) => {
        c.fillStyle = '#c99a6c';
        c.fillRect(0, 0, 256, 256);
        noise(c, 256, '#ffffff22', '#00000022', 1200);
        c.fillStyle = '#8c623e';
        for (let i = 0; i < 3; i++) {
          const x = 20 + i * 82;
          c.beginPath();
          c.ellipse(x + 34, 130, 30, 22, 0, 0, Math.PI * 2);
          c.ellipse(x + 6, 120, 15, 14, 0, 0, Math.PI * 2);
          c.fill();
          c.fillRect(x + 14, 140, 9, 34);
          c.fillRect(x + 48, 140, 9, 34);
          c.lineWidth = 7;
          c.strokeStyle = '#8c623e';
          c.beginPath();
          c.moveTo(x - 4, 124);
          c.quadraticCurveTo(x - 12, 160, x + 2, 172);
          c.stroke();
        }
        c.fillStyle = '#00000026';
        c.fillRect(0, 0, 256, 18);
        c.fillRect(0, 230, 256, 26);
      }),
    ),
  glow: () =>
    cachedTexture('glow', () =>
      canvasTexture(64, (c) => {
        const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, '#fff2b0ff');
        g.addColorStop(0.4, '#ffb43a88');
        g.addColorStop(1, '#ff6a1a00');
        c.fillStyle = g;
        c.fillRect(0, 0, 64, 64);
      }),
    ),
  blob: () =>
    cachedTexture('blob', () =>
      canvasTexture(64, (c) => {
        const g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
        g.addColorStop(0, '#000000aa');
        g.addColorStop(1, '#00000000');
        c.fillStyle = g;
        c.fillRect(0, 0, 64, 64);
      }),
    ),
};

// ---------- Materials ----------
const materials = new Map<string, Material>();
/** Physically based materials: `shine` maps to smoothness, `metal` for gold and bronze. */
export function mat(
  color: string,
  options: {
    map?: Texture;
    bump?: Texture;
    shine?: number;
    metal?: boolean;
    emissive?: string;
    glow?: number;
    opacity?: number;
    flat?: boolean;
    side?: 'double';
  } = {},
): Material {
  const key = [
    color,
    options.map?.uuid,
    options.bump?.uuid,
    options.shine,
    options.metal,
    options.emissive,
    options.glow,
    options.opacity,
    options.flat,
    options.side,
  ].join('|');
  let material = materials.get(key);
  if (!material) {
    const shine = options.shine ?? 18;
    const bump = options.bump ?? options.map;
    material = new MeshStandardMaterial({
      color: new Color(color),
      map: options.map ?? null,
      bumpMap: bump ?? null,
      bumpScale: bump ? 2.2 : 1,
      roughness: shine >= 80 ? 0.22 : shine >= 50 ? 0.38 : shine >= 30 ? 0.55 : 0.78,
      metalness: options.metal ? 0.85 : 0,
      emissive: new Color(options.emissive ?? '#000000'),
      emissiveIntensity: options.glow ?? 1,
      transparent: options.opacity !== undefined,
      opacity: options.opacity ?? 1,
      flatShading: options.flat ?? false,
      side: options.side === 'double' ? DoubleSide : undefined,
    });
    materials.set(key, material);
  }
  return material;
}
export const GOLD = () => mat('#f7c445', { shine: 85, metal: true });
export const BRONZE = () => mat('#d0903a', { shine: 70, metal: true });
/** For geometry that carries its own per-vertex colours (foliage, leaves). */
export function vertexMat(roughness = 0.8, side?: 'double'): Material {
  const key = `vertex|${roughness}|${side ?? ''}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      vertexColors: true,
      roughness,
      side: side === 'double' ? DoubleSide : undefined,
    });
    materials.set(key, material);
  }
  return material;
}

// ---------- Shape helpers (positions are bottom-centre unless noted) ----------
function place(parent: Object3D, mesh: Mesh, at: V3) {
  mesh.position.set(...at);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function rbox(
  parent: Object3D,
  size: V3,
  at: V3,
  material: Material,
  radius = 0.03,
  rotateY = 0,
) {
  const r = Math.min(radius, Math.min(...size) / 2 - 0.001);
  const mesh = new Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 3, r), material);
  mesh.rotation.y = rotateY;
  return place(parent, mesh, [at[0], at[1] + size[1] / 2, at[2]]);
}
export function cyl(
  parent: Object3D,
  top: number,
  bottom: number,
  height: number,
  at: V3,
  material: Material,
  segments = 18,
) {
  return place(parent, new Mesh(new CylinderGeometry(top, bottom, height, segments), material), [
    at[0],
    at[1] + height / 2,
    at[2],
  ]);
}
/** Centre-positioned sphere, optionally squashed. */
export function ball(
  parent: Object3D,
  radius: number,
  at: V3,
  material: Material,
  scale: V3 = [1, 1, 1],
  segments = 20,
) {
  const mesh = place(
    parent,
    new Mesh(new SphereGeometry(radius, segments, Math.round(segments * 0.75)), material),
    at,
  );
  mesh.scale.set(...scale);
  return mesh;
}
export function cone(
  parent: Object3D,
  radius: number,
  height: number,
  at: V3,
  material: Material,
  segments = 18,
) {
  return place(parent, new Mesh(new ConeGeometry(radius, height, segments), material), [
    at[0],
    at[1] + height / 2,
    at[2],
  ]);
}
export function capsule(
  parent: Object3D,
  radius: number,
  length: number,
  at: V3,
  material: Material,
  rotation: V3 = [0, 0, 0],
) {
  const mesh = place(parent, new Mesh(new CapsuleGeometry(radius, length, 6, 14), material), at);
  mesh.rotation.set(...rotation);
  return mesh;
}
export function tube(parent: Object3D, points: V3[], radius: number, material: Material) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  return place(
    parent,
    new Mesh(new TubeGeometry(curve, 32, radius, 10, false), material),
    [0, 0, 0],
  );
}
export function ring(
  parent: Object3D,
  radius: number,
  thickness: number,
  at: V3,
  material: Material,
  rotation: V3 = [Math.PI / 2, 0, 0],
) {
  const mesh = place(parent, new Mesh(new TorusGeometry(radius, thickness, 10, 32), material), at);
  mesh.rotation.set(...rotation);
  return mesh;
}
/** Revolve a profile of [radius, height] points around the vertical axis. */
export function lathe(parent: Object3D, profile: [number, number][], at: V3, material: Material) {
  return place(
    parent,
    new Mesh(
      new LatheGeometry(
        profile.map(([r, y]) => new Vector2(r, y)),
        24,
      ),
      material,
    ),
    at,
  );
}
/** A triangular gable end in the YZ plane, extruded along X. */
export function gable(
  parent: Object3D,
  width: number,
  rise: number,
  thickness: number,
  at: V3,
  material: Material,
) {
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const mesh = new Mesh(
    new ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: 0.01,
      bevelThickness: 0.01,
      bevelSegments: 2,
    }),
    material,
  );
  mesh.rotation.y = Math.PI / 2;
  return place(parent, mesh, [at[0] - thickness / 2, at[1], at[2]]);
}
/**
 * A pitched roof with its ridge along X: two chunky tiled slabs, gable ends, a ridge cap,
 * and upturned golden finials.
 */
export function roof(
  parent: Object3D,
  length: number,
  width: number,
  rise: number,
  base: V3,
  color: string,
  gableColor = '#d9a441',
  finials = true,
) {
  // Khmer roofs are steep, kick out at the eaves, and end in hooked chovea finials.
  const half = width / 2;
  const steep = rise * 1.35;
  const slope = Math.hypot(half, steep);
  const angle = Math.atan2(steep, half);
  const slab = mat(color, { map: tex.tiles(color), shine: 30 });
  const trim = mat('#2f7a5a', { shine: 35 });
  for (const side of [-1, 1]) {
    const mesh = new Mesh(new RoundedBoxGeometry(length, 0.06, slope + 0.06, 2, 0.025), slab);
    mesh.position.set(base[0], base[1] + steep / 2, base[2] + (side * half) / 2);
    mesh.rotation.x = side * angle;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    // Flared eave skirt with a painted green border.
    const flare = angle * 0.45;
    const skirt = 0.22;
    const eave = new Mesh(new RoundedBoxGeometry(length * 1.04, 0.05, skirt, 2, 0.02), slab);
    eave.position.set(
      base[0],
      base[1] - Math.sin(flare) * (skirt / 2) + 0.01,
      base[2] + side * (half + Math.cos(flare) * (skirt / 2) - 0.03),
    );
    eave.rotation.x = side * flare;
    eave.castShadow = eave.receiveShadow = true;
    parent.add(eave);
    const border = new Mesh(new RoundedBoxGeometry(length * 1.05, 0.04, 0.05, 2, 0.015), trim);
    border.position.set(
      base[0],
      base[1] - Math.sin(flare) * skirt + 0.005,
      base[2] + side * (half + Math.cos(flare) * skirt - 0.04),
    );
    border.rotation.x = side * flare;
    parent.add(border);
  }
  const gableMat = mat('#ffffff', {
    map: tex.kbach(gableColor, '#fff2b866', '#5a2a0a55'),
    shine: 40,
  });
  for (const end of [-1, 1]) {
    const x = base[0] + (end * length) / 2.2;
    gable(parent, width * 0.92, steep * 0.94, 0.04, [x, base[1], base[2]], gableMat);
    // Naga crest along both rakes, rising to the ridge.
    for (const side of [-1, 1])
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const fin = cone(
          parent,
          0.018,
          0.08,
          [x + end * 0.04, base[1] + steep * t, base[2] + side * half * (1 - t)],
          GOLD(),
          6,
        );
        fin.rotation.x = side * (Math.PI / 2 - angle) * 0.9;
      }
    // Curled naga heads at the foot of each rake.
    for (const side of [-1, 1]) {
      const foot: V3 = [x + end * 0.04, base[1] + 0.02, base[2] + side * half * 1.02];
      tube(
        parent,
        [
          foot,
          [foot[0], foot[1] + 0.06, foot[2] + side * 0.06],
          [foot[0], foot[1] + 0.12, foot[2] + side * 0.02],
        ],
        0.02,
        GOLD(),
      );
      ball(parent, 0.026, [foot[0], foot[1] + 0.13, foot[2] + side * 0.01], GOLD());
    }
  }
  const cap = new Mesh(
    new CylinderGeometry(0.04, 0.04, length + 0.04, 12),
    mat(color, { shine: 40 }),
  );
  cap.rotation.z = Math.PI / 2;
  place(parent, cap, [base[0], base[1] + steep + 0.03, base[2]]);
  if (finials)
    for (const end of [-1, 1]) {
      // Chovea: a slender hook like a bird's head rising from each ridge end.
      const x = base[0] + (end * (length + 0.04)) / 2;
      const y = base[1] + steep + 0.03;
      tube(
        parent,
        [
          [x, y, base[2]],
          [x + end * 0.04, y + 0.12, base[2]],
          [x + end * 0.1, y + 0.26, base[2]],
          [x + end * 0.05, y + 0.34, base[2]],
          [x - end * 0.02, y + 0.31, base[2]],
        ],
        0.022,
        GOLD(),
      );
      cone(parent, 0.016, 0.07, [x - end * 0.03, y + 0.27, base[2]], GOLD(), 6).rotation.z =
        end * 2.2;
    }
}
/** A stone-rimmed plinth with an inset lawn, sand, or stone top. Returns the top height. */
export function pad(
  parent: Object3D,
  size: number,
  top: 'grass' | 'earth' | 'stone' = 'grass',
  stone = '#d8c9a2',
) {
  const half = size * 0.47;
  const blob = new Mesh(
    new PlaneGeometry(size * 1.35, size * 1.35),
    new MeshBasicMaterial({ map: tex.blob(), transparent: true, opacity: 0.55, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.002;
  parent.add(blob);
  rbox(parent, [half * 2, 0.12, half * 2], [0, 0, 0], mat(stone, { map: tex.stone(stone) }), 0.035);
  const inset = top === 'grass' ? tex.grass() : top === 'earth' ? tex.earth() : tex.stone(stone);
  rbox(
    parent,
    [half * 2 - 0.1, 0.04, half * 2 - 0.1],
    [0, 0.1, 0],
    mat(top === 'grass' ? '#ffffff' : top === 'earth' ? '#ffffff' : stone, { map: inset }),
    0.02,
  );
  return 0.14;
}
export function glowSprite(parent: Object3D, at: V3, size: number) {
  const plane = new Mesh(
    new PlaneGeometry(size, size),
    new MeshBasicMaterial({ map: tex.glow(), transparent: true, depthWrite: false }),
  );
  plane.position.set(...at);
  plane.lookAt(new Vector3(at[0] + 1, at[1] + 0.58, at[2] + 1));
  parent.add(plane);
  return plane;
}
export function rng(seed: number) {
  return seeded(seed);
}

/** Renders isometric model sprites into canvases. One WebGL context, released after use. */
export class ModelStudio {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private constructor() {
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    // A 2:1 dimetric view: 45° around, 30° above, matching the map's tiles.
    const elevation = Math.PI / 6;
    const distance = 30;
    this.camera.position.set(
      Math.cos(elevation) * Math.sin(Math.PI / 4) * distance,
      Math.sin(elevation) * distance,
      Math.cos(elevation) * Math.cos(Math.PI / 4) * distance,
    );
    this.camera.lookAt(0, 0, 0);
    // Soft studio reflections give metal, water, and glazed surfaces something to mirror.
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();
    this.scene.add(new HemisphereLight('#fff1d6', '#3e5e2a', 0.6));
    // Warm sun from the upper left of the screen, so left faces glow and right faces fall into shade.
    const sun = new DirectionalLight('#ffe8c0', 2.3);
    sun.position.set(-2.5, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -2.5;
    sun.shadow.camera.right = sun.shadow.camera.top = 2.5;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    const rim = new DirectionalLight('#cfe8ff', 0.55);
    rim.position.set(5, 3, -3);
    this.scene.add(rim);
  }
  static create(): ModelStudio | null {
    try {
      const studio = new ModelStudio();
      return studio.renderer.getContext() ? studio : null;
    } catch {
      return null;
    }
  }
  /** Render a model centred on the origin: a building footprint `size` tiles across, or a frame. */
  render(model: Group, frame: number | Frame): HTMLCanvasElement {
    const f = typeof frame === 'number' ? FRAMES.building(frame) : frame;
    const k = f.scale;
    this.renderer.setSize(f.width * f.supersample, f.height * f.supersample, false);
    this.camera.left = -f.originX / k;
    this.camera.right = (f.width - f.originX) / k;
    this.camera.top = f.originY / k;
    this.camera.bottom = -(f.height - f.originY) / k;
    this.camera.updateProjectionMatrix();
    this.scene.add(model);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(model);
    model.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    for (const material of (model.userData.dispose as Material[] | undefined) ?? [])
      material.dispose();
    return this.renderer.domElement;
  }
  dispose() {
    this.scene.environment?.dispose();
    for (const m of materials.values()) m.dispose();
    materials.clear();
    for (const t of textures.values()) t.dispose();
    textures.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
