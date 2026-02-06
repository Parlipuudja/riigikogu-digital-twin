# SPECS.md

*The technical blueprint. Read SOUL.md for the philosophy. This document is the body.*

*This is the genotype. When expressed, it becomes the system.*

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
                        │  Vercel — seosetu.ee  │     │  (cron on VPS) │
                        └──────────────────────┘     └────────────────┘
```

**Three processes, one database, no coordinator.** The database is the coordination layer — each process reads the state of the world and acts accordingly (stigmergy, not orchestration).

- **Python service** (VPS, Docker): data pipeline, prediction model, learning loops, scheduling. Runs continuously. The body.
- **Next.js frontend** (Vercel): presentation only. SSR pages, i18n, API routes proxying to Python. Stateless. The face.
- **Claude Code operator** (VPS, cron): reads system state from MongoDB, modifies the codebase to improve it, tests changes, deploys. Runs on schedule and on trigger. The higher cognition.

The Python service is the nervous system — fast, deterministic, always running. Claude Code is the capacity for self-modification — slow, expensive, creative. The Python loops identify *what* is wrong. Claude Code figures out *how to fix it* at the code level.

The Python service writes data. The frontend reads data. Claude Code writes code. MongoDB Atlas is the shared truth.

---

## Directory Structure

```
/
├── SOUL.md
├── SPECS.md
├── .env
├── docker-compose.yml
├── vercel.json                         # { "rootDirectory": "frontend" }
│
├── service/                            # Python prediction service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                     # FastAPI entry
│   │   ├── config.py                   # pydantic-settings
│   │   ├── db.py                       # motor async MongoDB
│   │   ├── models.py                   # Pydantic data models
│   │   ├── routers/
│   │   │   ├── health.py               # GET /health
│   │   │   ├── predict.py              # POST /predict/{slug}
│   │   │   ├── simulate.py             # POST /simulate, GET /simulate/{id}
│   │   │   ├── sync.py                 # POST /sync, GET /sync/status
│   │   │   ├── backtest.py             # POST /backtest, GET /backtest/status
│   │   │   └── data.py                 # GET /mps, /votings, /drafts, /stats
│   │   ├── sync/
│   │   │   ├── riigikogu.py            # API client + sync orchestration
│   │   │   └── embeddings.py           # Voyage AI embedding generation
│   │   ├── prediction/
│   │   │   ├── baseline.py             # Naive party-line predictor
│   │   │   ├── features.py             # Feature engineering
│   │   │   ├── model.py                # Statistical model (logistic reg / XGBoost)
│   │   │   ├── calibrate.py            # Platt scaling / isotonic regression
│   │   │   └── explain.py              # LLM explanation generation
│   │   └── tasks/
│   │       ├── scheduler.py            # APScheduler: all loop heartbeats
│   │       ├── resolve.py              # Match predictions against actual votes
│   │       ├── diagnose.py             # Categorize prediction failures
│   │       ├── plan.py                 # Identify weaknesses, prioritize improvements
│   │       └── operator.py             # Claude Code session launcher + safety wrapper
│   ├── prompts/
│   │   ├── improvement.md             # Prompt: accuracy dropped, fix it
│   │   ├── investigation.md           # Prompt: new error category, investigate
│   │   ├── feature_engineering.md     # Prompt: engineer new features
│   │   ├── bug_fix.md                 # Prompt: sync/task failure, fix it
│   │   └── review.md                  # Prompt: weekly health + quality review
│   └── tests/
│       ├── test_baseline.py
│       ├── test_features.py
│       └── test_prediction.py
│
└── frontend/                           # Next.js app
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.ts
    └── src/
        ├── app/
        │   ├── [locale]/
        │   │   ├── layout.tsx
        │   │   ├── page.tsx            # Dashboard
        │   │   ├── mps/
        │   │   │   ├── page.tsx        # MP list
        │   │   │   └── [slug]/
        │   │   │       └── page.tsx    # MP detail + predict
        │   │   ├── simulate/
        │   │   │   └── page.tsx        # Parliament simulation
        │   │   ├── drafts/
        │   │   │   ├── page.tsx        # Draft list
        │   │   │   └── [uuid]/
        │   │   │       └── page.tsx    # Draft detail
        │   │   ├── accuracy/
        │   │   │   └── page.tsx        # Public accuracy
        │   │   └── about/
        │   │       └── page.tsx
        │   └── api/v1/                 # Proxy routes → Python service
        │       ├── health/route.ts
        │       ├── mps/route.ts
        │       ├── predict/route.ts
        │       └── simulate/route.ts
        ├── components/
        │   ├── ui/                     # shadcn/Radix primitives
        │   ├── mps/                    # MP cards, profile, history
        │   ├── simulate/               # Simulation UI
        │   ├── charts/                 # Recharts visualizations
        │   └── layout/                 # Header, footer, nav
        ├── lib/
        │   └── api.ts                  # HTTP client → Python service
        ├── types/
        │   └── domain.ts              # TypeScript mirrors of Python models
        ├── messages/
        │   ├── et.json                 # Estonian
        │   └── en.json                 # English
        └── i18n/
            └── config.ts               # next-intl
