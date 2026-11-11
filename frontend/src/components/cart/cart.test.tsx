import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@tronic/ui";
import { AddToCartButton } from "@/components/home/AddToCartButton";
import { formatPrice, getSampleProduct } from "@/components/home/sampleProducts";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { cartStore, wishlistStore } from "@/features/cart/store";
import { CartCountBadge, CartCountText } from "./CountBadge";
import { CartView } from "./CartView";
import { WishlistView } from "./WishlistView";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
}));

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const panel = getSampleProduct("sample-led-panel")!;
const extension = getSampleProduct("sample-extension")!;
const bulb = getSampleProduct("sample-led-bulb")!;

const dialogProto = HTMLDialogElement.prototype;
const originalDialog = { showModal: dialogProto.showModal, close: dialogProto.close };

beforeEach(() => {
  push.mockClear();
  // jsdom has no modal dialogs; enough of one for the options dialog.
  dialogProto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  dialogProto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(() => {
  dialogProto.showModal = originalDialog.showModal;
  dialogProto.close = originalDialog.close;
});

describe("product card buttons", () => {
  it("adds a product without options straight to the cart", async () => {
    const user = userEvent.setup();
    renderWithToast(
      <>
        <AddToCartButton product={panel} />
        <span>
          <CartCountBadge />
          <CartCountText />
        </span>
      </>,
    );
    await user.click(screen.getByRole("button", { name: `Add to cart: ${panel.name}` }));
    await user.click(screen.getByRole("button", { name: `Add to cart: ${panel.name}` }));
    expect(cartStore.get()).toEqual([{ productId: panel.id, color: null, variant: null, quantity: 2 }]);
    expect(screen.getByText(", 2 items")).toBeInTheDocument();
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(`Added 1 × ${panel.name} to your cart`);
  });

  it("asks for every option first, then Buy Now opens checkout without touching the cart", async () => {
    const user = userEvent.setup();
    renderWithToast(<AddToCartButton product={extension} />);
    await user.click(screen.getByRole("button", { name: /^Buy now: Extension Socket/ }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Buy Now" });
    expect(confirm).toBeDisabled();
    const colour = extension.colors![0]!.name;
    await user.click(within(dialog).getByRole("button", { name: colour }));
    await user.click(within(dialog).getByRole("button", { name: "4-way" }));
    await user.click(confirm);
    expect(cartStore.get()).toEqual([]);
    expect(push).toHaveBeenCalledWith(
      `/checkout?buy=${extension.id}&qty=1&color=${encodeURIComponent(colour)}&variant=4-way`,
    );
  });

  it("saves and removes a product with the heart", async () => {
    const user = userEvent.setup();
    renderWithToast(<WishlistButton productId={bulb.id} productName={bulb.name} />);
    const heart = screen.getByRole("button", { name: `Save ${bulb.name} to wishlist` });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    await user.click(heart);
    expect(wishlistStore.get()).toEqual([bulb.id]);
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(heart).toHaveAccessibleName(`Remove ${bulb.name} from wishlist`);
    await user.click(heart);
    expect(wishlistStore.get()).toEqual([]);
  });
});

describe("cart page", () => {
  it("shows an empty state", () => {
    renderWithToast(<CartView />);
    expect(screen.getByRole("heading", { name: "Your cart is empty" })).toBeInTheDocument();
  });

  it("prices lines from the catalogue, updates quantity and removes lines", async () => {
    const user = userEvent.setup();
    cartStore.set([
      { productId: bulb.id, color: null, variant: "Daylight", quantity: 2 },
      { productId: panel.id, color: null, variant: null, quantity: 1 },
      { productId: "sample-retired", color: null, variant: null, quantity: 1 },
    ]);
    renderWithToast(<CartView />);
    const summary = screen.getByRole("complementary", { name: "Order summary" });
    const subtotal = (count: number) => formatPrice(bulb.priceMinor * count + panel.priceMinor);
    expect(summary).toHaveTextContent(`Items3`);
    expect(summary).toHaveTextContent(subtotal(2));
    expect(screen.getByText("This product is no longer available.")).toBeInTheDocument();
    expect(within(summary).getByRole("link", { name: "Proceed to checkout" })).toHaveAttribute("href", "/checkout");

    const bulbQuantity = screen.getByRole("group", { name: `Quantity of ${bulb.name}` });
    await user.click(within(bulbQuantity).getByRole("button", { name: "Increase quantity" }));
    expect(cartStore.get()[0]!.quantity).toBe(3);
    expect(summary).toHaveTextContent(subtotal(3));

    await user.click(screen.getByRole("button", { name: `Remove ${bulb.name} (Daylight) from cart` }));
    expect(cartStore.get().map((line) => line.productId)).toEqual([panel.id, "sample-retired"]);
  });
});

describe("wishlist page", () => {
  it("lists saved products as cards and shows an empty state", () => {
    wishlistStore.set([bulb.id]);
    const { unmount } = renderWithToast(<WishlistView />);
    expect(screen.getByRole("link", { name: bulb.name })).toHaveAttribute("href", `/products/${bulb.slug}`);
    unmount();
    wishlistStore.set([]);
    renderWithToast(<WishlistView />);
    expect(screen.getByRole("heading", { name: "Your wishlist is empty" })).toBeInTheDocument();
  });
});
