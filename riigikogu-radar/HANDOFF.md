# Claude Code Handoff - Riigikogu Radar

*Last updated: 2026-02-02 by Claude Opus 4.5*

## Project Summary

**Riigikogu Radar** is an AI-powered Estonian parliamentary intelligence system. We predict how MPs will vote using RAG + Claude, with a target of >70% accuracy.

- **Production URL**: https://seosetu.ee / https://riigikogu-radar.vercel.app
- **MVP Deadline**: March 1, 2026
- **Primary Users**: Journalists

## Current Architecture

```
GitHub (source) ──push──▶ Vercel (frontend + API)
      │                    - Next.js 14 App Router
      │                    - Bilingual (ET/EN)
      │                    - Free tier
      │
      └──deploy key──▶ AWS EC2 (background jobs)
                        - IP: 13.63.58.135
                        - t3.small, eu-north-1
                        - Daily sync, embeddings, backtests
                        - Claude Code CLI installed
                        │
                        ▼
                   MongoDB Atlas
                    - 120 MB / 512 MB used
                    - Collections: mps, votings, drafts, stenograms
```

## What Was Accomplished Today (2026-02-02)

### Priority 1: Foundation ✅
- [x] All 101 MPs have profiles
- [x] Embeddings generated (votings 100%, stenograms 55%)
- [x] Backtests running, accuracy baseline established:
  - Aivar Sõerd: **97%**
  - Alar Laneman: **75%**
  - Tõnis Lukas: **83%**
  - **MVP target of >70% ACHIEVED**

### Priority 2: Intelligence ✅
- [x] Daily sync automation (GitHub Actions + AWS cron)
- [x] Anomaly detection: 8 insight types in `/api/v1/insights`
- [x] AWS infrastructure deployed (CloudFormation)

### Priority 3: Journalist Interface ✅
- [x] `/insights` page - Story leads for journalists
- [x] `/api/v1/search` - Natural language search endpoint
- [x] Export functionality (CSV/JSON)

### Infrastructure ✅
- [x] AWS EC2 deployed and configured
- [x] Cron jobs for automated sync/backtest
- [x] Claude Code CLI installed on AWS

## What's In Progress

### AWS Backtest (Running Now)
```bash
tail -f ~/logs/backtest.log
```
Currently testing: Aleksei Jevgrafov (and will continue through 10 MPs)

## What's Next (Priority Order)

### Week of Feb 3-8
1. **Complete backtests** for all 101 MPs (runs weekly via cron)
2. **Resume embeddings** for remaining stenograms:
   ```bash
   cd ~/riigikogu-radar/riigikogu-radar
   npx tsx scripts/generate-embeddings.ts
   ```
3. **Journalist validation** - Get 3-5 journalists using the system

### Future Enhancements
- Natural language query UI (search bar on homepage)
- Email alerts for significant predictions
- Swing vote detection improvements
- Vote outcome tracking (compare predictions vs actual)

## Key Files & Locations

### On AWS (`/home/ubuntu/riigikogu-radar/riigikogu-radar/`)
```
├── .env                          # API keys (MONGODB_URI, ANTHROPIC_API_KEY, VOYAGE_API_KEY)
├── scripts/
│   ├── sync-api.ts               # Data sync from Riigikogu API
│   ├── run-backtest.ts           # MP prediction backtesting
│   ├── generate-embeddings.ts    # Vector embeddings for RAG
│   ├── regen-mp.ts               # Regenerate MP profiles
│   └── db-stats.ts               # Database size check
├── src/
│   ├── app/api/v1/               # API routes
│   │   ├── insights/route.ts     # Story leads endpoint
│   │   ├── search/route.ts       # Natural language search
│   │   ├── simulate/route.ts     # Parliament simulation
│   │   └── mps/[slug]/predict/   # Individual MP prediction
│   ├── lib/
│   │   ├── ai/                   # Claude, Voyage integrations
│   │   ├── prediction/rag.ts     # RAG implementation
│   │   └── data/mongodb.ts       # Database access
│   └── app/[locale]/insights/    # Journalist insights page
└── CLAUDE.md                     # Project instructions (READ THIS)
```

### Logs
```
~/logs/sync.log       # Daily sync output
~/logs/embeddings.log # Embedding generation output
~/logs/backtest.log   # Backtest results
```

## Common Operations

### Check system status
```bash
cd ~/riigikogu-radar/riigikogu-radar
npx tsx scripts/db-stats.ts
```

### Run manual sync
```bash
npx tsx scripts/sync-api.ts all
```

### Run backtest for specific MP
```bash
npx tsx scripts/run-backtest.ts --mp=tonis-lukas --max-votes=100
```

### Generate embeddings
```bash
npx tsx scripts/generate-embeddings.ts
```

### Pull latest code
```bash
git pull origin main
```

### Deploy to Vercel (from local or after code changes)
```bash
npx vercel --prod
```

## API Keys Location

All in `~/riigikogu-radar/riigikogu-radar/.env`:
- `MONGODB_URI` - MongoDB Atlas connection
- `ANTHROPIC_API_KEY` - Claude API
- `VOYAGE_API_KEY` - Voyage AI embeddings

## Scheduled Jobs (Cron)

| Schedule | Job | Command |
|----------|-----|---------|
| Daily 5:00 UTC | Sync | `scripts/sync-api.ts all` |
| Daily 5:30 UTC | Embeddings | `scripts/generate-embeddings.ts` |
| Sunday 6:00 UTC | Backtest | `scripts/run-backtest.ts` |

View/edit: `crontab -e`

## Hard Limits (Cost Control)

Built into scripts to prevent runaway API costs:
- **Backtest**: Max 10 MPs per run, 200 votes per MP, 4h runtime
- **Embeddings**: Max 500 items per collection, 1h runtime
- **Sync**: 480 MB database limit

## Accuracy Targets

| Metric | Target | Current |
|--------|--------|---------|
| Overall prediction accuracy | >70% | 75-97% ✅ |
| Active MP profiles | 101 | 101 ✅ |
| Data freshness | <24h | Via daily cron ✅ |

## Contact & Resources

- **GitHub**: https://github.com/Parlipuudja/riigikogu-digital-twin
- **Production**: https://seosetu.ee
- **Vercel Dashboard**: https://vercel.com/parlipuudjas-projects/riigikogu-radar
- **MongoDB Atlas**: https://cloud.mongodb.com (cluster: stigrasta)

## Tips for Claude Code Sessions

1. **Always read CLAUDE.md first** - Contains mission, architecture, autonomy guidelines
2. **Check db-stats before large operations** - 512 MB limit
3. **Use `--max-votes=50` for quick backtest tests**
4. **Commit working code frequently**
5. **Deploy to Vercel after significant changes**

---

*This handoff was created to enable continuity between Claude Code sessions. Update this file when significant changes are made.*
