# Current Priorities

*Last updated: 2026-02-03 (afternoon)*

## ✅ Resolved: AI Functionality Restored

Anthropic credits added, switched to Haiku for cost efficiency (~90% cheaper).
Predictions working on production.

## Active: Database Expansion

Filling database to 80% capacity with historical data (2019-2023).

**Status:**
- 2022: ✅ 882 votings
- 2021: ✅ 687 votings
- 2020: ✅ 495 votings
- 2019: 🔄 In progress
- Stenograms: ⏳ Pending

Current: 35% → Target: 80%

## Priority 1: Complete Data Foundation

1. **Finish database fill** — Let background process complete
2. **Regenerate embeddings** — Run after fill for all new votings
3. **Verify RAG quality** — Ensure predictions use historical context

## Priority 2: Reliability Foundation

1. **Implement provider failover** — If Anthropic fails, try OpenAI/Gemini
2. **Add circuit breakers** — Don't hammer failing APIs
3. **Graceful degradation** — Show cached/statistical fallbacks when AI unavailable

## Priority 3: Trust Building

1. **Fix backtesting** — Currently flawed (data leakage concern)
2. **Honest accuracy reporting** — Show real post-cutoff accuracy
3. **Methodology documentation** — Already exists at /about#methodology

## Priority 4: Journalist Outreach Prep

1. **Verify all features work end-to-end**
2. **Prepare demo scenarios**
3. **Document API for power users**

## What We're NOT Prioritizing

- Full parliament simulation (disabled, too expensive)
- Mobile interface (desktop first for journalists)
- Neo4j migration (MongoDB sufficient)
- Performance optimization (correctness first)
