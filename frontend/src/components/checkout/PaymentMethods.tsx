"use client";

import type { ReactNode } from "react";
import { offeredMobileMoneyProviders } from "@tronic/country-config";
import { BankIcon, BanknoteIcon, CheckCircleIcon, CreditCardIcon, Input, LockIcon, SmartphoneIcon, type IconProps } from "@tronic/ui";
import { formatPrice } from "@/components/home/sampleProducts";
import { PAYMENT_METHODS, PAYMENT_POLICY, type PaymentMethod, type PaymentMethodId } from "@/features/checkout/config";
import { FIELD_LIMITS, type CheckoutErrors, type CheckoutField, type CheckoutForm } from "@/features/checkout/validation";

const ICONS: Record<PaymentMethodId, (props: IconProps) => ReactNode> = {
  mobile_money: SmartphoneIcon,
  card: CreditCardIcon,
  bank_transfer: BankIcon,
  pay_on_delivery: BanknoteIcon,
};

/** Methods the customer can choose; the rest are listed below as coming later. */
const AVAILABLE: readonly PaymentMethod[] = PAYMENT_METHODS.filter((method) => method.status !== "unavailable");
const COMING: readonly PaymentMethod[] = PAYMENT_METHODS.filter((method) => method.status === "unavailable");

export const PAYMENT_LABELS: Record<PaymentMethodId, string> = Object.fromEntries(
  PAYMENT_METHODS.map((method) => [method.id, method.label]),
) as Record<PaymentMethodId, string>;

interface Props {
  form: CheckoutForm;
  errors: CheckoutErrors;
  touched: Partial<Record<CheckoutField, boolean>>;
  totalMinor: number;
  totalIsPartial: boolean;
  onChange: (field: CheckoutField, value: string) => void;
  onBlur: (field: CheckoutField) => void;
}

/**
 * Payment step of the checkout (payment module brief, 2026-11-18).
 *
 * Every method and wallet comes from the country's payment policy
 * (@tronic/country-config). A method that is not approved and connected is
 * shown as "Coming soon" and cannot be chosen; its fields never appear.
 * Choosing a method only records the choice: no payment is started from
 * the browser, and nothing here can mark a payment as paid.
 *
 * Mobile money takes the wallet and the number that receives the prompt;
 * the customer approves it on their own phone and never types a PIN here.
 * Card payments happen on the provider's hosted page, so no card field
 * exists in TRONIC's pages.
 */
