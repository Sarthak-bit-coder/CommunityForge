// The illustrated scenes of the planner's opening story, drawn for the particle scene to sample.
// One side-on street, drawn flat with no outlines: each particle samples a ~6 px cell, so shapes
// stay large and colours carry the meaning, backed by the caption text beside the picture.

export const IMAGE = { width: 1200, height: 800 } as const;
export const GROUND_COLOR = "#f2f4f7";

type Context = CanvasRenderingContext2D;
type Point = readonly [number, number];

const C = {
  sky: "#e7eef5",
  skyline: "#d3dde7",
  sidewalk: "#cdd5dd",
  sidewalkTop: "#e4e9ee",
  curbFace: "#97a3af",
  road: "#3d4957",
  trunk: "#7a5a3c",
  leaf: "#5c9a6b",
  leafDark: "#4a855a",
  wall: "#ffffff",
  wallShade: "#e3e9ef",
  glass: "#8db3cb",
  door: "#5f8fad",
  red: "#d92d20",
  ink: "#16273c",
  navy: "#1f3b5c",
  frame: "#55657a",
  shirt: "#0f766e",
  skin: "#c98b5f",
  hair: "#2b2118",
  teal: "#0f766e",
  amber: "#f2a516",
  cone: "#f97316",
} as const;

// Street layout shared by every scene, in image pixels.
const CURB_Y = 520;
const ROAD = { left: 470, right: 730, top: 600 } as const;
const HOSPITAL = { x: 905, y: 170, w: 270, h: CURB_Y - 170 } as const;
const DOOR = { w: 84, h: 112 } as const;
const RIDER = { start: 230, atCurb: 380, arrived: 780 } as const;
const RAMP_RUN = 70;
const ROUTE_Y = 330;

function newPicture(): [HTMLCanvasElement, Context] {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE.width;
  canvas.height = IMAGE.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");
  context.fillStyle = GROUND_COLOR;
  context.fillRect(0, 0, IMAGE.width, IMAGE.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  return [canvas, context];
}

function trace(context: Context, points: readonly Point[]) {
  context.beginPath();
  points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
}

function line(context: Context, points: readonly Point[], width: number, color: string) {
  trace(context, points);
  context.lineWidth = width;
  context.strokeStyle = color;
  context.stroke();
}

function polygon(context: Context, points: readonly Point[], color: string) {
  trace(context, points);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function disc(context: Context, x: number, y: number, radius: number, color: string) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function block(context: Context, x: number, y: number, w: number, h: number, color: string) {
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(x, y, w, h, Math.min(8, w / 4, h / 4));
  context.fill();
}

/** Sky, a far skyline, two raised sidewalks and the road between them. */
function drawStreet(context: Context) {
  context.fillStyle = C.sky;
  context.fillRect(0, 0, IMAGE.width, CURB_Y);
  const skyline: readonly (readonly [number, number, number])[] = [
    [0, 90, 210],
    [100, 120, 300],
    [240, 80, 170],
    [330, 140, 260],
    [500, 110, 330],
    [630, 120, 220],
    [760, 100, 280],
  ];
  context.fillStyle = C.skyline;
  for (const [x, w, h] of skyline) context.fillRect(x, CURB_Y - h, w, h);

  context.fillStyle = C.road;
  context.fillRect(ROAD.left, ROAD.top, ROAD.right - ROAD.left, IMAGE.height - ROAD.top);
  for (const [x, w] of [
    [0, ROAD.left],
    [ROAD.right, IMAGE.width - ROAD.right],
  ] as const) {
    context.fillStyle = C.sidewalk;
    context.fillRect(x, CURB_Y, w, IMAGE.height - CURB_Y);
    context.fillStyle = C.sidewalkTop;
    context.fillRect(x, CURB_Y, w, 14);
  }
  context.fillStyle = C.curbFace;
  context.fillRect(ROAD.left - 6, CURB_Y, 12, ROAD.top - CURB_Y);
  context.fillRect(ROAD.right - 6, CURB_Y, 12, ROAD.top - CURB_Y);
}

/** A street tree on the near sidewalk, so the street reads as a street. */
function drawStreetLife(context: Context) {
  block(context, 82, CURB_Y - 120, 20, 120, C.trunk);
  disc(context, 92, CURB_Y - 170, 62, C.leafDark);
  disc(context, 62, CURB_Y - 150, 44, C.leaf);
  disc(context, 120, CURB_Y - 196, 42, C.leaf);
}

/** Washington Hospital: a white block with window bands, a red cross and a canopied entrance. */
function drawHospital(context: Context) {
  const { x, y, w, h } = HOSPITAL;
  context.fillStyle = C.wall;
  context.fillRect(x, y, w, h);
  context.fillStyle = C.wallShade;
  context.fillRect(x, y, w, 20);
  context.fillRect(x + w - 26, y + 20, 26, h - 20);
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 4; column++) {
      block(context, x + 26 + column * 56, y + 104 + row * 62, 38, 38, C.glass);
    }
  }
  const signX = x + 46;
  block(context, signX - 16, y + 40, 32, 48, C.red);
  block(context, signX - 26, y + 50, 52, 28, C.red);
  context.fillStyle = C.ink;
  context.font = "bold 28px sans-serif";
  context.textBaseline = "middle";
  context.fillText("HOSPITAL", x + 84, y + 66);
  const doorX = x + (w - 26 - DOOR.w) / 2;
  block(context, doorX, CURB_Y - DOOR.h, DOOR.w, DOOR.h, C.door);
  context.fillStyle = C.wall;
  context.fillRect(doorX + DOOR.w / 2 - 2, CURB_Y - DOOR.h, 4, DOOR.h);
  block(context, doorX - 30, CURB_Y - DOOR.h - 26, DOOR.w + 60, 20, C.red);
}