```

---

## Database Schema (MongoDB Atlas)

Constraint: **512MB free tier**. This shapes the data strategy — truncate stenograms, monitor size during sync, prioritize newer data.

### `members`

Raw MP data from Riigikogu API.

| Field | Type | Notes |
|-------|------|-------|
| `uuid` | string | Riigikogu API UUID (primary key) |
| `firstName` | string | |
| `lastName` | string | |
| `fullName` | string | |
| `active` | boolean | Current parliament member |
| `faction` | `{ name: string }` | Current faction |
| `partyCode` | string | Derived: RE, EKRE, K, I, SDE, E200, FR |
| `photoUrl` | string? | |
| `committees` | `[{ name, role, active }]` | Committee memberships |
| `convocations` | `number[]` | Which Riigikogu terms served |
| `syncedAt` | Date | |

### `mps`

Enriched MP profiles with stats and AI content.

| Field | Type | Notes |
|-------|------|-------|
| `slug` | string | URL-friendly: `"martin-helme"` |
| `memberUuid` | string | FK → members.uuid |
| `name`, `firstName`, `lastName` | string | |
| `party` | string | Display name |
| `partyCode` | string | RE, EKRE, etc. |
| `photoUrl` | string? | |
| `status` | enum | `active`, `inactive` |
| `isCurrentMember` | boolean | |
| `stats.totalVotes` | number | |
| `stats.attendance` | number | |
| `stats.votesFor/Against/Abstain` | number | |
| `stats.partyAlignmentRate` | number | 0–100 |
| `instruction.promptTemplate` | string | AI-generated behavior description |
| `instruction.politicalProfile` | object | `{ economicScale, socialScale }` (-100 to 100) |
| `instruction.keyIssues` | array | `[{ issue, issueEn, stance, stanceEn, confidence }]` |
| `instruction.behavioralPatterns` | object | Party loyalty score + independence indicators |
| `instruction.decisionFactors` | object | Primary factors, red flags, green flags |
| `instruction.generatedAt` | Date | |
| `backtest` | object | Accuracy, confusion matrix, per-decision breakdown |
| `backtest.postCutoffOnly` | boolean | True = honest evaluation |
| `backtest.cutoffDate` | string | LLM training data boundary |

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
| `inFavor`, `against`, `abstained`, `absent` | number | Vote counts |
| `voters` | array | `[{ memberUuid, fullName, faction, decision }]` |
| `relatedDraftUuid` | string? | |
| `embedding` | `number[1024]` | Voyage AI vector |
| `syncedAt` | Date | |

**Index**: `vector_index` on `embedding` (Atlas Vector Search, cosine similarity).

### `stenograms`

Parliamentary speeches.

| Field | Type | Notes |
|-------|------|-------|
| `uuid` | string | |
| `sessionDate` | string | |
| `sessionType` | string | |
| `speakers` | array | `[{ memberUuid, fullName, text, topic }]` |
| `syncedAt` | Date | |

`speakers[].text` truncated to **10KB per speaker** (Atlas free tier).

### `drafts`

Legislative bills.

| Field | Type | Notes |
|-------|------|-------|
| `uuid` | string | |
| `number` | string | Bill number, e.g. "123 SE" |
| `title` | string | |
| `titleEn` | string? | |
| `type`, `status` | `{ code, value }` | |
| `summary` | string? | |
| `initiators` | `string[]` | Who proposed the bill |
| `submitDate` | string | |
| `relatedVotingUuids` | `string[]` | |
| `embedding` | `number[1024]` | |
| `syncedAt` | Date | |

### `prediction_cache`

Short-term cache for API response speed. 7-day TTL.

| Field | Type | Notes |
|-------|------|-------|
| `cacheKey` | string | `"{mpSlug}:{billHash}"` — unique index |
| `mpSlug` | string | |
| `billHash` | string | `SHA256(title\|description\|fullText)[:16]` |
| `prediction` | Prediction | Full prediction object |
| `createdAt` | Date | |
| `expiresAt` | Date | TTL index (`expireAfterSeconds: 0`) |

### `prediction_log`

Every prediction ever made. The memory of the learning loop.

| Field | Type | Notes |
|-------|------|-------|
| `mpSlug` | string | |
| `mpUuid` | string | |
| `votingUuid` | string? | If predicting a specific upcoming vote |
| `billTitle` | string | |
| `billHash` | string | |
| `predicted` | enum | FOR, AGAINST, ABSTAIN, ABSENT |
| `confidence` | number | 0.0–1.0, calibrated |
| `featuresUsed` | array | `[{ name, value }]` |
| `modelVersion` | string | |
| `predictedAt` | Date | |
| `actual` | enum? | Filled when vote happens |
| `correct` | boolean? | Filled when resolved |
| `resolvedAt` | Date? | |

### `sync_progress`

Checkpoint tracking for resumable sync.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | string | Sync type: `votings`, `members`, `stenograms`, `drafts` |
| `status` | enum | `idle`, `running`, `completed`, `error` |
| `totalRecords` | number | |
| `earliestDate`, `latestDate` | string | |
| `checkpoints` | array | `[{ year, completed, recordCount, lastOffset }]` |
| `lastRunAt` | Date | |
| `error` | string? | |

### `model_state`

The system's self-model. Its understanding of its own performance, weaknesses, and next moves.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | string | `"current"` |
| `version` | string | |
| `trainedAt` | Date | |
| `trainingSize` | number | |
| `features` | `string[]` | Active feature names |
| `featureImportances` | `[{ name, importance }]` | From last training run |
| `accuracy.overall` | number | |
| `accuracy.byParty` | object | Per-party accuracy |
| `accuracy.byVoteType` | object | Per-decision accuracy |
| `accuracy.byMP` | `[{ slug, accuracy, sampleSize }]` | Per-MP accuracy |
| `baselineAccuracy` | number | Naive party-line |
| `improvementOverBaseline` | number | |
| `trend` | `[{ date, accuracy }]` | Accuracy over time — is the system getting better? |
| `errorCategories` | object | `{ free_vote, party_split, stale_profile, coalition_shift, feature_gap }` counts |
| `weakestMPs` | array | `[{ slug, accuracy, errorCategory }]` |
| `weakestTopics` | array | `[{ topic, accuracy }]` |
| `improvementPriorities` | array | `[{ area, expectedGain, action }]` — the system's own roadmap |
| `planHistory` | array | `[{ date, priorities, outcome }]` — what the system planned and what happened |

### `operator_sessions`

Audit trail of every Claude Code operator session. The system's memory of its own self-modification.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `sessionType` | enum | `improvement`, `investigation`, `feature_engineering`, `bug_fix`, `review` |
| `triggeredBy` | string | What condition triggered this session |
| `stateSnapshot` | object | `model_state` at session start — the diagnosis that prompted the session |
| `prompt` | string | What Claude Code was asked to do |
| `startedAt` | Date | |
| `completedAt` | Date | |
| `branch` | string | Git branch name (`operator/{type}/{timestamp}`) |
| `filesChanged` | `string[]` | Files modified during the session |
| `testsPassed` | boolean | Did `pytest` pass after changes? |
| `merged` | boolean | Was the branch merged to `main`? |
| `commitHash` | string? | If merged, the commit hash |
| `summary` | string | Claude Code's summary of what it did and why |
| `accuracyBefore` | number | `model_state.accuracy.overall` at session start |
| `accuracyAfter` | number? | Measured at next backtest — did the change actually help? |

This collection enables the meta-learning loop: the system can query its own session history to learn which types of interventions succeed and which fail. "Feature engineering sessions after accuracy drops have a 60% success rate. Bug fix sessions have 90%. Prioritize accordingly."

---

## Python Service — Detail

### config.py

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongodb_uri: str
    anthropic_api_key: str
    voyage_api_key: str
    openai_api_key: str = ""
    google_ai_api_key: str = ""

    riigikogu_api_base: str = "https://api.riigikogu.ee/api"
    riigikogu_rate_limit_ms: int = 500

    sync_interval_hours: int = 6
    backtest_interval_days: int = 7
    retrain_interval_days: int = 14

    prediction_cache_ttl_days: int = 7
    stenogram_max_bytes: int = 10240    # 10KB per speaker
    db_size_limit_mb: int = 480         # Pause sync near this

    model_cutoff_date: str = "2025-05-01"  # Evaluation boundary — test set starts after this

    # Operator (Claude Code self-improvement sessions)
    operator_enabled: bool = True
    operator_max_files_per_session: int = 5         # Safety: limit blast radius
    operator_session_timeout_seconds: int = 600     # 10 minutes max per session
    operator_accuracy_drop_threshold: float = 0.02  # Trigger improvement session on >2% drop
    operator_error_count_threshold: int = 5         # Trigger investigation on >5 new errors in a category

    class Config:
        env_file = ".env"
```

