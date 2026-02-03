# Current Priorities

*Last updated: 2026-02-03 11:20 UTC*

## Status Summary

| Metric | Value |
|--------|-------|
| Votings | 4,333 |
| MPs | 101 |
| DB Size | 263 MB (55%) |
| Embeddings | 46% (1,992/4,333) |
| Production | Healthy |

## Critical: Resume Embedding Generation

The fill-database process **crashed** during embedding generation at 80/500 votings.

**Impact:** Embedding coverage dropped from 51% to 46% because new votings were added without embeddings.

**Action:**
```bash
npm run embeddings:generate
```

## Completed: Database Expansion

All historical data synced:
- 2022: 882 votings
- 2021: 687 votings
- 2020: 495 votings
- 2019: 270 votings + 99 stenograms

## Priority 1: Fix Embeddings

1. **Resume embedding generation** — Run `npm run embeddings:generate`
2. **Monitor completion** — Target: 80%+ coverage
3. **Verify RAG quality** — Test predictions use historical context

## Priority 2: Enable Production Failover

1. Failover code exists (Anthropic → OpenAI → Gemini)
2. Circuit breakers implemented
3. **Blocked:** Needs `ENABLE_AI_FAILOVER=true` + backup API keys in Vercel

## Priority 3: Security

1. **Credentials in repo** — Need to rotate and remove
2. Owner: User action required

## Priority 4: Trust Building

1. ~~Fix backtesting (data leakage concern)~~ — **Done:** Added `postCutoffOnly` option, stats shows disclaimer
2. ~~Honest accuracy reporting~~ — **Done:** Stats API flags when data may have leakage
3. Methodology documentation exists at /about#methodology
4. **Next:** Re-run backtests with `postCutoffOnly: true` to get clean accuracy numbers

## What We're NOT Prioritizing

- Full parliament simulation (disabled, too expensive)
- Mobile interface (desktop first for journalists)
- Neo4j migration (MongoDB sufficient)
- Performance optimization (correctness first)
