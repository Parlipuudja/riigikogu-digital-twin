# Current Priorities

*Last updated: 2026-02-04 09:15 UTC*

## Status Summary

| Metric | Value |
|--------|-------|
| Votings | 4,333 |
| MPs | 101 |
| DB Size | ~268 MB |
| Embeddings | ~78% (500 votings + 70/200 stenograms) |
| Vector Index | READY (queryable) |
| Production | Healthy |
| Auth | LIVE |

## Completed This Session

1. **Vector search index created** - RAG now returns similar votes
2. **CLI `--post-cutoff` flag added** - Enables honest backtesting
3. **Post-cutoff backtests run:**
   - Maris Lauri: **90%** (20 votes)
   - Tõnis Lukas: **87%** (39 votes)
4. **API leakage audit** - Confirmed clean architecture
5. **Embedding generation** - 500 votings + 70/200 stenograms (hit 60min limit)
6. **UI improvements:**
   - Added login button to header (linked to auth)
   - Added OOS (out-of-sample) indicators on backtest results
   - Added OOS explanation to methodology
7. **Authentication system** - NextAuth.js integrated with:
   - Login page at /[locale]/login
   - Session-aware header (login/logout)
   - Credentials provider (admin-only for now)
8. **Auth environment variables deployed:**
   - AUTH_SECRET added to Vercel
   - ADMIN_PASSWORD added to Vercel
   - Login functional at https://seosetu.ee/et/login

## In Progress

- **Embedding generation** - Can restart to continue from 70/200 stenograms

## Next Priorities

### Priority 0: Bug Fixes
- [x] **Party loyalty fixed at 85%** - Fixed via fix-party-loyalty.ts script (101 MPs updated)
- [x] **Party loyalty rounding** - Now uses Math.floor to prevent rounding up to 100% (verified in instruction-generator.ts:183)
- [x] **MP citations should be direct quotes** - Fixed: Quote extraction now filters out third-party descriptions and prioritizes first-person opinion statements

### Priority 1: Add Admin-Only Features ✅ COMPLETE
- [x] Add AUTH_SECRET to Vercel
- [x] Add ADMIN_PASSWORD to Vercel
- [x] Deploy auth changes
- [x] System status dashboard at /admin
- [x] Backtest trigger from UI (admin only)
- [x] Data sync info and CLI commands (admin only)

### Priority 2: Enable Production Failover
**Blocked on user action:**
```
# In Vercel environment variables:
ENABLE_AI_FAILOVER=true
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
AUTH_SECRET=<generate with openssl rand -base64 32>
ADMIN_PASSWORD=<your choice>
```

## Future Improvements (Not Urgent)

- **Show RAG context in UI** - Frontend doesn't indicate when predictions lack historical context
- **Automated sync cron** - Currently manual; could add Vercel cron for daily updates
- **Mobile interface** - Desktop first for journalists

## What We're NOT Prioritizing

- Full parliament simulation (disabled, too expensive)
- Neo4j migration (MongoDB sufficient)
- Performance optimization (correctness first)
