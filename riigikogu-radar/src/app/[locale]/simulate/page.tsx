import { getTranslations } from "next-intl/server";
import { SimulationForm } from "@/components/forms/simulation-form";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "simulation" });
  return {
    title: `${t("title")} | Riigikogu Radar`,
    description: t("subtitle"),
  };
}

export default async function SimulatePage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { q?: string; draftUuid?: string };
}) {
  const t = await getTranslations({ locale, namespace: "simulation" });

  return (
    <div className="page-container py-8">
      <h1 className="mb-2">{t("title")}</h1>
      <p className="text-ink-600 mb-8 max-w-2xl">{t("subtitle")}</p>

      <SimulationForm
        initialQuery={searchParams.q}
        draftUuid={searchParams.draftUuid}
        locale={locale}
      />
    </div>
  );
}
