# SOUL.md — Riigikogu Radar

Everything a rebuilt version of this project needs to know and be.

---

## What This Is

A system that predicts how members of the Estonian Parliament (Riigikogu) will vote on proposed legislation, and makes those predictions publicly accessible.

One sentence: **Given a bill, predict each MP's vote (FOR/AGAINST/ABSTAIN/ABSENT), explain why, and show your accuracy.**

---

## Why It Exists

Parliamentary voting in Estonia is public record, but it is not legible. Citizens can see that MP X voted FOR bill Y, but they cannot see the pattern — that MP X votes with their party 97% of the time, breaks rank on environmental legislation, and has never voted against a defense budget increase.

This system makes parliamentary behavior legible and predictable. It inverts the surveillance relationship: instead of power watching citizens, citizens watch power.

The democratic value is not the prediction itself. It is the profile — the proof that a politician's behavior can be modeled, and therefore is not mysterious but systematic.

---

## The Domain

### Estonian Parliament (Riigikogu)

- **101 members**, elected by proportional representation
- Members belong to **factions** (fraktsioonid), which map to political parties
- **"Fraktsioonitud"** = independents — must be analyzed individually, not as a bloc
- **XV Riigikogu** (current convocation) began April 6, 2023

### Political Parties (as of 2025)

| Code | Name (Estonian) | Name (English) | Coalition/Opposition |
|------|----------------|-----------------|---------------------|
| RE | Reformierakond | Reform Party | Coalition |
| E200 | Eesti 200 | Estonia 200 | Coalition |
| SDE | Sotsiaaldemokraadid | Social Democrats | Coalition |
| EKRE | Eesti Konservatiivne Rahvaerakond | Conservative People's Party | Opposition |
| K | Keskerakond | Centre Party | Opposition |
| I | Isamaa | Fatherland | Opposition |

**Coalition composition changes.** Any code that hardcodes which parties are in the coalition is broken the day a government falls. This must be derived from data, not declared.

### Voting Mechanics

- **Simple majority**: 51 votes (most legislation)
- **Constitutional majority**: 68 votes (2/3, for organic laws and constitutional amendments)
- **Vote types**: FOR, AGAINST, ABSTAIN, ABSENT
- Most votes are party-line. The interesting predictions are the exceptions.

### Data Source

The **Riigikogu API** (api.riigikogu.ee) provides:
- Voting records with individual decisions per MP
- Stenograms (parliamentary speech transcripts) with speaker attribution
- Draft legislation with full text, initiators, and status
- MP data: faction membership, committees, photo, convocation history

The data is public. The API has rate limits (respect 200ms+ between calls). Estonian-language content dominates.

---

## What Actually Works (Honest Assessment)

### Working well:
- **Data collection** is solid. The sync system handles rate limiting, checkpointing, and resumption. 4,333 votings, 975 stenograms, 101 MPs collected.
- **Vector embeddings** at 100% coverage via Voyage AI (voyage-multilingual-2), which handles Estonian well.
- **The web interface** works. MP profiles, vote histories, prediction UI, parliament simulation — all functional at seosetu.ee.
- **Bilingual support** (Estonian/English) throughout the UI and API responses.

### Not working well:
- **Prediction accuracy is 73.3% on honest (post-cutoff) data.** This is mediocre. A naive baseline of "predict party line" would achieve ~85% for most MPs. The AI prediction system currently underperforms the obvious heuristic for loyal MPs and provides marginal value only for the ~15-20 MPs who regularly break rank.
- **The "brain" is a glorified health checker.** It runs Claude CLI every 15 minutes to curl a health endpoint and check data freshness. This is not autonomy — it is a cron job with LLM overhead.
- **The operatives concept is theater.** Project Manager, Collector, Analyst, Predictor, Guardian — these exist only as markdown role descriptions. There is no actual multi-agent architecture. One brain.ts spawns one Claude process.
- **No learning loop.** The system does not improve from its mistakes. Backtests measure accuracy but results never feed back into better predictions. There is no training step, no weight adjustment, no feature engineering.

---

## How Prediction Works (Current Implementation)

```
Bill text → Embed → Vector search for similar past votes →
  Find MP's votes on those similar bills →
  Find MP's relevant speeches (keyword match, not semantic) →
  Build prompt with MP's "digital twin" profile →
  Ask Claude (Haiku) to predict vote →
  Parse JSON response → Cache for 7 days
```

### The Three Layers (Cost Optimization)

1. **Cache** ($0): Check if this MP+bill combination was predicted in the last 7 days.
2. **Statistical bypass** ($0): If MP votes with party >95% of the time, predict party line without calling AI. (Flawed: hardcodes coalition = FOR, opposition = AGAINST, ignoring bill context.)
3. **AI prediction** (~$0.001): Build a prompt from the MP's profile template + RAG context, send to Claude Haiku, parse JSON response.