export function PaymentMethods({ form, errors, touched, totalMinor, totalIsPartial, onChange, onBlur }: Props) {
  const selected = PAYMENT_METHODS.find((method) => method.id === form.paymentMethod && method.status !== "unavailable");
  const error = (field: CheckoutField) => (touched[field] ? errors[field] : undefined);

  return (
    <div>
      <fieldset aria-describedby="payment-security">
        <legend className="sr-only">Payment method</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {AVAILABLE.map((method) => {
            const checked = form.paymentMethod === method.id;
            const Icon = ICONS[method.id];
            return (
              <label
                key={method.id}
                data-payment-method={method.id}
                className={`relative flex min-h-[4.75rem] cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-[border-color,background-color,box-shadow] duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-action-red)] has-[:focus-visible]:ring-offset-2 ${
                  checked
                    ? "border-[var(--color-action-red)] bg-[#fff7f7] shadow-[0_8px_22px_-14px_rgba(215,25,32,0.55)] ring-1 ring-[var(--color-action-red)]"
                    : "border-[var(--color-light-grey)] bg-white hover:border-[var(--color-mid-grey)]"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  checked={checked}
                  onChange={() => onChange("paymentMethod", method.id)}
                  onBlur={() => onBlur("paymentMethod")}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-200 ${
                    checked ? "bg-[var(--color-action-red)] text-white" : "bg-[var(--surface-card)] text-[var(--text-primary)]"
                  }`}
                >
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{method.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-[var(--text-muted)]">{method.description}</span>
                  {method.status === "sandbox" ? (
                    <span className="mt-1.5 inline-block rounded-full bg-[#fff4e0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8a5300]">
                      Test mode
                    </span>
                  ) : null}
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full transition-[color,border-color] duration-200 ${
                    checked ? "text-[var(--color-action-red)]" : "border-2 border-[var(--color-light-grey)] text-transparent"
                  }`}
                >
                  {checked ? <CheckCircleIcon size={20} /> : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error("paymentMethod") ? (
        <p role="alert" className="mt-2 text-xs font-medium text-[var(--color-action-red)]">
          {error("paymentMethod")}
        </p>
      ) : null}

      {selected ? (
        <div key={selected.id} className="account-enter mt-3 rounded-2xl border border-[var(--color-light-grey)] bg-white p-4" aria-live="polite">
          <MethodDetail
            method={selected.id}
            form={form}
            totalMinor={totalMinor}
            totalIsPartial={totalIsPartial}
            walletProviderError={error("walletProvider")}
            walletNumberError={error("walletNumber")}
            onChange={onChange}
            onBlur={onBlur}
          />
        </div>
      ) : null}

      {COMING.length > 0 ? (
        <fieldset className="mt-5" disabled>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Coming soon</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {COMING.map((method) => {
              const Icon = ICONS[method.id];
              return (
                <label
                  key={method.id}
                  data-payment-method={method.id}
                  className="flex cursor-not-allowed items-center gap-2.5 rounded-xl border border-dashed border-[var(--color-light-grey)] bg-[var(--surface-card)] px-3 py-2.5"
                >
                  <input type="radio" name="paymentMethod" value={method.id} checked={false} disabled readOnly className="sr-only" />
                  <Icon size={18} className="shrink-0 text-[var(--text-muted)]" />
                  <span className="min-w-0 text-sm font-medium text-[var(--text-secondary)]">{method.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <p id="payment-security" className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--text-secondary)]">
        <LockIcon size={14} className="mt-0.5 shrink-0 text-[var(--color-success)]" />
        <span>
          Secure checkout. Prices are checked on our server. TRONIC never asks for your mobile money PIN and never sees or
          stores card details.
        </span>
      </p>
    </div>
  );
}

function MethodDetail({
  method,
  form,
  totalMinor,
  totalIsPartial,
  walletProviderError,
  walletNumberError,
  onChange,
  onBlur,
}: {
  method: PaymentMethodId;
  form: CheckoutForm;
  totalMinor: number;
  totalIsPartial: boolean;
  walletProviderError: string | undefined;
  walletNumberError: string | undefined;
  onChange: (field: CheckoutField, value: string) => void;
  onBlur: (field: CheckoutField) => void;
}) {
  const amount = `${formatPrice(totalMinor)}${totalIsPartial ? " plus any delivery fee" : ""}`;

  if (method === "pay_on_delivery") {
    return (
      <div className="text-sm leading-relaxed">
        <p className="font-semibold">Pay when it arrives</p>
        <p className="mt-1 text-[var(--text-secondary)]">
          Have {amount} ready in cash for the delivery team. Your order shows as paid once it is delivered.
        </p>
      </div>
    );
  }

  if (method === "mobile_money") {
    const providers = offeredMobileMoneyProviders(PAYMENT_POLICY);
    return (
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Mobile money provider</legend>
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => {
              const checked = form.walletProvider === provider.id;
              return (
                <label
                  key={provider.id}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-action-red)] ${
                    checked
                      ? "border-[var(--color-action-red)] bg-[var(--color-action-red)] text-white"
                      : "border-[var(--color-light-grey)] bg-white hover:border-[var(--color-mid-grey)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="walletProvider"
                    value={provider.id}
                    checked={checked}
                    onChange={() => onChange("walletProvider", provider.id)}
                    onBlur={() => onBlur("walletProvider")}
                    className="sr-only"
                  />
                  {provider.name}
                </label>
              );
            })}
          </div>
          {walletProviderError ? (
            <p role="alert" className="mt-2 text-xs font-medium text-[var(--color-action-red)]">
              {walletProviderError}
            </p>
          ) : null}
        </fieldset>
        <Input
          id="checkout-wallet-number"
          name="walletNumber"
          label="Mobile money number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="0712 345 678"
          maxLength={FIELD_LIMITS.walletNumber}
          hint="The +255 number that gets the payment prompt."
          value={form.walletNumber}
          error={walletNumberError}
          onChange={(event) => onChange("walletNumber", event.target.value)}
          onBlur={() => onBlur("walletNumber")}
        />
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          After you place your order, a prompt for {amount} appears on this phone. Approve it there with your PIN. Your order
          is confirmed only when the provider confirms the payment to us.
        </p>
      </div>
    );
  }

  if (method === "card") {
    return (
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        After you place your order you continue to our payment provider&apos;s secure page to pay {amount} by Visa or
        Mastercard. Card details are entered there, never on TRONIC&apos;s site.
      </p>
    );
  }

  // Bank transfer: only accounts TRONIC has confirmed are configured.
  return (
    <div className="space-y-3 text-sm">
      <p className="leading-relaxed text-[var(--text-secondary)]">
        Transfer {amount} after you place your order, using your order number as the payment reference. We ship once the
        transfer is confirmed.
      </p>
      <ul className="space-y-2">
        {PAYMENT_POLICY.bankAccounts.map((account) => (
          <li key={account.accountNumber} className="rounded-xl bg-[var(--surface-card)] px-3 py-2.5">
            <p className="font-semibold">{account.bankName}</p>
            <p className="text-[var(--text-secondary)]">{account.accountName}</p>
            <p className="font-medium tabular-nums">{account.accountNumber}</p>
            {account.branch ? <p className="text-xs text-[var(--text-muted)]">Branch: {account.branch}</p> : null}
            {account.swiftCode ? <p className="text-xs text-[var(--text-muted)]">SWIFT: {account.swiftCode}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