### Sync Module

#### riigikogu.py

Port of the existing 867-line TypeScript client. Critical behaviors to preserve:

**Rate limiting**: Dynamic backoff starting at 500ms. On HTTP 429: double delay. On success: decrease by 10% (floor 200ms).

**Checkpoint resumption**: Track per-year progress in `sync_progress` collection. On restart, skip completed years, resume partial years from `lastOffset`.

**Session flattening**: The API returns sessions containing nested votings:
```
GET /api/votings?startDate=...&endDate=...
→ [{ uuid, title, sittingDateTime, votings: [{ uuid, description, startDateTime, type, ... }] }]
```
Flatten to individual voting records.

**Voting detail fetch**:
```
GET /api/votings/{uuid}
→ { uuid, description, startDateTime, type, present, absent, inFavor, against, abstained,
    voters: [{ uuid, fullName, firstName, lastName, faction: { uuid, name }, decision: { code, value } }] }
```

**Decision normalization**:
| API code | Normalized |
|----------|-----------|
| POOLT, FOR, P, KOHAL | FOR |
| VASTU, AGAINST, V | AGAINST |
| ERAPOOLETU, ABSTAIN, E | ABSTAIN |
| PUUDUB, PUUDUS, ABSENT, - | ABSENT |

**Party code extraction** from Estonian faction names:
| Faction name contains | Code |
|----------------------|------|
| `Konservatiiv` or `EKRE` | EKRE |
| `Isamaa` | I |
| `Reform` | RE |
| `Sotsiaaldemokraat` | SDE |
| `Kesk` | K |
| `200` | E200 |
| `Paremp` | PAREMPOOLSED |
| `mittekuuluv` or fallback | FR |

