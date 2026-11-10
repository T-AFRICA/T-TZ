# Cart feature (Phase 5)

Cart service: server-computed totals in integer minor units with explicit currency; never trusts client prices.

## Interim browser cart (2026-11-10)

Until the cart service exists, `store.ts` keeps a guest cart and wishlist in
this browser's localStorage (`tronic.<country>.cart.v1` / `.wishlist.v1`).
Only product ids, chosen options and quantities are stored; `lines.ts`
prices every line from the catalogue on each render, and the subtotal is a
display value only. There is no checkout: `/cart` says so and its button is
disabled. When the service lands, `hooks.ts` keeps its shape and the stores
become its client cache.
