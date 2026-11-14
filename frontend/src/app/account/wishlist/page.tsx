import type { Metadata } from "next";
import { WishlistView } from "@/components/cart/WishlistView";
import { PageHeading, PortalPage } from "@/components/account/ui";
import { requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "Wishlist" };

/**
 * /account/wishlist — the storefront's one wishlist (the same store as the
 * heart buttons and /wishlist), shown inside the portal. It is saved in
 * this browser for now; syncing it to the account needs a wishlist table
 * (docs/CUSTOMER-PORTAL.md).
 */
export default async function AccountWishlistPage() {
  await requireCustomer();
  return (
    <PortalPage>
      <PageHeading
        eyebrow="Saved for later"
        title="Wishlist"
        description="Products you saved with the heart. They are stored on this device, so they will not appear on your other devices yet."
      />
      <WishlistView embedded />
    </PortalPage>
  );
}
