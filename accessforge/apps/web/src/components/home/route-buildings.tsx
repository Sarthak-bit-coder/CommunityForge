import type { CSSProperties, ReactNode } from "react";

// Building models for the RouteCompare city, built from CSS 3D faces in board pixels.
// Faces: south (+y) faces the camera most, east second; north and west close the box.

type Faces = {
  readonly south: CSSProperties;
  readonly east: CSSProperties;
  readonly north?: CSSProperties;
  readonly west?: CSSProperties;
  readonly roof: CSSProperties;
};

type BoxProps = {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly faces: Faces;
  readonly south?: ReactNode;
  readonly roof?: ReactNode;
  readonly at?: { readonly x: number; readonly y: number };
};

/** A box standing on the board: four walls and a flat roof. */
export function Box({ w, d, h, faces, south, roof, at = { x: 0, y: 0 } }: BoxProps) {
  return (
    <div
      className="absolute [transform-style:preserve-3d]"
      style={{ left: at.x, top: at.y, width: w, height: d }}
    >
      <span
        className="absolute left-0 origin-bottom overflow-hidden"
        style={{ top: d - h, width: w, height: h, transform: "rotateX(-90deg)", ...faces.south }}
      >
        {south}
      </span>
      <span
        className="absolute top-0 left-0 origin-top"
        style={{ width: w, height: h, transform: "rotateX(90deg)", ...(faces.north ?? faces.east) }}
      />
      <span
        className="absolute top-0 origin-right"
        style={{ left: w - h, width: h, height: d, transform: "rotateY(90deg)", ...faces.east }}
      />
      <span
        className="absolute top-0 left-0 origin-left"
        style={{
          width: h,
          height: d,
          transform: "rotateY(-90deg)",
          ...(faces.west ?? faces.south),
        }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `translateZ(${h}px)`, ...faces.roof }}
      >
        {roof}
      </span>
    </div>
  );
}

// Rows of windows: floors run across the south wall, and up the east wall (rotated 90°).
const windows = (wall: string, glass: string, across: "south" | "east"): CSSProperties => {
  const floors = across === "south" ? "to bottom" : "to right";
  const columns = across === "south" ? "to right" : "to bottom";
  return {
    backgroundColor: glass,
    backgroundImage: `repeating-linear-gradient(${floors}, ${wall} 0 2px, transparent 2px 6px, ${wall} 6px 7px), repeating-linear-gradient(${columns}, ${wall} 0 2px, transparent 2px 6px)`,
  };
};

// Same teal ramp as the live 3D map (BUILDING_RAMP in map-flyover.ts), so the two read as one.
const OFFICE = { wall: "#c4d9d6", shade: "#8db8b2", glass: "#5f8f99", roof: "#e3eaee" } as const;

export function Office({
  w,
  d,
  h,
}: {
  readonly w: number;
  readonly d: number;
  readonly h: number;
}) {
  return (
    <Box
      w={w}
      d={d}
      h={h}
      faces={{
        south: windows(OFFICE.wall, OFFICE.glass, "south"),
        east: windows(OFFICE.shade, OFFICE.glass, "east"),
        roof: { background: OFFICE.roof, boxShadow: `inset 0 0 0 2px ${OFFICE.shade}` },
      }}
      roof={<span className="size-3 rounded-sm bg-[#8db8b2]" />}
    />
  );
}

const HOUSE = {
  wall: "#eef2f4",
  shade: "#c9d3da",
  roof: "#b5533c",
  roofShade: "#8f3f2d",
  door: "#0a6b62",
} as const;
const HOUSE_SIZE = { w: 34, d: 28, h: 12, ridge: 11, overhang: 2 } as const;

