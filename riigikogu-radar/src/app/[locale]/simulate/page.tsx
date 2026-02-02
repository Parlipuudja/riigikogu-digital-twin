import { getTranslations } from "next-intl/server";
import { SimulationForm } from "@/components/forms/simulation-form";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "simulation" });
  return {
    title: `${t("title")} | Riigikogu Radar`,
  };
}

export default async function SimulatePage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { q?: string };
}) {
  const t = await getTranslations({ locale, namespace: "simulation" });

  return (
    <div className="page-container py-8">
      <h1 className="mb-2">{t("title")}</h1>
      <p className="text-ink-600 mb-8 max-w-2xl">
        {locale === "et"
          ? "Sisesta eelnõu ja vaata, kuidas kogu parlament tõenäoliselt hääletaks."
          : "Enter a bill and see how the entire parliament would likely vote."}
      </p>

      <SimulationForm initialQuery={searchParams.q} locale={locale} />
    </div>
  );
}
