# ANALYZE Pillar

## Status: Operational

## What's Working

- Vector embeddings via Voyage AI — 100% coverage
- Semantic search across all parliamentary data
- MP profiling and political stance extraction
- Quote extraction (52/101 MPs completed)

## Data Coverage

- 4,333 voting embeddings (100%)
- 975 stenogram embeddings (100%)

## Gaps

- Quote extraction incomplete (52/101 MPs)
- Temporal trend analysis not implemented
- Coalition stability metrics not implemented
- MP influence scoring not implemented

## Commands

```bash
npx tsx scripts/generate-embeddings.ts      # Vector embeddings
npx tsx scripts/regen-mp-quotes.ts [slug]   # MP profile generation
```
