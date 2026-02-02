import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PredictionForm } from "@/components/forms/prediction-form";
import { getCollection } from "@/lib/data/mongodb";
import type { Draft, MPProfile } from "@/types";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "home" });

  return {
    title: `Riigikogu Radar | ${t("hero.subtitle")}`,
    description: t("hero.subtitle"),
  };
}

async function getUpcomingDrafts(): Promise<{ id: string; title: string; date: string }[]> {
  try {
    const collection = await getCollection<Draft>("drafts");
    const drafts = await collection
      .find({})
      .sort({ proceedingDate: -1 })
      .limit(5)
      .toArray();

    return drafts.map((d) => ({
      id: d.uuid,
      title: `${d.title} (${d.number})`,
      date: d.proceedingDate || d.submitDate || "",
    }));
  } catch {
    return [];
  }
}

async function getAccuracyStats(): Promise<{ overall: number; for: number; against: number; backtested: number }> {
  try {
    const collection = await getCollection<MPProfile>("mps");
    const mps = await collection
      .find({
        status: "active",
        "backtest.accuracy": { $exists: true },
      })
      .toArray();

    if (mps.length === 0) {
      return { overall: 0, for: 0, against: 0, backtested: 0 };
    }

    let totalCorrect = 0;
    let totalSamples = 0;
    let forCorrect = 0;
    let forTotal = 0;
    let againstCorrect = 0;
    let againstTotal = 0;

    for (const mp of mps) {
      const bt = mp.backtest;
      if (!bt?.accuracy || !bt.sampleSize) continue;

      const sampleSize = bt.sampleSize;
      totalCorrect += Math.round((bt.accuracy.overall / 100) * sampleSize);
      totalSamples += sampleSize;

      const forData = bt.accuracy.byDecision?.FOR;
      if (forData && forData.total > 0) {
        forCorrect += forData.correct;
        forTotal += forData.total;
      }

      const againstData = bt.accuracy.byDecision?.AGAINST;
      if (againstData && againstData.total > 0) {
        againstCorrect += againstData.correct;
        againstTotal += againstData.total;
      }
    }

    return {
      overall: totalSamples > 0 ? Math.round((totalCorrect / totalSamples) * 1000) / 10 : 0,
      for: forTotal > 0 ? Math.round((forCorrect / forTotal) * 1000) / 10 : 0,
      against: againstTotal > 0 ? Math.round((againstCorrect / againstTotal) * 1000) / 10 : 0,
      backtested: mps.length,
    };
  } catch {
    return { overall: 0, for: 0, against: 0, backtested: 0 };
  }
}

async function getRecentBacktests(): Promise<{ id: string; name: string; accuracy: number; date: string }[]> {
  try {
    const collection = await getCollection<MPProfile>("mps");
    const mps = await collection
      .find({
        status: "active",
        "backtest.lastRun": { $exists: true },
      })
      .sort({ "backtest.lastRun": -1 })
      .limit(5)
      .toArray();

    return mps.map((mp) => ({
      id: mp.slug,
      name: mp.info?.fullName || mp.slug,
      accuracy: mp.backtest?.accuracy?.overall || 0,
      date: mp.backtest?.lastRun ? new Date(mp.backtest.lastRun).toLocaleDateString("et-EE") : "",
    }));
  } catch {
    return [];
  }
}

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  const [upcomingDrafts, accuracy, recentBacktests] = await Promise.all([
    getUpcomingDrafts(),
    getAccuracyStats(),
    getRecentBacktests(),
  ]);

  return (
    <div className="page-container py-12">
      {/* Hero section */}
      <HeroSection locale={locale} />

      {/* Main content grid */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Upcoming votes */}
        <div className="lg:col-span-1">
          <UpcomingVotes locale={locale} drafts={upcomingDrafts} />
        </div>

        {/* Right column - Recent predictions & Accuracy */}
        <div className="lg:col-span-2 space-y-8">
          <RecentBacktests locale={locale} backtests={recentBacktests} />
          <AccuracyPanel locale={locale} accuracy={accuracy} />
        </div>
      </div>
    </div>
  );
}

