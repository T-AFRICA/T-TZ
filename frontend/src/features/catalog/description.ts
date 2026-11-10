/**
 * Short description shown when a product has no marketing copy yet. Generic
 * by design: it names only the category and says the real description comes
 * with the live catalogue, so nothing about the product is invented. Shared
 * by the product page and the search quick view so both say the same thing.
 */
export function placeholderDescription(categoryName: string): string {
  return `Reliable ${categoryName.toLowerCase()} for homes, businesses and industry. The full product description arrives with the live catalogue.`;
}
