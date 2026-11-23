import {
  animate,
  cancelFrame,
  frame,
  motionValue,
  transformValue,
  type AnimationPlaybackControls,
} from "motion";
import { threeEffect } from "motion/three";
import * as THREE from "three/webgpu";
import { attribute, cos, mix, positionLocal, sin, time, uniform, vec3 } from "three/tsl";
import { GROUND_COLOR } from "./story-pictures";

// A run of pictures as ~26,000 particles. One motion value drives one TSL uniform that morphs
// every particle between its place in the picture (0) and a slowly churning globe (1). Moving to
// the next picture gathers the globe, blends each particle's colour to the next picture, and lets
// it fall back. Adapted from the Motion three.js particle-photo example.

const COLUMNS = 200;
const GOLDEN_ANGLE = 2.39996323;
const GLOBE_TILT = -0.28;
const MAX_PIXEL_RATIO = 2;
const INTRO_DELAY_S = 0.8;
// The crisp picture fades in only once the particles have all but settled into it.
const SETTLE = { start: 0.005, end: 0.035 } as const;
// While gathered, colours blend to the next picture; the crisp overlay swaps once it is hidden.
const BLEND = { delay: 0.2, duration: 0.6 } as const;
const SWAP_AFTER_MS = 750;
// A morph reports done once the particles settle, or after this long at most, so a stopped
// spring can never leave the story waiting (and the page frozen) forever.
const SETTLE_MAX_MS = 1500;
const SPRINGS = {
  settle: { type: "spring", stiffness: 55, damping: 16, mass: 1 },
  gather: { type: "spring", stiffness: 120, damping: 18, mass: 0.9 },
  release: { type: "spring", stiffness: 70, damping: 16, mass: 1 },
} as const;

type Picture = {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
  readonly map: THREE.Texture;
};

const sizeUniform = () => uniform(new THREE.Vector2(0.01, 0.01));
const amountUniform = (start: number) => uniform(start);
type SizeUniform = ReturnType<typeof sizeUniform>;
type AmountUniform = ReturnType<typeof amountUniform>;

type Particles = {
  readonly imageAspect: number;
  readonly rows: number;
  readonly particleSize: SizeUniform;
  readonly object: THREE.Mesh;
  readonly colourFrom: THREE.InstancedBufferAttribute;
  readonly colourTo: THREE.InstancedBufferAttribute;
};

export type ParticleScene = {
  /** Morphs to picture `index`; resolves once the particles have settled into it. */
  readonly goTo: (index: number) => Promise<void>;
  readonly dispose: () => void;
};

function pictureMix(globeAmount: number): number {
  const amount = Math.max(globeAmount, 0);
  const t = Math.min(1, Math.max(0, (amount - SETTLE.start) / (SETTLE.end - SETTLE.start)));
  return 1 - t * t * (3 - 2 * t);
}

function readPicture(source: HTMLCanvasElement): Picture {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is not available");
  const map = new THREE.CanvasTexture(source);
  map.colorSpace = THREE.SRGBColorSpace;
  return {
    width: source.width,
    height: source.height,
    pixels: context.getImageData(0, 0, source.width, source.height).data,
    map,
  };
}

function particleColours(picture: Picture, rows: number): Float32Array {
  const colours = new Float32Array(COLUMNS * rows * 3);
  const colour = new THREE.Color();
  for (let index = 0; index < COLUMNS * rows; index++) {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const sampleX = Math.min(
      picture.width - 1,
      Math.floor(((column + 0.5) / COLUMNS) * picture.width),
    );
    const sampleY = Math.min(picture.height - 1, Math.floor(((row + 0.5) / rows) * picture.height));
    const pixel = (sampleY * picture.width + sampleX) * 4;
    colour.setRGB(
      (picture.pixels[pixel] ?? 0) / 255,
      (picture.pixels[pixel + 1] ?? 0) / 255,
      (picture.pixels[pixel + 2] ?? 0) / 255,
      THREE.SRGBColorSpace,
    );
    colours.set([colour.r, colour.g, colour.b], index * 3);
  }
  return colours;
}

