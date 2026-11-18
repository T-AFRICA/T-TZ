import type { CountryCode } from "@tronic/types";

/**
 * Which payment methods each country offers, and on what terms. This is
 * the only place availability is decided: the checkout page, the server
 * action that places orders and the payment service all read it.
 *
 * Rules (payment module brief, 2026-11-18):
 *   * A method is "live" only after TRONIC has approved its provider, the
 *     integration has been tested in the provider's sandbox and production
 *     use has been approved. "sandbox" is for test deployments only.
 *   * Nothing is enabled for a country by default. Kenya and Uganda have no
 *     method at all until their own providers and policies are approved.
 *   * Bank accounts are listed only when TRONIC has confirmed them. Nothing
 *     here is a placeholder for a real account.
 */
export type PaymentMethodId = "mobile_money" | "card" | "bank_transfer" | "pay_on_delivery";

/** The online methods: paid through a payment provider, before delivery. */
export const ONLINE_PAYMENT_METHODS: readonly PaymentMethodId[] = ["mobile_money", "card", "bank_transfer"];

export type PaymentAvailability = "unavailable" | "sandbox" | "live";

export type MobileMoneyProviderId = "mpesa" | "airtel_money" | "mixx_by_yas" | "halopesa";

export interface MobileMoneyProvider {
  id: MobileMoneyProviderId;
  /** Name as customers know it; no logo is used without permission. */
  name: string;
  /** Live only when the approved gateway supports this wallet. */
  availability: PaymentAvailability;
}

/** A bank account TRONIC has confirmed for customer transfers. */
export interface BankAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string | null;
  swiftCode: string | null;
}

export interface CountryPaymentPolicy {
  country: CountryCode;
  currency: string;
  /** The payment gateway TRONIC approved for this country; null until chosen. */
  gateway: string | null;
  methods: Readonly<Record<PaymentMethodId, PaymentAvailability>>;
  mobileMoneyProviders: readonly MobileMoneyProvider[];
  bankAccounts: readonly BankAccount[];
  payOnDelivery: {
    /** Delivery regions where cash on delivery is offered: "all" or a list. */
    regions: "all" | readonly string[];
    /** Largest order total (minor units) accepted for cash on delivery; null for no limit. */
    maxTotalMinor: number | null;
  };
  /**
   * How long an online payment may stay pending before it expires and the
   * reserved stock is released. A technical limit, to be aligned with the
   * approved gateway's own timeout.
   */
  pendingPaymentMinutes: number;
}

const NOTHING_ENABLED: Readonly<Record<PaymentMethodId, PaymentAvailability>> = {
  mobile_money: "unavailable",
  card: "unavailable",
  bank_transfer: "unavailable",
  pay_on_delivery: "unavailable",
};

export const PAYMENT_POLICIES: Readonly<Record<CountryCode, CountryPaymentPolicy>> = {
  TZ: {
    country: "TZ",
    currency: "TZS",
    gateway: null,
    methods: {
      mobile_money: "unavailable",
      card: "unavailable",
      bank_transfer: "unavailable",
      // Owner decision 2026-11-10, live since 2026-11-11: the delivery team
      // collects cash; the order is marked paid when it is delivered.
      pay_on_delivery: "live",
    },
    // Wallets a Tanzanian gateway may support. Each stays unavailable until
    // the approved gateway is connected and supports it.
    mobileMoneyProviders: [
      { id: "mpesa", name: "M-Pesa", availability: "unavailable" },
      { id: "airtel_money", name: "Airtel Money", availability: "unavailable" },
      { id: "mixx_by_yas", name: "Mixx by Yas", availability: "unavailable" },
      { id: "halopesa", name: "HaloPesa", availability: "unavailable" },
    ],
    bankAccounts: [],
    // As live today: every region, no limit. Narrow these when TRONIC sets a policy.
    payOnDelivery: { regions: "all", maxTotalMinor: null },
    pendingPaymentMinutes: 15,
  },
  KE: {
    country: "KE",
    currency: "KES",
    gateway: null,
    methods: NOTHING_ENABLED,
    mobileMoneyProviders: [],
    bankAccounts: [],
    payOnDelivery: { regions: [], maxTotalMinor: null },
    pendingPaymentMinutes: 15,
  },
  UG: {
    country: "UG",
    currency: "UGX",
    gateway: null,
    methods: NOTHING_ENABLED,
    mobileMoneyProviders: [],
    bankAccounts: [],
    payOnDelivery: { regions: [], maxTotalMinor: null },
    pendingPaymentMinutes: 15,
  },
};

export function getPaymentPolicy(country: CountryCode): CountryPaymentPolicy {
  return PAYMENT_POLICIES[country];
}

/** A method can be chosen at checkout (live, or sandbox on a test deployment). */
export function isMethodOffered(policy: CountryPaymentPolicy, method: string): method is PaymentMethodId {
  if (!(method in policy.methods)) return false;
  const availability = policy.methods[method as PaymentMethodId];
  if (availability === "unavailable") return false;
  // Bank transfer needs at least one confirmed account to show.
  if (method === "bank_transfer" && policy.bankAccounts.length === 0) return false;
  // Mobile money needs at least one wallet the gateway supports.
  if (method === "mobile_money" && !policy.mobileMoneyProviders.some((provider) => provider.availability !== "unavailable")) {
    return false;
  }
  return true;
}

/** Wallets a customer can choose, when mobile money is offered. */
export function offeredMobileMoneyProviders(policy: CountryPaymentPolicy): readonly MobileMoneyProvider[] {
  return isMethodOffered(policy, "mobile_money")
    ? policy.mobileMoneyProviders.filter((provider) => provider.availability !== "unavailable")
    : [];
}

export type PayOnDeliveryRefusal = "not_offered" | "region" | "amount";

/**
 * Whether cash on delivery may be used for this delivery region and total.
 * Null means allowed. Checked in the browser for the message and again on
 * the server before an order is placed.
 */
export function payOnDeliveryRefusal(
  policy: CountryPaymentPolicy,
  region: string,
  totalMinor: number | null,
): PayOnDeliveryRefusal | null {
  if (!isMethodOffered(policy, "pay_on_delivery")) return "not_offered";
  const { regions, maxTotalMinor } = policy.payOnDelivery;
  if (regions !== "all" && region !== "" && !regions.includes(region)) return "region";
  if (maxTotalMinor !== null && totalMinor !== null && totalMinor > maxTotalMinor) return "amount";
  return null;
}
