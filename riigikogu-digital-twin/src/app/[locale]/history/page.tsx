import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { VoteHistoryTable } from "@/components/vote-history-table";

export default function HistoryPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = useTranslations("history");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <VoteHistoryTable />
      </div>
    </div>
  );
}
