# COLLECT Pillar

## Status: Operational (Manual)

## What's Working

- Riigikogu API integration (votings, stenograms, drafts, MPs)
- Manual sync via `npm run db:sync`
- Daily sync variant: `npm run db:sync:daily`

## Data Volume

- 4,333 votings
- 975 stenograms
- 101 MPs

## Gaps

- **Automated scheduling**: Needs Vercel cron or equivalent for auto-sync every 6 hours
- Currently relies on manual execution or supervisor triggering

## Commands

```bash
npm run db:sync           # Full sync
npm run db:sync:daily     # Incremental daily sync
```
