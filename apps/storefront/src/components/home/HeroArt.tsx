/**
 * Original SVG product illustrations for the hero campaigns.
 *
 * PLACEHOLDER ART: drawn in-house (no third-party assets, no licensing risk)
 * because no approved TRONIC product photography exists in the repository
 * yet. Each illustration is generic for its category — it depicts no specific
 * SKU and must be replaced by approved campaign photography before launch.
 * The hero renders a visible "Illustration" tag so the art is never mistaken
 * for a real product photo.
 */

import type { ReactElement } from "react";

export type HeroArtKind = "floodlight" | "cables" | "breaker";

function FloodlightArt() {
  return (
    <svg viewBox="0 0 420 360" role="img" aria-label="Illustration of an LED flood light" className="h-full w-full">
      <defs>
        <radialGradient id="fl-glow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#fff7df" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#ffdf8a" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffdf8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fl-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffdf4" />
          <stop offset="100%" stopColor="#ffe9a8" />
        </linearGradient>
        <linearGradient id="fl-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4a4f57" />
          <stop offset="100%" stopColor="#23262b" />
        </linearGradient>
      </defs>
      <circle cx="210" cy="150" r="150" fill="url(#fl-glow)" />
      {/* heatsink fins */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={122 + i * 23} y="52" width="10" height="26" rx="3" fill="#33373d" />
      ))}
      {/* body frame */}
      <rect x="105" y="74" width="210" height="150" rx="16" fill="url(#fl-body)" />
      <rect x="121" y="90" width="178" height="118" rx="8" fill="url(#fl-panel)" />
      {/* LED grid */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <circle
            key={`${row}-${col}`}
            cx={147 + col * 32}
            cy={116 + row * 33}
            r="7"
            fill="#fff"
            stroke="#f0cf74"
            strokeWidth="2"
          />
        )),
      )}
      {/* mounting yoke */}
      <path
        d="M128 224 L116 286 M292 224 L304 286 M110 286 H310"
        stroke="#33373d"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      {/* ground shadow */}
      <ellipse cx="210" cy="312" rx="130" ry="14" fill="#000" opacity="0.35" />
    </svg>
  );
}

function CablesArt() {
  return (
    <svg viewBox="0 0 420 360" role="img" aria-label="Illustration of a coil of electrical cable" className="h-full w-full">
      <defs>
        <radialGradient id="cb-glow" cx="50%" cy="48%" r="55%">
          <stop offset="0%" stopColor="#ef1c26" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ef1c26" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cb-sheath" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f04349" />
          <stop offset="100%" stopColor="#a30f16" />
        </linearGradient>
        <linearGradient id="cb-copper" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f6c979" />
          <stop offset="100%" stopColor="#c87f2f" />
        </linearGradient>
      </defs>
      <circle cx="210" cy="170" r="150" fill="url(#cb-glow)" />
      {/* coil loops */}
      <circle cx="210" cy="160" r="96" fill="none" stroke="url(#cb-sheath)" strokeWidth="26" />
      <circle cx="210" cy="160" r="96" fill="none" stroke="#fff" strokeWidth="2" opacity="0.25" />
      <circle cx="216" cy="166" r="96" fill="none" stroke="url(#cb-sheath)" strokeWidth="26" opacity="0.9" />
      <circle cx="222" cy="172" r="96" fill="none" stroke="url(#cb-sheath)" strokeWidth="26" opacity="0.8" />
      {/* uncoiled tail with stripped copper end */}
      <path
        d="M300 236 C 348 260, 376 246, 388 214"
        fill="none"
        stroke="url(#cb-sheath)"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <path
        d="M388 214 C 393 200, 396 190, 398 180"
        fill="none"
        stroke="url(#cb-copper)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* ground shadow */}
      <ellipse cx="214" cy="312" rx="130" ry="14" fill="#000" opacity="0.35" />
    </svg>
  );
}

function BreakerArt() {
  return (
    <svg viewBox="0 0 420 360" role="img" aria-label="Illustration of a circuit breaker" className="h-full w-full">
      <defs>
        <radialGradient id="br-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ef1c26" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ef1c26" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="br-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d7dade" />
        </linearGradient>
        <linearGradient id="br-toggle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f04349" />
          <stop offset="100%" stopColor="#b3141a" />
        </linearGradient>
      </defs>
      <circle cx="210" cy="165" r="150" fill="url(#br-glow)" />
      {/* two-pole breaker: twin narrow modules on a DIN-style base */}
      {[0, 1].map((pole) => {
        const x = 150 + pole * 62;
        return (
          <g key={pole}>
            {/* module body */}
            <rect x={x} y="56" width="58" height="230" rx="8" fill="url(#br-body)" />
            <rect x={x} y="56" width="58" height="230" rx="8" fill="none" stroke="#9aa0a8" strokeWidth="2" />
            {/* raised face strip */}
            <rect x={x + 10} y="100" width="38" height="142" rx="6" fill="#f7f8f9" stroke="#c3c8cd" strokeWidth="1.5" />
            {/* terminal screws */}
            <circle cx={x + 29} cy="74" r="9" fill="#33373d" />
            <rect x={x + 23} y="72" width="12" height="4" rx="2" fill="#8a9099" />
            <circle cx={x + 29} cy="268" r="9" fill="#33373d" />
            <rect x={x + 23} y="266" width="12" height="4" rx="2" fill="#8a9099" />
            {/* toggle recess + red lever (ON position) */}
            <rect x={x + 15} y="136" width="28" height="70" rx="5" fill="#e3e6e9" />
            <rect x={x + 18} y="140" width="22" height="34" rx="4" fill="url(#br-toggle)" />
            <rect x={x + 22} y="146" width="14" height="5" rx="2.5" fill="#fff" opacity="0.55" />
            {/* rating markings */}
            <rect x={x + 15} y="114" width="28" height="7" rx="3.5" fill="#c3c8cd" />
            <rect x={x + 15} y="218" width="20" height="6" rx="3" fill="#d9dde1" />
          </g>
        );
      })}
      {/* tie bar joining both levers */}
      <rect x="172" y="152" width="76" height="8" rx="4" fill="#b3141a" />
      {/* ground shadow */}
      <ellipse cx="210" cy="320" rx="120" ry="13" fill="#000" opacity="0.35" />
    </svg>
  );
}

const ART: Record<HeroArtKind, () => ReactElement> = {
  floodlight: FloodlightArt,
  cables: CablesArt,
  breaker: BreakerArt,
};

export function HeroArt({ kind }: { kind: HeroArtKind }) {
  const Art = ART[kind];
  return <Art />;
}
