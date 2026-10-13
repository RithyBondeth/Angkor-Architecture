import type { Container } from 'pixi.js';

export class Camera {
  zoom = 0.72;
  private dragging = false;
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
  ) {
    const options = { signal: this.abort.signal };
    surface.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0 && e.button !== 1) return;
        this.dragging = true;
        this.moved = false;
        this.pointer = e.pointerId;
        this.lastX = this.downX = e.clientX;
        this.lastY = this.downY = e.clientY;
        surface.setPointerCapture(e.pointerId);
      },
      options,
    );
    surface.addEventListener(
      'pointermove',
      (e) => {
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
        if (!this.dragging) return;
        this.dragging = false;
        if (!this.moved) {
          const rect = surface.getBoundingClientRect();
          this.onClick(e.clientX - rect.left, e.clientY - rect.top);
        }
        if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId);
        this.pointer = null;
      },
      options,
    );
    surface.addEventListener(
      'pointercancel',
      () => {
        this.dragging = false;
        this.pointer = null;
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
  reset() {
    const width = this.surface.clientWidth;
    const height = this.surface.clientHeight;
    this.zoom = Math.max(0.42, Math.min(0.88, width / 1470));
    this.world.scale.set(this.zoom);
    this.world.position.set(width * 0.44, (height - 190) * 0.5 - 540 * this.zoom);
    this.onZoom(this.zoom);
  }
  setZoom(zoom: number, x = this.surface.clientWidth * 0.45, y = this.surface.clientHeight * 0.45) {
    const next = Math.max(0.3, Math.min(1.6, zoom));
    this.world.x = x - (x - this.world.x) * (next / this.zoom);
    this.world.y = y - (y - this.world.y) * (next / this.zoom);
    this.zoom = next;
    this.world.scale.set(next);
    this.clamp();
    this.onZoom(next);
  }
  pan(dx: number, dy: number) {
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
    if (this.pointer !== null && this.surface.hasPointerCapture(this.pointer))
      this.surface.releasePointerCapture(this.pointer);
    this.abort.abort();
  }
}
