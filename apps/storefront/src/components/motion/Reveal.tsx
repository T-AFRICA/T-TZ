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
 * layout shift — the element keeps its box), and under reduced motion the
 * content renders statically.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}
