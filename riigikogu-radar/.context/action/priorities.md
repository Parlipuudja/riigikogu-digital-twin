# Current Priorities

*Last updated: 2026-02-04 19:15 UTC*

## Status Summary

| Metric | Value |
|--------|-------|
| Votings | 4,333 |
| MPs | 101 |
| DB Size | ~268 MB |
| Embeddings | 100% votings, 100% stenograms |
| Vector Index | READY (queryable) |
| Production | Healthy |
| Auth | LIVE |

## Completed This Session (Feb 4)

1. **MP quote extraction fixed** - Now filters third-party descriptions, prioritizes first-person statements
2. **Quote relevance improved** - Requires stance keyword match + 35% relevance threshold
3. **Coalition filter added to insights** - Cross-party alliances now excludes RE+E200+SDE (coalition partners)
4. **Autonomous working mode** - Updated principles.md to clarify user monitors, Claude executes

## In Progress

- **MP quote regeneration** - Running batch process (optimized: ~1 min/MP instead of 10+ min)

## Completed This Session (Feb 4, evening)

1. **Stenogram embeddings** - COMPLETE 100% (975/975)
2. **Voting embeddings** - COMPLETE 100% (4,333/4,333)

## Completed This Session (Feb 4, afternoon)

1. **Fraktsioonitud fix** - Non-affiliated MPs no longer treated as a party
2. **Seat Plan Visualization** - Hemicycle view of simulation results
3. **Constitutional Amendment Detection** - Shows 68-vote threshold for põhiseadus amendments
4. **Quote regeneration** - 39/101 MPs have quotes (remaining stalled on timeouts)

## Next Priorities

### Priority 0: Bug Fixes ✅ COMPLETE
- [x] Party loyalty fixed at 85%
- [x] Party loyalty rounding (Math.floor)
- [x] MP citations - strict filtering, first-person preference

### Priority 1: Admin Features ✅ COMPLETE

### Priority 2: Failover ⏸️ OPTIONAL
User chose to skip - can enable later with OPENAI_API_KEY in Vercel

### Priority 3: Data Quality (Current Focus)
- [x] Complete embedding generation (80% → 100%) ✅
- [ ] Complete quote regeneration (39/101 → 101/101) - data collection slow for prolific MPs

## Future Improvements (Not Urgent)

- **Show RAG context in UI** - Frontend doesn't indicate when predictions lack historical context
- **Automated sync cron** - Currently manual; could add Vercel cron for daily updates
- **Mobile interface** - Desktop first for journalists

## What We're NOT Prioritizing

- Full parliament simulation (disabled, too expensive)
- Neo4j migration (MongoDB sufficient)
- Performance optimization (correctness first)
