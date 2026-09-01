"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carrying a workout from one day of a program week to another.
 *
 * Written against pointer events rather than HTML5 drag and drop, which does
 * not fire on touch at all — and rearranging the week because life happened is
 * something people do on a phone, standing in a kitchen, not at a desk.
 *
 * The gesture runs on the grip's own handlers under a pointer capture, rather
 * than on window listeners attached once a drag begins. Capture is what makes
 * that possible: from `setPointerCapture` onwards every event for that pointer
 * goes to the grip wherever the finger travels, so the handlers are already in
 * place before the first move can arrive. Listeners attached by an effect are
 * a render late by construction, and a flick fast enough to beat them would
 * drop a workout into nothing.
 *
 * Drop targets are found by hit-testing the DOM instead of being registered:
 * the calendar tags every movable day with `data-slot-*`, and decides through
 * `canDrop` which of them this particular workout may land on. The rule stays
 * with the calendar; this hook stays a gesture.
 */

/** A day of a program week a workout can be picked up from or dropped onto. */
export interface DragSlot {
  /** The cell's log key — unique per plan, and stable while it moves. */
  key: string;
  /** Program week. Only days of the same week can trade places. */
  week: number;
  /** Day of the program week, 0 = Monday. */
  position: number;
}

export interface WorkoutDrag {
  from: DragSlot;
  /** The workout's name, for the label that follows the pointer. */
  label: string;
  /** Viewport coordinates of the pointer. */
  x: number;
  y: number;
  /** The legal target under the pointer, if any. */
  over: DragSlot | null;
  /** False until the pointer has actually travelled, so a tap is not a drag. */
  moved: boolean;
}

/** Everything the grip that picks a workout up needs to listen for. */
export interface GripProps {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

/** How close to the viewport edge starts scrolling, and how fast it goes. */
const EDGE_BAND = 90;
const EDGE_STEP = 14;
/** Movement before a press counts as a drag rather than a stray wobble. */
const SLOP = 6;

function slotUnder(x: number, y: number): DragSlot | null {
  const element = document.elementFromPoint(x, y);
  const zone =
    element instanceof Element
      ? element.closest<HTMLElement>("[data-slot-key]")
      : null;
  const key = zone?.dataset.slotKey;
  if (!zone || !key) return null;
  const week = Number(zone.dataset.slotWeek);
  const position = Number(zone.dataset.slotPosition);
  if (!Number.isInteger(week) || !Number.isInteger(position)) return null;
  return { key, week, position };
}

/**
 * How fast the page should scroll for a pointer at this height, and which way.
 * Zero anywhere but the bands at the very top and bottom of the viewport.
 */
function edgeSpeed(y: number): number {
  const overTop = y - EDGE_BAND;
  const overBottom = y - (window.innerHeight - EDGE_BAND);
  if (overTop < 0) return Math.max(-EDGE_STEP, overTop / 6);
  if (overBottom > 0) return Math.min(EDGE_STEP, overBottom / 6);
  return 0;
}

export function useWorkoutDrag(
  /**
   * Whether a workout may land on a slot. Asked on every pointer move, so the
   * answer cannot depend on a render having happened first.
   */
  canDrop: (from: DragSlot, to: DragSlot) => boolean,
  onDrop: (from: DragSlot, to: DragSlot) => void
): {
  drag: WorkoutDrag | null;
  /** Spread onto the grip that picks up a given day's workout. */
  gripProps: (from: DragSlot, label: string) => GripProps;
} {
  const [drag, setDrag] = useState<WorkoutDrag | null>(null);
  const dragRef = useRef<WorkoutDrag | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  const canDropRef = useRef(canDrop);
  canDropRef.current = canDrop;

  const write = useCallback((next: WorkoutDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  /*
   * On a phone the week is a single column taller than the screen, so the far
   * end of it is off-screen the moment a drag starts. Nudging the page when
   * the pointer nears an edge is the only way to reach Saturday from Sunday
   * without letting go.
   *
   * The loop runs only while the pointer is actually in one of those bands. A
   * frame callback that reschedules itself for the whole drag keeps the
   * renderer busy from pick-up to drop, which is a lot to ask of a phone in
   * exchange for nothing most of the time.
   */
  const stopEdgeScroll = useCallback(() => {
    if (!frameRef.current) return;
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
  }, []);

  const syncEdgeScroll = useCallback(
    (y: number) => {
      if (edgeSpeed(y) === 0) {
        stopEdgeScroll();
        return;
      }
      if (frameRef.current) return;
      const tick = () => {
        const current = dragRef.current;
        const speed = current?.moved ? edgeSpeed(current.y) : 0;
        if (speed === 0) {
          frameRef.current = 0;
          return;
        }
        window.scrollBy(0, speed);
        frameRef.current = window.requestAnimationFrame(tick);
      };
      frameRef.current = window.requestAnimationFrame(tick);
    },
    [stopEdgeScroll]
  );

  const end = useCallback(
    (drop: boolean) => {
      const current = dragRef.current;
      stopEdgeScroll();
      document.body.style.userSelect = "";
      write(null);
      if (!drop || !current?.moved || !current.over) return;
      dropRef.current(current.from, current.over);
    },
    [stopEdgeScroll, write]
  );

  const gripProps = useCallback(
    (from: DragSlot, label: string): GripProps => ({
      onPointerDown: (event) => {
        // Right and middle clicks belong to the browser.
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        originRef.current = { x: event.clientX, y: event.clientY };
        document.body.style.userSelect = "none";
        write({
          from,
          label,
          x: event.clientX,
          y: event.clientY,
          over: null,
          moved: false,
        });
      },
      onPointerMove: (event) => {
        const current = dragRef.current;
        if (!current || current.from.key !== from.key) return;
        const origin = originRef.current;
        const moved =
          current.moved ||
          Math.abs(event.clientX - origin.x) +
            Math.abs(event.clientY - origin.y) >
            SLOP;
        if (!moved) return;
        syncEdgeScroll(event.clientY);
        const under = slotUnder(event.clientX, event.clientY);
        write({
          ...current,
          moved,
          x: event.clientX,
          y: event.clientY,
          over:
            under && under.key !== from.key && canDropRef.current(from, under)
              ? under
              : null,
        });
      },
      onPointerUp: () => end(true),
      onPointerCancel: () => end(false),
    }),
    [end, syncEdgeScroll, write]
  );

  /*
   * Escape abandons a drag. The cleanup is the other half: a calendar that
   * unmounts mid-gesture must not leave the page scrolling itself or the whole
   * document unselectable.
   */
  const active = drag !== null;
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") end(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stopEdgeScroll();
      document.body.style.userSelect = "";
    };
  }, [active, end, stopEdgeScroll]);

  return { drag, gripProps };
}