function createParticles(
  first: Float32Array,
  rows: number,
  imageAspect: number,
  uniforms: { readonly globe: AmountUniform; readonly blend: AmountUniform },
  seed: () => number,
): Particles {
  const count = COLUMNS * rows;
  // One small quad per particle, instanced.
  const quad = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(quad.index);
  geometry.setAttribute("position", quad.getAttribute("position"));
  geometry.setAttribute("uv", quad.getAttribute("uv"));
  geometry.instanceCount = count;
  const add = (name: string, data: Float32Array, size: number) => {
    const buffer = new THREE.InstancedBufferAttribute(data, size);
    geometry.setAttribute(name, buffer);
    return buffer;
  };
  add("imagePosition", new Float32Array(count * 3), 3);
  add("globePosition", new Float32Array(count * 3), 3);
  const colourFrom = add("colourFrom", Float32Array.from(first), 3);
  const colourTo = add("colourTo", Float32Array.from(first), 3);
  add(
    "phase",
    Float32Array.from({ length: count }, () => seed() * Math.PI * 2),
    1,
  );
  add(
    "speed",
    Float32Array.from({ length: count }, () => 0.7 + seed() * 0.35),
    1,
  );

  const phase = attribute("phase", "float");
  const speed = attribute("speed", "float");
  const particleSize = sizeUniform();
  // Each particle drifts on its own small loop while in the globe.
  const turbulence = vec3(
    sin(time.mul(speed.add(0.6)).add(phase)).mul(0.045),
    cos(time.mul(speed.add(0.37)).add(phase.mul(1.71))).mul(0.035),
    sin(time.mul(speed.add(0.22)).add(phase.mul(2.13))).mul(0.045),
  );
  const material = new THREE.MeshBasicNodeMaterial({ toneMapped: false });
  material.colorNode = mix(
    attribute("colourFrom", "vec3"),
    attribute("colourTo", "vec3"),
    uniforms.blend,
  );
  const centre = mix(
    attribute("imagePosition", "vec3"),
    attribute("globePosition", "vec3").add(turbulence),
    uniforms.globe,
  );
  material.positionNode = centre.add(vec3(positionLocal.xy.mul(particleSize), 0));
  return {
    imageAspect,
    rows,
    particleSize,
    object: new THREE.Mesh(geometry, material),
    colourFrom,
    colourTo,
  };
}

function createPictureOverlay(
  map: THREE.Texture,
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map,
      toneMapped: false,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0,
    }),
  );
  mesh.renderOrder = 1;
  return mesh;
}

function layout(particles: Particles, overlay: THREE.Mesh, aspect: number, yaw: number): void {
  const { imageAspect, rows, object, particleSize } = particles;
  const halfHeight = Math.min(0.92, (0.98 * aspect) / imageAspect);
  const halfWidth = halfHeight * imageAspect;
  const radius = Math.min(0.62, aspect * 0.82);
  const image = object.geometry.getAttribute("imagePosition");
  const sphere = object.geometry.getAttribute("globePosition");
  const [yawCos, yawSin] = [Math.cos(yaw), Math.sin(yaw)];
  for (let index = 0; index < image.count; index++) {
    const x = ((index % COLUMNS) + 0.5) / COLUMNS;
    const y = (Math.floor(index / COLUMNS) + 0.5) / rows;
    // Fibonacci sphere: every particle gets an evenly spaced place on the globe.
    const sphereY = 1 - (index / Math.max(image.count - 1, 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - sphereY * sphereY));
    const sx = Math.cos(index * GOLDEN_ANGLE) * ring;
    const sz = Math.sin(index * GOLDEN_ANGLE) * ring;
    const spunX = sx * yawCos + sz * yawSin;
    const spunZ = -sx * yawSin + sz * yawCos;
    image.setXYZ(index, (x - 0.5) * halfWidth * 2, (0.5 - y) * halfHeight * 2, 0);
    sphere.setXYZ(
      index,
      spunX * radius,
      (sphereY * Math.cos(GLOBE_TILT) - spunZ * Math.sin(GLOBE_TILT)) * radius,
      (sphereY * Math.sin(GLOBE_TILT) + spunZ * Math.cos(GLOBE_TILT)) * radius,
    );
  }
  image.needsUpdate = true;
  sphere.needsUpdate = true;
  particleSize.value.set(((halfWidth * 2) / COLUMNS) * 1.01, ((halfHeight * 2) / rows) * 1.01);
  overlay.scale.set(halfWidth * 2, halfHeight * 2, 1);
}