**Party name mapping**:
```python
PARTY_NAMES = {
    "EKRE": ("Eesti Konservatiivne Rahvaerakond", "Estonian Conservative People's Party"),
    "I":    ("Isamaa Erakond", "Isamaa Party"),
    "RE":   ("Eesti Reformierakond", "Estonian Reform Party"),
    "SDE":  ("Sotsiaaldemokraatlik Erakond", "Social Democratic Party"),
    "K":    ("Eesti Keskerakond", "Estonian Centre Party"),
    "E200": ("Eesti 200", "Estonia 200"),
    "PAREMPOOLSED": ("Parempoolsed", "Right-wing"),
    "FR":   ("Fraktsioonitud", "Non-affiliated"),
}
```

**Members sync**:
```
GET /api/plenary-members?lang=ET
→ [{ uuid, firstName, lastName, fullName, active, factions: [{ uuid, name, active, membership }],
     photo: { uuid, _links: { download: { href } } } }]

GET /api/plenary-members/{uuid}?lang=ET
→ { ..., memberships: [{ bodyName, bodyType, roleName, startDate, endDate }],
    convocations: [{ number, startDate, endDate }] }
```
Note: The API has two formats — old (`faction: { code, value }`) and new (`factions: [...]`). Handle both. For the new format, find the active faction (no `endDate`), extract party code from faction name.

**Stenograms sync**:
```
GET /api/steno/verbatims?startDate=...&endDate=...&lang=et
→ [{ membership, plenarySession, link, date, title, edited,
     agendaItems: [{ agendaItemUuid, date, title,
       events: [{ type, uuid, date, speaker, text, link }] }] }]
```
Extract events where `type === "SPEECH"` and `text` is non-null. Speaker UUID from `event.uuid`, name from `event.speaker`, topic from `agendaItem.title`. Truncate `text` to 10KB.

**Drafts sync**:
```
GET /api/volumes/drafts?startDate=...&endDate=...&lang=et&size=500
→ { _embedded: { content: [{ uuid, title, mark, draftType, draftStatus, initiated, initiators, ... }] },
    page: { size, totalElements, totalPages, number } }

GET /api/volumes/drafts/{uuid}?lang=et
→ { uuid, number, title, draftType, draftStatus, initiators, submitDate, relatedVotings }
```
Handle paginated response — `_embedded.content` array.

**Database size monitoring**: Every 100 records, check `db.command("dbStats").dataSize`. If > 480MB, pause sync and log warning.

#### embeddings.py

- **Model**: Voyage AI `voyage-multilingual-2`, 1024 dimensions
- Embed: voting titles/descriptions, draft titles/summaries
- Batch: max 128 texts per API call
- Store: directly on document (`votings.embedding`, `drafts.embedding`)
- After embedding: create/verify Atlas Vector Search index `vector_index` on `embedding` field (cosine)

### Prediction Module

#### baseline.py

Naive party-line predictor — the floor.

1. For each voting in history, compute the majority decision per party
2. For each MP, compute `party_alignment_rate` = (votes matching party majority) / (total votes)
3. Prediction: MP votes the same as their party majority on the given bill
4. **Dynamic coalition detection**: For each pair of parties, compute voting correlation over last N votes. Parties correlating >70% on government-type bills are coalition partners. Use this to determine expected party position instead of hardcoding.

#### features.py

For each (MP, bill) pair:

| Feature | Type | Description |
|---------|------|-------------|
| `party_loyalty_rate` | float | % of last 100 votes matching party majority |
| `bill_topic_similarity` | float | Cosine similarity: bill embedding vs mean of MP's past vote embeddings |
| `bill_type` | categorical | constitutional, budget, procedural, legislative, other (derived from draft metadata) |
| `committee_relevance` | bool | Is MP on a committee related to this bill's topic? |
| `coalition_bill` | bool | Was this bill initiated by a coalition-affiliated party? |
| `defection_rate_by_topic` | float | MP's defection rate on historically similar bills |
| `party_cohesion_on_similar` | float | How united was the party on similar past votes? |
| `days_since_last_defection` | int | Recency of breaking rank |
| `mp_attendance_rate` | float | Recent attendance % |
| `party_position_strength` | float | Strength of party majority on similar bills |

#### model.py

1. **Start**: Logistic regression (scikit-learn). Interpretable, fast, strong baseline.
2. **If accuracy < 87%**: XGBoost gradient boosting. More capacity for nonlinear interaction effects.
3. **Training data**: Historical votes as labeled examples. Features from `features.py`. Target: `VoteDecision`.
4. **Train/test split**: Test set = post-cutoff votes only (`model_cutoff_date` from config). Never evaluate on training data.
5. **Multi-class**: FOR / AGAINST / ABSTAIN / ABSENT. Use one-vs-rest or multinomial depending on model.
6. **Output**: `{ prediction: VoteDecision, confidence: float, features_used: [{ name, value, importance }] }`

