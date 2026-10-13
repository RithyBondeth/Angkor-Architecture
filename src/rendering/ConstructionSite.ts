import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { BUILDINGS } from '../data/buildings';
import type { Building } from '../core/types';
import type { TextureAtlas } from './TextureAtlas';

export function constructionSite(building: Building, atlas: TextureAtlas) {
  const size = BUILDINGS[building.kind].size;
  const w = size * 36 - 3,
    h = size * 18 - 2;
  const view = new Container();
  const frame = new Graphics()
    .poly([0, -h, w, 0, 0, h, -w, 0])
    .fill({ color: 0xa99b68, alpha: 0.25 })
    .stroke({ color: 0xd7b878, width: 2 });
  const corners = [
    [0, -h],
    [w, 0],
    [0, h],
    [-w, 0],
  ];
  for (const [x, y] of corners)
    frame
      .moveTo(x!, y!)
      .lineTo(x!, y! - 20)
      .stroke({ color: 0x94794e, width: 3 });
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!,
      b = corners[(i + 1) % 4]!;
    frame
      .moveTo(a[0]!, a[1]! - 16)
      .lineTo(b[0]!, b[1]! - 16)
      .stroke({ color: 0xb99b60, width: 2 });
  }
  frame.roundRect(-36, h + 19, 72, 19, 4).fill({ color: 0x3b513a, alpha: 0.95 });
  view.addChild(frame);
  const label = new Text({
    text: '0%',
    style: { fontFamily: 'DM Sans', fontSize: 10, fill: 0xf6edcc },
  });
  label.anchor.set(0.5);
  label.position.set(0, h + 29);
  view.addChild(label);
  const workers = Array.from({ length: 4 }, (_, i) => {
    const worker = new Sprite(atlas.get('worker'));
    worker.anchor.set(0.5, 0.9);
    worker.scale.set(0.6);
    worker.position.set(
      (i % 2 ? 1 : -1) * (18 + Math.floor(i / 2) * 22),
      h - Math.floor(i / 2) * 10,
    );
    view.addChild(worker);
    return worker;
  });
  return { view, label, workers };
}
