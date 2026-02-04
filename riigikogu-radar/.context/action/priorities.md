# Current Priorities

*Last updated: 2026-02-04 09:20 UTC*

## Status Summary

| Metric | Value |
|--------|-------|
| Votings | 4,333 |
| MPs | 101 |
| DB Size | ~268 MB |
| Embeddings | 80.6% votings, 63.3% stenograms |
| Vector Index | READY (queryable) |
| Production | Healthy |
| Auth | LIVE |

## Completed This Session (Feb 4)

1. **MP quote extraction fixed** - Now filters third-party descriptions, prioritizes first-person statements
2. **Quote relevance improved** - Requires stance keyword match + 35% relevance threshold
3. **Coalition filter added to insights** - Cross-party alliances now excludes RE+E200+SDE (coalition partners)
4. **Autonomous working mode** - Updated principles.md to clarify user monitors, Claude executes

## In Progress

- **Quote regeneration** - ~24/101 MPs done (running in background)
- **Embedding generation** - Processing votings (running in background)

## Next Priorities

### Priority 0: Bug Fixes ✅ COMPLETE
- [x] Party loyalty fixed at 85%
- [x] Party loyalty rounding (Math.floor)
- [x] MP citations - strict filtering, first-person preference

### Priority 1: Admin Features ✅ COMPLETE

### Priority 2: Failover ⏸️ OPTIONAL
User chose to skip - can enable later with OPENAI_API_KEY in Vercel

### Priority 3: Data Quality (Current Focus)
- [ ] Complete embedding generation (80% → 95%+)
- [ ] Complete quote regeneration (24/101 → 101/101)

## Future Improvements (Not Urgent)

- **Show RAG context in UI** - Frontend doesn't indicate when predictions lack historical context
- **Automated sync cron** - Currently manual; could add Vercel cron for daily updates
- **Mobile interface** - Desktop first for journalists

## What We're NOT Prioritizing

- Full parliament simulation (disabled, too expensive)
- Neo4j migration (MongoDB sufficient)
- Performance optimization (correctness first)
