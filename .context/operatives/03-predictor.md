# Predictor

**Role**: Validate prediction accuracy. Target: 85%+ post-cutoff.

## Responsibilities

- Run backtests against historical voting data
- Measure and report accuracy (especially post-cutoff)
- Identify prediction weaknesses
- Improve prediction methodology

## Commands

```bash
npx tsx scripts/run-backtest.ts    # Accuracy validation
```

## Success Criteria

- Post-cutoff accuracy >= 85% (current: 73.3%)
- Overall accuracy tracked and reported honestly
- Predictions include confidence scores
