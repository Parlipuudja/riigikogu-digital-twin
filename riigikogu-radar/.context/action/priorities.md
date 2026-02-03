# Current Priorities

*Last updated: 2026-02-03 11:50 UTC*

## Status Summary

| Metric | Value |
|--------|-------|
| Votings | 4,333 |
| MPs | 101 |
| DB Size | 263 MB (55%) |
| Embeddings | 58% (2,492/4,333) — generating |
| Production | Healthy |

## Completed This Session

1. **Brain upgrade** — Added worldview, accurate state, autonomy principle
2. **Data leakage fix** — Backtesting now has `postCutoffOnly` option
3. **Embedding generation** — 500 votings done, stenograms in progress
4. **Session log** — Updated throughout

## In Progress

### Embedding Generation (Background)
- Task: b34ebad
- Status: 500 votings done, 200 stenograms processing
- Target: 80%+ coverage

## Next Priorities

### Priority 1: Verify RAG Quality
After embeddings complete:
1. Test a prediction to verify historical context is used
2. Compare prediction quality with/without embeddings

### Priority 2: Run Post-Cutoff Backtests
Get honest accuracy numbers:
```typescript
runBacktest(mpUuid, { postCutoffOnly: true })
```
- Only 440 post-cutoff votes available
- Will give true out-of-sample accuracy

### Priority 3: Enable Production Failover
**Blocked on user action:**
```
# In Vercel environment variables:
ENABLE_AI_FAILOVER=true
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

## What We're NOT Prioritizing

- Full parliament simulation (disabled, too expensive)
- Mobile interface (desktop first for journalists)
- Neo4j migration (MongoDB sufficient)
- Performance optimization (correctness first)
