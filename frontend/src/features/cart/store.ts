import { ACTIVE_COUNTRY } from "@tronic/country-config";

/**
 * Guest cart and wishlist kept in this browser (owner request 2026-11-10:
 * working cart and wishlist on every device before accounts exist).
 *
 * What is stored is only product ids, chosen options and quantities, never
 * prices or names: every page looks the product up in the catalogue when it
 * renders, so a price edited in storage changes nothing. Keys carry the
 * country, so another country's storefront never reads this cart.
 *
 * This is a per-device convenience, not an order: there is no checkout,
 * nothing reaches a server, and clearing site data empties it. When the
 * cart service lands (Module 02 / Phase 5) these stores become its
 * client cache; the hooks in ./hooks.ts keep their shape.
 *
 * Storage can be missing or throw (private windows, blocked site data);
 * then the stores work in memory for the visit. Corrupt or tampered
 * entries are dropped on read.
 */
export const MAX_LINE_QUANTITY = 10;
export const MAX_CART_LINES = 50;
export const MAX_WISHLIST_ITEMS = 100;

const country = ACTIVE_COUNTRY.code.toLowerCase();
export const CART_STORAGE_KEY = `tronic.${country}.cart.v1`;
export const WISHLIST_STORAGE_KEY = `tronic.${country}.wishlist.v1`;

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const OPTION_MAX_LENGTH = 60;

export interface CartLine {
  productId: string;
  /** Chosen colour name, or null when the product has no colours. */
  color: string | null;
  /** Chosen variant, or null when the product has no variants. */
  variant: string | null;
  quantity: number;
}

/** One line per product and option combination. */
export function lineKey(line: Pick<CartLine, "productId" | "color" | "variant">): string {
  return JSON.stringify([line.productId, line.color, line.variant]);
}

function isOption(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length > 0 && value.length <= OPTION_MAX_LENGTH);
}

export function parseCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: CartLine[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { productId, color, variant, quantity } = item as Record<string, unknown>;
    if (typeof productId !== "string" || !PRODUCT_ID.test(productId)) continue;
    if (!isOption(color) || !isOption(variant)) continue;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) continue;
    const line: CartLine = { productId, color, variant, quantity: Math.min(quantity, MAX_LINE_QUANTITY) };
    const key = lineKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
    if (lines.length >= MAX_CART_LINES) break;
  }
  return lines;
}

export function parseWishlist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((id): id is string => typeof id === "string" && PRODUCT_ID.test(id));
  return [...new Set(ids)].slice(0, MAX_WISHLIST_ITEMS);
}

/** A list kept in localStorage, shared by every component and tab. */
export interface ListStore<T> {
  get(): readonly T[];
  set(next: readonly T[]): void;
  subscribe(listener: () => void): () => void;
}

const EMPTY: readonly never[] = Object.freeze([]);

export function createListStore<T>(key: string, parse: (raw: unknown) => T[]): ListStore<T> {
  let value: readonly T[] | null = null;
  const listeners = new Set<() => void>();

  function read(): readonly T[] {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? Object.freeze(parse(JSON.parse(raw))) : EMPTY;
    } catch {
      return EMPTY;
    }
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  function onStorage(event: StorageEvent) {
    // Another tab changed (or cleared) this list.
    if (event.key === key || event.key === null) {
      value = read();
      notify();
    }
  }

  return {
    get() {
      if (typeof window === "undefined") return EMPTY;
      if (value === null) value = read();
      return value;
    },
    set(next) {
      value = Object.freeze([...next]);
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage full or blocked: keep the in-memory value for this visit.
      }
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export const cartStore = createListStore(CART_STORAGE_KEY, parseCart);
export const wishlistStore = createListStore(WISHLIST_STORAGE_KEY, parseWishlist);

/** Adds a line, or raises the quantity of the same product and options (capped). */
export function addLine(lines: readonly CartLine[], line: CartLine): CartLine[] {
  const key = lineKey(line);
  const quantity = Math.min(Math.max(1, Math.floor(line.quantity)), MAX_LINE_QUANTITY);
  const existing = lines.find((item) => lineKey(item) === key);
  if (existing) {
    return lines.map((item) =>
      item === existing ? { ...item, quantity: Math.min(item.quantity + quantity, MAX_LINE_QUANTITY) } : item,
    );
  }
  // Newest first; the oldest line drops off at the cap.
  return [{ ...line, quantity }, ...lines].slice(0, MAX_CART_LINES);
}

export function setLineQuantity(lines: readonly CartLine[], key: string, quantity: number): CartLine[] {
  const next = Math.min(Math.max(1, Math.floor(quantity)), MAX_LINE_QUANTITY);
  return lines.map((item) => (lineKey(item) === key ? { ...item, quantity: next } : item));
}

export function removeLine(lines: readonly CartLine[], key: string): CartLine[] {
  return lines.filter((item) => lineKey(item) !== key);
}

export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [id, ...ids].slice(0, MAX_WISHLIST_ITEMS);
}
