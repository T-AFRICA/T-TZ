"use client";

import { motion, useReducedMotion } from "motion/react";

export interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger offset in seconds for siblings revealed together. */
  delay?: number;
}

/**
 * Gentle scroll-reveal for homepage sections: a short fade-and-rise the
 * first time the block enters the viewport. Opacity/transform only (no
 * layout shift — the element keeps its box). The rendered DOM/attributes
 * never branch on the reduced-motion preference (SSR cannot know it, so
 * branching caused hydration mismatches); reduced motion only zeroes the
 * transition duration, which is not serialized into the HTML.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }
      }
    >
      {children}
    </motion.div>
  );
}