### MP Profile ("Digital Twin")

Each MP gets an AI-generated instruction template containing:
- Political position (economic scale, social scale)
- Key issues with stances and confidence scores
- Decision factors (support triggers, opposition triggers)
- Behavioral patterns (party loyalty %, independence indicators)
- Voting statistics (distribution, attendance)
- Direct quotes from speeches (matched by keyword, not semantic similarity)

The template is generated once by Claude Sonnet analyzing the MP's voting history and speeches, then used as a prompt prefix for all future predictions via Haiku.

### RAG (Retrieval-Augmented Generation)

- **Similar votes**: MongoDB Atlas Vector Search on voting embeddings (Voyage AI). Finds past votes semantically similar to the bill being predicted. Returns the MP's actual vote on those similar bills.
- **Relevant speeches**: Falls back to keyword matching (not semantic search). Finds stenogram excerpts where the MP spoke on related topics. Limited to 20 stenograms, word overlap matching.

### Known Prediction Flaws

1. **No calibrated confidence.** The confidence score is whatever Claude outputs — not statistically calibrated. A "90% confidence" prediction is not correct 90% of the time.
2. **Coalition hardcoding.** `COALITION_PARTIES = new Set(["RE", "E200", "SDE"])` breaks when the government changes. Must be derived dynamically.
3. **No bill-type awareness in statistical bypass.** The bypass assumes coalition parties always vote FOR and opposition always AGAINST. This ignores free votes, conscience votes, opposition-initiated legislation, and constitutional amendments where dynamics differ.
4. **Speech retrieval is weak.** Keyword matching produces false positives and misses semantic relevance. This is inconsistent — votings use vector search, speeches use keywords.
5. **No cross-MP signal.** Each MP is predicted independently. The system doesn't model that if one party leader votes AGAINST, their faction likely follows.
6. **Profile staleness.** MP profiles are generated once and reused. If an MP changes positions or party dynamics shift, the profile is stale until manually regenerated.

---

## Data Leakage Warning (ADR-001)

Backtesting showed 91.7% accuracy — but this included votes from before Claude's training cutoff (May 2025). The model may have memorized these votes during pre-training. **Only post-cutoff accuracy (73.3%) is honest.** Any accuracy claim must specify the evaluation period relative to the model's training data.

This is the single most important technical integrity decision in the project. Overstating accuracy would be both dishonest and strategically stupid — it would lead to false confidence in predictions that don't work.

---

## Architecture

