import { describe, expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { Camera } from '../src/rendering/Camera';

function cameraFixture(building = true) {
  const surface = new EventTarget() as HTMLElement;
  const captured = new Set<number>();
  Object.assign(surface, {
    clientWidth: 1000,
    clientHeight: 700,
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  });
  const world = {
    x: 0,
    y: 0,
    scale: { set: vi.fn() },
    position: { set: vi.fn() },
  } as unknown as Container;
  const gesture = { start: vi.fn(() => building), move: vi.fn(), end: vi.fn(), cancel: vi.fn() };
  const click = vi.fn();
  const camera = new Camera(world, surface, click, vi.fn(), vi.fn(), gesture);
  const pointer = (type: string, x = 100, y = 100, id = 1, button = 0) =>
    surface.dispatchEvent(
      Object.assign(new Event(type), { clientX: x, clientY: y, pointerId: id, button }),
    );
  return { camera, world, gesture, click, pointer, captured };
}

describe('camera build gestures', () => {
  it('previews a primary drag without panning and commits only once on release', () => {
    const f = cameraFixture();
    f.pointer('pointerdown');
    f.pointer('pointermove', 200, 150);
    expect(f.world.x).toBe(0);
    expect(f.gesture.move).toHaveBeenCalledWith(190, 130);
    expect(f.gesture.end).not.toHaveBeenCalled();
    f.pointer('pointerup', 200, 150);
    f.pointer('pointerup', 200, 150);
    expect(f.gesture.end).toHaveBeenCalledExactlyOnceWith(190, 130);
    expect(f.click).not.toHaveBeenCalled();
    expect(f.captured.size).toBe(0);
    f.camera.destroy();
  });

  it.each(['pointercancel', 'lostpointercapture', 'escape', 'zoom', 'pan', 'reset', 'destroy'])(
    'cancels without building on %s',
    (action) => {
      const f = cameraFixture();
      f.pointer('pointerdown');
      if (action === 'escape') f.camera.cancelGesture();
      else if (action === 'zoom') f.camera.setZoom(1);
      else if (action === 'pan') f.camera.pan(10, 0);
      else if (action === 'reset') f.camera.reset();
      else if (action === 'destroy') f.camera.destroy();
      else f.pointer(action);
      f.pointer('pointerup');
      expect(f.gesture.cancel).toHaveBeenCalledTimes(1);
      expect(f.gesture.end).not.toHaveBeenCalled();
      expect(f.click).not.toHaveBeenCalled();
      expect(f.captured.size).toBe(0);
      f.camera.destroy();
    },
  );

  it('keeps middle-drag panning and ordinary selection/panning intact', () => {
    const f = cameraFixture();
    f.pointer('pointerdown', 100, 100, 1, 1);
    f.pointer('pointermove', 140, 130, 1, 1);
    f.pointer('pointerup', 140, 130, 1, 1);
    expect(f.world.x).toBe(40);
    expect(f.world.y).toBe(30);
    expect(f.gesture.start).not.toHaveBeenCalled();
    expect(f.gesture.end).not.toHaveBeenCalled();
    f.camera.destroy();
    const normal = cameraFixture(false);
    normal.pointer('pointerdown');
    normal.pointer('pointerup');
    expect(normal.click).toHaveBeenCalledOnce();
    normal.pointer('pointerdown');
    normal.pointer('pointermove', 150, 150);
    normal.pointer('pointerup', 150, 150);
    expect(normal.click).toHaveBeenCalledOnce();
    expect(normal.world.x).toBe(50);
    normal.camera.destroy();
  });

  it('ignores another finger and supports a single-tile tap', () => {
    const f = cameraFixture();
    f.pointer('pointerdown');
    f.pointer('pointerdown', 200, 200, 2);
    f.pointer('pointermove', 200, 200, 2);
    f.pointer('pointercancel', 200, 200, 2);
    f.pointer('pointerup', 200, 200, 2);
    expect(f.gesture.move).not.toHaveBeenCalled();
    expect(f.gesture.end).not.toHaveBeenCalled();
    expect(f.gesture.cancel).not.toHaveBeenCalled();
    f.pointer('pointerup');
    expect(f.gesture.start).toHaveBeenCalledExactlyOnceWith(90, 80);
    expect(f.gesture.end).toHaveBeenCalledExactlyOnceWith(90, 80);
    f.camera.destroy();
  });
});
