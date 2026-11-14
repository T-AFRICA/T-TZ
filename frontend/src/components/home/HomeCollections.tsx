import { Container } from "@tronic/ui";
import { loadCollection } from "@/features/catalog/collections";
import { GridCollection, PanelCollection, SpotlightCollection } from "./CollectionSections";

/**
 * Homepage collections (owner brief 2026-11-12), directly under the
 * category rail; the brand banner that came first moved to the end of the
 * page (PromoBanner in app/page.tsx). Each
 * collection is read from the catalogue by its taxonomy scope (the same
 * scopes as the category pages its "View all" opens), in parallel.
 * Photography for the panels is the owner-supplied category art.
 */
export async function HomeCollections() {
  const [switchgear, extensions, spotlights, garden] = await Promise.all([
    loadCollection([{ category: "switchgear-protection" }]),
    loadCollection([{ category: "switches-sockets", group: "power-outlets-extensions" }]),
    loadCollection([
      { category: "lighting", group: "indoor-lighting", subcategory: "spotlights" },
      { category: "lighting", group: "indoor-lighting", subcategory: "tracklights" },
      { category: "lighting", group: "indoor-lighting", subcategory: "recessed-downlights" },
    ], 4),
    loadCollection([
      { category: "lighting", group: "outdoor-lighting", subcategory: "garden-gate-lights" },
      { category: "lighting", group: "outdoor-lighting", subcategory: "bollards-stand-lights" },
    ]),
  ]);

  return (
    <>
      <Container>
        <PanelCollection
          id="collection-switchgear"
          title="Switchgear & Protection"
          description="Circuit breakers, consumer units, distribution boards and surge protection."
          viewAllHref="/categories/switchgear-protection"
          viewAllLabel="View all"
          result={switchgear}
          photo={{
            src: "/categories/switchgear-protection.webp",
            alt: "Row of low-voltage switchgear panels in a plant room",
          }}
        />
        <GridCollection
          id="collection-extensions"
          title="Adapters & Extensions"
          description="Extension sockets, USB power strips and adaptors."
          viewAllHref="/categories/switches-sockets/power-outlets-extensions"
          result={extensions}
        />
        <SpotlightCollection
          id="collection-spotlights"
          title="Spotlights"
          description="Track spotlights, spot downlights and GU10 lamps for accent and architectural lighting."
          viewAllHref="/categories/lighting/indoor-lighting"
          result={spotlights}
          photo={{ src: "/categories/lighting.webp", alt: "Living room lit by pendant lamps and warm cove lighting" }}
        />
        <PanelCollection
          id="collection-garden"
          title="Garden Lights"
          description="Post lights, bollards and wall lights for gardens, paths and gates."
          viewAllHref="/categories/lighting/outdoor-lighting"
          viewAllLabel="Shop collection"
          result={garden}
          photo={{ src: "/categories/shop-by-use.webp", alt: "Modern villa at dusk with illuminated facade and pool" }}
          reverse
        />
      </Container>
    </>
  );
}