#### calibrate.py

- **Platt scaling** (sigmoid calibration) on held-out validation set
- If poorly calibrated: try isotonic regression
- Evaluate with reliability diagram and Brier score
- Goal: reported probability matches empirical frequency. "90% confident" = correct 90% of the time.

#### explain.py

After the model predicts:

1. Build prompt with prediction result + key features + bill context
2. Call Claude Haiku (cheap, fast):
   ```
   MP {name} ({party}) is predicted to vote {decision} on "{bill_title}"
   with {confidence}% confidence.
   Key factors: party loyalty {rate}%, similar votes {n}/{total} {decision},
   {committee context}, {defection history context}.
   Explain this in 2-3 sentences. Provide both Estonian and English.
   ```
3. Parse bilingual response
4. Cache alongside prediction
5. Cost: ~$0.001 per explanation

### Scheduler

APScheduler, running inside the FastAPI process. These are the heartbeats of the autonomy loops described in SOUL.md.

| Task | Interval | Loop | What it does |
|------|----------|------|-------------|
| `sync_data` | Every 6 hours | Metabolic | Sync from Riigikogu API → MongoDB. Checkpoint-resumable. |
| `generate_embeddings` | After sync | Metabolic | Embed new votings and drafts (Voyage AI) |
| `resolve_predictions` | After sync | Learning | Match `prediction_log` entries against actual votes that have now occurred |
| `backtest` | Weekly | Learning | Full accuracy evaluation on post-cutoff data |
| `retrain_model` | After backtest | Learning | Retrain on new data. Deploy only if accuracy improves on holdout set. |
| `diagnose_errors` | After backtest | Diagnostic | Categorize prediction failures → update `model_state.weaknesses` |
| `plan_improvements` | After diagnosis | Planning | Identify weakest MPs/topics/features → write priorities to `model_state` |
| `regenerate_stale_profiles` | Weekly | Pruning | Re-generate MP profiles where accuracy has dropped below threshold |
| `prune_cache` | Daily | Pruning | TTL-expired prediction_cache entries |
| `health_check` | Every 5 min | Metabolic | DB connectivity, API reachability, disk, memory |
| `operator_check` | After plan + weekly + on error | Operator | Evaluate triggers → launch Claude Code session if needed |

---

## Autonomy Architecture

*Concrete realization of the six loops from SOUL.md. The database is the coordination layer — no central brain, no orchestrator.*

### The Metabolic Loop

```
scheduler.sync_data → riigikogu.py → MongoDB (members, votings, stenograms, drafts)
                    → embeddings.py → MongoDB (embedding fields)
                    → sync_progress (checkpoint state)
```

On failure: log error to `sync_progress.error`, retry next interval with backoff. On crash: Docker `restart: unless-stopped` brings the process back; sync resumes from checkpoint. On disk pressure: `db.command("dbStats")` checked every 100 records; pause if >480MB.

### The Learning Loop

```
prediction request → model.predict() → prediction_log (logged with features + confidence)
                                                          ↓
scheduler.resolve_predictions → match prediction_log.billHash against new votings
                              → set prediction_log.actual, .correct, .resolvedAt
                                                          ↓
scheduler.backtest → evaluate all resolved predictions
                   → update model_state.accuracy (overall, byParty, byVoteType, byMP)
                   → update mps[].backtest per MP
                                                          ↓
scheduler.retrain_model → train new model on full dataset
                        → evaluate on held-out post-cutoff data
                        → if new.accuracy > current.accuracy: deploy new model
                        → if not: keep current, log the attempt
                        → update model_state.version, .trainedAt, .trainingSize
```

The key: every prediction becomes a training example. The dataset grows with every parliamentary vote. The model evolves by natural selection — only improvements survive.

### The Diagnostic Loop

```
scheduler.diagnose_errors → query prediction_log WHERE correct = false
                          → categorize each error:
                            - "free_vote": party cohesion on this voting < 60%
                            - "party_split": >30% of party voted against majority
                            - "stale_profile": MP accuracy dropped >15% since profile generation
                            - "coalition_shift": party voting correlation changed significantly
                            - "feature_gap": high-confidence wrong predictions (model was certain but wrong)
                          → update model_state.error_categories with counts and examples
```

Error categories drive different responses:
- `free_vote` → need a free-vote detection feature
- `party_split` → need real-time party cohesion monitoring
- `stale_profile` → trigger profile regeneration for that MP
- `coalition_shift` → recalculate coalition affiliations
- `feature_gap` → investigate what signal the model is missing

### The Planning Loop

```
scheduler.plan_improvements → read model_state.accuracy, .error_categories, .weaknesses
                            → rank improvement opportunities by expected accuracy gain:
                              1. weakest MPs (accuracy < baseline for that MP)
                              2. most common error category
                              3. features with lowest importance scores
                              4. vote types with worst accuracy
                            → write prioritized list to model_state.improvement_priorities
                            → log plan to model_state.plan_history[]
```

This is the system's roadmap — not a markdown file, but live data that the next retrain cycle acts on. When the system retrains, it can weight features differently for weak areas, or engineer new features targeting the most common error category.

