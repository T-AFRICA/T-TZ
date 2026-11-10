"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  addLine,
  cartStore,
  removeLine,
  setLineQuantity,
  toggleId,
  wishlistStore,
  type CartLine,
} from "./store";

const EMPTY: readonly never[] = [];
const noopSubscribe = () => () => {};

/**
 * False while the server-rendered HTML is hydrating, true afterwards. The
 * server cannot see this browser's cart, so pages show a loading state
 * until this is true instead of flashing "Your cart is empty".
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function useCart() {
  const lines = useSyncExternalStore(cartStore.subscribe, cartStore.get, () => EMPTY);
  const add = useCallback((line: CartLine) => cartStore.set(addLine(cartStore.get(), line)), []);
  const setQuantity = useCallback(
    (key: string, quantity: number) => cartStore.set(setLineQuantity(cartStore.get(), key, quantity)),
    [],
  );
  const remove = useCallback((key: string) => cartStore.set(removeLine(cartStore.get(), key)), []);
  const clear = useCallback(() => cartStore.set([]), []);
  return useMemo(() => ({ lines, add, setQuantity, remove, clear }), [lines, add, setQuantity, remove, clear]);
}

/** Total units in the cart, for the header and tab bar badges. */
export function useCartCount(): number {
  const lines = useSyncExternalStore(cartStore.subscribe, cartStore.get, () => EMPTY);
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function useWishlist() {
  const ids = useSyncExternalStore(wishlistStore.subscribe, wishlistStore.get, () => EMPTY);
  /** Adds or removes the product; returns true when it is now saved. */
  const toggle = useCallback((id: string) => {
    const next = toggleId(wishlistStore.get(), id);
    wishlistStore.set(next);
    return next.includes(id);
  }, []);
  const remove = useCallback(
    (id: string) => wishlistStore.set(wishlistStore.get().filter((item) => item !== id)),
    [],
  );
  return useMemo(() => ({ ids, toggle, remove }), [ids, toggle, remove]);
}
