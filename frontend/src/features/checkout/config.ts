/**
 * Checkout options for Tanzania (owner request 2026-11-10: complete the
 * checkout frontend now, connect payments and orders later).
 *
 * Nothing here invents an operational fact. Delivery fees, delivery
 * coverage, showroom pickup points, tax treatment and payment providers
 * have not been confirmed by TRONIC, so every option that depends on them
 * is marked unavailable or "confirmed later". When the owner confirms them,
 * only this file changes; the checkout page reads it.
 */

/** Tanzania's 31 administrative regions (26 mainland, 5 Zanzibar). A list of
 *  places to deliver to, not a claim of delivery coverage. */
export const TZ_REGIONS = [
  "Arusha",
  "Dar es Salaam",
  "Dodoma",
  "Geita",
  "Iringa",
  "Kagera",
  "Katavi",
  "Kigoma",
  "Kilimanjaro",
  "Lindi",
  "Manyara",
  "Mara",
  "Mbeya",
  "Morogoro",
  "Mtwara",
  "Mwanza",
  "Njombe",
  "Pwani",
  "Rukwa",
  "Ruvuma",
  "Shinyanga",
  "Simiyu",
  "Singida",
  "Songwe",
  "Tabora",
  "Tanga",
  "Kaskazini Pemba",
  "Kusini Pemba",
  "Kaskazini Unguja",
  "Kusini Unguja",
  "Mjini Magharibi",
] as const;

export type DeliveryMethodId = "home" | "pickup";

export interface DeliveryMethod {
  id: DeliveryMethodId;
  label: string;
  description: string;
  /** Fee in minor units once TRONIC sets delivery rates; null until then. */
  feeMinor: number | null;
  /** False while the method cannot be used at all (e.g. no pickup points). */
  enabled: boolean;
  /** Shown instead of a fee when the fee is not set or the method is off. */
  note: string;
}

export const DELIVERY_METHODS: readonly DeliveryMethod[] = [
  {
    id: "home",
    label: "Delivery to your address",
    description: "To your home, business or site in Tanzania.",
    feeMinor: null,
    enabled: true,
    note: "Fee confirmed before you pay",
  },
  {
    id: "pickup",
    label: "Pick up from a TRONIC showroom",
    description: "Collect your order in person.",
    feeMinor: null,
    enabled: false,
    note: "Pickup points coming soon",
  },
];

export type PaymentMethodId = "mobile_money" | "card" | "bank_transfer" | "pay_on_delivery";

export interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  description: string;
  /**
   * "unavailable" until a provider is connected and approved. "sandbox"
   * will mark test-only providers; "live" is set only for an approved,
   * verified provider. No payment method is live yet.
   */
  status: "unavailable" | "sandbox" | "live";
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  {
    id: "mobile_money",
    label: "Mobile money",
    description: "Pay from your mobile money wallet.",
    status: "unavailable",
  },
  {
    id: "card",
    label: "Debit or credit card",
    description: "On the payment provider's secure page; TRONIC never sees card details.",
    status: "unavailable",
  },
  {
    id: "bank_transfer",
    label: "Bank transfer",
    description: "Transfer to TRONIC's account; your order ships once paid.",
    status: "unavailable",
  },
  {
    // Owner decision 2026-11-10: keep cash on delivery open. No provider is
    // involved: the delivery team collects cash and payment is recorded as
    // pending until the order is marked paid.
    id: "pay_on_delivery",
    label: "Cash on delivery",
    description: "Pay in cash when your order arrives.",
    status: "live",
  },
];

export function isPaymentMethodAvailable(id: string): boolean {
  return PAYMENT_METHODS.some((method) => method.id === id && method.status !== "unavailable");
}

/** The only available method is chosen for the customer; otherwise none. */
export function defaultPaymentMethod(): PaymentMethodId | "" {
  const available = PAYMENT_METHODS.filter((method) => method.status !== "unavailable");
  return available.length === 1 ? available[0]!.id : "";
}

/**
 * False until orders are stored (Supabase, Stage 2). While false, Place
 * order checks the details and says that nothing was sent; no order is
 * created or simulated, whatever payment method is chosen.
 */
export const ORDERS_CONNECTED = false;
