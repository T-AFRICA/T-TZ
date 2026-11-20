import { getPublicProductImage } from "@tronic/database";
import { getDb, ordersEnabled } from "@/features/data/source";

/**
 * /media/products/<id> — a product photo uploaded from the Central Admin
 * (country migration 0016, owner decision 2026-11-20: photos live in this
 * country's database, served from this site's own address).
 *
 * Only photos of live products are served; anything else is a 404 with no
 * hint whether the photo exists. A photo never changes once uploaded (a new
 * photo gets a new id), so browsers and the image optimiser may keep it for
 * a year.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60", "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id) || !ordersEnabled()) return notFound();
  const image = await getPublicProductImage(getDb(), id);
  if (!image) return notFound();
  return new Response(Buffer.from(image.bytes), {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
