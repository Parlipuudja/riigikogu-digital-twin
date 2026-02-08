import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { api } from "@/lib/api";
import { MPCard } from "@/components/mps/mp-card";
import { MPFilters } from "./filters";

export default async function MPsPage({
  searchParams,
}: {
  searchParams: Promise<{ party?: string; sort?: string }>;
}) {
  const t = await getTranslations("mps");
  const locale = await getLocale();
  const params = await searchParams;

  let mps: Awaited<ReturnType<typeof api.mps>> = [];
  try {
    mps = await api.mps({
      party: params.party,
      sort: params.sort,
      active: "true",
    });
  } catch {
    // Service unavailable
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>

      <MPFilters currentParty={params.party} currentSort={params.sort} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mps.map((mp) => (
          <MPCard key={mp.slug} mp={mp} locale={locale} />
        ))}
      </div>

      {mps.length === 0 && (
        <p className="mt-8 text-center text-muted-foreground">
          {t("search")}
        </p>
      )}
    </div>
  );
}
