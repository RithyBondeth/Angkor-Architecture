import type { Container } from 'pixi.js';

export interface BuildGesture {
  start(x: number, y: number): boolean;
  move(x: number, y: number): void;
  end(x: number, y: number): void;
  cancel(): void;
}

export class Camera {
  zoom = 0.72;
  private dragging = false;
  private building = false;
  private primary = true;
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  private downX = 0;
  private downY = 0;
  private pointer: number | null = null;
  private readonly abort = new AbortController();
  constructor(
    private readonly world: Container,
    private readonly surface: HTMLElement,
    private readonly onClick: (x: number, y: number) => void,
    private readonly onMove: (x: number, y: number) => void,
    private readonly onZoom: (zoom: number) => void,
    private readonly buildGesture?: BuildGesture,
  ) {
    const options = { signal: this.abort.signal };
    surface.addEventListener(
      'pointerdown',
      (e) => {
        if ((e.button !== 0 && e.button !== 1) || this.pointer !== null) return;
        this.dragging = true;
        this.moved = false;
        this.pointer = e.pointerId;
        this.lastX = this.downX = e.clientX;
        this.lastY = this.downY = e.clientY;
        this.primary = e.button === 0;
        const rect = surface.getBoundingClientRect();
        this.building =
          this.primary && !!this.buildGesture?.start(e.clientX - rect.left, e.clientY - rect.top);
        surface.setPointerCapture(e.pointerId);
      },
      options,
    );
    surface.addEventListener(
      'pointermove',
      (e) => {
        if (this.pointer !== null && e.pointerId !== this.pointer) return;
        if (this.building) {
          const rect = surface.getBoundingClientRect();
          this.buildGesture?.move(e.clientX - rect.left, e.clientY - rect.top);
          return;
        }
        if (this.dragging) {
          if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 5) this.moved = true;
          if (this.moved) {
            this.world.x += e.clientX - this.lastX;
            this.world.y += e.clientY - this.lastY;
            this.clamp();
          }
          this.lastX = e.clientX;
          this.lastY = e.clientY;
        }
        const rect = surface.getBoundingClientRect();
        this.onMove(e.clientX - rect.left, e.clientY - rect.top);
      },
      options,
    );
    surface.addEventListener(
      'pointerup',
      (e) => {
        if (!this.dragging || e.pointerId !== this.pointer) return;
        const building = this.building;
        this.building = false;
        this.dragging = false;
        this.pointer = null;
        if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId);
        const rect = surface.getBoundingClientRect();
        if (building) this.buildGesture?.end(e.clientX - rect.left, e.clientY - rect.top);
        else if (!this.moved && this.primary)
          this.onClick(e.clientX - rect.left, e.clientY - rect.top);
      },
      options,
    );
    for (const event of ['pointercancel', 'lostpointercapture'])
      surface.addEventListener(
        event,
        (e) => {
          if ((e as PointerEvent).pointerId === this.pointer) this.cancelGesture();
        },
        options,
      );
    surface.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = surface.getBoundingClientRect();
        this.setZoom(
          this.zoom * Math.exp(-e.deltaY * 0.001),
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
      },
      { ...options, passive: false },
    );
  }
  cancelGesture() {
    const pointer = this.pointer;
    const building = this.building;
    this.pointer = null;
    this.dragging = false;
    this.building = false;
    if (pointer !== null && this.surface.hasPointerCapture(pointer))
      this.surface.releasePointerCapture(pointer);
    if (building) this.buildGesture?.cancel();
  }
  reset() {
    this.cancelGesture();
    const width = this.surface.clientWidth;
    const height = this.surface.clientHeight;
    this.zoom = Math.max(0.48, Math.min(1.05, width / 1260));
    this.world.scale.set(this.zoom);
    const focusX = width > 900 ? (width - 270) * 0.5 : width * 0.5;
    const focusY = (height - 80) * 0.5;
    this.world.position.set(focusX, focusY - 540 * this.zoom);
    this.onZoom(this.zoom);
  }
  setZoom(zoom: number, x = this.surface.clientWidth * 0.45, y = this.surface.clientHeight * 0.45) {
    this.cancelGesture();
    const next = Math.max(0.3, Math.min(1.6, zoom));
    this.world.x = x - (x - this.world.x) * (next / this.zoom);
    this.world.y = y - (y - this.world.y) * (next / this.zoom);
    this.zoom = next;
    this.world.scale.set(next);
    this.clamp();
    this.onZoom(next);
  }
  pan(dx: number, dy: number) {
    this.cancelGesture();
    this.world.x += dx;
    this.world.y += dy;
    this.clamp();
  }
  private clamp() {
    this.world.x = Math.max(
      -1100 * this.zoom,
      Math.min(this.surface.clientWidth + 1100 * this.zoom, this.world.x),
    );
    this.world.y = Math.max(-1100 * this.zoom, Math.min(this.surface.clientHeight, this.world.y));
  }
  destroy() {
    this.cancelGesture();
    this.abort.abort();
  }
}
