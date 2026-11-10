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
  ChevronRight,
  Gauge,
  Globe,
  Heart,
  House,
  Info,
  LayoutGrid,
  MapPin,
  Newspaper,
  Phone,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Store,
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
export const ChevronRightIcon = wrap(ChevronRight);
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
export const InfoIcon = wrap(Info);
export const MapPinIcon = wrap(MapPin);
export const NewspaperIcon = wrap(Newspaper);
export const StoreIcon = wrap(Store);
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

/**
 * WhatsApp-style glyph: the lucide MessageCircle bubble with the lucide Phone
 * scaled into it (both paths verbatim from lucide-react 1.68). The inner
 * stroke is widened to compensate for the scale so both read at 2px.
 */
export const WhatsAppIcon = brand(
  <>
    <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
    <g transform="translate(12 12) scale(0.42) translate(-12 -12)" strokeWidth={4.4}>
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </g>
  </>,
);
