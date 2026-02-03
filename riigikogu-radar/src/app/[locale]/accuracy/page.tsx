import { getTranslations } from "next-intl/server";
import { getActiveMPs } from "@/lib/data/mps";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  return {
    title: locale === "et" ? "Mudeli täpsus | Riigikogu Radar" : "Model Accuracy | Riigikogu Radar",
  };
}

export const dynamic = "force-dynamic";

export default async function AccuracyPage({ params: { locale } }: { params: { locale: string } }) {
  const mps = await getActiveMPs();

  // Calculate aggregate accuracy from MP backtests
  const mpsWithBacktest = mps.filter((mp) => mp.backtest?.accuracy?.overall !== undefined);
  const avgAccuracy =
    mpsWithBacktest.length > 0
      ? mpsWithBacktest.reduce((sum, mp) => sum + (mp.backtest?.accuracy?.overall || 0), 0) / mpsWithBacktest.length
      : null;

  const totalSamples = mpsWithBacktest.reduce((sum, mp) => sum + (mp.backtest?.sampleSize || 0), 0);

  return (
    <div className="page-container py-8">
      <h1 className="mb-2">
        {locale === "et" ? "Mudeli täpsus" : "Model Accuracy"}
      </h1>
      <p className="text-ink-600 mb-8 max-w-2xl">
        {locale === "et"
          ? "Meie ennustuste täpsus põhineb ajaloolistel andmetel läbiviidud tagasiulatuvatel testidel."
          : "Our prediction accuracy is based on backtesting against historical voting data."}
      </p>

      {/* Overall accuracy */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="text-lg font-semibold">
            {locale === "et" ? "Üldine täpsus" : "Overall Accuracy"}
          </h2>
        </div>
        <div className="card-content">
          {avgAccuracy !== null ? (
            <div className="text-center py-8">
              <div className="text-6xl font-mono font-bold text-rk-700 mb-2">
                {avgAccuracy.toFixed(1)}%
              </div>
              <div className="text-ink-500">
                {locale === "et"
                  ? `Põhineb ${totalSamples} hääletusel ${mpsWithBacktest.length} saadiku andmetel`
                  : `Based on ${totalSamples} votes across ${mpsWithBacktest.length} MPs`}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-ink-500">
              {locale === "et"
                ? "Tagasiulatuvad testid pole veel teostatud."
                : "Backtests have not been run yet."}
            </div>
          )}
        </div>
      </div>

      {/* Methodology */}
      <div className="card mb-8" id="methodology">
        <div className="card-header">
          <h2 className="text-lg font-semibold">
            {locale === "et" ? "Metoodika" : "Methodology"}
          </h2>
        </div>
        <div className="card-content prose prose-sm max-w-none">
          {locale === "et" ? (
            <div className="space-y-4 text-ink-700">
              <p>
                <strong>Tagasiulatuv testimine (backtesting)</strong> tähendab, et testime oma mudelit
                ajalooliste andmete põhjal, kasutades ainult seda infot, mis oli saadaval enne iga
                testitud hääletust.
              </p>
              <p>
                <strong>Ajaline isolatsioon:</strong> Iga ennustuse tegemisel kasutame ainult varasemaid
                hääletusi ja kõnesid. See tagab, et meie täpsusnäitajad peegeldavad reaalseid tingimusi.
              </p>
              <p>
                <strong>RAG (Retrieval-Augmented Generation):</strong> Iga ennustuse jaoks otsime
                vektorotsinguga sarnaseid varasemaid hääletusi ja kõnesid, et anda tehisintellektile
                konteksti.
              </p>
              <p>
                <strong>Piirangud:</strong> Mudel ei suuda ennustada ootamatuid poliitilisi nihkeid ega
                arvesta koalitsioonilepingutega, mis pole avalikud.
              </p>
              <p>
                <strong>OOS (Out-of-Sample):</strong> Märkega{" "}
                <span className="px-1 py-0.5 text-[10px] font-medium bg-conf-high/10 text-conf-high rounded">OOS</span>{" "}
                testid kasutavad ainult hääletusi pärast mudeli treeningandmeid (mai 2025), tagades tõese
                täpsuse ilma andmeleketa.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-ink-700">
              <p>
                <strong>Backtesting</strong> means we test our model against historical data, using only
                information that was available before each test vote.
              </p>
              <p>
                <strong>Temporal isolation:</strong> For each prediction, we only use earlier votes and
                speeches. This ensures our accuracy metrics reflect real-world conditions.
              </p>
              <p>
                <strong>RAG (Retrieval-Augmented Generation):</strong> For each prediction, we use vector
                search to find similar past votes and speeches to give the AI context.
              </p>
              <p>
                <strong>Limitations:</strong> The model cannot predict unexpected political shifts and
                does not account for non-public coalition agreements.
              </p>
              <p>
                <strong>OOS (Out-of-Sample):</strong> Backtests marked with{" "}
                <span className="px-1 py-0.5 text-[10px] font-medium bg-conf-high/10 text-conf-high rounded">OOS</span>{" "}
                only use votes after the model&apos;s training cutoff (May 2025), providing true accuracy
                with no data leakage.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Per-MP accuracy */}
      {mpsWithBacktest.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">
              {locale === "et" ? "Täpsus saadikute lõikes" : "Accuracy by MP"}
            </h2>
          </div>
          <div className="card-content">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{locale === "et" ? "Saadik" : "MP"}</th>
                  <th>{locale === "et" ? "Erakond" : "Party"}</th>
                  <th className="text-right">{locale === "et" ? "Täpsus" : "Accuracy"}</th>
                  <th className="text-right">{locale === "et" ? "Valim" : "Sample"}</th>
                </tr>
              </thead>
              <tbody>
                {mpsWithBacktest
                  .sort((a, b) => (b.backtest?.accuracy?.overall || 0) - (a.backtest?.accuracy?.overall || 0))
                  .map((mp) => {
                    const accuracy = mp.backtest?.accuracy?.overall || 0;
                    return (
                      <tr key={mp.slug}>
                        <td className="font-medium">
                          <span>{mp.info?.fullName || mp.slug}</span>
                          {mp.backtest?.postCutoffOnly && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-conf-high/10 text-conf-high rounded" title={locale === "et" ? "Out-of-sample test" : "Out-of-sample test"}>
                              OOS
                            </span>
                          )}
                        </td>
                        <td className="text-ink-500">{mp.info?.party?.name || ""}</td>
                        <td className="text-right font-mono">
                          <span
                            className={
                              accuracy >= 70
                                ? "text-conf-high"
                                : accuracy >= 50
                                ? "text-conf-medium"
                                : "text-conf-low"
                            }
                          >
                            {accuracy.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right font-mono text-ink-500">
                          n={mp.backtest?.sampleSize}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
