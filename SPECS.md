# SPECS.md

*The technical blueprint. SOUL.md is the philosophy. This document is the body.*

*Each phase must be completely finished before the next begins. The gate is absolute.*

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────┐
│  Riigikogu API  │────▶│  Python Service       │────▶│  MongoDB Atlas │
│  (data source)  │     │  (FastAPI + Docker)   │◀───▶│  (shared DB)   │
└─────────────────┘     │  VPS :8000            │     └───────┬────────┘
                        └──────────┬───────────┘             │
                                   │ REST              reads │ state
                        ┌──────────▼───────────┐     ┌───────▼────────┐
                        │  Next.js Frontend     │     │  Claude Code   │
                        │  Vercel — seosetu.ee  │     │  (operator)    │
                        └──────────────────────┘     └────────────────┘
```

**Three processes, one database, no coordinator.** The database is the coordination layer — each process reads the state of the world and acts accordingly.

- **Python service** (VPS, Docker): data pipeline, prediction engine, learning loops, scheduling. The nervous system.
- **Next.js frontend** (Vercel): presentation only. SSR pages, i18n. Stateless. The face.
- **Claude Code operator** (VPS): reads system state, audits against SOUL.md, modifies code, tests, deploys. The cognition. Currently requires human initiation — full autonomy is the hardest unsolved problem (see SOUL.md).

---

## Phase 1: Legibility

*Make the Estonian Parliament readable. Complete, accurate, trustworthy data.*

### What gets built

**Data sync** from the Riigikogu API:
- Members (profiles, factions, committees, convocations)
- Votings (every vote, every MP decision, linked to bills)
- Drafts (legislation with initiators, status, text)
- Stenograms (speeches, speaker attribution)

**MP profiles** — the core analytical input, not a display page:
- Personal background, constituency, faction, committee assignments
- Complete voting record with attendance
- Party alignment rate, defection patterns, sponsorship history
- Updated automatically on every sync

**Embeddings** for similarity search:
- Voyage AI `voyage-multilingual-2`, 1024 dimensions
- Every voting title/description and draft title/summary embedded
- Atlas Vector Search index (cosine similarity)

**Frontend**: MP list, MP detail pages, voting records, drafts. The parliament is readable.

### Data flow

```
Riigikogu API → sync/riigikogu.py → MongoDB (members, votings, drafts, stenograms)
                                   → sync/embeddings.py → MongoDB (embedding fields)
                                   → mps collection (enriched profiles with stats)
```

### Gate

A user can look at any MP and understand their voting behavior, party loyalty, committee work, and attendance — accurately, completely, without touching the Riigikogu website. Every voting record is present. Every profile is current. No gaps, no stale data, no silent sync failures.

---

## Phase 2: Prediction

*Predict individual MP votes with verified accuracy above baseline.*

### The pipeline

One pipeline. Every bill — known or novel — goes through the same process.

```
bill → embed (Voyage AI)
     → vector search (find similar past votings)
     → profile (retrieve structured MP profile)
     → analyze.py (dialectical analysis + trustee/delegate/follower lenses)
     → features.py (statistical features + analysis signals)
     → model.py (predict)
     → calibrate.py (calibrate probabilities)
     → explain.py (bilingual explanation)
     → response
