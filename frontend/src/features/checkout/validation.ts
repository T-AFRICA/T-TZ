import { offeredMobileMoneyProviders, payOnDeliveryRefusal } from "@tronic/country-config";
import {
  DELIVERY_METHODS,
  PAYMENT_POLICY,
  TZ_REGIONS,
  defaultPaymentMethod,
  isPaymentMethodAvailable,
  type DeliveryMethodId,
  type PaymentMethodId,
} from "./config";
import { DEFAULT_DIAL_CODE, OTHER_DIAL_CODE, isDialCode, normalizeWhatsApp } from "./phone";

/**
 * Checkout form validation, shared by the browser (inline errors) and the
 * server (the order action, when it exists, must run the same checks and
 * never trust the browser's result). Plain functions, no dependency.
 */
export interface CheckoutForm {
  fullName: string;
  email: string;
  /** The WhatsApp number as typed: without its country code, or in full with a plus sign. */
  phone: string;
  /** The country code chosen for it ("+255"), or "" for a country that is not in the list. */
  phoneCountry: string;
  deliveryMethod: DeliveryMethodId;
  region: string;
  district: string;
  ward: string;
  street: string;
  addressExtra: string;
  instructions: string;
  paymentMethod: PaymentMethodId | "";
  /** Mobile money only: the wallet and the number that receives the payment prompt. */
  walletProvider: string;
  walletNumber: string;
}

export type CheckoutField = keyof CheckoutForm;
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export const EMPTY_CHECKOUT_FORM: CheckoutForm = {
  fullName: "",
  email: "",
  phone: "",
  phoneCountry: DEFAULT_DIAL_CODE,
  deliveryMethod: "home",
  region: "",
  district: "",
  ward: "",
  street: "",
  addressExtra: "",
  instructions: "",
  paymentMethod: defaultPaymentMethod(),
  walletProvider: "",
  walletNumber: "",
};

/** Copies only the known checkout fields, as strings, from untrusted input. */
export function readCheckoutForm(raw: unknown): CheckoutForm {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const form = { ...EMPTY_CHECKOUT_FORM };
  for (const key of Object.keys(form) as (keyof CheckoutForm)[]) {
    const value = source[key];
    if (typeof value === "string") (form as Record<string, string>)[key] = value;
  }
  return form;
}

export const FIELD_LIMITS = {
  fullName: 80,
  email: 254,
  phone: 20,
  district: 60,
  ward: 60,
  street: 120,
  addressExtra: 120,
  instructions: 300,
  walletNumber: 20,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Basic email shape check, shared by checkout and the account forms. */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length > 0 && email.length <= FIELD_LIMITS.email && EMAIL.test(email);
}

/**
 * Normalises a Tanzanian mobile number to +255XXXXXXXXX, or returns null.
 * Accepts 0712 345 678, 712345678, 255712345678 and +255 712 345 678;
 * mobile numbers start with 6 or 7 after the country code.
 */
export function normalizeTzPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  const match = /^(?:\+?255|0)?([67]\d{8})$/.exec(digits);
  return match ? `+255${match[1]}` : null;
}

function text(value: string, min: number, max: number, label: string, required: boolean): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return required ? `Enter ${label}.` : undefined;
  if (trimmed.length < min) return `${label[0]!.toUpperCase()}${label.slice(1)} looks too short.`;
  if (trimmed.length > max) return `Keep ${label} under ${max} characters.`;
  return undefined;
}

export function validateCheckout(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const set = (field: CheckoutField, message: string | undefined) => {
    if (message) errors[field] = message;
  };

  const name = form.fullName.trim();
  set("fullName", text(form.fullName, 2, FIELD_LIMITS.fullName, "your full name", true));
  if (!errors.fullName && !/\p{L}/u.test(name)) errors.fullName = "Enter your full name.";

  const email = form.email.trim();
  if (email.length === 0) errors.email = "Enter your email address.";
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address, like name@example.com.";

  // A country code that is not from the list is not used: the number must then carry its own.
  const dialCode = isDialCode(form.phoneCountry) ? form.phoneCountry : OTHER_DIAL_CODE;
  if (form.phone.trim().length === 0) errors.phone = "Enter your WhatsApp number.";
  else if (form.phone.trim().length > FIELD_LIMITS.phone || !normalizeWhatsApp(form.phone, dialCode)) {
    errors.phone =
      dialCode === OTHER_DIAL_CODE
        ? "Enter the number in full, with + and its country code, like +255 712 345 678."
        : dialCode === DEFAULT_DIAL_CODE
          ? "Enter a Tanzanian mobile number, like 712 345 678, or choose another country code."
          : `Enter a WhatsApp number for ${dialCode}, without the country code.`;
  }

  const method = DELIVERY_METHODS.find((item) => item.id === form.deliveryMethod);
  if (!method || !method.enabled) {
    errors.deliveryMethod = "Choose an available delivery option.";
  }

  if (form.deliveryMethod === "home") {
    if (!(TZ_REGIONS as readonly string[]).includes(form.region)) errors.region = "Choose your region.";
    set("district", text(form.district, 2, FIELD_LIMITS.district, "your district or city", true));
    set("ward", text(form.ward, 2, FIELD_LIMITS.ward, "your ward or area", true));
    set("street", text(form.street, 3, FIELD_LIMITS.street, "the street or building", true));
  }
  set("addressExtra", text(form.addressExtra, 0, FIELD_LIMITS.addressExtra, "the extra address details", false));
  set("instructions", text(form.instructions, 0, FIELD_LIMITS.instructions, "the delivery instructions", false));

  if (!isPaymentMethodAvailable(form.paymentMethod)) {
    errors.paymentMethod = "Choose an available payment method.";
  } else if (form.paymentMethod === "pay_on_delivery" && form.deliveryMethod === "home") {
    if (payOnDeliveryRefusal(PAYMENT_POLICY, form.region, null) === "region") {
      errors.paymentMethod = `Cash on delivery isn't offered in ${form.region} yet. Choose another payment method.`;
    }
  } else if (form.paymentMethod === "mobile_money") {
    if (!offeredMobileMoneyProviders(PAYMENT_POLICY).some((provider) => provider.id === form.walletProvider)) {
      errors.walletProvider = "Choose your mobile money provider.";
    }
    if (form.walletNumber.trim().length === 0) errors.walletNumber = "Enter the number of your mobile money wallet.";
    else if (!normalizeTzPhone(form.walletNumber)) errors.walletNumber = "Enter a Tanzanian mobile number, like 0712 345 678.";
  }

  return errors;
}

/** Fields in the order they appear, so the first error can take focus. */
export const FIELD_ORDER: readonly CheckoutField[] = [
  "fullName",
  "email",
  "phoneCountry",
  "phone",
  "deliveryMethod",
  "region",
  "district",
  "ward",
  "street",
  "addressExtra",
  "instructions",
  "paymentMethod",
  "walletProvider",
  "walletNumber",
];
