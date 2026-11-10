import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { cartStore, wishlistStore } from "@/features/cart/store";

// Newer Node versions ship their own `localStorage` global, which is
// undefined unless Node is started with --localstorage-file and shadows
// jsdom's. Tests then get a small in-memory Storage instead.
if (typeof window !== "undefined" && !window.localStorage) {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}

// RTL only auto-registers cleanup when test globals exist; we run without
// globals, so unmount rendered trees between tests explicitly.
afterEach(() => {
  cleanup();
  // Each test starts with an empty browser cart and wishlist.
  if (typeof window !== "undefined") {
    cartStore.set([]);
    wishlistStore.set([]);
    window.localStorage.clear();
  }
});