/** A person seated in a wheelchair, facing right, wheels resting on `groundY`. */
function drawRider(context: Context, x: number, groundY: number) {
  const g = groundY;
  line(
    context,
    [
      [x - 34, g - 150],
      [x - 16, g - 74],
      [x + 50, g - 74],
      [x + 70, g - 16],
    ],
    8,
    C.frame,
  );
  context.beginPath();
  context.arc(x - 6, g - 54, 50, 0, Math.PI * 2);
  context.lineWidth = 12;
  context.strokeStyle = C.navy;
  context.stroke();
  disc(context, x - 6, g - 54, 7, C.frame);
  disc(context, x + 72, g - 10, 10, C.navy);
  line(
    context,
    [
      [x - 4, g - 84],
      [x + 46, g - 86],
      [x + 56, g - 26],
    ],
    22,
    C.navy,
  );
  block(context, x + 50, g - 30, 30, 14, C.ink);
  line(
    context,
    [
      [x - 8, g - 86],
      [x + 2, g - 150],
    ],
    36,
    C.shirt,
  );
  line(
    context,
    [
      [x + 4, g - 142],
      [x + 30, g - 108],
      [x + 22, g - 80],
    ],
    14,
    C.shirt,
  );
  disc(context, x + 22, g - 78, 8, C.skin);
  disc(context, x + 8, g - 190, 25, C.skin);
  context.beginPath();
  context.arc(x + 6, g - 196, 25, Math.PI * 0.95, Math.PI * 2.05);
  context.fillStyle = C.hair;
  context.fill();
}

/** A dotted route arching from the rider over the road to the hospital entrance canopy. */
function drawPlannedRoute(context: Context, fromX: number, toX: number, color: string) {
  context.setLineDash([2, 26]);
  context.beginPath();
  context.moveTo(fromX, ROUTE_Y + 40);
  context.quadraticCurveTo((fromX + toX) / 2, ROUTE_Y - 120, toX, ROUTE_Y + 40);
  context.lineWidth = 14;
  context.strokeStyle = color;
  context.stroke();
  context.setLineDash([]);
}

function doorX(): number {
  return HOSPITAL.x + (HOSPITAL.w - 26) / 2;
}

