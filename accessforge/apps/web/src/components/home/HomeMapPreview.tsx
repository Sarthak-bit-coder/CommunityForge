"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarrierMap } from "@/components/barriers/BarrierMap";
import { MotionLink } from "@/components/motion/MotionLink";
import { NO_FILTER, type Barrier } from "@/lib/barriers";
import { fetchReports, reportBarrier } from "@/lib/reports-api";

type Preview =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly barriers: readonly Barrier[]; readonly total: number }
  | { readonly status: "error" };

type HomeMapPreviewProps = {
  /** Height of the map itself; the key and summary sit below it. */
  readonly mapClassName?: string;
  readonly isWheelZoomOff?: boolean;
};

// The same real basemap as /barriers, with the latest submitted reports. Details live there.
export function HomeMapPreview({
  mapClassName = "h-80 sm:h-[26rem]",
  isWheelZoomOff = false,
}: HomeMapPreviewProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchReports(NO_FILTER, 1, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setPreview({
          status: "ready",
          barriers: response.data.map(reportBarrier),
          total: response.meta.total,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreview({ status: "error" });
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <BarrierMap
        barriers={preview.status === "ready" ? preview.barriers : []}
        selectedId={null}
        onSelect={() => router.push("/barriers")}
        className={mapClassName}
        isFlyover
        isWheelZoomOff={isWheelZoomOff}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted">
          {summary(preview)}
        </p>
        <MotionLink href="/barriers" className="af-link">
          Open the barrier map
        </MotionLink>
      </div>
    </div>
  );
}

function summary(preview: Preview): string {
  if (preview.status === "loading") return "Loading submitted reports…";
  if (preview.status === "error") return "Reports could not be loaded. The map still works.";
  if (preview.total === 0) return "No barriers reported yet.";
  const noun = preview.total === 1 ? "report" : "reports";
  return `Showing ${preview.barriers.length} of ${preview.total} submitted ${noun}. Unverified until reviewed.`;
}
