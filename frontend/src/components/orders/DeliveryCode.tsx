import { KeyRound } from "lucide-react";

/**
 * The code a customer gives TRONIC's rider at the door (migration 0008).
 * Shown only to the customer, only while the order is on its way.
 */
export function DeliveryCode({ code }: { code: string }) {
  return (
    <section
      aria-labelledby="delivery-code-title"
      className="flex items-start gap-3 rounded-2xl border border-[var(--color-action-red)] bg-[#fff7f7] p-4 md:p-5"
    >
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-action-red)] text-white">
        <KeyRound size={20} />
      </span>
      <div className="min-w-0">
        <h2 id="delivery-code-title" className="text-sm font-semibold">
          Your delivery code
        </h2>
        <p className="mt-1 text-[1.75rem] font-bold leading-none tracking-[0.3em] tabular-nums" aria-label={`Delivery code ${code.split("").join(" ")}`}>
          {code}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          Give this code to the TRONIC rider only when you have your order in your hands. Do not share it by phone or message.
        </p>
      </div>
    </section>
  );
}
