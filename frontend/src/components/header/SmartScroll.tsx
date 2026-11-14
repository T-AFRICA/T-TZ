"use client";

import { useEffect } from "react";

/** Phones and small tablets: the widths where the bottom tab bar is shown (below Tailwind md). */
const MOBILE_QUERY = "(max-width: 47.999rem)";
/** Scroll further than this, in one direction, before the bars react. */
const DELTA_PX = 6;
/** Near the top of the page the bars always show. */
const TOP_ZONE_PX = 72;
/** The bars come back this long after scrolling stops. */
const STOP_MS = 500;

/**
 * Smart scroll for phones (owner brief 2026-11-14): scrolling down slides
 * the header up and the bottom tab bar down, out of the way of the content;
 * scrolling up, or stopping for half a second, brings both back together.
 *
 * It only sets data-nav-hidden on <html>; the movement itself is CSS
 * (globals.css: .site-header and .bottom-nav), so there is no layout shift
 * and reduced motion simply shows and hides without sliding.
 *
 * The bars stay visible near the top of the page, on desktop widths, while
 * a dialog is open (the menu drawer, the search panel, a quick-view sheet)
 * and whenever keyboard focus is inside them, so nothing a customer is
 * using disappears.
 */
export function SmartScroll() {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const root = document.documentElement;
    const mobile = window.matchMedia(MOBILE_QUERY);
    let lastY = Math.max(window.scrollY, 0);
    let frame = 0;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;

    const show = () => {
      delete root.dataset.navHidden;
    };
    const hide = () => {
      root.dataset.navHidden = "true";
    };
    const mustStayVisible = () =>
      !mobile.matches ||
      document.querySelector("dialog[open]") !== null ||
      document.activeElement?.closest(".site-header, .bottom-nav") != null;

    const update = () => {
      frame = 0;
      const y = Math.max(window.scrollY, 0);
      const moved = y - lastY;
      if (mustStayVisible() || y <= TOP_ZONE_PX) {
        show();
        lastY = y;
        return;
      }
      // Small movements add up: lastY only moves once the bars have reacted.
      if (moved > DELTA_PX) {
        hide();
        lastY = y;
      } else if (moved < -DELTA_PX) {
        show();
        lastY = y;
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
      clearTimeout(stopTimer);
      stopTimer = setTimeout(show, STOP_MS);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.closest(".site-header, .bottom-nav")) show();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    mobile.addEventListener("change", show);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      mobile.removeEventListener("change", show);
      if (frame) window.cancelAnimationFrame(frame);
      clearTimeout(stopTimer);
      show();
    };
  }, []);

  return null;
}
