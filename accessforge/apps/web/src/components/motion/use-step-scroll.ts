"use client";

import { type RefObject, useEffect, useRef } from "react";
import { crossedStage, decideGesture } from "./step-gesture";

// A wheel burst ends after this much quiet. A trackpad swipe and all of its momentum arrive as
// one unbroken stream, so only a pause starts a new gesture; bumps inside the stream never do.
const GESTURE_GAP_MS = 150;
const LINE_PX = 16;
const ARROW_KEY_PX = 40;
const PAGE_KEY_SHARE = 0.9;
// Scrolls this soon after wheel or key input count as the visitor's own scrolling. Scrolls from
// focus moves, links, or the scrollbar never lock the story, so nothing is trapped.
const INPUT_WINDOW_MS = 600;

type StepScrollOptions = {
  readonly trackRef: RefObject<HTMLElement | null>;
  readonly index: number;
  readonly count: number;
  readonly onStep: (index: number) => void;
  readonly onEngage: () => void;
  /** New gestures wait this long after a step starts, so one swipe never plays two steps. */
  readonly stepLockMs: number;
  /** While this returns true a step is still playing, so new gestures wait for it to finish. */
  readonly isBusy?: () => boolean;
  /** Once the last step shows, the story is done: the next gesture either way leaves it, and
   *  it never locks or plays backwards again. */
  readonly isOneWay?: boolean;
};

const NEVER_BUSY = () => false;

