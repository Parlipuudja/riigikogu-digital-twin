# Current Priorities

*Last updated: 2026-02-03 13:15 UTC*

## Status Summary

| Metric | Value |
|--------|-------|
| Votings | 4,333 |
| MPs | 101 |
| DB Size | ~268 MB |
| Embeddings | ~75% (votings + stenograms in progress) |
| Vector Index | READY (queryable) |
| Production | Healthy |

## Completed This Session

1. **Vector search index created** - RAG now returns similar votes
2. **CLI `--post-cutoff` flag added** - Enables honest backtesting
3. **Post-cutoff backtests run:**
   - Maris Lauri: **90%** (20 votes)
   - Tõnis Lukas: **87%** (39 votes)
4. **API leakage audit** - Confirmed clean architecture
5. **Embedding generation** - 500 votings done, ~50/200 stenograms done
6. **UI improvements:**
   - Added login button to header (linked to auth)
   - Added OOS (out-of-sample) indicators on backtest results
   - Added OOS explanation to methodology
7. **Authentication system** - NextAuth.js integrated with:
   - Login page at /[locale]/login
   - Session-aware header (login/logout)
   - Credentials provider (admin-only for now)

## In Progress

- **Embedding generation** (task bd72480) - ~50/200 stenograms

## Next Priorities

### Priority 1: Complete Auth Setup
- [ ] Add AUTH_SECRET to .env
- [ ] Add ADMIN_PASSWORD to .env
- [ ] Test login flow locally
- [ ] Deploy auth changes

### Priority 2: Add Admin-Only Features
- [ ] Backtest trigger from UI (admin only)
- [ ] Data sync trigger (admin only)
- [ ] System status dashboard

### Priority 3: Enable Production Failover
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
