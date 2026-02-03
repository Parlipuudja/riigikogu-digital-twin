# CLAUDE.md — Riigikogu Radar

## Start Here

This is a **political project expressed through software**. Before writing any code, understand why we exist.

### Read the Context System

```
.context/
├── soul/           # WHY we exist (mission, principles, ethics)
├── world/          # The political landscape we serve
├── strategy/       # WHAT we're building and for whom
├── state/          # Current system health and blockers
├── knowledge/      # Accumulated learnings (don't repeat failures)
├── action/         # Current priorities and next steps
└── log/            # Session history
```

**At session start:**
1. Read `.context/soul/mission.md` to remember the purpose
2. Read `.context/state/health.json` to understand current state
3. Read `.context/state/blockers.json` to see what's blocking progress
4. Read `.context/action/priorities.md` to know what to focus on
5. Check `.context/knowledge/failures.md` to avoid past mistakes

**At session end:**
1. Update `.context/state/` with new reality
2. Add learnings to `.context/knowledge/`
3. Log the session in `.context/log/`

### Quick State Check

```bash
# Update and view current state
npx tsx scripts/update-context-state.ts

# Or check production directly
curl -s https://seosetu.ee/api/v1/health
```

---

## The Core Thesis

> **Parliament is a complex system that can be modeled, understood, and predicted — but currently isn't.**

We make the legislative system **legible**. Legibility enables accountability. Accountability enables better governance.

---

## Working Directory

```
/home/ubuntu/riigikogu-radar/riigikogu-radar
```

## Essential Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm run lint                   # Check for errors

# State Management
npx tsx scripts/update-context-state.ts    # Update .context/state/
npx tsx scripts/progress-tracker.ts        # Full progress report

# Data Operations
npm run sync:all               # Sync from Riigikogu API
npm run embeddings:generate    # Generate vector embeddings
npm run backtest               # Run accuracy backtests

# Deployment
npx vercel --prod              # Deploy to production
```

## Architecture

```
DATA         MongoDB Atlas + Voyage AI embeddings
     ↓
INTELLIGENCE Claude/OpenAI/Gemini + RAG
     ↓
INTERFACE    Next.js 14 + API routes
```

## Key Principles (from .context/soul/principles.md)

1. **Reliability > Features** — A tool that works 3/4 times is not a tool
2. **Accuracy > Speed** — Better to be right than first
3. **Transparency > Magic** — If they can't understand it, they can't trust it
4. **Data > Opinion** — We present patterns, not judgments

## Environment Variables

Required in Vercel (NOT in repo):
```
MONGODB_URI
ANTHROPIC_API_KEY
VOYAGE_API_KEY
OPENAI_API_KEY (fallback)
GOOGLE_AI_API_KEY (fallback)
```

## Autonomy

You have authority to:
- Make decisions that serve the mission
- Update the context system as the project evolves
- Prioritize reliability over new features
- Say "this isn't ready" if it isn't

You must:
- Read the context system before starting work
- Update state after significant changes
- Log sessions with learnings
- Test on production after deploying

## Production

- **URL**: https://seosetu.ee
- **Health**: https://seosetu.ee/api/v1/health
- **Deployment**: Git push to main triggers Vercel build

---

*The detailed roadmap, features, and technical specs have moved to `.context/`. This file is the entry point, not the source of truth.*
