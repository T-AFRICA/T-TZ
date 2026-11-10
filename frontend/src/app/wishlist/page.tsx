import type { Metadata } from "next";
import { ShopPageHeader } from "@/components/cart/ShopPageHeader";
import { WishlistView } from "@/components/cart/WishlistView";

export const metadata: Metadata = {
  title: "Your wishlist",
  robots: { index: false, follow: false },
};

/** /wishlist — products saved with the heart on this device. */
export default function WishlistPage() {
  return (
    <>
      <ShopPageHeader eyebrow="Saved for later" title="Your wishlist" />
      <WishlistView />
    </>
  );
}
