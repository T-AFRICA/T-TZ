"use client";

import { useEffect, useRef } from "react";

export interface Tilt3DProps {
  children: React.ReactNode;
  /** Classes for the outer (perspective) element, e.g. "absolute inset-0". */
  className?: string;
  /** Maximum tilt in degrees on each axis. */
  maxTilt?: number;
}

/**
 * Pointer-following 3D tilt with a cursor-tracking sheen, used to give
 * product imagery a tactile hover feel until real 360° photography exists.
 * Mouse-only by design (no effect for touch/pen), inert under
 * prefers-reduced-motion, and purely decorative — content and hit targets
 * are unchanged.
 */
// Cached lazily on first pointer move (client-only code path), instead of
// constructing a MediaQueryList on every mousemove across every card.
let reducedMotionQuery: MediaQueryList | null = null;

function prefersReducedMotion(): boolean {
  reducedMotionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reducedMotionQuery.matches;
}

export function Tilt3D({ children, className = "", maxTilt = 8 }: Tilt3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") {
      return;
    }
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }
    const rect = root.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      root.style.setProperty("--tilt-x", `${((0.5 - y) * 2 * maxTilt).toFixed(2)}deg`);
      root.style.setProperty("--tilt-y", `${((x - 0.5) * 2 * maxTilt).toFixed(2)}deg`);
      root.style.setProperty("--sheen-x", `${(x * 100).toFixed(1)}%`);
      root.style.setProperty("--sheen-y", `${(y * 100).toFixed(1)}%`);
      root.style.setProperty("--sheen-opacity", "1");
    });
  }

  function onPointerLeave() {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    cancelAnimationFrame(frameRef.current);
    root.style.setProperty("--tilt-x", "0deg");
    root.style.setProperty("--tilt-y", "0deg");
    root.style.setProperty("--sheen-opacity", "0");
  }

  return (
    <div
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`[perspective:650px] ${className}`}
    >
      <div className="relative h-full w-full transition-transform duration-200 ease-out [transform-style:preserve-3d] [transform:rotateX(var(--tilt-x,0deg))_rotateY(var(--tilt-y,0deg))]">
        {children}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[var(--sheen-opacity,0)] transition-opacity duration-300 [background:radial-gradient(farthest-corner_at_var(--sheen-x,50%)_var(--sheen-y,50%),rgba(255,255,255,0.45),transparent_55%)]"
        />
      </div>
    </div>
  );
}
