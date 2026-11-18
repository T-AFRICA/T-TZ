/**
 * Checkout options for Tanzania (owner request 2026-11-10: complete the
 * checkout frontend now, connect payments and orders later).
 *
 * Nothing here invents an operational fact. Delivery fees, delivery
 * coverage, showroom pickup points, tax treatment and payment providers
 * have not been confirmed by TRONIC, so every option that depends on them
 * is marked unavailable or "confirmed later". When the owner confirms them,
 * only this file changes; the checkout page reads it. Payment methods come
 * from the country's payment policy in @tronic/country-config.
 */
import {
  ACTIVE_COUNTRY,
  getPaymentPolicy,
  isMethodOffered,
  type CountryPaymentPolicy,
  type PaymentAvailability,
  type PaymentMethodId,
} from "@tronic/country-config";

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

export type { PaymentMethodId } from "@tronic/country-config";

/** This deployment's payment policy (packages/country-config/src/payments.ts). */
export const PAYMENT_POLICY: CountryPaymentPolicy = getPaymentPolicy(ACTIVE_COUNTRY.code);

export interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  description: string;
  /**
   * From the country's payment policy: "unavailable" until a provider is
   * approved and connected, "sandbox" on test deployments only, "live" for
   * an approved, verified provider (today: cash on delivery only).
   */
  status: PaymentAvailability;
}

const METHOD_TEXT: Record<PaymentMethodId, { label: string; description: string }> = {
  mobile_money: { label: "Mobile money", description: "Approve the payment on your phone." },
  card: { label: "Debit or credit card", description: "Visa or Mastercard, on the payment provider's secure page." },
  bank_transfer: { label: "Bank transfer", description: "Transfer to TRONIC's bank account; we ship once it arrives." },
  pay_on_delivery: { label: "Cash on delivery", description: "Pay in cash when your order arrives." },
};

/** Display order: the primary method first, cash on delivery last. */
const METHOD_ORDER: readonly PaymentMethodId[] = ["mobile_money", "card", "bank_transfer", "pay_on_delivery"];

export const PAYMENT_METHODS: readonly PaymentMethod[] = METHOD_ORDER.map((id) => ({
  id,
  ...METHOD_TEXT[id],
  status: isMethodOffered(PAYMENT_POLICY, id) ? PAYMENT_POLICY.methods[id] : "unavailable",
}));

export function isPaymentMethodAvailable(id: string): boolean {
  return isMethodOffered(PAYMENT_POLICY, id);
}

/** The only available method is chosen for the customer; otherwise none. */
export function defaultPaymentMethod(): PaymentMethodId | "" {
  const available = PAYMENT_METHODS.filter((method) => method.status !== "unavailable");
  return available.length === 1 ? available[0]!.id : "";
}

// Whether orders can be placed is decided on the server by the data source
// (features/data/source.ts: ordersEnabled), not by a constant here.
