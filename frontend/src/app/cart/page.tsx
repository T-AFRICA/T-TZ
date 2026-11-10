import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { ShopPageHeader } from "@/components/cart/ShopPageHeader";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

/** /cart — this browser's cart (features/cart); no checkout yet. */
export default function CartPage() {
  return (
    <>
      <ShopPageHeader eyebrow="Shopping cart" title="Your cart" />
      <CartView />
    </>
  );
}