### The Pruning Loop

```
scheduler.prune_cache → TTL index on prediction_cache.expiresAt handles this automatically
scheduler.regenerate_stale_profiles → query mps WHERE backtest.accuracy < (baseline - 5%)
                                    → regenerate instruction for those MPs
                                    → log regeneration event
```

Model pruning: after retrain, compare feature importances. Features with importance < 1% for 3 consecutive retrains are candidates for removal. Log the removal, don't delete silently — antifragility requires knowing what was tried.

### The Operator — Code Autonomy via Claude Code

*The five loops above are the nervous system — fast, deterministic, always running. The operator is the higher cognition — slow, expensive, creative. The loops identify what is wrong. The operator figures out how to fix it at the code level.*

The Python loops can retrain weights and adjust parameters. They cannot write new features, fix their own bugs, or rethink their approach. Claude Code can. This is the difference between a thermostat (adjusts a number) and an organism (reshapes its own body).

#### Three Levels of Autonomy

**Level 1: Data autonomy** (Python loops). The model retrains on new data. Weights shift. The same code processes better numbers. This is the five loops above.

**Level 2: Code autonomy** (Claude Code, event-triggered). The system modifies its own source code. A new feature is engineered in `features.py`. A bug in `riigikogu.py` is fixed. A new error category handler is added to `diagnose.py`. The code itself evolves.

**Level 3: Strategy autonomy** (Claude Code, monthly). The system reviews its own architecture. Should logistic regression be replaced with XGBoost? Should the two-stage attendance/vote split be implemented? Should a new scheduler task be added? Larger structural changes, still bounded by SOUL.md.

#### Trigger Conditions

`operator.py` runs `operator_check` on schedule. It reads `model_state` and `sync_progress` to decide if a Claude Code session is needed.

| Trigger | Condition | Session Type |
|---------|-----------|-------------|
| Accuracy drop | `model_state.accuracy.overall` dropped >2% since last operator session | `improvement` |
| New error pattern | An `errorCategories` type has >5 new examples since last session | `investigation` |
| Feature stagnation | Feature importances unchanged across 3 retrains | `feature_engineering` |
| Persistent sync failure | `sync_progress.error` persists for >2 cycles | `bug_fix` |
| Weekly routine | Every Sunday | `review` |
| Post-backtest | After weekly backtest completes | `improvement` (if accuracy < target) |
| Monthly strategy | First of month | `review` (deep) |

If no trigger condition is met, the operator does nothing. Silence is the default.

#### Session Execution

```
operator_check() → evaluate triggers against model_state
                 → if triggered:
                   1. snapshot model_state → operator_sessions.stateSnapshot
                   2. select prompt template from prompts/{session_type}.md
                   3. inject current state into prompt
                   4. create git branch: operator/{type}/{timestamp}
                   5. launch Claude Code with --print flag
                   6. run pytest service/tests/
                   7. if tests pass → merge to main → docker compose rebuild
                   8. if tests fail → discard branch → log failure
                   9. record session to operator_sessions collection
```

#### The Launch

```python
def launch_operator_session(session_type: str, state: dict) -> dict:
    branch = f"operator/{session_type}/{datetime.now():%Y%m%d-%H%M}"
    prompt = build_prompt(session_type, state)

    # Branch for safety
    subprocess.run(["git", "checkout", "-b", branch], cwd=REPO_ROOT)

    try:
        # Launch Claude Code
        result = subprocess.run(
            ["claude", "--print", "-p", prompt,
             "--allowedTools", "Read,Write,Edit,Bash,Glob,Grep"],
            cwd=REPO_ROOT,
            capture_output=True, text=True,
            timeout=settings.operator_session_timeout_seconds,
        )

        # Validate
        tests = subprocess.run(
            ["docker", "compose", "exec", "service", "pytest", "tests/", "-x"],
            cwd=REPO_ROOT, capture_output=True, text=True,
        )

        if tests.returncode == 0:
            subprocess.run(["git", "checkout", "main"], cwd=REPO_ROOT)
            subprocess.run(["git", "merge", "--no-ff", branch], cwd=REPO_ROOT)
            subprocess.run(["docker", "compose", "up", "-d", "--build"], cwd=REPO_ROOT)
            return {"merged": True, "branch": branch}
        else:
            subprocess.run(["git", "checkout", "main"], cwd=REPO_ROOT)
            subprocess.run(["git", "branch", "-D", branch], cwd=REPO_ROOT)
            return {"merged": False, "branch": branch, "test_output": tests.stderr}

    except subprocess.TimeoutExpired:
        subprocess.run(["git", "checkout", "main"], cwd=REPO_ROOT)
        subprocess.run(["git", "branch", "-D", branch], cwd=REPO_ROOT)
        return {"merged": False, "timeout": True}
```

Changes only reach `main` if tests pass. Failed attempts are logged but discarded. The system literally cannot break itself — natural selection at the code level.

#### Prompt Templates

Each session type has a prompt template in `service/prompts/`. The template receives the current `model_state` as context.

**Core rules injected into every prompt:**

