# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Riigikogu Digital Twin - A web application that predicts how Estonian MPs would vote on proposed legislation using AI. The system:
- Creates AI-powered "digital twin" profiles for any Member of Parliament
- Analyzes historical voting records, speeches, and political positions
- Generates personalized vote predictions with bilingual reasoning (Estonian/English)
- Runs parliament-wide simulations to predict bill passage probability
- Includes backtesting to measure prediction accuracy

## Commands

```bash
# Development
npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint

# Database (MongoDB Atlas)
npm run db:seed          # Load sample data
npm run db:size          # Check database size/usage

# Data Sync from Riigikogu API
npm run sync:all         # Sync all data (members, votings, drafts, stenograms)
npm run sync:members     # Sync parliament members
npm run sync:votings     # Sync voting records with voter details
npm run sync:drafts      # Sync legislative drafts/bills
npm run sync:stenograms  # Sync stenogram speeches
npm run sync:status      # Check sync progress
npm run sync:resume      # Resume interrupted sync
npm run sync:draft-texts # Download and extract full text from draft PDF/DOCX files
npm run sync:link-votings # Link votings to drafts using API-provided UUIDs

# Embeddings & RAG
npm run embeddings:generate  # Generate Voyage AI embeddings for vector search

# Backtesting
npm run backtest         # Run backtests for all active MPs
npm run backtest:mp      # Run backtest for specific MP (--mp=slug)
```

## Architecture

**Tech Stack:** Next.js 14 (App Router), TypeScript, MongoDB Atlas + Vector Search, Claude Sonnet 4, Voyage AI (voyage-multilingual-2), Tailwind CSS + shadcn/ui, next-intl (bilingual ET/EN)

**Core Data Flow:**
```
User submits bill → POST /api/mps/[slug]/predict → prediction.ts → claude.ts → Claude API → JSON response → UI
```

**Key Directories:**
- `src/lib/` - Core logic:
  - `claude.ts` - Claude API wrapper for predictions
  - `prediction.ts` - Prediction orchestration with RAG
  - `embeddings.ts` - Vector search for similar votes/speeches
  - `backtesting.ts` - Accuracy measurement with temporal isolation
  - `instruction-generator.ts` - AI-powered MP profile generation
  - `mp-service.ts` - MP profile CRUD operations
  - `mongodb.ts` - Database connection
  - `voyage.ts` - Voyage AI embeddings
  - `riigikogu-api.ts` - Estonian Parliament API client
- `src/app/api/` - API routes:
  - `predict/` - Legacy single-MP prediction
  - `mps/` - MP profile management
  - `mps/[slug]/predict/` - MP-specific predictions
  - `mps/[slug]/backtest/` - Backtesting endpoints
  - `simulate/` - Parliament-wide vote simulation
- `src/app/[locale]/` - Pages with i18n routing (et/en)
- `scripts/` - Data collection and management:
  - `sync-api.ts` - Main data sync orchestrator
  - `lib/sync-*.ts` - Collection-specific sync modules
  - `sync-draft-texts.ts` - PDF/DOCX text extraction
  - `link-votings-drafts.ts` - Voting-draft relationship linking
  - `run-backtest.ts` - Batch backtesting
  - `regen-mp.ts` - Regenerate MP profiles

**Database Collections** (MongoDB Atlas):
- `mps` - MP profiles with AI-generated instructions
- `votings` - Voting records with embedded voter decisions
- `drafts` - Legislative drafts with full text
- `stenograms` - Parliamentary speeches with speaker data
- `members` - Parliament member details
- `sync_progress` - Data sync tracking
- `backtest_progress` - Backtest state for resume

**Vector Search Index:**
Create `vector_index` on `votings`, `drafts` collections with:
- path: `embedding`
- numDimensions: 1024
- similarity: cosine

**External APIs:**
- Riigikogu Open Data API: `https://api.riigikogu.ee/api` (voting records, stenograms, drafts)
- Claude Sonnet 4: Vote prediction and profile generation
- Voyage AI voyage-multilingual-2: Embeddings for similarity search (1024 dimensions)

## Environment Variables

Required in `.env`:
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/riigikogu
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...    # For embeddings:generate
MP_UUID=...              # Default MP UUID for legacy /api/predict endpoint
```

## Key Features

### Multi-MP Digital Twin System
- Create profiles for any current Riigikogu member
- AI analyzes voting history and speeches to build political profile
- Generates personalized instruction templates for predictions
- Profiles include: political position scales, key issues, decision factors, behavioral patterns

### Vote Prediction
- Submit bill title and description
- RAG retrieves similar past votes and relevant speeches
- Claude predicts vote (FOR/AGAINST/ABSTAIN) with confidence
- Bilingual reasoning in Estonian and English

### Parliament Simulation
- Batch predict all active MPs on a bill
- Calculate passage probability
- Group by confidence level

### Backtesting
- Temporal isolation: predictions use only data available before each test vote
- Confusion matrix and precision metrics
- Resume capability for long runs
- Results stored on MP profile

## Current Data Status

The database contains synchronized data from Riigikogu API:
- ~500 drafts with full text (PDF/DOCX extracted)
- ~850 votings with embedded voter data
- ~400 stenograms with speaker speeches
- ~100 members

Voting-draft links are established via `relatedVotingUuids` from the API.
