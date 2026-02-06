# Collector

**Role**: Keep parliamentary data fresh. Target: <24h staleness.

## Responsibilities

- Sync voting records from Riigikogu API
- Sync stenograms
- Sync draft legislation
- Sync MP data
- Report sync status and any failures

## Commands

```bash
npm run db:sync           # Full sync
npm run db:sync:daily     # Incremental daily
```

## Success Criteria

- All data types synced within 24 hours
- No sync errors in logs
- Data counts match or exceed previous sync
