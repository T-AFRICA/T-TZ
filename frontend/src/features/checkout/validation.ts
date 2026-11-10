import {
  DELIVERY_METHODS,
  TZ_REGIONS,
  defaultPaymentMethod,
  isPaymentMethodAvailable,
  type DeliveryMethodId,
  type PaymentMethodId,
} from "./config";

/**
 * Checkout form validation, shared by the browser (inline errors) and the
 * server (the order action, when it exists, must run the same checks and
 * never trust the browser's result). Plain functions, no dependency.
 */
export interface CheckoutForm {
  fullName: string;
  email: string;
  phone: string;
  deliveryMethod: DeliveryMethodId;
  region: string;
  district: string;
  ward: string;
  street: string;
  addressExtra: string;
  instructions: string;
  paymentMethod: PaymentMethodId | "";
}

export type CheckoutField = keyof CheckoutForm;
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export const EMPTY_CHECKOUT_FORM: CheckoutForm = {
  fullName: "",
  email: "",
  phone: "",
  deliveryMethod: "home",
  region: "",
  district: "",
  ward: "",
  street: "",
  addressExtra: "",
  instructions: "",
  paymentMethod: defaultPaymentMethod(),
};

export const FIELD_LIMITS = {
  fullName: 80,
  email: 254,
  phone: 20,
  district: 60,
  ward: 60,
  street: 120,
  addressExtra: 120,
  instructions: 300,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  else if (email.length > FIELD_LIMITS.email || !EMAIL.test(email)) errors.email = "Enter a valid email address, like name@example.com.";

  if (form.phone.trim().length === 0) errors.phone = "Enter your phone number.";
  else if (!normalizeTzPhone(form.phone)) errors.phone = "Enter a Tanzanian mobile number, like 0712 345 678.";

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
  }

  return errors;
}

/** Fields in the order they appear, so the first error can take focus. */
export const FIELD_ORDER: readonly CheckoutField[] = [
  "fullName",
  "email",
  "phone",
  "deliveryMethod",
  "region",
  "district",
  "ward",
  "street",
  "addressExtra",
  "instructions",
  "paymentMethod",
];
