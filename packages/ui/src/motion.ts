/**
 * TRONIC motion system, TypeScript side: the same durations and curves as
 * motion.css (motion.test.ts keeps the two files in step), and the one-shot
 * feedback effects that cannot be written as a CSS state change because
 * they answer an event: a heart that pops when saved, a badge that bumps
 * when its number changes, a product that travels to the cart.
 *
 * They run on the Web Animations API (no library), animate transform and
 * opacity only, never block or delay the action they follow, and do nothing
 * when the visitor asks for reduced motion or the API is missing (older
 * browsers, the test DOM).
 */
export const MOTION_DURATION = {
  instant: 100,
  fast: 160,
  base: 240,
  slow: 320,
  slower: 420,
} as const;

export const MOTION_EASING = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

export const MOTION_STAGGER = 40;

export type MotionEffect = "pop" | "release" | "bump" | "shake";

interface EffectSpec {
  keyframes: Keyframe[];
  duration: number;
  easing: string;
}

/**
 * - pop: something succeeded (saved, added). A short wind-up, a stretch
 *   past full size, one counter-squash, rest.
 * - release: the opposite, quieter (removed, unsaved).
 * - bump: a supporting element reacts (a count changed, an icon received
 *   something).
 * - shake: refused, try again.
 */
const EFFECTS: Record<MotionEffect, EffectSpec> = {
  pop: {
    keyframes: [
      { transform: "scale(1)", offset: 0 },
      { transform: "scale(0.8, 0.84)", offset: 0.18 },
      { transform: "scale(1.26, 1.2)", offset: 0.48 },
      { transform: "scale(0.95, 1.03)", offset: 0.72 },
      { transform: "scale(1)", offset: 1 },
    ],
    duration: MOTION_DURATION.slower,
    easing: MOTION_EASING.standard,
  },
  release: {
    keyframes: [
      { transform: "scale(1)", offset: 0 },
      { transform: "scale(0.86)", offset: 0.4 },
      { transform: "scale(1)", offset: 1 },
    ],
    duration: MOTION_DURATION.base,
    easing: MOTION_EASING.standard,
  },
  bump: {
    keyframes: [
      { transform: "translateY(0) scale(1)", offset: 0 },
      { transform: "translateY(-2px) scale(1.32)", offset: 0.35 },
      { transform: "translateY(0) scale(0.96)", offset: 0.7 },
      { transform: "translateY(0) scale(1)", offset: 1 },
    ],
    duration: MOTION_DURATION.slow,
    easing: MOTION_EASING.standard,
  },
  shake: {
    keyframes: [
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(-5px)", offset: 0.2 },
      { transform: "translateX(4px)", offset: 0.45 },
      { transform: "translateX(-3px)", offset: 0.7 },
      { transform: "translateX(0)", offset: 1 },
    ],
    duration: MOTION_DURATION.slow,
    easing: MOTION_EASING.standard,
  },
};

/** True when the visitor asked for reduced motion, and on the server. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canAnimate(element: Element | null | undefined): element is Element {
  return Boolean(element) && typeof element?.animate === "function" && !prefersReducedMotion();
}

/** Plays one feedback effect on an element. Returns null when nothing was played. */
export function playMotion(element: Element | null | undefined, effect: MotionEffect): Animation | null {
  if (!canAnimate(element)) return null;
  const spec = EFFECTS[effect];
  return element.animate(spec.keyframes, { duration: spec.duration, easing: spec.easing });
}

export interface FlyOptions {
  /** A picture for the travelling dot (the product's photo); a plain dot otherwise. */
  image?: string | null;
  /** Dot colour when there is no picture. */
  color?: string;
  /** Called when the dot arrives (not called when nothing was played). */
  onArrive?: () => void;
}

/** How far above a straight line the dot rises, in CSS pixels. */
const FLY_LIFT = 56;
const FLY_SIZE = 36;

/**
 * Sends a small dot from one element to another along an arc: the
 * horizontal and the vertical move run on different curves, so the path
 * bends like something thrown rather than sliding along a ruler. The dot
 * ignores the pointer and removes itself. Purely an echo of an action that
 * has already happened; nothing waits for it.
 */
export function flyBetween(from: Element | null | undefined, to: Element | null | undefined, options: FlyOptions = {}): boolean {
  if (!canAnimate(from) || !to || typeof document === "undefined") return false;
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  if (start.width === 0 || end.width === 0) return false;

  const dx = end.left + end.width / 2 - (start.left + start.width / 2);
  const dy = end.top + end.height / 2 - (start.top + start.height / 2);

  const carrier = document.createElement("div");
  carrier.setAttribute("aria-hidden", "true");
  carrier.dataset.motionFly = "";
  Object.assign(carrier.style, {
    position: "fixed",
    left: `${start.left + start.width / 2 - FLY_SIZE / 2}px`,
    top: `${start.top + start.height / 2 - FLY_SIZE / 2}px`,
    width: `${FLY_SIZE}px`,
    height: `${FLY_SIZE}px`,
    zIndex: "70",
    pointerEvents: "none",
    willChange: "transform",
  });
  const dot = document.createElement("div");
  Object.assign(dot.style, {
    width: "100%",
    height: "100%",
    borderRadius: "9999px",
    backgroundColor: options.image ? "#ffffff" : (options.color ?? "#d71920"),
    backgroundImage: options.image ? `url("${encodeURI(options.image)}")` : "none",
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    boxShadow: "0 6px 16px -4px rgba(17, 17, 17, 0.35), 0 0 0 2px #ffffff",
    willChange: "transform, opacity",
  });
  carrier.append(dot);
  document.body.append(carrier);

  const duration = MOTION_DURATION.slower + 30;
  // Across: one smooth move. Up and down: rise first, then fall into the target.
  carrier.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], {
    duration,
    easing: MOTION_EASING.inOut,
    fill: "forwards",
  });
  const apex = Math.min(0, dy) - FLY_LIFT;
  const fall = dot.animate(
    [
      { transform: "translateY(0) scale(1)", opacity: 1, offset: 0, easing: MOTION_EASING.out },
      { transform: `translateY(${apex}px) scale(0.9)`, opacity: 1, offset: 0.42, easing: MOTION_EASING.in },
      { transform: `translateY(${dy}px) scale(0.35)`, opacity: 0.4, offset: 1 },
    ],
    { duration, fill: "forwards" },
  );
  const done = () => {
    carrier.remove();
    options.onArrive?.();
  };
  fall.addEventListener("finish", done, { once: true });
  fall.addEventListener("cancel", () => carrier.remove(), { once: true });
  return true;
}
