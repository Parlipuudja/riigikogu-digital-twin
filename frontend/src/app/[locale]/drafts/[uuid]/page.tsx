import { getTranslations } from "next-intl/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";

const SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

async function getDraft(uuid: string) {
  const res = await fetch(`${SERVICE_URL}/drafts?limit=500`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const drafts = await res.json();
  return drafts.find((d: { uuid: string }) => d.uuid === uuid) || null;
}

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const t = await getTranslations("drafts");

  const draft = await getDraft(uuid);
  if (!draft) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{draft.title}</CardTitle>
          {draft.titleEn && (
            <p className="text-sm text-muted-foreground">{draft.titleEn}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.number && (
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Number:{" "}
              </span>
              <span className="font-mono">#{draft.number}</span>
            </div>
          )}
          <div className="flex gap-2">
            {draft.status && (
              <Badge variant="secondary">
                {t("status")}: {draft.status}
              </Badge>
            )}
            {draft.billType && (
              <Badge variant="outline">
                {t("type")}: {draft.billType}
              </Badge>
            )}
          </div>
          {draft.initiators && draft.initiators.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("initiators")}
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {draft.initiators.map((initiator: string, i: number) => (
                  <li key={i}>{initiator}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
