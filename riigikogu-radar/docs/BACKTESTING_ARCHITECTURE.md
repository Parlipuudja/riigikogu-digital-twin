# Backtesting Architecture

## Current Implementation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT BACKTESTING SYSTEM                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   CLI RUNNER     │     │   CORE ENGINE    │     │    STORAGE       │
│                  │     │                  │     │                  │
│ run-backtest.ts  │────▶│ backtesting.ts   │────▶│ MongoDB Atlas    │
│                  │     │                  │     │                  │
│ • --mp=<slug>    │     │ • runBacktest()  │     │ • mps.backtest   │
│ • --max-votes    │     │ • buildContext() │     │ • backtest_prog  │
│ • --resume       │     │ • makePredict()  │     │   ress           │
│ • Hard limits    │     │ • calcAccuracy() │     │                  │
└──────────────────┘     └────────┬─────────┘     └──────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   AI PROVIDER    │
                         │                  │
                         │ Claude Sonnet 4  │
                         │ (or OpenAI/      │
                         │  Gemini)         │
                         └──────────────────┘
```

## Backtest Flow (Per Vote)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                         BACKTEST FLOW (per vote)                          ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  1. SELECT TEST VOTE                                                      ║
║     ┌─────────────────────────────────────────────────────────────┐      ║
║     │ Vote #150: "Climate Amendment" (2024-03-15)                 │      ║
║     └─────────────────────────────────────────────────────────────┘      ║
║                              │                                            ║
║                              ▼                                            ║
║  2. BUILD BACKDATED CONTEXT (temporal isolation)                         ║
║     ┌─────────────────────────────────────────────────────────────┐      ║
║     │ Query: votingTime < "2024-03-15"                            │      ║
║     │ ───────────────────────────────────────────────────────────▶│      ║
║     │ Votes 1-149 only (future votes excluded)                    │      ║
║     │                                                             │      ║
║     │ Output:                                                     │      ║
║     │ • FOR: 67%  AGAINST: 28%  ABSTAIN: 5%                      │      ║
║     │ • Last 10 votes: [FOR, FOR, AGAINST, FOR, ...]             │      ║
║     └─────────────────────────────────────────────────────────────┘      ║
║                              │                                            ║
║                              ▼                                            ║
║  3. GENERATE PREDICTION                                                   ║
║     ┌─────────────────────────────────────────────────────────────┐      ║
║     │ Prompt: "As Kaja Kallas with pattern [67% FOR]..."         │      ║
║     │                    │                                        │      ║
║     │                    ▼                                        │      ║
║     │              ┌──────────┐                                   │      ║
║     │              │ Claude   │ → { prediction: "FOR",           │      ║
║     │              │ API      │     confidence: 85 }             │      ║
║     │              └──────────┘                                   │      ║
║     └─────────────────────────────────────────────────────────────┘      ║
║                              │                                            ║
║                              ▼                                            ║
║  4. COMPARE & RECORD                                                      ║
║     ┌─────────────────────────────────────────────────────────────┐      ║
║     │ Predicted: FOR  |  Actual: FOR  |  ✓ CORRECT               │      ║
║     │                                                             │      ║
║     │ Save to backtest_progress (for resume capability)           │      ║
║     └─────────────────────────────────────────────────────────────┘      ║
║                              │                                            ║
║                              ▼                                            ║
║  5. REPEAT for votes 21-200 (skip first 20 as training data)             ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

## Accuracy Output

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           ACCURACY OUTPUT                                 │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Overall: 87.6%   Sample: 200 votes                                       │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ CONFUSION MATRIX                                                     │ │
│  │                                                                      │ │
│  │              │  Actual FOR  │ Actual AGAINST │ Actual ABSTAIN │     │ │
│  │ ─────────────┼──────────────┼────────────────┼────────────────│     │ │
│  │ Pred FOR     │     [45]     │       5        │       0        │     │ │
│  │ Pred AGAINST │       7      │     [43]       │       0        │     │ │
│  │ Pred ABSTAIN │       2      │       2        │     [35]       │     │ │
│  │                                                                      │ │
│  │ Diagonal = correct predictions                                       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Golden Plan: Enhanced Backtesting

### Multi-Factor Prediction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MULTI-FACTOR PREDICTION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CURRENT (Single-factor)          GOLDEN PLAN (Multi-factor)               │
│  ┌─────────────────────┐          ┌─────────────────────────────────┐      │
│  │ Historical votes    │          │ Historical votes                │      │
│  │         │           │          │ + Speech embeddings (RAG)       │      │
│  │         ▼           │          │ + Coalition dynamics            │      │
│  │     [Claude]        │          │ + Bill topic classification     │      │
│  │         │           │          │ + Temporal patterns (seasons)   │      │
│  │         ▼           │          │ + Committee membership          │      │
│  │    Prediction       │          │         │                       │      │
│  └─────────────────────┘          │         ▼                       │      │
│                                   │   [Multi-model ensemble]        │      │
│                                   │         │                       │      │
│                                   │         ▼                       │      │
│                                   │   Weighted prediction           │      │
│                                   └─────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Continuous Calibration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONTINUOUS CALIBRATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Daily Sync   │────▶│ New Votes    │────▶│ Auto-backtest│                │
│  │ (cron)       │     │ Detected     │     │ Triggered    │                │
│  └──────────────┘     └──────────────┘     └──────┬───────┘                │
│                                                    │                        │
│                                                    ▼                        │
│                              ┌────────────────────────────────────┐        │
│                              │ Accuracy Dashboard (Real-time)     │        │
│                              │                                    │        │
│                              │ • 7-day rolling accuracy           │        │
│                              │ • Per-party breakdown              │        │
│                              │ • Topic-specific accuracy          │        │
│                              │ • Confidence calibration curve     │        │
│                              │ • Alert on accuracy drops          │        │
│                              └────────────────────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Advanced Analytics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ADVANCED ANALYTICS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SWING VOTE PREDICTION                    ANOMALY DETECTION                 │
│  ┌───────────────────────────┐           ┌───────────────────────────┐     │
│  │                           │           │                           │     │
│  │  MP       │ Swing Prob   │           │  MP       │ Anomaly Score │     │
│  │  ─────────┼─────────────│           │  ─────────┼───────────────│     │
│  │  Kallas   │    12%       │           │  Helme    │    8.7 (HIGH) │     │
│  │  Lukas    │    34%       │◀──Alert   │  Kallas   │    1.2 (LOW)  │     │
│  │  Kross    │    67%       │           │  Ratas    │    5.4 (MED)  │◀──   │
│  │                           │           │                           │     │
│  │  Factors:                 │           │  Factors:                 │     │
│  │  • Past party deviation   │           │  • Deviation from pattern │     │
│  │  • Topic sensitivity      │           │  • Unexpected coalitions  │     │
│  │  • Coalition pressure     │           │  • Timing anomalies       │     │
│  └───────────────────────────┘           └───────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Gap Analysis

| Feature                   | Current       | Golden Plan Target              |
|---------------------------|---------------|----------------------------------|
| Prediction factors        | 1 (history)   | 6+ (multi-factor ensemble)       |
| Backtest coverage         | 5/101 MPs     | 101/101 MPs                      |
| Accuracy tracking         | Manual/weekly | Real-time dashboard              |
| Confidence calibration    | None          | Platt scaling / isotonic         |
| RAG integration           | Partial       | Full (votes + speeches)          |
| Anomaly detection         | Basic         | ML-based with alerts             |
| A/B testing               | None          | Multi-model comparison           |

## Key Files

| Component | Path |
|-----------|------|
| Core engine | `src/lib/prediction/backtesting.ts` |
| CLI runner | `scripts/run-backtest.ts` |
| Types | `src/types/domain.ts` (lines 470-585) |
| Automation | `.github/workflows/weekly-backtest.yml` |
| UI Display | `src/app/[locale]/accuracy/page.tsx` |
| Production prediction | `src/lib/prediction/predict.ts` |

## Commands

```bash
# Run backtest for all MPs (max 10 per run)
npx tsx scripts/run-backtest.ts

# Run backtest for specific MP
npx tsx scripts/run-backtest.ts --mp=kaja-kallas

# Resume interrupted backtests
npx tsx scripts/run-backtest.ts --resume

# Limit test votes
npx tsx scripts/run-backtest.ts --max-votes=100
```

---

*Auto-generated: 2026-02-03*
