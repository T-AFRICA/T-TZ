"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeftIcon, ArrowRightIcon, Dialog, SearchIcon, useToast } from "@tronic/ui";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import type { SampleProduct } from "@/components/home/sampleProducts";

/**
 * PDP gallery in the approved reference style: large photo in a soft
 * rounded container with prev/next arrows over the image area and a
 * thumbnail row below. Every sample product currently has one official
 * photo, so arrows and thumbnails appear only once a product gains more
 * images — the switching mechanics (click, arrows, crossfade) are already
 * wired for the live catalog. Tap/click the photo for a full-screen zoom
 * dialog; wishlist and share float over the frame.
 */
export function ProductGallery({ product }: { product: SampleProduct }) {
  const images = [product.image];
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const { showToast } = useToast();
  // DOM props stay constant across SSR/client (hydration safety); reduced
  // motion only zeroes transition durations, which never reach the HTML.
  const reduceMotion = useReducedMotion() ?? false;
  const activeImage = images[activeIndex] ?? product.image;
  const hasMultiple = images.length > 1;
  const zoomRef = useRef<HTMLSpanElement>(null);
  const touchStartX = useRef<number | null>(null);
  /** True right after a swipe, so the synthetic click that follows the
   *  touch does not also open the zoom dialog. */
  const swipedRef = useRef(false);

  // Touch swipe between images (no-op while there is a single photo).
  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (!hasMultiple || touchStartX.current === null) {
      return;
    }
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > 40) {
      swipedRef.current = true;
      step(delta < 0 ? 1 : -1);
    }
  }

  function onFrameClick() {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    setZoomOpen(true);
  }

  // Magnifier: while a mouse hovers the photo it zooms in around the
  // cursor (origin follows the pointer). Mouse-only — touch keeps the
  // plain photo and the full-screen dialog. Direct style writes avoid a
  // re-render per mousemove.
  function onZoomMove(event: React.PointerEvent<HTMLButtonElement>) {
    const zoom = zoomRef.current;
    if (!zoom || event.pointerType !== "mouse") {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    zoom.style.transformOrigin = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
    zoom.style.transform = "scale(2)";
  }

  function onZoomLeave() {
    const zoom = zoomRef.current;
    if (zoom) {
      zoom.style.transform = "";
    }
  }

  function step(direction: 1 | -1) {
    setActiveIndex((index) => (index + direction + images.length) % images.length);
  }

  async function onShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard", "success");
    } catch {
      // Dismissed share sheet / clipboard denied — nothing to report.
    }
  }

  const arrowClasses =
    "pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--text-secondary)] shadow-md transition-all hover:scale-105 hover:text-[var(--color-action-red)] active:scale-95";

  return (
    <div>
      <div className="relative">
        {/* CSS entrance (not Motion): the SSR HTML must never ship the
            product photo hidden — a JS-gated opacity left the gallery as
            an empty box until hydration on slow devices. CSS finishes on
            its own and the reduced-motion override zeroes it. */}
        <button
          type="button"
          aria-label={`${product.name} — open full-screen view`}
          onClick={onFrameClick}
          onPointerMove={onZoomMove}
          onPointerLeave={onZoomLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="group relative block aspect-[5/4] w-full cursor-zoom-in overflow-hidden rounded-3xl bg-white animate-[hero-copy-in_450ms_ease-out] md:aspect-square md:ring-1 md:ring-[var(--color-light-grey)]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={activeImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="absolute inset-0"
            >
              <span
                ref={zoomRef}
                className="absolute inset-0 transition-transform duration-200 ease-out will-change-transform"
              >
                <Image
                  src={activeImage}
                  alt={product.name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 34rem, (min-width: 768px) 50vw, 100vw"
                  className="object-contain p-6 md:p-12"
                />
              </span>
            </motion.span>
          </AnimatePresence>
          <span className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[var(--text-secondary)] shadow-sm backdrop-blur transition-colors group-hover:text-[var(--color-action-red)]">
            <SearchIcon size={16} />
          </span>
        </button>

        {/* Prev / next over the image area (reference style) */}
        {hasMultiple ? (
          <div className="pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center justify-between">
            <button type="button" aria-label="Previous image" onClick={() => step(-1)} className={arrowClasses}>
              <ArrowLeftIcon size={17} />
            </button>
            <button type="button" aria-label="Next image" onClick={() => step(1)} className={arrowClasses}>
              <ArrowRightIcon size={17} />
            </button>
          </div>
        ) : null}

        {/* Pagination dots (phones; thumbnails cover md+) */}
        {hasMultiple ? (
          <div
            aria-hidden="true"
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 md:hidden"
          >
            {images.map((image, index) => (
              <span
                key={image}
                className={`h-1.5 rounded-full transition-all ${
                  index === activeIndex
                    ? "w-4 bg-[var(--color-action-red)]"
                    : "w-1.5 bg-[var(--color-light-grey)]"
                }`}
              />
            ))}
          </div>
        ) : null}

        {/* Wishlist + share float over the frame */}
        <div className="absolute right-4 top-4 flex gap-2">
          <WishlistButton
            productId={product.id}
            productName={product.name}
            size={16}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition-all hover:scale-110 active:scale-90"
          />
          <button
            type="button"
            aria-label={`Share ${product.name}`}
            onClick={onShare}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--text-secondary)] shadow-sm transition-all hover:scale-110 hover:text-[var(--color-action-red)] active:scale-90"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Thumbnail row below the main frame */}
      {hasMultiple ? (
        <ul className="mt-3 flex gap-2.5" aria-label="Product images">
          {images.map((image, index) => (
            <li key={image}>
              <button
                type="button"
                aria-label={`Show image ${index + 1}`}
                aria-current={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                className={`relative block h-20 w-20 overflow-hidden rounded-2xl border bg-white transition-colors ${
                  index === activeIndex
                    ? "border-[var(--color-action-red)]"
                    : "border-transparent hover:border-[var(--color-mid-grey)]"
                }`}
              >
                <Image src={image} alt="" fill sizes="5rem" className="object-contain p-2" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={zoomOpen} onClose={() => setZoomOpen(false)} title={product.name}>
        <div className="relative aspect-square w-full">
          <Image src={activeImage} alt={product.name} fill sizes="28rem" className="object-contain" />
        </div>
      </Dialog>
    </div>
  );
}
