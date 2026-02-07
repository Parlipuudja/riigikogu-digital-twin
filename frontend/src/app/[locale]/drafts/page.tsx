import { getTranslations } from "next-intl/server";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

export default async function DraftsPage() {
  const t = await getTranslations("drafts");

  let drafts: Awaited<ReturnType<typeof api.drafts>> = [];
  try {
    drafts = await api.drafts({ limit: 100 });
  } catch {
    // Service unavailable
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>

      <div className="space-y-3">
        {drafts.map((draft) => (
          <Link key={draft.uuid} href={`/drafts/${draft.uuid}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{draft.title}</h3>
                  {draft.number && (
                    <p className="text-sm text-muted-foreground">
                      #{draft.number}
                    </p>
                  )}
                  {draft.initiators && draft.initiators.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("initiators")}: {draft.initiators.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {draft.status && (
                    <Badge variant="secondary">{draft.status}</Badge>
                  )}
                  {draft.billType && (
                    <Badge variant="outline">{draft.billType}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {drafts.length === 0 && (
        <p className="mt-8 text-center text-muted-foreground">{t("noDrafts")}</p>
      )}
    </div>
  );
}