// Turns wheel and key input into one story step per gesture while the stage is locked in.
// Scrollbar drags, focus moves, links, and find-in-page scroll normally, so nothing is trapped.
export function useStepScroll({
  trackRef,
  index,
  count,
  onStep,
  onEngage,
  stepLockMs,
  isBusy = NEVER_BUSY,
  isOneWay = false,
}: StepScrollOptions) {
  const latest = useRef({ index, onStep, onEngage, isBusy });
  useEffect(() => {
    latest.current = { index, onStep, onEngage, isBusy };
  });

  useEffect(() => {
    let lastWheelAt = 0;
    let isGestureSpent = false;
    let lockedUntil = 0;
    let lastInputAt = 0;
    let previousY = window.scrollY;
    let isFrozen = false;
    // Set while the page glides out below the story; cleared once the page is free again.
    let isLeaving = false;
    // Set once the visitor plays the story through and leaves it below; it never replays after.
    let hasPlayedThrough = false;
    const root = document.documentElement;

    // While the story is locked in, the page itself cannot scroll. Browsers only let a page block
    // the first wheel event of a trackpad stream, so blocking events alone lets the rest of the
    // stream (and its momentum) carry the page straight past the story. Wheel and key events
    // still arrive while frozen and drive the steps.
    function freeze() {
      if (isFrozen) return;
      isFrozen = true;
      root.style.overflow = "hidden";
    }

    function unfreeze() {
      if (!isFrozen) return;
      isFrozen = false;
      isLeaving = false;
      root.style.overflow = "";
    }

    function stageTopOf(track: HTMLElement): number {
      return track.getBoundingClientRect().top + window.scrollY;
    }

    function engage(stageTop: number) {
      window.scrollTo({ top: stageTop, behavior: "instant" });
      previousY = stageTop;
      isGestureSpent = true;
      freeze();
      latest.current.onEngage();
    }

    function isFinishedOneWay(): boolean {
      return isOneWay && latest.current.index === count - 1;
    }

    // Past either end of the story: give the page its scrolling back. The page was frozen when
    // this input arrived, so the browser will not move it; carry the scroll on here.
    function leave(
      direction: 1 | -1,
      distance: number,
      track: HTMLElement,
      stageTop: number,
    ): boolean {
      if (!isFrozen) return false;
      // Leaving downward past the last step: the page stays frozen while it glides to the
      // content right after the story (scripted scrolling still works on a frozen page), so
      // the swipe that left cannot carry it further.
      if (direction === 1) {
        isLeaving = true;
        hasPlayedThrough = true;
        isGestureSpent = true;
        window.scrollTo({ top: stageTop + track.offsetHeight, behavior: "smooth" });
        return true;
      }
      unfreeze();
      window.scrollBy({ top: direction * distance, behavior: "smooth" });
      return true;
    }

    function act(direction: 1 | -1, distance: number): boolean {
      const track = trackRef.current;
      if (!track) return false;
      // Just left the story downward: the rest of that swipe (and its momentum) is swallowed so
      // the page settles right after the story instead of flying past it. A new gesture frees it.
      if (isLeaving) {
        if (isGestureSpent) return true;
        unfreeze();
        return false;
      }
      // A played-through story stays out of the way: scrolling back over it never locks it.
      if (hasPlayedThrough) return false;
      const stageTop = stageTopOf(track);
      if (isFinishedOneWay()) {
        // The swipe that showed the last step is swallowed; the next gesture leaves.
        if (isFrozen && (isGestureSpent || latest.current.isBusy())) return true;
        hasPlayedThrough = true;
        return leave(direction, distance, track, stageTop);
      }
      const action = decideGesture({
        y: window.scrollY,
        stageTop,
        direction,
        distance,
        index: latest.current.index,
        count,
        isGestureSpent,
        isLocked: performance.now() < lockedUntil || latest.current.isBusy(),
      });
      if (action.kind === "pass") return leave(direction, distance, track, stageTop);
      if (action.kind === "engage") engage(stageTop);
      else if (action.kind === "step") {
        isGestureSpent = true;
        lockedUntil = performance.now() + stepLockMs;
        latest.current.onStep(action.index);
      }
      return true;
    }

    function onWheel(event: WheelEvent) {
      // Pinch-zoom arrives as a ctrl-wheel; horizontal scrolling is not ours.
      if (event.ctrlKey || event.deltaY === 0) return;
      // The event's own timestamp, not the handling time: if the page is busy for a moment,
      // queued events of one swipe must not look like a pause between two swipes.
      if (event.timeStamp - lastWheelAt > GESTURE_GAP_MS) isGestureSpent = false;
      lastWheelAt = event.timeStamp;
      lastInputAt = performance.now();
      if (act(event.deltaY > 0 ? 1 : -1, Math.abs(toPixels(event)))) event.preventDefault();
    }

    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      const move = keyMove(event);
      if (!move) return;
      isGestureSpent = false;
      lastInputAt = performance.now();
      if (act(move.direction, move.distance)) event.preventDefault();
    }

    // The safety net: if the visitor's scrolling carried the page across the stage anyway,
    // pull it back and lock in.
    function onScroll() {
      const track = trackRef.current;
      const y = window.scrollY;
      const isOwnScroll = performance.now() - lastInputAt < INPUT_WINDOW_MS;
      if (track && isOwnScroll && !hasPlayedThrough && !isFinishedOneWay()) {
        const stageTop = stageTopOf(track);
        if (crossedStage(previousY, y, stageTop)) {
          engage(stageTop);
          return;
        }
      }
      previousY = y;
    }

    // Tabbing to anything outside the story releases the page, so keyboard users are never stuck.
    function onFocusIn(event: FocusEvent) {
      const track = trackRef.current;
      if (track && event.target instanceof Node && !track.contains(event.target)) unfreeze();
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    return () => {
      unfreeze();
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [trackRef, count, stepLockMs, isOneWay]);
}

function toPixels(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * LINE_PX;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

function keyMove(event: KeyboardEvent): { direction: 1 | -1; distance: number } | null {
  const page = window.innerHeight * PAGE_KEY_SHARE;
  switch (event.key) {
    case "ArrowDown":
      return { direction: 1, distance: ARROW_KEY_PX };
    case "ArrowUp":
      return { direction: -1, distance: ARROW_KEY_PX };
    case "PageDown":
      return { direction: 1, distance: page };
    case "PageUp":
      return { direction: -1, distance: page };
    case " ":
      return { direction: event.shiftKey ? -1 : 1, distance: page };
    default:
      return null;
  }
}

// Keys in form controls (including the scenario radios) keep their own meaning.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea, select, button, a") !== null;
}