/** A one-storey house with a gable roof, a door, and two windows facing the street. */
export function House() {
  const { w, d, h, ridge, overhang } = HOUSE_SIZE;
  const half = d / 2;
  const slope = Math.hypot(half, ridge);
  const pitch = (Math.asin(ridge / slope) * 180) / Math.PI;
  const roofTop = h + ridge;
  return (
    <div className="absolute [transform-style:preserve-3d]" style={{ width: w, height: d }}>
      <Box
        w={w}
        d={d}
        h={h}
        faces={{
          south: { background: HOUSE.wall },
          east: { background: HOUSE.shade },
          roof: { background: "transparent" },
        }}
        south={
          <>
            <span
              className="absolute bottom-0 left-[42%] h-[70%] w-[18%] rounded-t-sm"
              style={{ background: HOUSE.door }}
            />
            <span className="absolute top-[22%] left-[10%] size-[4px] bg-[#5f8f99]" />
            <span className="absolute top-[22%] right-[10%] size-[4px] bg-[#5f8f99]" />
          </>
        }
      />
      {/* Two roof slopes meet at a ridge running east–west; gables close each end. */}
      <span
        className="absolute origin-top"
        style={{
          left: -overhang,
          top: half,
          width: w + overhang * 2,
          height: slope + overhang,
          background: HOUSE.roof,
          transform: `translateZ(${roofTop}px) rotateX(${-pitch}deg)`,
        }}
      />
      <span
        className="absolute origin-bottom"
        style={{
          left: -overhang,
          top: half - slope - overhang,
          width: w + overhang * 2,
          height: slope + overhang,
          background: HOUSE.roofShade,
          transform: `translateZ(${roofTop}px) rotateX(${pitch}deg)`,
        }}
      />
      <span
        className="absolute top-0 left-0 origin-left"
        style={{
          width: ridge,
          height: d,
          background: HOUSE.wall,
          clipPath: "polygon(0 0, 100% 50%, 0 100%)",
          transform: `translateZ(${h}px) rotateY(-90deg)`,
        }}
      />
      <span
        className="absolute top-0 origin-right"
        style={{
          left: w - ridge,
          width: ridge,
          height: d,
          background: HOUSE.shade,
          clipPath: "polygon(100% 0, 0 50%, 100% 100%)",
          transform: `translateZ(${h}px) rotateY(90deg)`,
        }}
      />
    </div>
  );
}

const HOSPITAL = {
  wall: "#f4f7f9",
  shade: "#d5dee4",
  glass: "#4f86a8",
  cross: "#d92d20",
  pad: "#c9d3da",
} as const;
const HOSPITAL_SIZE = { w: 62, d: 50, h: 46 } as const;
const CANOPY = { w: 26, d: 9, h: 7 } as const;
// The entrance sits toward the east end, clear of the barrier at the street corner.
const CANOPY_INSET = 4;

/** Washington Hospital: a white tower with window rows, a red cross, a helipad, and an entrance. */
export function Hospital() {
  const { w, d, h } = HOSPITAL_SIZE;
  return (
    <div className="absolute [transform-style:preserve-3d]" style={{ width: w, height: d }}>
      <Box
        w={w}
        d={d}
        h={h}
        faces={{
          south: windows(HOSPITAL.wall, HOSPITAL.glass, "south"),
          east: windows(HOSPITAL.shade, HOSPITAL.glass, "east"),
          roof: { background: HOSPITAL.wall, boxShadow: `inset 0 0 0 2px ${HOSPITAL.shade}` },
        }}
        south={
          <span className="absolute top-[6%] left-1/2 flex size-[13px] -translate-x-1/2 items-center justify-center rounded-[2px] bg-surface">
            <RedCross size={9} />
          </span>
        }
        roof={
          <span
            className="flex size-[30px] items-center justify-center rounded-full border-2 border-[#d92d20] text-[13px] leading-none font-bold text-[#d92d20]"
            style={{ background: HOSPITAL.pad }}
          >
            H
          </span>
        }
      />
      <Box
        at={{ x: w - CANOPY.w - CANOPY_INSET, y: d }}
        w={CANOPY.w}
        d={CANOPY.d}
        h={CANOPY.h}
        faces={{
          south: { background: HOSPITAL.cross },
          east: { background: "#a8231a" },
          roof: { background: HOSPITAL.wall },
        }}
      />
    </div>
  );
}

function RedCross({ size }: { readonly size: number }) {
  return (
    <svg viewBox="-3 -3 6 6" style={{ width: size, height: size }} aria-hidden="true">
      <path d="M-1 -3 H1 V-1 H3 V1 H1 V3 H-1 V1 H-3 V-1 H-1 Z" fill={HOSPITAL.cross} />
    </svg>
  );
}

const PARK = { grass: "#3f8f86", path: "#8db8b2", bush: "#24635c" } as const;
// Bushes sit clear of the paths and of the crew's truck, which parks on the north path.
const BUSHES = [
  { x: 4, y: 40 },
  { x: 48, y: 40 },
  { x: 50, y: 4 },
] as const;

/** A flat park with crossing paths and low bushes: open ground, so nothing hides what is in front. */
export function Park({ w, d }: { readonly w: number; readonly d: number }) {
  return (
    <div
      className="absolute overflow-hidden rounded-[3px]"
      style={{
        width: w,
        height: d,
        backgroundColor: PARK.grass,
        backgroundImage: `linear-gradient(to right, transparent 46%, ${PARK.path} 46% 54%, transparent 54%), linear-gradient(to bottom, transparent 46%, ${PARK.path} 46% 54%, transparent 54%)`,
      }}
    >
      {BUSHES.map((bush) => (
        <span
          key={`${bush.x}-${bush.y}`}
          className="absolute size-2 rounded-full"
          style={{ left: bush.x, top: bush.y, background: PARK.bush }}
        />
      ))}
    </div>
  );
}
