# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Riigikogu Digital Twin - A web application that predicts how Estonian MP Tõnis Lukas (Isamaa party) would vote on proposed legislation using AI. The system analyzes historical voting records, speeches, and political positions to generate predictions with reasoning in both Estonian and English.

## Commands

```bash
# Development
npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint

# Database (PostgreSQL + pgvector via Docker)
npm run db:up            # Start database container
npm run db:down          # Stop database container
npm run db:seed          # Load sample data (npx tsx scripts/seed-db.ts)

# Data collection from Riigikogu API
npm run data:collect-votes      # Fetch voting records
npm run data:collect-speeches   # Fetch stenogram speeches
npm run embeddings:generate     # Generate OpenAI embeddings for RAG
```

## Architecture

**Tech Stack:** Next.js 14 (App Router), TypeScript, PostgreSQL + pgvector, Claude Sonnet 4, Tailwind CSS + shadcn/ui, next-intl (bilingual ET/EN)

**Core Data Flow:**
```
User submits bill → POST /api/predict → claude.ts (predictVote) → Claude API → JSON response → UI
```

**Key Directories:**
- `riigikogu-digital-twin/src/lib/` - Core logic: `claude.ts` (prediction), `db.ts` (PostgreSQL), `embeddings.ts` (pgvector), `riigikogu-api.ts` (external API client)
- `riigikogu-digital-twin/src/app/api/` - API routes: `predict/`, `votes/`, `evaluate/`
- `riigikogu-digital-twin/src/app/[locale]/` - Pages with i18n routing (et/en)
- `riigikogu-digital-twin/scripts/` - Data collection and DB management

**Database Schema** (see `scripts/init-db.sql`):
- `bills` - Legislation metadata
- `votes` - Individual vote records (FOR/AGAINST/ABSTAIN/ABSENT)
- `speeches` - Stenogram transcripts
- `embeddings` - Vector embeddings (1536 dimensions) with HNSW index
- `vote_summary` - Denormalized view joining votes + bills

**External APIs:**
- Riigikogu Open Data API: `https://api.riigikogu.ee/api` (voting records, stenograms)
- Claude Sonnet 4: Vote prediction with bilingual reasoning
- OpenAI text-embedding-3-small: Embeddings for similarity search

## Environment Variables

Required in `.env` (see `.env.example`):
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/riigikogu
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...    # For embeddings:generate
MP_UUID=36a13f33-bfa9-4608-b686-4d7a4d33fdc4  # Tõnis Lukas
```

## Current Status

RAG/embeddings functionality is implemented but currently disabled in the prediction flow. Predictions use direct Claude API calls without similarity search augmentation.
