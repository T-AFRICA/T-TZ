import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/products";
import { Notice, PageHeader, Panel, buttonClass } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { createProductAction } from "@/features/products/actions";
import { EMPTY_PRODUCT_FORM, placementChoices } from "@/features/products/form";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "New product" };

/** A new product, saved in the country as a draft. Photos are added on its page afterwards. */
export default async function NewProductPage({ params }: { params: Promise<{ country: string }> }) {
  const { admin, country } = await requireCountry((await params).country, "products.create");
  const api = await countryApiFor(admin, country);
  const options = await api.catalogueOptions(admin.actor.userId);
  const back = `/c/${country.id}/products`;

  return (
    <>
      <PageHeader
        eyebrow={`${country.name} · Products`}
        title="New product"
        description="It is saved as a draft: not on the website until someone who may publish products makes it live. Add photos on the next page."
        actions={
          <Link href={back} className={buttonClass.secondary}>
            All products
          </Link>
        }
      />
      {!options.available ? (
        <Notice tone="warn" title="Products cannot be created right now">
          {SERVICE_UNAVAILABLE_TEXT[options.reason]}
        </Notice>
      ) : (
        <Panel title="Details">
          <ProductForm
            action={createProductAction}
            countryId={country.id}
            currency={options.data.currency}
            currencyExponent={options.data.currencyExponent}
            initial={EMPTY_PRODUCT_FORM}
            placements={placementChoices(options.data)}
            brands={options.data.brands}
            submitLabel="Create draft"
          />
        </Panel>
      )}
    </>
  );
}
