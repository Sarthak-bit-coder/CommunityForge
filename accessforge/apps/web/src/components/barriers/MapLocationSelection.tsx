"use client";

import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { animate } from "motion";
import { useEffect, useEffectEvent } from "react";
import { MOTION_DURATION_S, MOTION_EASE_ENTER } from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import type { LngLat } from "@/lib/barriers";

const PIN_DROP_PX = 16;

type Props = {
  readonly map: MapLibreMap;
  readonly MarkerClass: typeof Marker;
  readonly location: LngLat | null;
  readonly onSelect: (location: LngLat) => void;
};

export function MapLocationSelection({ map, MarkerClass, location, onSelect }: Props) {
  const select = useEffectEvent((point: LngLat) => onSelect({ lat: point.lat, lng: point.lng }));
  useEffect(() => {
    const choose = (event: { lngLat: LngLat }) => select(event.lngLat);
    map.on("click", choose);
    return () => {
      map.off("click", choose);
    };
  }, [map]);
  const reduceMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (!location) return;
    // MapLibre owns the outer element's transform for positioning, so the drop moves an inner pin.
    const element = document.createElement("div");
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "Selected report location");
    const pin = document.createElement("span");
    pin.className =
      "flex size-11 items-center justify-center rounded-full border-2 border-ink bg-surface text-2xl font-bold text-ink";
    pin.textContent = "+";
    element.append(pin);
    const marker = new MarkerClass({ element }).setLngLat([location.lng, location.lat]).addTo(map);
    // One drop per chosen point; under reduced motion the pin is simply there.
    const drop = reduceMotion
      ? null
      : animate(
          pin,
          { y: [-PIN_DROP_PX, 0], opacity: [0, 1] },
          { duration: MOTION_DURATION_S.interactive, ease: MOTION_EASE_ENTER },
        );
    return () => {
      drop?.stop();
      marker.remove();
    };
  }, [map, MarkerClass, location, reduceMotion]);
  return (
    <button
      type="button"
      className="absolute bottom-3 left-3 min-h-11 rounded-md border border-accent bg-surface px-4 font-medium text-accent shadow"
      onClick={() => onSelect(map.getCenter())}
    >
      Use map center
    </button>
  );
}
