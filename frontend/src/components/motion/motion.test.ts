import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOTION_DURATION, MOTION_EASING, MOTION_STAGGER, flyBetween, playMotion, prefersReducedMotion } from "@tronic/ui";

const css = readFileSync(resolve(process.cwd(), "../packages/ui/src/motion.css"), "utf8");

/** The value a custom property is given in motion.css. */
function cssValue(name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`${name} is not in motion.css`);
  return match[1].replace(/\s+/g, " ").trim();
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: reduce && query.includes("reduce"), media: query })),
  );
}

/** A stand-in for the Web Animations API, which the test DOM does not have. */
function fakeAnimate() {
  const listeners = new Map<string, () => void>();
  const animation = {
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    finish: () => listeners.get("finish")?.(),
  };
  const animate = vi.fn(() => animation);
  Object.defineProperty(Element.prototype, "animate", { configurable: true, writable: true, value: animate });
  return { animate, animation };
}

function box(left: number, top: number, size = 40) {
  return { left, top, width: size, height: size, right: left + size, bottom: top + size, x: left, y: top, toJSON: () => ({}) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "animate");
  document.body.replaceChildren();
});

describe("the motion tokens", () => {
  it("are the same in motion.css and motion.ts", () => {
    expect(cssValue("--motion-instant")).toBe(`${MOTION_DURATION.instant}ms`);
    expect(cssValue("--motion-fast")).toBe(`${MOTION_DURATION.fast}ms`);
    expect(cssValue("--motion-base")).toBe(`${MOTION_DURATION.base}ms`);
    expect(cssValue("--motion-slow")).toBe(`${MOTION_DURATION.slow}ms`);
    expect(cssValue("--motion-slower")).toBe(`${MOTION_DURATION.slower}ms`);
    expect(cssValue("--motion-stagger")).toBe(`${MOTION_STAGGER}ms`);
    expect(cssValue("--ease-standard")).toBe(MOTION_EASING.standard);
    expect(cssValue("--ease-out")).toBe(MOTION_EASING.out);
    expect(cssValue("--ease-in")).toBe(MOTION_EASING.in);
    expect(cssValue("--ease-in-out")).toBe(MOTION_EASING.inOut);
    expect(cssValue("--default-transition-duration")).toBe(`${MOTION_DURATION.fast}ms`);
  });

  it("keep to the timing the brief asks for", () => {
    // Buttons about 100 to 180ms; menus and overlays about 180 to 300ms; major transitions about 250 to 450ms.
    for (const press of [MOTION_DURATION.instant, MOTION_DURATION.fast]) {
      expect(press).toBeGreaterThanOrEqual(100);
      expect(press).toBeLessThanOrEqual(180);
    }
    expect(MOTION_DURATION.base).toBeGreaterThanOrEqual(180);
    expect(MOTION_DURATION.base).toBeLessThanOrEqual(300);
    for (const major of [MOTION_DURATION.slow, MOTION_DURATION.slower]) {
      expect(major).toBeGreaterThanOrEqual(250);
      expect(major).toBeLessThanOrEqual(450);
    }
  });

  it("move only transform and opacity in their keyframes", () => {
    const frames = [...css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)].map((match) => match[1] ?? "");
    expect(frames.length).toBeGreaterThan(0);
    for (const body of frames) {
      const properties = [...body.matchAll(/^\s{4}([a-z-]+):/gm)].map((match) => match[1]);
      expect(properties.every((property) => property === "transform" || property === "opacity"), body).toBe(true);
    }
  });

  it("give a pressed control its squash and a smaller control a 44px touch area", () => {
    expect(css).toMatch(/\.m-press:active:not\(:disabled, \[aria-disabled="true"\]\) \{\s*scale: var\(--press-scale\);/);
    expect(css).toMatch(/\.m-hit::after,\s*\.m-hit-y::after \{[^}]*width: max\(100%, 2\.75rem\);\s*height: max\(100%, 2\.75rem\);/);
  });
});

describe("the one-shot effects", () => {
  it("do nothing where the browser cannot animate", () => {
    setReducedMotion(false);
    const element = document.createElement("button");
    expect(playMotion(element, "pop")).toBeNull();
    expect(flyBetween(element, element)).toBe(false);
    expect(playMotion(null, "bump")).toBeNull();
  });

  it("do nothing when the visitor asks for reduced motion", () => {
    setReducedMotion(true);
    const { animate } = fakeAnimate();
    const element = document.createElement("button");
    document.body.append(element);
    expect(prefersReducedMotion()).toBe(true);
    expect(playMotion(element, "pop")).toBeNull();
    expect(flyBetween(element, element)).toBe(false);
    expect(animate).not.toHaveBeenCalled();
    expect(document.querySelector("[data-motion-fly]")).toBeNull();
  });

  it("play a feedback effect for its token duration", () => {
    setReducedMotion(false);
    const { animate } = fakeAnimate();
    const element = document.createElement("button");
    expect(playMotion(element, "pop")).not.toBeNull();
    expect(animate).toHaveBeenCalledWith(expect.any(Array), { duration: MOTION_DURATION.slower, easing: MOTION_EASING.standard });
    playMotion(element, "bump");
    expect(animate).toHaveBeenLastCalledWith(expect.any(Array), { duration: MOTION_DURATION.slow, easing: MOTION_EASING.standard });
  });

  it("send a dot from one element to another, out of the pointer's way, and clear it up", () => {
    setReducedMotion(false);
    const { animate, animation } = fakeAnimate();
    const from = document.createElement("button");
    const to = document.createElement("a");
    document.body.append(from, to);
    from.getBoundingClientRect = () => box(100, 600);
    to.getBoundingClientRect = () => box(900, 20);
    const onArrive = vi.fn();

    expect(flyBetween(from, to, { image: '/media/products/a"b.png', onArrive })).toBe(true);
    const carrier = document.querySelector<HTMLElement>("[data-motion-fly]");
    expect(carrier).not.toBeNull();
    expect(carrier?.getAttribute("aria-hidden")).toBe("true");
    expect(carrier?.style.pointerEvents).toBe("none");
    expect(carrier?.style.position).toBe("fixed");
    // Across and up-and-down run as two animations: that is what bends the path.
    expect(animate).toHaveBeenCalledTimes(2);
    // A quote in the picture's address cannot end the CSS url().
    expect(carrier?.firstElementChild?.getAttribute("style") ?? "").not.toContain('a"b');

    animation.finish();
    expect(document.querySelector("[data-motion-fly]")).toBeNull();
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("does not send a dot to a target that is not on screen", () => {
    setReducedMotion(false);
    fakeAnimate();
    const from = document.createElement("button");
    const hidden = document.createElement("a");
    from.getBoundingClientRect = () => box(100, 600);
    hidden.getBoundingClientRect = () => box(0, 0, 0);
    expect(flyBetween(from, hidden)).toBe(false);
    expect(document.querySelector("[data-motion-fly]")).toBeNull();
  });
});
