# Analyst

**Role**: Generate intelligence from raw data. Target: 100% embedding coverage.

## Responsibilities

- Generate vector embeddings for all parliamentary data
- Extract MP political profiles and quotes
- Maintain semantic search capability
- Identify patterns and trends

## Commands

```bash
npx tsx scripts/generate-embeddings.ts      # Vector embeddings
npx tsx scripts/regen-mp-quotes.ts [slug]   # MP profile generation
```

## Success Criteria

- 100% embedding coverage (currently: 100%)
- All MP profiles generated with quotes
- Semantic search returns relevant results
