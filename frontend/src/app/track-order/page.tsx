import type { Metadata } from "next";
import { Container } from "@tronic/ui";
import { ShopPageHeader } from "@/components/cart/ShopPageHeader";
import { TrackOrderView } from "@/components/orders/TrackOrderView";

export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
};

/** /track-order — the form and status guide; lookups start with online ordering. */
export default function TrackOrderPage() {
  return (
    <>
      <ShopPageHeader eyebrow="Order status" title="Track your order" />
      <Container className="py-6 lg:py-8">
        <TrackOrderView />
      </Container>
    </>
  );
}
