import { getCollection } from "@/lib/data/mongodb";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";
import type { MPProfile } from "@/types";

export const dynamic = "force-dynamic";

interface StatsResponse {
  accuracy: {
    overall: number;
    for: number;
    against: number;
    /**
     * Whether this accuracy is from post-cutoff (out-of-sample) data only.
     * Post-cutoff accuracy is the honest measure with no data leakage risk.
     */
    isPostCutoffOnly?: boolean;
  };
  coverage: {
    totalMPs: number;
    backtested: number;
    avgSampleSize: number;
  };
  lastUpdated: string | null;
  /**
   * Disclaimer about accuracy measurement methodology
   */
  disclaimer?: string;
}

export async function GET() {
  try {
    const collection = await getCollection<MPProfile>("mps");

    // Get all active MPs with backtest data
    const mps = await collection
      .find({
        status: "active",
        "backtest.accuracy": { $exists: true },
      })
      .toArray();

    const totalMPs = await collection.countDocuments({ status: "active" });

    if (mps.length === 0) {
      return apiSuccess<StatsResponse>(
        {
          accuracy: {
            overall: 0,
            for: 0,
            against: 0,
          },
          coverage: {
            totalMPs,
            backtested: 0,
            avgSampleSize: 0,
          },
          lastUpdated: null,
        },
        {
          cacheMaxAge: 300,
          cacheStaleWhileRevalidate: 1800,
        }
      );
    }

    // Calculate aggregate accuracy across all backtested MPs
    let totalCorrect = 0;
    let totalSamples = 0;
    let forCorrect = 0;
    let forTotal = 0;
    let againstCorrect = 0;
    let againstTotal = 0;
    let latestRun: Date | null = null;
    let totalSampleSize = 0;
    let postCutoffCount = 0;

    for (const mp of mps) {
      const bt = mp.backtest;
      if (!bt?.accuracy || !bt.sampleSize) continue;

      const sampleSize = bt.sampleSize;
      totalSampleSize += sampleSize;

      // Track if this is post-cutoff data
      if (bt.postCutoffOnly) {
        postCutoffCount++;
      }

      // Overall accuracy
      totalCorrect += Math.round((bt.accuracy.overall / 100) * sampleSize);
      totalSamples += sampleSize;

      // FOR accuracy
      const forData = bt.accuracy.byDecision?.FOR;
      if (forData && forData.total > 0) {
        forCorrect += forData.correct;
        forTotal += forData.total;
      }

      // AGAINST accuracy
      const againstData = bt.accuracy.byDecision?.AGAINST;
      if (againstData && againstData.total > 0) {
        againstCorrect += againstData.correct;
        againstTotal += againstData.total;
      }

      // Track latest run
      if (bt.lastRun) {
        const runDate = new Date(bt.lastRun);
        if (!latestRun || runDate > latestRun) {
          latestRun = runDate;
        }
      }
    }

    // Determine if all backtests are post-cutoff (truly out-of-sample)
    const allPostCutoff = postCutoffCount === mps.length && mps.length > 0;

    const stats: StatsResponse = {
      accuracy: {
        overall: totalSamples > 0 ? Math.round((totalCorrect / totalSamples) * 100 * 10) / 10 : 0,
        for: forTotal > 0 ? Math.round((forCorrect / forTotal) * 100 * 10) / 10 : 0,
        against: againstTotal > 0 ? Math.round((againstCorrect / againstTotal) * 100 * 10) / 10 : 0,
        isPostCutoffOnly: allPostCutoff,
      },
      coverage: {
        totalMPs,
        backtested: mps.length,
        avgSampleSize: mps.length > 0 ? Math.round(totalSampleSize / mps.length) : 0,
      },
      lastUpdated: latestRun?.toISOString() || null,
      disclaimer: allPostCutoff
        ? undefined
        : "Accuracy includes votes before model training cutoff (May 2025). True out-of-sample accuracy may differ.",
    };

    return apiSuccess<StatsResponse>(stats, {
      cacheMaxAge: 300,
      cacheStaleWhileRevalidate: 1800,
    });
  } catch (error) {
    return handleApiError(error, "fetching stats");
  }
}