/** A sloped ramp from the sidewalk down to the road at the curb at `curbX`. */
function drawRamp(context: Context, curbX: number, direction: 1 | -1, color: string) {
  polygon(
    context,
    [
      [curbX - 6 * direction, CURB_Y],
      [curbX + RAMP_RUN * direction, ROAD.top],
      [curbX - 6 * direction, ROAD.top],
    ],
    color,
  );
}

function badge(context: Context, x: number, y: number, label: string, color: string) {
  block(context, x - 58, y - 38, 116, 76, color);
  context.fillStyle = C.wall;
  context.font = "bold 52px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x, y + 2);
  context.textAlign = "start";
}

function drawCone(context: Context, x: number) {
  polygon(
    context,
    [
      [x - 8, CURB_Y - 74],
      [x + 8, CURB_Y - 74],
      [x + 24, CURB_Y - 6],
      [x - 24, CURB_Y - 6],
    ],
    C.cone,
  );
  context.fillStyle = C.wall;
  context.fillRect(x - 15, CURB_Y - 46, 30, 10);
  block(context, x - 30, CURB_Y - 10, 60, 10, C.cone);
}

function baseScene(): [HTMLCanvasElement, Context] {
  const [canvas, context] = newPicture();
  drawStreet(context);
  drawStreetLife(context);
  drawHospital(context);
  return [canvas, context];
}

/** Scene 1: the trip ahead, from the sidewalk to the hospital across the street. */
export function drawTripScene(): HTMLCanvasElement {
  const [canvas, context] = baseScene();
  drawPlannedRoute(context, RIDER.start + 60, doorX(), C.teal);
  drawRider(context, RIDER.start, CURB_Y);
  return canvas;
}

/** Scene 2: the curb has no ramp; the wheelchair cannot go on. */
export function drawBlockedScene(): HTMLCanvasElement {
  const [canvas, context] = baseScene();
  drawRider(context, RIDER.atCurb, CURB_Y);
  context.fillStyle = C.red;
  context.fillRect(ROAD.left - 12, CURB_Y, 24, ROAD.top - CURB_Y);
  const x = ROAD.left + 40;
  const y = 380;
  disc(context, x, y, 46, C.red);
  line(
    context,
    [
      [x - 18, y - 18],
      [x + 18, y + 18],
    ],
    12,
    C.wall,
  );
  line(
    context,
    [
      [x + 18, y - 18],
      [x - 18, y + 18],
    ],
    12,
    C.wall,
  );
  return canvas;
}

/** Scene 3: the planner ranks this ramp first; cones mark where it will be built. */
export function drawRepairScene(): HTMLCanvasElement {
  const [canvas, context] = baseScene();
  drawRider(context, RIDER.start, CURB_Y);
  context.setLineDash([16, 12]);
  trace(context, [
    [ROAD.left - 6, CURB_Y],
    [ROAD.left + RAMP_RUN, ROAD.top],
    [ROAD.left - 6, ROAD.top],
  ]);
  context.closePath();
  context.lineWidth = 8;
  context.strokeStyle = C.amber;
  context.stroke();
  context.setLineDash([]);
  drawCone(context, ROAD.left - 60);
  drawCone(context, ROAD.right + 60);
  badge(context, ROAD.left + 40, 380, "#1", C.teal);
  return canvas;
}

/** Scene 4: ramps at both curbs; the rider has crossed and reached the hospital. */
export function drawOpenScene(): HTMLCanvasElement {
  const [canvas, context] = baseScene();
  drawRamp(context, ROAD.left, 1, C.teal);
  drawRamp(context, ROAD.right, -1, C.teal);
  line(
    context,
    [
      [RIDER.start, CURB_Y - 4],
      [ROAD.left - 6, CURB_Y - 4],
      [ROAD.left + RAMP_RUN, ROAD.top - 4],
      [ROAD.right - RAMP_RUN, ROAD.top - 4],
      [ROAD.right + 6, CURB_Y - 4],
      [RIDER.arrived - 60, CURB_Y - 4],
    ],
    10,
    C.amber,
  );
  drawRider(context, RIDER.arrived, CURB_Y);
  return canvas;
}
