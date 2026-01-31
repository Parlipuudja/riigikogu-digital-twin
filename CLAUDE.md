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

# Database (MongoDB Atlas)
npm run db:seed          # Load sample data (npx tsx scripts/seed-db.ts)

# Data collection from Riigikogu API
npm run data:collect-votes      # Fetch voting records
npm run data:collect-speeches   # Fetch stenogram speeches
npm run embeddings:generate     # Generate Voyage AI embeddings for RAG
```

## Architecture

**Tech Stack:** Next.js 14 (App Router), TypeScript, MongoDB Atlas + Vector Search, Claude Sonnet 4, Voyage AI (voyage-multilingual-2), Tailwind CSS + shadcn/ui, next-intl (bilingual ET/EN)

**Core Data Flow:**
```
User submits bill → POST /api/predict → claude.ts (predictVote) → Claude API → JSON response → UI
```

**Key Directories:**
- `riigikogu-digital-twin/src/lib/` - Core logic: `claude.ts` (prediction), `mongodb.ts` (database), `voyage.ts` (embeddings), `embeddings.ts` (vector search), `riigikogu-api.ts` (external API client)
- `riigikogu-digital-twin/src/app/api/` - API routes: `predict/`, `votes/`, `evaluate/`
- `riigikogu-digital-twin/src/app/[locale]/` - Pages with i18n routing (et/en)
- `riigikogu-digital-twin/scripts/` - Data collection and DB management

**Database Collections** (MongoDB Atlas):
- `bills` - Legislation metadata
- `votes` - Individual vote records (FOR/AGAINST/ABSTAIN/ABSENT)
- `speeches` - Stenogram transcripts
- Embeddings stored directly in documents (1024 dimensions)

**Vector Search Index:**
Create `vector_index` on `votes`, `speeches`, `bills` collections with:
- path: `embedding`
- numDimensions: 1024
- similarity: cosine

**External APIs:**
- Riigikogu Open Data API: `https://api.riigikogu.ee/api` (voting records, stenograms)
- Claude Sonnet 4: Vote prediction with bilingual reasoning
- Voyage AI voyage-multilingual-2: Embeddings for similarity search (better Estonian support)

## Environment Variables

Required in `.env` (see `.env.example`):
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/riigikogu
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...    # For embeddings:generate
MP_UUID=36a13f33-bfa9-4608-b686-4d7a4d33fdc4  # Tõnis Lukas
```

## Current Status

RAG/embeddings functionality is implemented using MongoDB Atlas Vector Search and Voyage AI. Embeddings are stored directly in documents for simpler architecture.
