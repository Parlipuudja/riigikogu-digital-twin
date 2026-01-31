# Riigikogu Digital Twin - Build Context

## Project Status: Structure Complete, Dependencies Not Installed

### What's Been Built

All source files have been created for the MVP:

**Core Infrastructure:**
- `package.json` - Dependencies and scripts defined
- `docker-compose.yml` - PostgreSQL + pgvector container
- `scripts/init-db.sql` - Full database schema (bills, votes, speeches, embeddings tables)
- `src/lib/db.ts` - Database connection with pooling

**Data Collection:**
- `src/lib/riigikogu-api.ts` - Riigikogu API client
- `scripts/collect-votes.ts` - Fetch voting data for Tõnis Lukas
- `scripts/collect-speeches.ts` - Collect stenogram speeches
- `scripts/seed-db.ts` - Sample data for development

**RAG + Prediction:**
- `src/lib/embeddings.ts` - OpenAI embeddings generation & pgvector similarity search
- `src/lib/claude.ts` - Claude Sonnet 4 API client for predictions
- `src/lib/prediction.ts` - RAG retrieval + prediction logic

**API Routes:**
- `src/app/api/predict/route.ts` - POST /api/predict
- `src/app/api/votes/route.ts` - GET /api/votes (history)
- `src/app/api/evaluate/route.ts` - GET /api/evaluate (stats)

**Web Interface (Bilingual ET/EN):**
- `src/app/[locale]/page.tsx` - Landing page
- `src/app/[locale]/predict/page.tsx` - Vote prediction UI
- `src/app/[locale]/history/page.tsx` - Voting history browser
- `src/app/[locale]/evaluate/page.tsx` - Evaluation dashboard
- `src/app/[locale]/about/page.tsx` - Methodology page
- `src/components/` - All UI components (prediction-form, prediction-result, vote-history-table, nav, language-switcher)
- `src/i18n/en.json` & `src/i18n/et.json` - Translations

**UI Components (shadcn/ui style):**
- button, card, input, textarea, label, select, tabs, badge, separator, dropdown-menu, table

### What's Left To Do

1. **Install dependencies:** `npm install`
2. **Start database:** `npm run db:up`
3. **Seed sample data:** `npm run db:seed`
4. **Generate embeddings:** `npm run embeddings:generate` (requires OPENAI_API_KEY)
5. **Start dev server:** `npm run dev`

### Environment Variables Needed

Create `.env` file:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/riigikogu
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
MP_UUID=36a13f33-bfa9-4608-b686-4d7a4d33fdc4
```

### Tech Stack
- Next.js 14 (App Router) + TypeScript
- shadcn/ui + Tailwind CSS
- PostgreSQL 15 + pgvector (Docker)
- Claude Sonnet 4 (predictions)
- OpenAI text-embedding-3-small (embeddings)
- next-intl (bilingual ET/EN)

### MP Target
Tõnis Lukas - Isamaa party member, former Minister of Education and Culture