```
You are the autonomous operator of Riigikogu Radar.

SOUL.md defines your philosophy. You never modify SOUL.md or SPECS.md.

Current system state:
{model_state JSON}

Rules:
- One problem per session. Do not scope-creep.
- Never modify SOUL.md, SPECS.md, or .env
- Always run tests before committing
- Write commit messages that explain WHY, not just WHAT
- If uncertain, write to model_state.improvement_priorities instead of implementing
- Maximum {max_files} files changed per session
- Small, targeted changes. The minimum that addresses the issue.
```

**`improvement.md`** — accuracy dropped. Read the error categories. Read the weakest MPs/topics. Read the current features. Implement the single highest-impact fix.

**`investigation.md`** — a new error pattern appeared. Read examples of the failing predictions. Determine root cause. Either fix it directly or add it to improvement priorities with a clear diagnosis.

**`feature_engineering.md`** — features are stagnant. Read feature importances. Read error categories. Design and implement one new feature that targets the most common error type. Add it to `features.py`. Update tests.

**`bug_fix.md`** — a sync or task is failing persistently. Read the error logs. Read the relevant source code. Fix the bug. Add a regression test.

**`review.md`** — weekly or monthly health check. Review accuracy trends, session history, feature importances, error distribution. Write a summary to `model_state.planHistory`. Optionally make small improvements.

#### The Meta-Loop

This is the feedback loop of feedback loops:

```
Python loops → model_state (diagnosis) → operator_check (trigger)
                                              ↓
                                         Claude Code (modify code)
                                              ↓
                                         tests pass? → merge → rebuild
                                              ↓
                                         Python loops (improved) → model_state (new diagnosis)
                                              ↓
                                         operator_sessions (did it help?)
```

The `accuracyAfter` field in `operator_sessions` closes the meta-loop. At the next backtest after a merged session, the system records whether accuracy actually improved. Over time, `operator_sessions` becomes a dataset of what works and what doesn't. The system can query its own history: "Which session types succeed most? Which trigger conditions lead to the best improvements? What's the ROI of feature engineering vs bug fixes?"

This is autopoiesis realized: the system that produces and improves itself.

#### Cost

- Claude Code session: ~$0.05–0.50 depending on scope
- Weekly routine: ~4 sessions/month ≈ $2
- Event-triggered: ~4–8 sessions/month ≈ $4
- Total: ~$6–10/month for genuine code-level self-improvement

### API Endpoints

| Method | Path | Purpose | Response shape |
|--------|------|---------|----------------|
| GET | `/health` | System health | `{ status, db, model_version, last_sync, accuracy, uptime }` |
| GET | `/mps` | List MPs | `[{ slug, name, party, partyCode, stats, photoUrl }]` |
| GET | `/mps/{slug}` | MP detail | `{ slug, name, party, stats, instruction, backtest, ... }` |
| POST | `/predict/{slug}` | Predict one MP | Body: `{ title, description?, fullText? }` → `{ prediction, confidence, reasoning, features }` |
| POST | `/simulate` | Full parliament | Body: `{ title, description?, fullText?, billType? }` → `{ jobId }` (async) |
| GET | `/simulate/{id}` | Simulation status | `{ status, result?, progress? }` |
| POST | `/sync` | Trigger sync | `{ status: "started" }` |
| GET | `/sync/status` | Sync progress | `{ types: { votings: {...}, members: {...}, ... } }` |
| POST | `/backtest` | Trigger backtest | `{ status: "started" }` |
| GET | `/backtest/status` | Accuracy metrics | `{ overall, byParty, byVoteType, byMP, trend }` |
| GET | `/votings` | List votings | Paginated `[{ uuid, title, votingTime, result, voters }]` |
| GET | `/drafts` | List drafts | Paginated `[{ uuid, title, number, status, initiators }]` |
| GET | `/stats` | Summary stats | `{ totalVotings, totalMPs, totalDrafts, lastVotingDate, ... }` |
| GET | `/accuracy` | Public accuracy | `{ overall, baseline, improvement, honestPeriod, sampleSize }` |
| GET | `/model/status` | Model info | `{ version, trainedAt, features, weaknesses }` |

---

## Next.js Frontend — Detail

### Pages

| Path | What it shows | Data source |
|------|--------------|-------------|
| `/` | Dashboard — stats, recent votes, current accuracy, system health | `GET /stats`, `GET /accuracy`, `GET /health` |
| `/mps` | All MPs — search by name, filter by party, sort by loyalty/attendance | `GET /mps` |
| `/mps/[slug]` | MP profile — photo, stats, political profile, voting history, prediction interface | `GET /mps/{slug}`, `POST /predict/{slug}` |
| `/simulate` | Parliament simulation — enter bill description, see predicted vote breakdown | `POST /simulate`, `GET /simulate/{id}` |
| `/drafts` | Browse legislation — filter by status, type, date | `GET /drafts` |
| `/drafts/[uuid]` | Draft detail — bill info, related votings, initiators | `GET /drafts` (filtered) |
| `/accuracy` | Public accuracy — overall, by party, by MP, trend over time, comparison to baseline | `GET /accuracy`, `GET /backtest/status` |
| `/about` | Project information — methodology, philosophy, data sources | Static content |

