import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getCollection } from "@/lib/data/mongodb";
import type { Draft } from "@/types";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "drafts" });

  return {
    title: `${t("title")} | Riigikogu Radar`,
    description: t("subtitle"),
  };
}

interface DraftItem {
  uuid: string;
  number: string;
  title: string;
  status: string;
  phase: string;
  submitDate: string;
  initiators: string[];
}

async function getDrafts(page: number, limit: number): Promise<{ drafts: DraftItem[]; total: number }> {
  try {
    const collection = await getCollection<Draft>("drafts");
    const skip = (page - 1) * limit;

    const [drafts, total] = await Promise.all([
      collection
        .find({})
        .sort({ proceedingDate: -1, submitDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments({}),
    ]);

    return {
      drafts: drafts.map((d) => ({
        uuid: d.uuid,
        number: d.number,
        title: d.title,
        status: typeof d.status === "object" ? d.status.value : d.status || "",
        phase: d.phase || "",
        submitDate: d.submitDate || d.proceedingDate || "",
        initiators: d.initiators || [],
      })),
      total,
    };
  } catch {
    return { drafts: [], total: 0 };
  }
}

export default async function DraftsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { page?: string };
}) {
  const t = await getTranslations({ locale, namespace: "drafts" });
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const limit = 20;

  const { drafts, total } = await getDrafts(page, limit);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600 mt-2">{t("subtitle")}</p>
        <p className="text-sm text-ink-500 mt-1">
          {total} {t("total")}
        </p>
      </div>

      {/* Draft list */}
      {drafts.length > 0 ? (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <DraftCard key={draft.uuid} draft={draft} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="card-content text-center py-12">
            <p className="text-ink-500">
              {t("noDrafts")}
            </p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination locale={locale} page={page} totalPages={totalPages} />
      )}
    </div>
  );
}

async function Pagination({ locale, page, totalPages }: { locale: string; page: number; totalPages: number }) {
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <div className="mt-8 flex justify-center gap-2">
      {page > 1 && (
        <Link
          href={`/${locale}/drafts?page=${page - 1}`}
          className="px-4 py-2 text-sm bg-ink-100 hover:bg-ink-200 rounded transition-colors"
        >
          &larr; {t("previous")}
        </Link>
      )}
      <span className="px-4 py-2 text-sm text-ink-600">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={`/${locale}/drafts?page=${page + 1}`}
          className="px-4 py-2 text-sm bg-ink-100 hover:bg-ink-200 rounded transition-colors"
        >
          {t("next")} &rarr;
        </Link>
      )}
    </div>
  );
}

async function DraftCard({ draft, locale }: { draft: DraftItem; locale: string }) {
  const t = await getTranslations({ locale, namespace: "drafts" });

  return (
    <Link href={`/${locale}/drafts/${draft.uuid}`} className="block">
      <div className="card hover:shadow-md transition-shadow">
        <div className="card-content">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-rk-700 font-medium">
                  {draft.number}
                </span>
                {draft.status && (
                  <span className="text-xs px-2 py-0.5 bg-ink-100 text-ink-600 rounded">
                    {draft.status}
                  </span>
                )}
              </div>
              <h3 className="text-ink-900 font-medium group-hover:text-rk-700">
                {draft.title}
              </h3>
              {draft.initiators.length > 0 && (
                <p className="text-sm text-ink-500 mt-1">
                  {t("initiators")}: {draft.initiators.slice(0, 3).join(", ")}
                  {draft.initiators.length > 3 && ` +${draft.initiators.length - 3}`}
                </p>
              )}
            </div>
            {draft.submitDate && (
              <div className="text-right shrink-0">
                <div className="text-xs text-ink-500">
                  {t("submitted")}
                </div>
                <div className="text-sm text-ink-700">{draft.submitDate}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
