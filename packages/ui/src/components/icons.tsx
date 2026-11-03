/**
 * Interface icon set, backed by lucide-react (professionally drawn, optically
 * corrected strokes — owner request Nov 2026 after the hand-drawn set read
 * as thin at small sizes). The wrapper keeps the original IconProps API so
 * call sites are unchanged, pins the shared stroke weight, and marks every
 * icon decorative — the consuming component must pair it with visible or
 * visually-hidden text.
 */
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  Gauge,
  Globe,
  Heart,
  House,
  LayoutGrid,
  Phone,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  User,
  X,
  type LucideIcon,
} from "lucide-react";

export interface IconProps {
  size?: number;
  className?: string;
}

function wrap(Icon: LucideIcon) {
  return function WrappedIcon({ size = 20, className }: IconProps) {
    return <Icon size={size} className={className} strokeWidth={2} aria-hidden="true" />;
  };
}

export const SearchIcon = wrap(Search);
export const TruckIcon = wrap(Truck);
export const PhoneIcon = wrap(Phone);
export const UserIcon = wrap(User);
export const CartIcon = wrap(ShoppingCart);
export const HeartIcon = wrap(Heart);
export const ChevronDownIcon = wrap(ChevronDown);
export const GlobeIcon = wrap(Globe);
export const ArrowLeftIcon = wrap(ArrowLeft);
export const ArrowRightIcon = wrap(ArrowRight);
export const HomeIcon = wrap(House);
export const GridIcon = wrap(LayoutGrid);
export const BellIcon = wrap(Bell);
export const SlidersIcon = wrap(SlidersHorizontal);
export const MeterIcon = wrap(Gauge);
export const ShieldCheckIcon = wrap(ShieldCheck);
export const TrendingUpIcon = wrap(TrendingUp);
export const XIcon = wrap(X);
/**
 * Social brand glyphs. This lucide-react version has dropped its deprecated
 * brand icons (and never had TikTok), so these are drawn locally with the
 * set's stroke conventions; Facebook/Instagram reuse the classic lucide paths.
 */
function brand(path: React.ReactNode) {
  return function BrandIcon({ size = 20, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };
}

export const FacebookIcon = brand(
  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
);

export const InstagramIcon = brand(
  <>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </>,
);

export const TikTokIcon = brand(<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />);
