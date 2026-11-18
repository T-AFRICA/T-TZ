import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ORDER_NUMBER_PATTERN } from "@tronic/api-contracts";
import { DeliverForm, FailedAttemptForm } from "@/components/deliveries";
import { ConfirmAction } from "@/components/forms";
import { Notice, PageHeader, Panel, StatusPill, buttonClass } from "@/components/ui";
import { riderStepAction } from "@/features/deliveries/actions";
import { FAILURE_REASON_LABEL, RIDER_STEP, mapsSearchUrl } from "@/features/deliveries/labels";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, formatMinor } from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Delivery" };

/** One of the rider's deliveries: who, where, what to collect, and the next step. */
export default async function DeliveryPage({ params }: { params: Promise<{ country: string; orderNumber: string }> }) {
  const { country: countryId, orderNumber: raw } = await params;
  const { admin, country } = await requireCountry(countryId, "deliveries.perform");
  const orderNumber = decodeURIComponent(raw).toUpperCase();
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();

  const api = await countryApiFor(admin, country);
  const result = await api.getMyDelivery(admin.actor.userId, orderNumber);
  const back = `/c/${country.id}/deliveries`;
  if (!result.available) {
    return (
      <>
        <PageHeader eyebrow={country.name} title={`Delivery ${orderNumber}`} />
        <Notice tone="warn" title="This delivery cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      </>
    );
  }
  if (!result.data.ok) notFound();
  const delivery = result.data.delivery;
  const amount = (minor: number) => formatMinor(minor, delivery.currency, delivery.currencyExponent);
  const place = delivery.delivery;
  const address = [place.street, place.extra, place.ward, place.district, place.region].filter(Boolean).join(", ");
  const maps = mapsSearchUrl([place.street, place.ward, place.district, place.region]);
  const step = RIDER_STEP[delivery.status];
  const onTheWay = delivery.status === "dispatched" || delivery.status === "in_transit";

  return (
    <>
      <PageHeader
        eyebrow={`${country.name} · My deliveries`}
        title={delivery.contact.name}
        description={`Order ${delivery.orderNumber} · given to you ${formatDateTime(delivery.assignedAt)}`}
        actions={
          <>
            <StatusPill tone={ORDER_STATUS_TONE[delivery.status]}>{ORDER_STATUS_LABEL[delivery.status]}</StatusPill>
            <Link href={back} className={buttonClass.secondary}>
              All deliveries
            </Link>
          </>
        }
      />

      <Panel title="Where">
        <div className="flex flex-col gap-3">
          <p className="text-base text-ink [overflow-wrap:anywhere]">{address || "No address given"}</p>
          {place.notes ? <p className="rounded-lg bg-raised px-3 py-2 text-sm text-ink">Customer&apos;s note: {place.notes}</p> : null}
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${delivery.contact.phone}`} className={buttonClass.primary}>
              Call {delivery.contact.phone}
            </a>
            {maps ? (
              <a href={maps} target="_blank" rel="noopener noreferrer" className={buttonClass.secondary}>
                Open in Maps
              </a>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel title="What">
        <ul className="flex flex-col gap-2 text-sm">
          {delivery.lines.map((line, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span className="text-ink [overflow-wrap:anywhere]">
                {line.name}
                {line.color || line.variant ? <span className="text-muted"> · {[line.color, line.variant].filter(Boolean).join(" · ")}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums text-muted">× {line.quantity}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3 text-base font-semibold text-ink">
          {delivery.cashToCollectMinor > 0 ? `Collect ${amount(delivery.cashToCollectMinor)} in cash` : "Already paid: collect nothing"}
        </p>
      </Panel>

      {delivery.status === "delivered" ? (
        <Notice tone="ok" title="Delivered">
          Delivered {delivery.deliveredAt ? formatDateTime(delivery.deliveredAt) : ""}. Nothing more to do.
        </Notice>
      ) : step ? (
        <Panel title="Next step" description={step.description}>
          <ConfirmAction
            action={riderStepAction}
            fields={{ countryId: country.id, orderNumber: delivery.orderNumber, step: step.action }}
            label={step.label}
            title={`${step.label}?`}
            description={step.description}
            confirmLabel={step.label}
            variant="primary"
          />
        </Panel>
      ) : delivery.status === "in_transit" ? (
        <Panel title="Hand over the order" description="Ask for the code once the customer has the order. Then take a photo and let them sign.">
          {delivery.codeLockedUntil ? (
            <Notice tone="warn" title="Locked for now">
              Too many wrong codes. Try again after {formatDateTime(delivery.codeLockedUntil)}, or call your order manager.
            </Notice>
          ) : (
            <DeliverForm countryId={country.id} orderNumber={delivery.orderNumber} cashText={delivery.cashToCollectMinor > 0 ? amount(delivery.cashToCollectMinor) : null} />
          )}
        </Panel>
      ) : (
        <Notice tone="info">This order is not ready to leave yet. It is &quot;{ORDER_STATUS_LABEL[delivery.status]}&quot;.</Notice>
      )}

      {onTheWay ? (
        <Panel title="Could not deliver?" description="Record what happened. The order stays with you so you can try again.">
          <FailedAttemptForm countryId={country.id} orderNumber={delivery.orderNumber} />
        </Panel>
      ) : null}

      {delivery.attempts.length > 0 ? (
        <Panel title="Earlier attempts">
          <ul className="flex flex-col gap-2 text-sm">
            {delivery.attempts.map((attempt, index) => (
              <li key={index}>
                <span className="text-ink">{FAILURE_REASON_LABEL[attempt.reason]}</span>
                <span className="text-muted"> · {formatDateTime(attempt.createdAt)}</span>
                {attempt.note ? <p className="text-muted [overflow-wrap:anywhere]">{attempt.note}</p> : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