async function HeroSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section className="text-center">
      <h1 className="text-4xl font-semibold text-ink-900 mb-3">
        {t("hero.title")}
      </h1>
      <p className="text-lg text-ink-600 mb-8 max-w-2xl mx-auto">
        {t("hero.subtitle")}
      </p>

      {/* Prediction form */}
      <div className="max-w-2xl mx-auto">
        <PredictionForm />
      </div>
    </section>
  );
}

async function UpcomingVotes({ locale, drafts }: { locale: string; drafts: { id: string; title: string; date: string }[] }) {
  const t = await getTranslations({ locale, namespace: "home.upcoming" });

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
      </div>
      <div className="card-content">
        {drafts.length > 0 ? (
          <ul className="space-y-4">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={`/${locale}/drafts/${draft.id}`}
                  className="block group"
                >
                  <div className="text-sm font-medium text-ink-900 group-hover:text-rk-700">
                    {draft.title}
                  </div>
                  {draft.date && (
                    <div className="text-xs text-ink-500 mt-0.5">
                      {draft.date}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-500">
            {locale === "et" ? "Eelnõusid ei leitud." : "No drafts found."}
          </p>
        )}

        <Link
          href={`/${locale}/drafts`}
          className="block mt-4 text-sm text-rk-700 hover:text-rk-500"
        >
          {t("title")} &rarr;
        </Link>
      </div>
    </section>
  );
}

async function RecentBacktests({ locale, backtests }: { locale: string; backtests: { id: string; name: string; accuracy: number; date: string }[] }) {
  const t = await getTranslations({ locale, namespace: "home.recent" });

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
      </div>
      <div className="card-content">
        {backtests.length > 0 ? (
          <div className="space-y-4">
            {backtests.map((bt) => (
              <div
                key={bt.id}
                className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0"
              >
                <div>
                  <Link
                    href={`/${locale}/mps/${bt.id}`}
                    className="text-sm font-medium text-ink-900 hover:text-rk-700"
                  >
                    {bt.name}
                  </Link>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {locale === "et" ? "Testitud" : "Tested"}: {bt.date}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-lg font-mono font-semibold ${
                      bt.accuracy >= 70 ? "text-conf-high" : "text-conf-low"
                    }`}
                  >
                    {bt.accuracy}%
                  </div>
                  <div className="text-xs text-ink-500">
                    {locale === "et" ? "täpsus" : "accuracy"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">
            {locale === "et" ? "Tagasitestimisi pole veel tehtud." : "No backtests completed yet."}
          </p>
        )}
      </div>
    </section>
  );
}

async function AccuracyPanel({ locale, accuracy }: { locale: string; accuracy: { overall: number; for: number; against: number; backtested: number } }) {
  const t = await getTranslations({ locale, namespace: "home.accuracy" });

  return (
    <section className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
        <span className="text-xs text-ink-500">
          {accuracy.backtested} {locale === "et" ? "saadikut testitud" : "MPs tested"}
        </span>
      </div>
      <div className="card-content">
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-rk-700">
              {accuracy.overall > 0 ? `${accuracy.overall}%` : "—"}
            </div>
            <div className="text-xs text-ink-500 mt-1">{t("overall")}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-vote-for">
              {accuracy.for > 0 ? `${accuracy.for}%` : "—"}
            </div>
            <div className="text-xs text-ink-500 mt-1">{t("for")}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-vote-against">
              {accuracy.against > 0 ? `${accuracy.against}%` : "—"}
            </div>
            <div className="text-xs text-ink-500 mt-1">{t("against")}</div>
          </div>
        </div>

        <Link
          href={`/${locale}/accuracy`}
          className="block mt-6 text-sm text-center text-rk-700 hover:text-rk-500"
        >
          {t("methodology")} &rarr;
        </Link>
      </div>
    </section>
  );
}
