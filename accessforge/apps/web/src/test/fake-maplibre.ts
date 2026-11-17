import { vi } from "vitest";

// Minimal stand-in for maplibre-gl, which needs WebGL that jsdom lacks. Use via:
// vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));
type MapEvent = { error?: Error; lngLat?: { lat: number; lng: number } };
type Handler = (event: MapEvent) => void;
type LngLatTuple = readonly [number, number];

export const fakeMapControl = { throwOnCreate: false, instances: [] as FakeMap[] };

export function resetFakeMaplibre(): void {
  fakeMapControl.throwOnCreate = false;
  fakeMapControl.instances = [];
}

export class FakeMap {
  readonly container: HTMLElement;
  readonly easeTo = vi.fn();
  readonly fitBounds = vi.fn();
  isRemoved = false;
  private isLoaded = false;
  private center: LngLatTuple;
  private readonly handlers = new Map<string, Handler[]>();

  constructor(options: { container: HTMLElement; center?: LngLatTuple }) {
    if (fakeMapControl.throwOnCreate) throw new Error("WebGL is not supported");
    this.container = options.container;
    this.center = options.center ?? [0, 0];
    fakeMapControl.instances.push(this);
  }

  addControl(): this {
    return this;
  }
  on(type: string, handler: Handler): this {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
    return this;
  }
  once(type: string, handler: Handler): this {
    return this.on(type, handler);
  }
  off(type: string, handler: Handler): this {
    this.handlers.set(
      type,
      (this.handlers.get(type) ?? []).filter((item) => item !== handler),
    );
    return this;
  }
  getCenter(): { lng: number; lat: number } {
    return { lng: this.center[0], lat: this.center[1] };
  }
  loaded(): boolean {
    return this.isLoaded;
  }
  remove(): void {
    this.isRemoved = true;
  }
  emit(type: string, event: MapEvent = {}): void {
    if (type === "load") this.isLoaded = true;
    (this.handlers.get(type) ?? []).forEach((handler) => handler(event));
  }
}

export class Marker {
  private readonly element: HTMLElement;
  private lngLat: LngLatTuple = [0, 0];

  constructor(options: { element: HTMLElement }) {
    this.element = options.element;
  }
  setLngLat(lngLat: LngLatTuple): this {
    this.lngLat = lngLat;
    return this;
  }
  getLngLat(): LngLatTuple {
    return this.lngLat;
  }
  getElement(): HTMLElement {
    return this.element;
  }
  addTo(map: FakeMap): this {
    map.container.append(this.element);
    return this;
  }
  remove(): void {
    this.element.remove();
  }
}

export class NavigationControl {}
export { FakeMap as Map };

export const setWorkerUrl = vi.fn();