```

No special cases. No fast path. No degraded mode. The same pipeline, every time.

#### embed + vector search

Embed the bill text. Find the top-N most similar past votings by cosine similarity. These provide historical context — how did parliament vote on similar legislation?

#### profile

Retrieve each MP's structured profile. The Political Actor Agent paper (AAAI 2025) proved this is the single most important input — removing profiles drops accuracy from 92% to 79%.

The profile includes: personal background, constituency, committee assignments, sponsorship history, voting record, defection patterns, known positions, party alignment rate.

#### analyze.py

Substantive bill analysis. Two stages:

**Stage 1 — The tension (dialectic).** What political conflict does this bill create?
- What forces push FOR? (parties, ideologies, constituencies, coalition pressure)
- What forces push AGAINST? (parties, ideologies, constituencies, electoral incentives)

**Stage 2 — The resolution (per MP).** Three lenses per MP:
- **Trustee**: personal conviction and expertise on this issue
- **Delegate**: constituency preferences and electoral incentives
- **Follower**: party discipline and leadership pressure

Output: `BillAnalysis` — structured object with per-party positions, cross-pressure indicators, controversy level, dominant lens per MP, and reasoning.

The LLM analyzes the political landscape. It does not predict votes. It provides structured signals that feed into the model as features.

#### features.py

For each (MP, bill) pair, compute features from both statistical history and substantive analysis:

| Feature | Source | Description |
|---------|--------|-------------|
| `party_loyalty_rate` | stats | % of recent votes matching party majority |
| `bill_topic_similarity` | stats | Cosine similarity: bill vs MP's past vote embeddings |
| `bill_type` | stats | Constitutional, budget, procedural, legislative |
| `committee_relevance` | stats | MP on a committee related to this bill? |
| `coalition_bill` | stats | Initiated by coalition party? |
| `defection_rate_by_topic` | stats | MP's defection rate on similar past bills |
| `party_cohesion_on_similar` | stats | Party unity on similar past votes |
| `days_since_last_defection` | stats | Recency of breaking rank |
| `mp_attendance_rate` | stats | Recent attendance % |
| `party_position_strength` | stats | Strength of party majority on similar bills |
| `analysis_party_position` | analysis | LLM assessment: party likely FOR/AGAINST/SPLIT |
| `analysis_controversy_level` | analysis | 0–1, how politically divisive |
| `analysis_cross_pressure` | analysis | Is this MP cross-pressured? |
| `analysis_dominant_lens` | analysis | Trustee, delegate, or follower on this bill? |

#### model.py

1. Start with logistic regression (interpretable, fast)
2. If accuracy < target: XGBoost (more capacity for interaction effects)
3. Training data: historical votes as labeled examples, all features. Target: vote decision.
4. Train/test split: test = post-cutoff votes only. Never evaluate on training data.
5. Output: `{ prediction, confidence, features_used: [{ name, value, importance }] }`

#### calibrate.py

Platt scaling on held-out validation set. "90% confident" means correct 90% of the time. Evaluate with reliability diagram and Brier score. If poorly calibrated: isotonic regression.

#### explain.py

After the model predicts, the LLM explains *why* — in Estonian and English. The explanation includes:
- Which political tensions the system identified
- Which lens (trustee/delegate/follower) dominated for this MP
- Which evidence it weighed
- What is surprising or informative about this prediction

The LLM never makes the prediction. It narrates the prediction the model already made.

### Simulation

The simulation endpoint runs the pipeline 101 times — once per MP — on the same bill. Bill analysis is computed once and shared.

```
POST /simulate { title, description?, fullText? }
  → analyze bill once
  → for each of 101 current MPs: profile → features → predict → explain
  → tally results, identify notable predictions
  → return full result with analysis, tally, per-MP predictions, notable
