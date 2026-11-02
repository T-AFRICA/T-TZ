/**
 * Inline stroke icon set for the storefront shell. Icons inherit
 * `currentColor` and are decorative (aria-hidden) — the consuming component
 * must pair them with visible or visually-hidden text.
 */
export interface IconProps {
  size?: number;
  className?: string;
}

function svgProps({ size = 20, className }: IconProps) {
  return {
    width: size,
    height: size,
    className,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
    </svg>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M2 6.5h11.5V16H2zM13.5 9.5h3.8l2.7 3V16h-6.5z" />
      <circle cx="6" cy="17.8" r="1.7" />
      <circle cx="16.8" cy="17.8" r="1.7" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M22 16.9v2.1a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 3.2 2 2 0 0 1 4.1 1h2.1a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L7.6 8.2a16 16 0 0 0 6 6l.8-.8a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M2.5 3.5h2.3l2.5 12.1a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L20.8 8H6" />
      <circle cx="9.3" cy="20.3" r="1.5" />
      <circle cx="17.3" cy="20.3" r="1.5" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 20.5 4.7 13A5.1 5.1 0 0 1 12 5.9 5.1 5.1 0 0 1 19.3 13z" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
