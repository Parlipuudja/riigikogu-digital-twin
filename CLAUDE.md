# CLAUDE.md — Riigikogu Radar (Codename: Stig Rästa)

## Mission

> **Make the Estonian Parliament legible through AI-powered intelligence.**

We are building an independent parliamentary intelligence system following the think tank model (RAND, Arenguseire Keskus). Our principles:
- **Accuracy over speed**: Better to be right than first
- **Transparency over magic**: Explain how predictions work
- **Data over opinion**: Let facts speak, avoid editorializing
- **Non-partisan**: Serve truth, not political alignment

## Strategic Context

| Parameter | Value |
|-----------|-------|
| **MVP Deadline** | 1 March 2026 |
| **Primary Users** | Journalists |
| **Monetization** | Freemium |
| **Production URL** | https://seosetu.ee |
| **Vercel URL** | https://riigikogu-radar.vercel.app |

## MVP Success Criteria

1. **>70% prediction accuracy** (backtested)
2. **All 101 active MPs have profiles**
3. **Data freshness <24h**
4. **3-5 journalists using actively** (validation)

## Working Directory

All commands should be run from: `/home/ubuntu/riigikogu-radar/riigikogu-radar`

(Note: On the AWS instance, use `/home/ubuntu/riigikogu-radar/riigikogu-radar`)

## Commands

```bash
# Development
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Production build
npm run lint                   # ESLint

# MP Profile Generation
npx tsx scripts/regen-mp.ts --all           # Generate all MP profiles
npx tsx scripts/regen-mp.ts <slug>          # Regenerate specific MP
npx tsx scripts/regen-mp.ts --all --limit=N # Generate N new MPs

# Data Sync
npm run sync:all               # Sync all data from Riigikogu API
npm run sync:members           # Sync parliament members
npm run sync:votings           # Sync voting records
npm run sync:drafts            # Sync legislative drafts
npm run sync:stenograms        # Sync speeches
npm run sync:draft-texts       # Extract text from PDF/DOCX

# Embeddings (required for RAG)
npm run embeddings:generate    # Generate vector embeddings

# Backtesting
npm run backtest               # Run backtests for all MPs
npm run backtest:mp            # Backtest specific MP (--mp=slug)

# Database
npx tsx scripts/db-stats.ts    # Check database size (512MB limit)

# Deployment
npx vercel --prod              # Deploy to production
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│   MongoDB Atlas: members, mps, votings, drafts, stenograms  │
│   Voyage AI: Vector embeddings (1024 dimensions)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER                        │
│   RAG: Similar votes + speeches via vector search           │
│   Claude Sonnet 4: Prediction generation                    │
│   Profile Generator: AI-powered MP analysis                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    INTERFACE LAYER                           │
│   Next.js 14 App Router                                     │
│   Bilingual: Estonian (et) / English (en)                   │
│   API: /api/v1/mps, /api/v1/simulate, /api/v1/mps/[slug]/predict │
└─────────────────────────────────────────────────────────────┘
```

## Key Directories

```
riigikogu-radar/
├── src/
│   ├── app/
│   │   ├── [locale]/          # Pages (et/en)
│   │   │   ├── mps/           # MP list and detail pages
│   │   │   ├── simulate/      # Parliament simulation
│   │   │   └── accuracy/      # Accuracy dashboard
│   │   └── api/v1/            # API routes
│   ├── lib/
│   │   ├── ai/                # Claude, Voyage AI integrations
│   │   ├── data/              # MongoDB, data access
│   │   ├── prediction/        # Vote prediction, RAG
│   │   └── sync/              # Riigikogu API sync
│   ├── components/            # React components
│   └── types/                 # TypeScript types
└── scripts/                   # Data collection, generation
```

## Data Types

**MPProfile** (stored in `mps` collection):
```typescript
{
  uuid: string;           // Riigikogu member UUID
  slug: string;           // URL-friendly name
  status: "active" | "pending" | "inactive";
  info?: {
    fullName: string;
    party: { code, name, nameEn };
    photoUrl: string;
    votingStats: { total, attendancePercent, partyLoyaltyPercent, distribution };
    policyAreas: Array<{ area, areaEn, count }>;
  };
  instruction?: {
    promptTemplate: string;  // AI-generated profile for predictions
    politicalProfile: { economicScale, socialScale };
    keyIssues: Array<{ issue, issueEn, position, confidence }>;
  };
  backtest?: {
    accuracy: { overall, byDecision };
    sampleSize: number;
    lastRunAt: Date;
  };
}
```

## Environment Variables

Required in `.env`:
```
MONGODB_URI=mongodb+srv://...
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
```

## Autonomy Guidelines

You have authority to:
- Make architectural decisions that serve the mission
- Refactor code for clarity and maintainability
- Add features that clearly support MVP criteria
- Fix bugs and improve reliability
- Update this CLAUDE.md as the project evolves

Always:
- Commit working code with clear messages
- Deploy to production after significant changes
- Track accuracy metrics
- Prioritize journalist-facing features
- **VERIFY ON PRODUCTION**: If something works, it MUST work on production (seosetu.ee) too. Always test against production after deploying.

Avoid:
- Over-engineering (YAGNI)
- Political commentary in code or data
- Exposing API keys or credentials
- Breaking changes without migration path

## Daily Progress Report Protocol

**IMPORTANT**: At the start of each new day (or session), Claude should:

1. Run the progress tracker and present results to the user:
   ```bash
   npx tsx scripts/progress-tracker.ts
   ```

2. Save the report to the archive:
   ```bash
   npx tsx scripts/progress-tracker.ts --json > reports/progress-$(date +%Y-%m-%d).json
   ```

3. Run user tests to verify system health:
   ```bash
   npx tsx scripts/user-test.ts
   ```

Progress reports are archived in `riigikogu-radar/reports/` for tracking progress over time.

## Current Status (auto-updated)

Check live status:
- **Progress Report**: `npx tsx scripts/progress-tracker.ts`
- **User Tests**: `npx tsx scripts/user-test.ts`
- **MPs**: `curl -s https://seosetu.ee/api/v1/mps | jq '.data.total'`
- **Health**: `curl -s https://seosetu.ee/api/v1/health`
- **DB Size**: `npx tsx scripts/db-stats.ts`

## MVP Roadmap (Week of Feb 2-8)

### Priority 1: Foundation
- [x] All 101 MPs have profiles
- [x] Embeddings generated for RAG (votings 100%, stenograms in progress)
- [x] Backtests establish accuracy baseline (87.6% accuracy achieved)

### Priority 2: Intelligence
- [x] Swing vote detection (via /insights API)
- [x] Anomaly detection (unusual voting patterns)
- [x] Daily data sync automation (cron configured)

### Priority 3: Journalist Interface
- [x] Natural language query (/api/v1/search)
- [x] Export functionality (/api/v1/export)
- [x] Story leads detection (/insights page)

## Related Documents

- `SR Golden Plan.md` — Strategic plan and product vision
- `SR Mission.md` — Mission statement and philosophy
- `SR Long-term plan.md` — Long-term direction

---

*Last updated: 2026-02-02 (MVP criteria achieved)*