```

**Absurdity detection** before returning:
- Unanimity check: >90% same direction on substantive legislation → suspicious
- Input sensitivity: if analysis features contributed zero importance → the system is ignoring the bill
- Confidence calibration: >90% average confidence on a novel controversial bill → miscalibrated

### Cadence

Predictions are living estimates. When context changes — new votes cast, coalition events, committee reassignments — affected predictions re-score. A prediction from last week with last week's context is stale.

### Gate

The system predicts individual votes on novel bills with verified accuracy above the 85% party-line baseline, on post-cutoff data. Explanations are credible — a knowledgeable user reads them and finds them plausible and informative. Scenario confrontation passes: "legalize cannabis," "raise defense budget to 5%," "ban TikTok" produce different, non-trivial results. No 101-0 on controversial bills.

---

## Phase 3: Intelligence

*Strategic analysis. Vote prediction proved the engine. This phase makes it actionable.*

### What gets built

**MP political actor profiles.** Beyond statistics — where does this MP act as trustee (conviction), delegate (constituency), or follower (party)? What cross-pressures do they carry? What will break them from their party, and on what? Generated from voting history, committee work, speech analysis, and prediction patterns.

**Shift detection.** Continuous monitoring:
- Pairwise party voting correlation (rolling window). Delta > threshold → coalition stress alert.
- Per-MP defection rate trend. Rising → potential realignment alert.
- Opposition voting pattern changes. Unusual alignment → emerging cross-party dynamics.

**Coalition health assessment.** Derived from voting correlation patterns — never hardcoded. Current coalition coherence, stress fractures, policy areas of disagreement.

**Cross-pressure maps.** For upcoming legislation: which MPs carry contradictions that this bill forces into the open? Where are the trustee/delegate/follower tensions most acute?

**Bill impact analysis.** For any bill: which sectors, which constituencies, which political dynamics are affected? Where does it create pressure?

### Gate

The system gives one demanding user political sight they could not achieve without it. The user relies on it for understanding Estonian politics. The intelligence is actionable — it changes decisions, not just knowledge. If the user would be equally informed without the system, this phase is not done.

---

## Phase 4: Citizens

*Open the intelligence to non-experts.*

### What gets built

**Accessible explanations.** Every prediction, every profile, every intelligence product must be understandable by someone with no political background. Jargon-free. Context-rich. Both Estonian and English.

**Public accuracy dashboard.** The system's credibility is public. Every prediction timestamped before the vote, verified after. The accuracy record is visible. A system that hides its mistakes is propaganda.

**Public-facing frontend.** seosetu.ee serves the full arc: legibility, prediction, intelligence. MP profiles show political actors, not statistical summaries. Simulation shows analysis and notable predictions. Shift detection is visible.

### Gate

A citizen with no political background can use the system and get intelligence they find useful and trustworthy. If the system only works for experts, this phase is not done.

---

## Database Schema (MongoDB Atlas)

Constraint: **512MB free tier**. Truncate stenograms, monitor size during sync, prioritize newer data.

### `members`

Raw MP data from the Riigikogu API.

| Field | Type | Notes |
|-------|------|-------|
| `uuid` | string | Riigikogu API UUID (primary key) |
| `firstName`, `lastName`, `fullName` | string | |
| `active` | boolean | Current parliament member |
| `faction` | `{ name }` | Current faction |
| `partyCode` | string | RE, EKRE, K, I, SDE, E200, FR |
| `photoUrl` | string? | |
| `committees` | `[{ name, role, active }]` | Committee memberships |
| `convocations` | `number[]` | Which Riigikogu terms served |
| `syncedAt` | Date | |

### `mps`

Enriched MP profiles — the core analytical input.

| Field | Type | Notes |
|-------|------|-------|
| `slug` | string | URL-friendly: `"martin-helme"` |
| `memberUuid` | string | FK → members.uuid |
| `name`, `firstName`, `lastName` | string | |
| `party`, `partyCode` | string | |
| `photoUrl` | string? | |
| `status` | enum | `active`, `inactive` |
| `isCurrentMember` | boolean | |
| `stats` | object | totalVotes, attendance, partyAlignmentRate, votesFor/Against/Abstain |
| `profile.dominantLens` | string | Primary mode: trustee, delegate, or follower |
| `profile.trusteeTopics` | array | Issues where MP acts on personal conviction |
| `profile.delegateTopics` | array | Issues where constituency pressure dominates |
| `profile.crossPressures` | array | Contradictions the MP carries |
| `profile.breakingPoints` | array | What would make this MP defy their party |
| `profile.keyPositions` | array | `[{ issue, stance, confidence, evidence }]` |
| `profile.generatedAt` | Date | |
| `backtest` | object | Accuracy, confusion matrix, per-decision breakdown |

### `votings`

All voting records with individual MP decisions.

| Field | Type | Notes |
|-------|------|-------|
| `uuid` | string | Riigikogu API UUID |
| `title` | string | Estonian |
| `titleEn` | string? | AI-translated |
| `description` | string? | |
| `votingTime` | string | ISO datetime |
| `sessionDate` | string | |
| `type` | `{ code, value }` | |
| `result` | string | ACCEPTED, REJECTED |
| `inFavor`, `against`, `abstained`, `absent` | number | |
| `voters` | array | `[{ memberUuid, fullName, faction, decision }]` |
| `relatedDraftUuid` | string? | |
| `embedding` | `number[1024]` | Voyage AI vector |
| `syncedAt` | Date | |

### `drafts`

Legislative bills.

| Field | Type | Notes |
|-------|------|-------|
| `uuid` | string | |
| `number` | string | e.g. "123 SE" |
| `title`, `titleEn` | string | |
| `type`, `status` | `{ code, value }` | |
| `summary` | string? | |
| `initiators` | `string[]` | |
| `submitDate` | string | |
| `relatedVotingUuids` | `string[]` | |
| `embedding` | `number[1024]` | |
| `syncedAt` | Date | |

### `stenograms`

Parliamentary speeches. `speakers[].text` truncated to 10KB per speaker.

| Field | Type | Notes |
|-------|------|-------|
| `uuid` | string | |
| `sessionDate` | string | |
| `sessionType` | string | |
| `speakers` | array | `[{ memberUuid, fullName, text, topic }]` |
| `syncedAt` | Date | |

### `prediction_log`

Every prediction ever made. The memory of the learning loop.

| Field | Type | Notes |
|-------|------|-------|
| `mpSlug` | string | |
| `mpUuid` | string | |
| `votingUuid` | string? | If predicting a specific vote |
| `billTitle` | string | |
| `billHash` | string | SHA256[:16] |
| `predicted` | enum | FOR, AGAINST, ABSTAIN, ABSENT |
| `confidence` | number | 0.0–1.0, calibrated |
| `featuresUsed` | array | `[{ name, value, importance }]` |
| `analysisUsed` | object? | Substantive analysis summary |
| `dominantLens` | string? | Which lens dominated this prediction |
| `modelVersion` | string | |
| `predictedAt` | Date | |
| `actual` | enum? | Filled when vote happens |
| `correct` | boolean? | |
| `resolvedAt` | Date? | |

### `prediction_cache`

Short-term cache. 7-day TTL.

| Field | Type | Notes |
|-------|------|-------|
| `cacheKey` | string | `"{mpSlug}:{billHash}"` |
| `prediction` | object | Full prediction |
| `createdAt` | Date | |
| `expiresAt` | Date | TTL index |

### `model_state`

The system's self-model.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | string | `"current"` |
| `version` | string | |
| `trainedAt` | Date | |
| `features` | `string[]` | Active feature names |
| `featureImportances` | array | `[{ name, importance }]` |
| `accuracy.overall` | number | |
| `accuracy.byParty` | object | Per-party accuracy |
| `accuracy.byVoteType` | object | Per-decision accuracy |
| `baselineAccuracy` | number | Party-line floor |
| `improvementOverBaseline` | number | |
| `trend` | array | `[{ date, accuracy }]` |
| `errorCategories` | object | `{ free_vote, party_split, stale_profile, coalition_shift, feature_gap }` |
| `weakestMPs` | array | `[{ slug, accuracy, errorCategory }]` |
| `improvementPriorities` | array | `[{ area, expectedGain, action }]` |
| `lastSoulAudit` | object? | `{ date, scenarioResults, principleGaps, passed }` |

### `sync_progress`

Checkpoint tracking for resumable sync.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | string | `votings`, `members`, `stenograms`, `drafts` |
| `status` | enum | `idle`, `running`, `completed`, `error` |
| `totalRecords` | number | |
| `checkpoints` | array | `[{ year, completed, recordCount, lastOffset }]` |
| `lastRunAt` | Date | |
| `error` | string? | |

### `operator_sessions`

Audit trail of operator sessions.

| Field | Type | Notes |
|-------|------|-------|
| `sessionType` | enum | improvement, investigation, feature_engineering, bug_fix, review |
| `triggeredBy` | string | |
| `stateSnapshot` | object | model_state at session start |
| `prompt` | string | |
| `startedAt`, `completedAt` | Date | |
| `branch` | string | `operator/{type}/{timestamp}` |
| `filesChanged` | `string[]` | |
| `testsPassed` | boolean | |
| `merged` | boolean | |
| `summary` | string | |

---

## Sync Module Detail

### Riigikogu API

**Rate limiting**: Dynamic backoff starting at 500ms. On 429: double. On success: decrease 10% (floor 200ms).

**Checkpoint resumption**: Per-year progress in `sync_progress`. On restart: skip completed years, resume partial from `lastOffset`.

**Decision normalization**:

| API code | Normalized |
|----------|-----------|
| POOLT, FOR, P, KOHAL | FOR |
| VASTU, AGAINST, V | AGAINST |
| ERAPOOLETU, ABSTAIN, E | ABSTAIN |
| PUUDUB, PUUDUS, ABSENT, - | ABSENT |

**Party code extraction**:

| Faction contains | Code |
|-----------------|------|
| `Konservatiiv` / `EKRE` | EKRE |
| `Isamaa` | I |
| `Reform` | RE |
| `Sotsiaaldemokraat` | SDE |
| `Kesk` | K |
| `200` | E200 |
| `Paremp` | PAREMPOOLSED |
| fallback | FR |

**Database size monitoring**: Check `dbStats.dataSize` every 100 records. If >480MB: pause sync.

### API endpoints used

```
GET /api/plenary-members?lang=ET                    → member list
GET /api/plenary-members/{uuid}?lang=ET             → member detail (committees, convocations)
GET /api/votings?startDate=...&endDate=...           → session votings (flattened)
GET /api/votings/{uuid}                              → voting detail with voters
GET /api/steno/verbatims?startDate=...&endDate=...   → stenograms with speeches
GET /api/volumes/drafts?startDate=...&endDate=...    → draft list (paginated)
GET /api/volumes/drafts/{uuid}?lang=et               → draft detail
```

---

## Autonomy Loops

### The inner loops (running)

| Loop | Interval | What it does |
|------|----------|-------------|
| Metabolic | Every 6 hours | Sync from Riigikogu API. Compute embeddings. Update MP stats. |
| Learning | After sync | Resolve predictions against actual votes. Retrain if improved. |
| Diagnostic | After backtest | Categorize failures: free_vote, party_split, stale_profile, coalition_shift, feature_gap. |
| Detection | After sync | Monitor party correlation changes, MP behavior shifts. |
| Planning | After diagnosis | Rank improvements by expected gain. Write priorities. |
| Pruning | Daily/Weekly | TTL cache cleanup. Regenerate stale MP profiles. |

### The outer loop (aspirational)

The operator (Claude Code) reads model_state, audits against SOUL.md, modifies code, tests, deploys. Currently requires human initiation. The goal is event-triggered autonomy — accuracy drops, error patterns emerge, the operator activates.

**Trigger conditions** (when autonomy is achieved):

| Trigger | Condition | Session Type |
|---------|-----------|-------------|
| Accuracy drop | >2% decline | improvement |
| New error pattern | >5 new examples in one category | investigation |
| Feature stagnation | Importances unchanged across 3 retrains | feature_engineering |
| Sync failure | Persists >2 cycles | bug_fix |
| Weekly routine | Sunday | review |

**Safety**: Operator never modifies SOUL.md, SPECS.md, or .env. Max 5 files per session. Tests must pass before merge. Scenarios must pass. Failed attempts are logged.

### The meta-loop

After every significant change, the operator audits:

1. **Scenario test**: Do citizen questions get useful, non-trivial, bill-sensitive answers?
2. **Principle audit**: For each belief in SOUL.md, does code embody it?
3. **Information check**: Do outputs carry information or restate the obvious?
4. **Absurdity check**: Would a knowledgeable user find outputs useful?
5. **Dialectical check**: Does the system reason about political tensions, not just count votes?

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | System status, model version, accuracy |
| GET | `/mps` | List MPs (filterable, sortable) |
| GET | `/mps/{slug}` | MP detail with profile and backtest |
| POST | `/predict/{slug}` | Predict one MP on a bill |
| POST | `/simulate` | Predict all 101 MPs on a bill (async) |
| GET | `/simulate/{id}` | Simulation result |
| GET | `/votings` | Voting records (paginated) |
| GET | `/votings/{uuid}` | Voting detail with all MP decisions |
| GET | `/drafts` | Draft legislation (paginated) |
| GET | `/stats` | Aggregate statistics |
| GET | `/accuracy` | Public accuracy dashboard |
| GET | `/detections` | Political shift alerts |
| POST | `/sync` | Trigger data sync |
| POST | `/backtest` | Trigger accuracy evaluation |

---

## Frontend

### Pages

| Path | Shows | Phase |
|------|-------|-------|
| `/[locale]` | Dashboard — stats, system health | 1 |
| `/[locale]/mps` | MP list — search, filter by party | 1 |
| `/[locale]/mps/[slug]` | MP profile — political actor view | 1 (stats), 3 (intelligence) |
| `/[locale]/votings` | Voting records | 1 |
| `/[locale]/drafts` | Draft legislation | 1 |
| `/[locale]/simulate` | Parliament simulation with analysis | 2 |
| `/[locale]/accuracy` | Public accuracy dashboard | 2 |
| `/[locale]/intelligence` | Shift detection, coalition health | 3 |
| `/[locale]/about` | Methodology, philosophy, data sources | 1 |

### Stack

| Tool | Purpose |
|------|---------|
| Next.js | SSR React framework |
| Tailwind CSS | Styling |
| Radix UI (shadcn/ui) | Component primitives |
| Recharts | Data visualization |
| next-intl | i18n (Estonian, English) |
| Zod | Validation |

---

## Deployment

### Python Service (VPS, Docker)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
COPY prompts/ ./prompts/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
services:
  service:
    build: ./service
    ports: ["8000:8000"]
    env_file: .env
    restart: unless-stopped
```

