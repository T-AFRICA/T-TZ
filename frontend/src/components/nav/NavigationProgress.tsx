"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar at the top of the screen that starts the moment a link is
 * pressed and ends when the new page is on screen.
 *
 * Why: most pages are rendered on the server per request. Between the press
 * and the server's answer nothing on the page changed, so a press looked
 * ignored (audit 2026-11-17). The bar is the immediate answer to the press;
 * it does not make the page arrive sooner and it never blocks a click
 * (pointer-events: none, and it is not in the tab order).
 *
 * It starts on a plain left click on a same-site link to another address,
 * on back/forward, and when code that navigates by itself asks for it
 * (startNavigationProgress). It ends when the address changes, or after ten
 * seconds whatever happened.
 */
const EVENT = "tronic:navigation-start";
const GIVE_UP_MS = 10_000;

/** For code that navigates without a link (router.push): call just before navigating. */
export function startNavigationProgress(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function sameSiteDestination(anchor: HTMLAnchorElement): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download") || anchor.getAttribute("rel")?.includes("external")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // The same page (or only another place on it) is not a navigation to wait for.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

type Phase = "idle" | "running" | "done";

export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [phase, setPhase] = useState<Phase>("idle");
  const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = () => {
      setPhase("running");
      if (giveUp.current) clearTimeout(giveUp.current);
      giveUp.current = setTimeout(() => setPhase("idle"), GIVE_UP_MS);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (anchor instanceof HTMLAnchorElement && sameSiteDestination(anchor)) start();
    };
    // Capture phase: before the link's own handler starts the navigation.
    document.addEventListener("click", onClick, true);
    window.addEventListener(EVENT, start);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(EVENT, start);
      window.removeEventListener("popstate", start);
      if (giveUp.current) clearTimeout(giveUp.current);
    };
  }, []);

  // The address changed: the new page is on screen.
  useEffect(() => {
    if (giveUp.current) clearTimeout(giveUp.current);
    setPhase((current) => (current === "running" ? "done" : current));
    const hide = setTimeout(() => setPhase((current) => (current === "done" ? "idle" : current)), 250);
    return () => clearTimeout(hide);
  }, [pathname, search]);

  return (
    <div
      aria-hidden="true"
      data-nav-progress={phase}
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] overflow-hidden"
    >
      <div className="nav-progress-bar h-full w-full origin-left bg-[var(--color-action-red)]" />
    </div>
  );
}