```
Riigikogu API → MongoDB Atlas → Voyage AI → Claude → Next.js API → Web UI
     ↓              ↓              ↓           ↓           ↓
  COLLECT        STORE          EMBED      PREDICT     SERVE
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 14 (App Router) | SSR + API routes in one deployment |
| Language | TypeScript (strict) | Type safety for complex domain |
| Database | MongoDB Atlas | Document store fits parliamentary data shapes; vector search built-in |
| Embeddings | Voyage AI (voyage-multilingual-2, 1024 dim) | Best multilingual/Estonian support |
| Prediction | Claude (Haiku for predictions, Sonnet for profiles) | Best reasoning quality |
| Failover | OpenAI, Google AI | Backup if Anthropic is down |
| Hosting | Vercel | Git-push deploys, serverless |
| Styling | Tailwind CSS + Radix UI | Rapid UI development |
| i18n | next-intl | Estonian/English |
| Validation | Zod | Schema validation for API responses |

### Database Collections

| Collection | Purpose | Size |
|------------|---------|------|
| `members` | Raw MP data from API | Small |
| `mps` | Enriched MP profiles with AI-generated templates | Medium |
| `votings` | All voting records with per-voter decisions + embeddings | Large |
| `stenograms` | Parliamentary speeches by session and speaker | Large |
| `drafts` | Legislation text, initiators, status | Medium |
| `prediction_cache` | Cached predictions (7-day TTL) | Small |
| `simulations` | Cached full parliament simulations | Small |
| `simulation_jobs` | Async job tracking for simulations | Small |
| `brain_state` | Brain process status and heartbeat | Tiny |
| `brain_runs` | Brain cycle history and output logs | Small |
| `sync_progress` | Per-type sync checkpointing for resumption | Tiny |
| `backtest_progress` | Per-MP backtest progress tracking | Small |

### Constraint: MongoDB Atlas Free Tier (512 MB)

The current deployment uses the free tier. Stenograms are the largest data type and are truncated to 10KB per speaker. Sync scripts check database size every N records and pause if approaching 480MB. This constraint shapes the entire data strategy.

---

## Web Pages

| Path | Purpose |
|------|---------|
| `/` | Dashboard with system stats and recent activity |
| `/mps` | List all MPs with search and party filtering |
| `/mps/[slug]` | Individual MP profile, voting history, prediction interface |
| `/simulate` | Full parliament vote simulation for a bill |
| `/drafts` | Browse legislation |
| `/drafts/[uuid]` | Individual draft with related votes |
| `/accuracy` | Public accuracy metrics |
| `/insights` | AI-generated political analysis |
| `/about` | Project information |
| `/admin` | Admin dashboard (status, sync, backtest controls) |
| `/admin/brain` | Brain chat interface |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/mps/[slug]/predict` | Predict one MP's vote on a bill |
| GET | `/api/v1/mps` | List MPs |
| GET | `/api/v1/mps/[slug]` | Get MP profile |
| POST | `/api/v1/simulate` | Start parliament simulation |
| GET | `/api/v1/simulate/[jobId]` | Get simulation status/results |
| POST | `/api/v1/simulate/[jobId]/continue` | Resume interrupted simulation |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/search` | Semantic search across all data |
| GET | `/api/v1/insights` | AI-generated insights |
| GET | `/api/v1/stats` | Parliamentary statistics |
| GET | `/api/v1/drafts` | List drafts |
| GET | `/api/v1/ai-status` | AI provider status |
| GET | `/api/v1/export/mps` | Export MP data |
| GET | `/api/v1/export/votings` | Export voting data |
| POST | `/api/v1/brain/chat` | Brain chat with tool use |
| GET | `/api/v1/admin/status` | Admin system status |
| POST | `/api/v1/admin/sync` | Trigger data sync |
| GET | `/api/v1/admin/backtest` | Backtest status |
| GET | `/api/v1/admin/simulations` | Simulation history |
| GET | `/api/v1/admin/operatives` | Brain/operative status |

---

## Principles for a Rebuild

### 1. Accuracy Is the Product

Not the UI. Not the "autonomous brain." Not the architecture. The only thing that matters is: **does the system correctly predict how MPs will vote?** Everything else is infrastructure to serve that question.

Current accuracy: 73.3%. Target: 85%+. The gap is not a prompting problem — it is a methodology problem. The system needs to move from "ask an LLM" to "build a model that learns from data."

### 2. Start With the Naive Baseline

Before building anything complex, implement the obvious: **predict that every MP votes with their party.** Measure accuracy. This is probably ~85% for loyal MPs. Now you have a baseline. Every technique must beat this baseline or it is waste.

### 3. Separate What LLMs Are Good At From What Statistics Are Good At

LLMs are good at: understanding bill text, generating explanations, extracting positions from speeches, producing bilingual output.

LLMs are bad at: consistent numerical reasoning, calibrated probability estimates, learning from data patterns, being fast and cheap at scale.

Use LLMs for understanding content. Use statistics/ML for making predictions.

### 4. The Interesting Problem Is the Exceptions

85% of votes are party-line. They are boring and easy to predict. The valuable predictions are the 15%: when an MP breaks rank, when a party splits, when a free vote produces surprises. A system that is 100% accurate on party-line votes and 0% on defections is useless. Optimize for the tail.

### 5. Dynamic Over Static

Coalition composition changes. Party positions evolve. MPs switch parties. Individual voting patterns shift over time. Nothing should be hardcoded that can be derived from data. If you find yourself writing `COALITION_PARTIES = ["RE", "E200", "SDE"]`, you are building something that will break.

### 6. Honest Accuracy Is Non-Negotiable

Always separate pre-cutoff from post-cutoff evaluation. Always report the honest number. Never inflate accuracy to look good. Users who trust inflated numbers will be burned; users who trust honest numbers will be loyal.

### 7. Occam's Razor Applied to Code

The previous version had: a brain, a supervisor, a run-operative script, a live-server, an elaborate .context/ directory tree, a multi-operative role system, and a health monitoring loop. What it actually needed: a script that syncs data, a function that predicts votes, and a web server that shows results. Start from minimum viable and add complexity only when forced by a real problem.

### 8. Feedback Loops Over Fire-and-Forget

The current system predicts → caches → forgets. A better system predicts → records → waits for the actual vote → compares → adjusts. Every prediction should be an opportunity to learn. Every wrong prediction should be investigated: was the bill text misleading? Was the MP profile stale? Was it a free vote? Was it a party split?

---

## What a Rebuild Should Prioritize

### Phase 1: Data Foundation
- Sync all parliamentary data (existing code works well, reuse it)
- Establish the naive baseline: party-line prediction accuracy
- Build a clean data model with one canonical type per entity

### Phase 2: Statistical Prediction
- For each MP, calculate party loyalty rate dynamically
- Classify votes by type (party-line, free vote, constitutional, procedural)
- For high-loyalty MPs (>95%): predict party line, done
- For swing MPs: build feature vectors from voting history, committee membership, bill topic similarity, coalition dynamics
- Measure accuracy against the naive baseline

### Phase 3: LLM Enhancement
- Use LLMs to understand bill text (classification, topic extraction)
- Use LLMs to generate explanations for statistical predictions
- Use LLMs to extract positions from speeches
- Do NOT use LLMs to make the prediction itself

### Phase 4: Learning Loop
- Record every prediction with a timestamp
- When the actual vote happens, compare
- Track accuracy over time per MP, per vote type, per topic
- Feed errors back into the model
- Publish accuracy transparently

### Phase 5: Autonomy (If Earned)
- Only automate what works manually first
- The "brain" should trigger data syncs and backtests, not make architectural decisions
- Health monitoring is a cron job, not an AI agent

---

## Hard-Won Lessons

1. **Data leakage flatters accuracy.** Testing on data the model was trained on (or that the LLM saw in pre-training) produces unrealistically high numbers. Always evaluate on truly unseen data.

2. **Fire-and-forget in serverless dies silently.** Vercel functions have a 60-300 second timeout. Any work must complete within the request lifecycle or use continuation tokens.

3. **Single AI dependency is a single point of failure.** Build the failover chain (Claude → OpenAI → Google AI) but test it regularly. An untested failover is not a failover.

4. **Rate limiting is a feature, not a bug.** The Riigikogu API has limits. Respecting them with dynamic backoff (start 500ms, reduce on success, increase on 429) builds a robust sync system.

5. **MongoDB Atlas free tier caps at 512MB.** This means truncating stenogram text (10KB per speaker), checking size during sync, and prioritizing newer data. Upgrading the tier removes this constraint but costs money.

6. **MP profiles go stale.** An MP who switched from coalition to opposition has a fundamentally different voting pattern. Profiles must be regenerated when major political events occur, not just on a schedule.

7. **Keyword search is not semantic search.** The speech retrieval system uses keyword matching while the voting retrieval uses vector search. This inconsistency means speech context is unreliable.

8. **The LLM's confidence score is not calibrated.** When Claude says "85% confidence," it does not mean the prediction is correct 85% of the time. Treat LLM-generated confidence as ordinal (relative ranking), not cardinal (actual probability).

9. **Party-line prediction is the floor, not the ceiling.** A system that only predicts party line is ~85% accurate but useless — it tells you nothing you couldn't know from knowing the party composition. Value comes from predicting deviations.

10. **Bilingual adds complexity.** Supporting Estonian and English doubles the prompt length, the profile size, and the testing surface. Decide if this is worth it for the target audience.

---

## Philosophical Foundations

These are the intellectual frameworks that should guide design decisions:

- **Falsificationism** (Popper): Every prediction must be testable against reality. Report accuracy honestly. Predictions that cannot be wrong are worthless.
- **Bayesian Epistemology**: Start with prior beliefs (party loyalty, historical voting), update with evidence (bill text, speeches, similar votes), produce posterior probability. This is literally what the prediction function should be.
- **Cybernetics** (Wiener/Ashby): The system must have a feedback loop. Sense → Compare → Act → Sense again. Measure accuracy, find errors, improve, measure again.
- **Requisite Variety** (Ashby): The model must have at least as many dimensions as the phenomenon it predicts. A model that only knows party affiliation cannot predict cross-party votes.
- **Occam's Razor**: Do not add complexity that does not improve prediction accuracy. A statistical model that is 85% accurate is better than an LLM pipeline that is 73% accurate.
- **Unix Philosophy**: Do one thing well. The sync script syncs. The prediction function predicts. The web server serves. They are composed, not entangled.

---

## Environment Variables

```
MONGODB_URI           # MongoDB Atlas connection string
ANTHROPIC_API_KEY     # Claude API (primary)
VOYAGE_API_KEY        # Voyage AI embeddings
OPENAI_API_KEY        # OpenAI (failover)
GOOGLE_AI_API_KEY     # Google AI (failover)
ENABLE_AI_FAILOVER    # "true" to enable failover chain
```

---

## Production

- **URL**: https://seosetu.ee
- **Health**: https://seosetu.ee/api/v1/health
- **Deploy**: Push to `main` branch triggers Vercel auto-deploy
- **API docs**: https://api.riigikogu.ee/swagger-ui.html (data source)

---

*This document is the seed. Everything else is implementation.*
