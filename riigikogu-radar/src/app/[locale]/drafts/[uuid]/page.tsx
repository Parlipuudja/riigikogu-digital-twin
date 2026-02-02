import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection } from "@/lib/data/mongodb";
import type { Draft, Voting } from "@/types";

export async function generateMetadata({
  params: { locale, uuid },
}: {
  params: { locale: string; uuid: string };
}) {
  const t = await getTranslations({ locale, namespace: "common" });
  const draft = await getDraft(uuid);

  if (!draft) {
    return { title: t("notFound") };
  }

  return {
    title: `${draft.number}: ${draft.title} | Riigikogu Radar`,
    description: draft.summary || draft.title,
  };
}

async function getDraft(uuid: string): Promise<Draft | null> {
  try {
    const collection = await getCollection<Draft>("drafts");
    return collection.findOne({ uuid });
  } catch {
    return null;
  }
}

async function getRelatedVotings(draftUuid: string): Promise<Voting[]> {
  try {
    const collection = await getCollection<Voting>("votings");
    return collection
      .find({ relatedDraftUuid: draftUuid })
      .sort({ votingTime: -1 })
      .limit(10)
      .toArray();
  } catch {
    return [];
  }
}

export default async function DraftDetailPage({
  params: { locale, uuid },
}: {
  params: { locale: string; uuid: string };
}) {
  const t = await getTranslations({ locale, namespace: "drafts" });
  const tPred = await getTranslations({ locale, namespace: "prediction" });
  const draft = await getDraft(uuid);

  if (!draft) {
    notFound();
  }

  const relatedVotings = await getRelatedVotings(uuid);
  const status = typeof draft.status === "object" ? draft.status.value : draft.status;

  return (
    <div className="page-container py-12">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href={`/${locale}/drafts`}
          className="text-sm text-rk-700 hover:text-rk-500"
        >
          &larr; {t("title")}
        </Link>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-lg font-mono text-rk-700 font-semibold">
            {draft.number}
          </span>
          {status && (
            <span className="text-sm px-3 py-1 bg-ink-100 text-ink-600 rounded-full">
              {status}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-semibold text-ink-900">{draft.title}</h1>
        {draft.titleEn && locale === "en" && (
          <p className="text-lg text-ink-600 mt-2">{draft.titleEn}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Summary */}
          {draft.summary && (
            <section className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-ink-900">
                  {t("summary")}
                </h2>
              </div>
              <div className="card-content">
                <p className="text-ink-700 whitespace-pre-wrap">{draft.summary}</p>
              </div>
            </section>
          )}

          {/* Simulate Vote */}
          <section className="card bg-rk-50 border-rk-200">
            <div className="card-content">
              <h3 className="font-semibold text-ink-900 mb-2">
                {t("simulateVote")}
              </h3>
              <p className="text-sm text-ink-600 mb-4">
                {t("simulateVoteDesc")}
              </p>
              <Link
                href={`/${locale}/simulate?q=${encodeURIComponent(draft.title)}`}
                className="inline-flex items-center px-4 py-2 bg-rk-700 text-white rounded hover:bg-rk-800 transition-colors"
              >
                {t("simulate")} &rarr;
              </Link>
            </div>
          </section>

          {/* Related Votings */}
          {relatedVotings.length > 0 && (
            <section className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-ink-900">
                  {t("relatedVotings")}
                </h2>
              </div>
              <div className="card-content">
                <ul className="space-y-4">
                  {relatedVotings.map((voting) => (
                    <li key={voting.uuid} className="border-b border-ink-100 pb-4 last:border-0 last:pb-0">
                      <div className="font-medium text-ink-900">{voting.title}</div>
                      <div className="text-sm text-ink-500 mt-1">
                        {voting.votingTime?.split("T")[0]}
                      </div>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="text-vote-for">
                          {tPred("for")}: {voting.inFavor || voting.votesFor || 0}
                        </span>
                        <span className="text-vote-against">
                          {tPred("against")}: {voting.against || voting.votesAgainst || 0}
                        </span>
                        <span className="text-vote-abstain">
                          {tPred("abstain")}: {voting.abstained || voting.votesAbstain || 0}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <section className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-ink-900">
                {t("details")}
              </h2>
            </div>
            <div className="card-content space-y-4">
              {draft.phase && (
                <div>
                  <div className="text-xs text-ink-500 uppercase tracking-wide">
                    {t("phase")}
                  </div>
                  <div className="text-ink-900">{draft.phase}</div>
                </div>
              )}

              {draft.submitDate && (
                <div>
                  <div className="text-xs text-ink-500 uppercase tracking-wide">
                    {t("submitted")}
                  </div>
                  <div className="text-ink-900">{draft.submitDate}</div>
                </div>
              )}

              {draft.proceedingDate && (
                <div>
                  <div className="text-xs text-ink-500 uppercase tracking-wide">
                    {t("proceeding")}
                  </div>
                  <div className="text-ink-900">{draft.proceedingDate}</div>
                </div>
              )}
            </div>
          </section>

          {/* Initiators */}
          {draft.initiators && draft.initiators.length > 0 && (
            <section className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-ink-900">
                  {t("initiators")}
                </h2>
              </div>
              <div className="card-content">
                <ul className="space-y-2">
                  {draft.initiators.map((initiator, i) => (
                    <li key={i} className="text-sm text-ink-700">
                      {initiator}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* External Link */}
          <section className="card">
            <div className="card-content">
              <a
                href={`https://www.riigikogu.ee/tegevus/eelnoud/eelnou/${draft.uuid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-rk-700 hover:text-rk-500 flex items-center gap-1"
              >
                {t("viewOnRiigikogu")}
                <span>↗</span>
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
