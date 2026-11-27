import { vi } from "vitest";

// Minimal stand-in for maplibre-gl, which needs WebGL that jsdom lacks. Use via:
// vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));
type MapEvent = { error?: Error; lngLat?: { lat: number; lng: number } };
type Handler = (event: MapEvent) => void;
type LngLatTuple = readonly [number, number];
type MapOptions = {
  container: HTMLElement;
  center?: LngLatTuple;
  zoom?: number;
  pitch?: number;
  style?: unknown;
};

export const fakeMapControl = { throwOnCreate: false, instances: [] as FakeMap[] };

export function resetFakeMaplibre(): void {
  fakeMapControl.throwOnCreate = false;
  fakeMapControl.instances = [];
}

export class FakeMap {
  readonly container: HTMLElement;
  readonly easeTo = vi.fn();
  readonly fitBounds = vi.fn();
  readonly setMaxBounds = vi.fn();
  readonly isMoving = vi.fn(() => false);
  readonly streets = { setData: vi.fn() };
  readonly addSource = vi.fn();
  readonly addLayer = vi.fn();
  readonly jumpTo = vi.fn();
  readonly flyTo = vi.fn();
  readonly setPaintProperty = vi.fn();
  readonly setSky = vi.fn();
  readonly setLight = vi.fn();
  readonly getLayer = vi.fn(() => undefined);
  /** Layers in the loaded basemap style; tests add a building layer to exercise 3D buildings. */
  styleLayers: { id: string; type?: string; source?: string; "source-layer"?: string }[] = [];
  getStyle(): {
    layers: { id: string; type?: string; source?: string; "source-layer"?: string }[];
  } {
    return { layers: this.styleLayers };
  }
  readonly options: MapOptions;
  isRemoved = false;
  private isLoaded = false;
  private center: LngLatTuple;
  private readonly handlers = new Map<string, Handler[]>();

  constructor(options: MapOptions) {
    if (fakeMapControl.throwOnCreate) throw new Error("WebGL is not supported");
    this.options = options;
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
  getSource(id: string): { setData: (data: unknown) => void } | undefined {
    return id === "streets" ? this.streets : undefined;
  }
  getCenter(): { lng: number; lat: number } {
    return { lng: this.center[0], lat: this.center[1] };
  }
  getZoom(): number {
    return 13;
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
    // Like the real Marker: this class is what positions the element on the map.
    this.element.classList.add("maplibregl-marker");
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
