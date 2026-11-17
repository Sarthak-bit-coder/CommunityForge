import type { Network } from "@/lib/planning-api";

const PADDING = 28;
const SCALE = 3.2; // SVG units per modeled meter; grid blocks are 25 m.
const NODE_RADIUS = 5;
const MARKER = 9;

/** Schematic of the synthetic network. The repair table beside it carries the same facts. */
export function NetworkDiagram({
  network,
  selected,
}: {
  readonly network: Network;
  readonly selected: readonly string[];
}) {
  const at = new Map(
    network.nodes.map((node) => [
      node.id,
      { x: PADDING + node.x_m * SCALE, y: PADDING + node.y_m * SCALE },
    ]),
  );
  const width = Math.max(...[...at.values()].map((point) => point.x)) + PADDING;
  const height = Math.max(...[...at.values()].map((point) => point.y)) + PADDING + 14;
  const repairOf = new Map(
    network.repairs.flatMap((repair) => repair.barrier_ids.map((id) => [id, repair.id] as const)),
  );
  const barrierOnEdge = new Map(
    network.barriers.flatMap((barrier) =>
      barrier.edge_id ? [[barrier.edge_id, barrier] as const] : [],
    ),
  );
  const origins = new Set(network.origins.map((origin) => origin.node_id));
  const destinations = new Set(network.destinations.map((item) => item.node_id));
  const fixed = network.barriers.filter((b) => selected.includes(repairOf.get(b.id) ?? "")).length;

  return (
    <figure className="rounded-lg border border-line bg-surface p-4">
      <svg
        role="img"
        aria-label={`Schematic of the synthetic network: ${network.nodes.length} corners, ${network.edges.length} segments, ${network.barriers.length} barriers, ${fixed} repaired in this plan. The repair table lists the same information.`}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block max-h-80 w-full text-ink"
      >
        {network.edges.map((edge) => {
          const from = at.get(edge.u);
          const to = at.get(edge.v);
          if (!from || !to) return null;
          const barrier = barrierOnEdge.get(edge.id);
          const repairId = barrier ? repairOf.get(barrier.id) : undefined;
          const isFixed = repairId !== undefined && selected.includes(repairId);
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          return (
            <g key={edge.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="currentColor"
                strokeWidth={barrier && !isFixed ? 2 : 3}
                strokeDasharray={barrier && !isFixed ? "4 5" : undefined}
                opacity={barrier ? 1 : 0.45}
              />
              {barrier ? (
                <g className={isFixed ? "text-success" : "text-warning"}>
                  <rect
                    x={midX - MARKER}
                    y={midY - MARKER}
                    width={MARKER * 2}
                    height={MARKER * 2}
                    rx={isFixed ? MARKER : 2}
                    fill="var(--color-surface)"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <text
                    x={midX}
                    y={midY + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="currentColor"
                  >
                    {isFixed ? "✓" : "✕"}
                  </text>
                  <text
                    x={midX}
                    y={midY - MARKER - 3}
                    textAnchor="middle"
                    fontSize="10"
                    fill="currentColor"
                  >
                    {repairId}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
        {network.nodes.map((node) => {
          const point = at.get(node.id);
          if (!point) return null;
          const letter = origins.has(node.id) ? "H" : destinations.has(node.id) ? "D" : "";
          return (
            <g key={node.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={letter ? NODE_RADIUS + 5 : NODE_RADIUS}
                fill={letter ? "var(--color-accent)" : "currentColor"}
              />
              {letter ? (
                <text
                  x={point.x}
                  y={point.y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--color-surface)"
                >
                  {letter}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-3 text-sm text-muted">
        H marks where modeled trips start (homes), D marks destinations. A dashed segment with ✕ has
        a barrier that stays; a solid segment with ✓ is repaired in this plan. Fictional layout, not
        a map of any real place.
      </figcaption>
    </figure>
  );
}