### API Client (`lib/api.ts`)

```typescript
const SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

async function fetchService<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${SERVICE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`Service error: ${res.status}`);
  return res.json();
}

export const api = {
  health: () => fetchService("/health"),
  mps: () => fetchService("/mps"),
  mp: (slug: string) => fetchService(`/mps/${slug}`),
  predict: (slug: string, bill: BillInput) =>
    fetchService(`/predict/${slug}`, { method: "POST", body: JSON.stringify(bill) }),
  simulate: (bill: BillInput) =>
    fetchService("/simulate", { method: "POST", body: JSON.stringify(bill) }),
  simulationStatus: (id: string) => fetchService(`/simulate/${id}`),
  votings: (params?: PaginationParams) => fetchService(`/votings?${qs(params)}`),
  drafts: (params?: PaginationParams) => fetchService(`/drafts?${qs(params)}`),
  stats: () => fetchService("/stats"),
  accuracy: () => fetchService("/accuracy"),
};
```

### i18n

- **Library**: next-intl
- **Locales**: `et` (default), `en`
- **Routing**: `/et/mps`, `/en/mps`, etc.
- **Files**: `messages/et.json`, `messages/en.json`

### UI Stack

| Tool | Purpose |
|------|---------|
| Tailwind CSS | Styling |
| Radix UI (shadcn/ui) | Accessible component primitives |
| Recharts | Data visualization (accuracy charts, vote distributions) |
| Zod | Client-side validation |
| clsx + tailwind-merge | Conditional class composition |

---

## Deployment

### Python Service (VPS)

```dockerfile
# service/Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
services:
  service:
    build: ./service
    ports:
      - "8000:8000"
    env_file: .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Next.js Frontend (Vercel)

```json
// vercel.json (repo root)
{ "rootDirectory": "frontend" }
```

Deploy: push to `main` → Vercel auto-deploys.

### Environment Variables

```bash
# Database
MONGODB_URI=mongodb+srv://...

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
OPENAI_API_KEY=sk-...            # Failover
GOOGLE_AI_API_KEY=...            # Failover

# Service (frontend → Python)
PYTHON_SERVICE_URL=http://localhost:8000
```

---

## Dependencies

### Python Service (`requirements.txt`)

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

### Next.js Frontend (`package.json`)

```
next
react
react-dom
tailwindcss
@radix-ui/react-*
next-intl
recharts
zod
clsx
tailwind-merge
```

---

## Implementation Order

The arc from SOUL.md determines the order: legible first, then predictable, then accountable.

```
Phase 0: Skeleton       service/ + Dockerfile + docker-compose
                        → docker compose up → curl :8000/health → OK

Phase 1: Legibility     sync/riigikogu.py + sync/embeddings.py + data router
                        → POST /sync → MongoDB populated
                        → GET /mps, /votings, /drafts, /stats return structured data
                        → the parliament is readable

Phase 2: Prediction     prediction/* + routers/predict.py
                        → POST /predict/martin-helme → beats baseline

Phase 3: Explanation    prediction/explain.py
                        → predictions include bilingual reasoning text

Phase 4: Autonomy       tasks/* + prediction_log + model_state + operator_sessions
                        → the five Python loops running: metabolic, learning,
                          diagnostic, planning, pruning
                        → operator.py + prompts/ + cron trigger
                        → Claude Code can read state, modify code, test, deploy
                        → the system improves itself

Phase 5: Frontend       frontend/ (Next.js app)
                        → npm run build passes, all pages render
                        → legibility is visible: MP profiles, histories, patterns
                        → predictions are accessible: predict UI, simulation
                        → accountability is public: accuracy dashboard

Phase 6: Deploy         Vercel + VPS
                        → seosetu.ee serves the full arc end-to-end
```

Phases 0–4 are sequential. Phase 5 can overlap with 3–4 (API contract stable early). Phase 6 is the cutover.

**Phase 1 is where legibility is achieved.** The system becomes useful even without prediction.
**Phase 4 is where the system comes alive.** Before it, a service. After it, an organism. The Python loops are the heartbeat. Claude Code is the capacity to evolve.

---

## Verification

| Phase | Test | Pass |
|-------|------|------|
| 0 | `curl localhost:8000/health` | `{"status": "ok"}` |
| 1 | `POST /sync` + inspect MongoDB | Collections populated; sync_progress complete |
| 2 | `POST /predict/martin-helme` | Returns prediction; backtest accuracy > 85% |
| 3 | Check prediction response | Contains `reasoning.et` and `reasoning.en` |
| 4 | Wait for one sync+backtest cycle | `prediction_log` has resolved entries; `model_state` has `improvementPriorities`; accuracy trend exists; `operator_sessions` has at least one entry; operator branch was created, tested, and merged or discarded |
| 5 | `cd frontend && npm run build` | Zero errors; all pages render; API calls succeed |
| 6 | `curl https://seosetu.ee` | New frontend; predictions work end-to-end |

---

*This is the body. SOUL.md is the soul. Express them together, phase by phase. Verify at each step. If a phase fails, fix it before moving on.*
