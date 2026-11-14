import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { ButtonLink, EmptyState, NotConnected, PageHeading, Panel, PortalPage, StatusBadge } from "@/components/account/ui";
import { createAccountService } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "Addresses" };

/**
 * /account/addresses — saved delivery addresses. There is no address table
 * or API yet, so nothing can be saved here: the page says so and lists the
 * fields an address will have. Until then each order keeps the address
 * typed at checkout (shown on the order's own page).
 */
export default async function AccountAddressesPage() {
  const user = await requireCustomer();
  const result = await createAccountService(user).listAddresses();

  return (
    <PortalPage>
      <PageHeading eyebrow="Delivery" title="Addresses" description="Delivery addresses saved to your account for faster checkout." />

      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
        {result.status === "not_connected" ? (
          <NotConnected
            icon={MapPin}
            title="Saved addresses are not available yet"
            body="You cannot save addresses to your account yet. For now, enter your delivery address at checkout; each order keeps the address you gave."
            waitingFor={result.waitingFor}
            action={<ButtonLink href="/account/orders" variant="outline">See addresses on my orders</ButtonLink>}
          />
        ) : result.data.length === 0 ? (
          <EmptyState icon={MapPin} title="No saved addresses" body="Add an address to check out faster next time." />
        ) : (
          <ul className="divide-y divide-[var(--color-light-grey)]" aria-label="Saved addresses">
            {result.data.map((address) => (
              <li key={address.id} className="p-4 md:p-5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{address.recipientName}</p>
                  {address.isDefault ? <StatusBadge tone="neutral">Default</StatusBadge> : null}
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {[address.street, address.ward, address.district, address.region].join(", ")}
                </p>
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{address.phone}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Panel title="What an address will include" labelledBy="address-fields">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
          {[
            "Recipient full name",
            "Tanzania phone number",
            "Region",
            "District",
            "Ward or area",
            "Street or building",
            "Delivery instructions",
            "A default address for checkout",
          ].map((field) => (
            <li key={field} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-action-red)]" />
              {field}
            </li>
          ))}
        </ul>
      </Panel>
    </PortalPage>
  );
}
