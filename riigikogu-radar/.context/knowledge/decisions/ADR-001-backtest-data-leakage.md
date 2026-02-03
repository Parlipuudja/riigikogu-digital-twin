# ADR-001: Address Data Leakage in Backtesting

**Date:** 2026-02-03
**Status:** Accepted

## Context

We report prediction accuracy based on backtesting against historical votes. However, Claude's training data includes information up to May 2025, which means votes before that date may have been "seen" during training.

This creates data leakage - we can't claim true predictive accuracy on votes the model may have memorized.

**Evidence:**
- 3,893 votes before Claude's training cutoff (May 2025)
- 440 votes after cutoff (truly out-of-sample)
- Reported accuracy (87.6%) vs post-cutoff accuracy (73.3%)

## Decision

1. Add `MODEL_TRAINING_CUTOFF` constant (May 2025) to backtesting module
2. Add `postCutoffOnly` option to backtest function to test only on post-cutoff votes
3. Track whether backtest data is post-cutoff in `BacktestData` type
4. Stats API shows disclaimer when accuracy includes pre-cutoff votes
5. Only claim accuracy based on post-cutoff (out-of-sample) data in public communications

## Consequences

**Positive:**
- Honest accuracy reporting builds trust
- Clear methodology is defensible under scrutiny
- Post-cutoff accuracy is a real predictive measure

**Negative:**
- Post-cutoff sample is smaller (440 vs 3893 votes)
- May show lower accuracy than before (if leakage was inflating numbers)
- Requires re-running backtests with new option to get clean numbers

**Trade-offs:**
- Accuracy vs honesty: We choose honesty
- Sample size vs validity: We choose validity
