import type { Metadata } from "next";
import { Container } from "@tronic/ui";
import { ShopPageHeader } from "@/components/cart/ShopPageHeader";
import { TrackOrderView } from "@/components/orders/TrackOrderView";
import { ordersEnabledForRequest } from "@/features/data/source";

export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
};

/** /track-order — the lookup form (POST) and status guide; lookups need online ordering (DATA_SOURCE=database). */
export default async function TrackOrderPage() {
  return (
    <>
      <ShopPageHeader eyebrow="Order status" title="Track your order" />
      <Container className="py-6 lg:py-8">
        <TrackOrderView enabled={await ordersEnabledForRequest()} />
      </Container>
    </>
  );
}