### Frontend (Vercel)

Push to `main` → auto-deploy. Root directory: `frontend/`.

---

## Dependencies

### Python

```
fastapi>=0.110
uvicorn[standard]>=0.29
motor>=3.4
pymongo>=4.7
httpx>=0.27
pydantic-settings>=2.2
anthropic>=0.25
voyageai>=0.2
scikit-learn>=1.4
pandas>=2.2
numpy>=1.26
xgboost>=2.0
apscheduler>=3.10
```

### Frontend

```
next, react, react-dom
tailwindcss, @radix-ui/react-*
next-intl, recharts, zod
clsx, tailwind-merge
```

---

## Directory Structure

```
/
├── SOUL.md                             # Philosophy, beliefs, method, goals
├── SPECS.md                            # This file — technical blueprint
├── SYNTHESIS.md                        # World precedent analysis
├── .env                                # Configuration (secrets, intervals)
├── archive/v1/                         # Previous implementation (reference)
│
├── service/                            # Python intelligence service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                     # FastAPI entry
│   │   ├── config.py                   # pydantic-settings
│   │   ├── db.py                       # Motor async MongoDB
│   │   ├── models.py                   # Pydantic data models
│   │   ├── routers/
│   │   │   ├── health.py
│   │   │   ├── predict.py
│   │   │   ├── simulate.py
│   │   │   ├── sync.py
│   │   │   ├── backtest.py
│   │   │   └── data.py
│   │   ├── sync/
│   │   │   ├── riigikogu.py            # API client + sync orchestration
│   │   │   └── embeddings.py           # Voyage AI embeddings
│   │   ├── prediction/
│   │   │   ├── baseline.py             # Party-line predictor (the floor)
│   │   │   ├── features.py             # Statistical + analysis features
│   │   │   ├── analyze.py              # Dialectical analysis + T/D/F lenses
│   │   │   ├── model.py                # Statistical model
│   │   │   ├── calibrate.py            # Probability calibration
│   │   │   └── explain.py              # Bilingual explanation generation
│   │   └── tasks/
│   │       ├── scheduler.py            # APScheduler: all loop heartbeats
│   │       ├── detect.py               # Political shift monitoring
│   │       ├── resolve.py              # Match predictions to actual votes
│   │       ├── diagnose.py             # Categorize prediction failures
│   │       ├── plan.py                 # Prioritize improvements
│   │       └── operator.py             # Claude Code session launcher
│   ├── prompts/
│   │   ├── analyze_bill.md             # Bill analysis prompt
│   │   ├── improvement.md
│   │   ├── investigation.md
│   │   ├── feature_engineering.md
│   │   ├── bug_fix.md
│   │   └── review.md                   # Includes soul audit
│   └── tests/
│       ├── test_baseline.py
│       ├── test_features.py
│       ├── test_prediction.py
│       └── test_scenarios.py           # Scenario confrontation
│
├── frontend/                           # Next.js app
│   ├── package.json
│   ├── next.config.ts
│   └── src/
│       ├── app/[locale]/               # i18n routing (et, en)
│       ├── components/                 # UI components
│       ├── lib/api.ts                  # HTTP client → Python service
│       ├── types/domain.ts             # TypeScript domain models
│       ├── messages/                   # et.json, en.json
│       └── i18n/                       # next-intl config
│
└── docker-compose.yml
```

---

## Verification

Each phase has a gate. The gate is absolute.

| Phase | Test | Pass |
|-------|------|------|
| 1: Legibility | Every MP has complete profile. Every voting record present. `POST /sync` → all collections populated. No gaps. | Data is trustworthy. |
| 2: Prediction | `POST /predict/{slug}` beats 85% baseline on post-cutoff data. Scenario confrontation: "legalize cannabis," "raise defense to 5%," "ban TikTok" → different, non-trivial results with explanations. No 101-0 on controversial bills. | Predictions are accurate and credible. |
| 3: Intelligence | System produces shift detection, coalition health, cross-pressure maps, bill impact analysis. One user relies on it for political sight. | Intelligence is actionable. |
| 4: Citizens | Non-expert uses system and finds intelligence useful and trustworthy. Public accuracy dashboard visible. | System serves citizens. |

**No phase starts until the previous gate passes completely.**

---

*This is the body. SOUL.md is the soul. Build phase by phase. Verify at each gate. If a phase fails, stay until it works.*
