# Current Priorities

*Last updated: 2026-02-03*

## Blocking Priority: Restore AI Functionality

**Nothing else matters until the core features work.**

The Anthropic API is out of credits. Options:
1. Add Anthropic credits (user action)
2. Switch to OpenAI as primary provider
3. Switch to Gemini as primary provider

The multi-provider abstraction exists (`src/lib/ai/provider.ts`). It needs to be:
1. Connected to the prediction engine
2. Configured with working credentials
3. Deployed to production

## Priority 1: Reliability Foundation

Once AI is working, focus on making it STAY working:

1. **Implement provider failover** — If primary fails, try secondary, then tertiary
2. **Add circuit breakers** — Don't hammer failing APIs
3. **Graceful degradation** — Show cached/statistical fallbacks when AI unavailable
4. **Clear error states** — Users should know when features are degraded

## Priority 2: Trust Building

Before seeking users, ensure the system deserves trust:

1. **Honest accuracy reporting** — Show 73% (post-cutoff), not 87% (with leakage)
2. **Methodology documentation** — Public page explaining how predictions work
3. **Confidence intervals** — Every prediction shows uncertainty
4. **Source citations** — Every claim traceable to data

## Priority 3: Unique Value

What can we provide that journalists can't get elsewhere?

1. **Pattern detection over time** — "Party X cohesion dropped 12% this quarter"
2. **Anomaly alerts** — "MP Y voting pattern changed significantly"
3. **Historical similarity** — "Similar bills passed/failed with these patterns"

## What We're NOT Prioritizing

- New features (reliability first)
- Performance optimization (correctness first)
- Mobile interface (core functionality first)
- Neo4j migration (MongoDB is fine for now)
