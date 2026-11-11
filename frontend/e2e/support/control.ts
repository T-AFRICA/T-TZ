import { PORTS } from "../ports";

/** TEST ONLY: talks to the control endpoint of e2e/global-setup.ts. */
export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const response = await fetch(`http://127.0.0.1:${PORTS.control}/sql`, {
    method: "POST",
    body: JSON.stringify({ text, params }),
  });
  const body = (await response.json()) as T[] | { error: string };
  if (!response.ok || !Array.isArray(body)) throw new Error(`control sql failed: ${JSON.stringify(body)}`);
  return body;
}

/** Creates a confirmed customer in the stand-in auth server and auth.users. */
export async function createCustomer(email: string, password: string): Promise<{ id: string; email: string }> {
  const response = await fetch(`http://127.0.0.1:${PORTS.control}/users`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`control users failed: ${response.status}`);
  return (await response.json()) as { id: string; email: string };
}

export async function stockOf(slug: string): Promise<number> {
  const [row] = await sql<{ available: number }>(
    `select s.available from stock_levels s join products p on p.id = s.product_id where p.slug = $1 and s.country_code = 'TZ'`,
    [slug],
  );
  return Number(row?.available);
}

export async function setStock(slug: string, available: number): Promise<void> {
  await sql(`update stock_levels set available = $2 where product_id = (select id from products where slug = $1) and country_code = 'TZ'`, [
    slug,
    available,
  ]);
}

export async function setPriceMinor(slug: string, priceMinor: number): Promise<void> {
  await sql(
    `update product_country_prices set price_minor = $2 where product_id = (select id from products where slug = $1) and country_code = 'TZ'`,
    [slug, String(priceMinor)],
  );
}