type SceneOptions = {
  readonly canvas: HTMLCanvasElement;
  readonly stage: HTMLElement;
  /** Every picture must share the first one's size, so particles keep one grid. */
  readonly pictures: readonly HTMLCanvasElement[];
  readonly isStatic: boolean;
  readonly seed: () => number;
};

/** Starts the scene on the first picture. */
export async function startParticleScene({
  canvas,
  stage,
  pictures,
  isStatic,
  seed,
}: SceneOptions): Promise<ParticleScene> {
  const sources = pictures.map(readPicture);
  const [first] = sources;
  if (!first) throw new Error("The particle scene needs at least one picture");
  if (sources.some((source) => source.width !== first.width || source.height !== first.height)) {
    throw new Error("Every picture in the particle scene must be the same size");
  }
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const imageAspect = first.width / first.height;
  const rows = Math.round(COLUMNS / imageAspect);
  const colours = sources.map((source) => particleColours(source, rows));
  const globe = amountUniform(isStatic ? 0 : 1);
  const blend = amountUniform(1);
  const globeValue = motionValue(isStatic ? 0 : 1);
  const blendValue = motionValue(1);
  const particles = createParticles(
    colours[0] ?? new Float32Array(),
    rows,
    imageAspect,
    { globe, blend },
    seed,
  );
  const overlay = createPictureOverlay(first.map);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  const yaw = seed() * Math.PI * 2;
  scene.background = new THREE.Color(GROUND_COLOR);
  camera.position.z = 4;
  scene.add(particles.object, overlay);

  const resize = () => {
    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const aspect = width / height;
    renderer.setSize(width, height, false);
    Object.assign(camera, { left: -aspect, right: aspect, top: 1, bottom: -1 });
    camera.updateProjectionMatrix();
    layout(particles, overlay, aspect, yaw);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  const stopEffects = [
    threeEffect(globe, { value: globeValue }),
    threeEffect(blend, { value: blendValue }),
    threeEffect(overlay.material, { opacity: transformValue(() => pictureMix(globeValue.get())) }),
  ];
  const running = new Set<AnimationPlaybackControls>();
  const run = (controls: AnimationPlaybackControls) => {
    running.add(controls);
    controls.finished.then(() => running.delete(controls)).catch(() => running.delete(controls));
  };
  const timers = new Set<number>();
  if (!isStatic) run(animate(globeValue, 0, { ...SPRINGS.settle, delay: INTRO_DELAY_S }));
  const render = () => renderer.render(scene, camera);
  frame.render(render, true);

  const showPicture = (index: number) => {
    overlay.material.map = sources[index]?.map ?? first.map;
    overlay.material.needsUpdate = true;
  };

  const goTo = (index: number): Promise<void> => {
    const next = colours[index];
    if (!next) return Promise.resolve();
    particles.colourFrom.array.set(particles.colourTo.array);
    particles.colourTo.array.set(next);
    particles.colourFrom.needsUpdate = true;
    particles.colourTo.needsUpdate = true;
    if (isStatic) {
      blendValue.jump(1);
      showPicture(index);
      return Promise.resolve();
    }
    blendValue.jump(0);
    run(animate(globeValue, 1, SPRINGS.gather));
    run(animate(blendValue, 1, { ...BLEND, ease: "easeInOut" }));
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        showPicture(index);
        const release = animate(globeValue, 0, SPRINGS.release);
        run(release);
        release.finished.then(
          () => resolve(),
          () => resolve(),
        );
        const cap = window.setTimeout(() => {
          timers.delete(cap);
          resolve();
        }, SETTLE_MAX_MS);
        timers.add(cap);
      }, SWAP_AFTER_MS);
      timers.add(timer);
    });
  };

  const dispose = () => {
    cancelFrame(render);
    timers.forEach((timer) => window.clearTimeout(timer));
    running.forEach((controls) => controls.stop());
    stopEffects.forEach((stop) => stop?.());
    observer.disconnect();
    particles.object.geometry.dispose();
    (particles.object.material as THREE.Material).dispose();
    overlay.geometry.dispose();
    overlay.material.dispose();
    sources.forEach((source) => source.map.dispose());
    renderer.dispose();
  };

  return { goTo, dispose };
}
