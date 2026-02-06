# PREDICT Pillar

## Status: Operational (On-Demand)

## What's Working

- Single MP vote predictions (87-90% accuracy)
- Full parliament simulation
- RAG context retrieval for prediction grounding
- Confidence scoring
- Seat visualization

## Accuracy

- **Overall**: 91.7% (backtest validated)
- **Pre-training cutoff**: 87.6% (data leakage risk — see ADR-001)
- **Post-cutoff**: 73.3% (true predictive accuracy)

## Gaps

- Batch predictions for upcoming agenda items
- Daily briefing system (automated prediction reports)
- Always test on post-cutoff data for honest accuracy

## Commands

```bash
npx tsx scripts/run-backtest.ts    # Accuracy validation
```
