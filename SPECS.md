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

- **Python service** (VPS, Docker): data pipeline, prediction model, substantive analysis, learning loops, scheduling. Runs continuously. The nervous system.
- **Next.js frontend** (Vercel): presentation only. SSR pages, i18n, API routes proxying to Python. Stateless. The face.
- **Claude Code operator** (VPS, cron): reads system state from MongoDB, audits against SOUL.md, modifies the codebase to improve it, tests changes, deploys. Runs on schedule and on trigger. The cognition.

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
├── service/                            # Python intelligence service
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
│   │   │   ├── baseline.py             # Naive party-line predictor (the floor)
│   │   │   ├── features.py             # Statistical feature engineering
│   │   │   ├── model.py                # Statistical model (logistic reg / XGBoost)
│   │   │   ├── analyze.py              # LLM substantive analysis for novel bills
│   │   │   ├── calibrate.py            # Platt scaling / isotonic regression
│   │   │   └── explain.py              # LLM explanation generation (bilingual)
│   │   └── tasks/
│   │       ├── scheduler.py            # APScheduler: all loop heartbeats
│   │       ├── detect.py               # Detection system: political shift monitoring
│   │       ├── resolve.py              # Match predictions against actual votes
│   │       ├── diagnose.py             # Categorize prediction failures
│   │       ├── plan.py                 # Identify weaknesses, prioritize improvements
│   │       └── operator.py             # Claude Code session launcher + safety wrapper
│   ├── prompts/
│   │   ├── analyze_bill.md             # Prompt: substantive bill analysis
│   │   ├── improvement.md             # Prompt: accuracy dropped, fix it
│   │   ├── investigation.md           # Prompt: new error category, investigate
│   │   ├── feature_engineering.md     # Prompt: engineer new features
│   │   ├── bug_fix.md                 # Prompt: sync/task failure, fix it
│   │   └── review.md                  # Prompt: health + quality + soul audit
│   └── tests/
│       ├── test_baseline.py
│       ├── test_features.py
│       ├── test_prediction.py
│       └── test_scenarios.py           # Scenario confrontation tests
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
        │   │   ├── intelligence/
        │   │   │   └── page.tsx        # Political shift detection
        │   │   ├── accuracy/
        │   │   │   └── page.tsx        # Public accuracy dashboard
        │   │   └── about/
        │   │       └── page.tsx
        │   └── api/v1/                 # Proxy routes → Python service
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

Enriched MP profiles with stats and AI-generated political intelligence.

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

The `instruction` field is what makes an MP legible as a political actor — not just stats, but what they stand for, where they break, what contradictions they carry. This is what a citizen reads to understand their representative.

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
| `analysisUsed` | string? | Summary of substantive analysis (for novel bills) |
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
| `trend` | `[{ date, accuracy }]` | Accuracy over time |
| `errorCategories` | object | `{ free_vote, party_split, stale_profile, coalition_shift, feature_gap }` counts |
| `weakestMPs` | array | `[{ slug, accuracy, errorCategory }]` |
| `weakestTopics` | array | `[{ topic, accuracy }]` |
| `improvementPriorities` | array | `[{ area, expectedGain, action }]` — the system's own roadmap |
| `planHistory` | array | `[{ date, priorities, outcome }]` |
| `lastSoulAudit` | object? | `{ date, scenarioResults, principleGaps, passed }` |

### `operator_sessions`

Audit trail of every Claude Code operator session.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `sessionType` | enum | `improvement`, `investigation`, `feature_engineering`, `bug_fix`, `review`, `soul_audit` |
| `triggeredBy` | string | What condition triggered this session |
| `stateSnapshot` | object | `model_state` at session start |
| `prompt` | string | What Claude Code was asked to do |
| `startedAt` | Date | |
| `completedAt` | Date | |
| `branch` | string | Git branch name (`operator/{type}/{timestamp}`) |
| `filesChanged` | `string[]` | |
| `testsPassed` | boolean | Did `pytest` pass after changes? |
| `scenariosPassed` | boolean? | Did scenario confrontation pass? |
| `merged` | boolean | Was the branch merged to `main`? |
| `commitHash` | string? | |
| `summary` | string | What was done and why |
| `accuracyBefore` | number | |
| `accuracyAfter` | number? | Measured at next backtest |

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

    model_cutoff_date: str = "2025-05-01"  # Evaluation boundary

    # Operator
    operator_enabled: bool = True
    operator_max_files_per_session: int = 5
    operator_session_timeout_seconds: int = 600
    operator_accuracy_drop_threshold: float = 0.02
    operator_error_count_threshold: int = 5

    class Config:
        env_file = ".env"
```

### Sync Module

#### riigikogu.py

Critical behaviors:

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
The API has two formats — old (`faction: { code, value }`) and new (`factions: [...]`). Handle both.

**Stenograms sync**:
```
GET /api/steno/verbatims?startDate=...&endDate=...&lang=et
→ [{ membership, plenarySession, link, date, title, edited,
     agendaItems: [{ agendaItemUuid, date, title,
       events: [{ type, uuid, date, speaker, text, link }] }] }]
```
Extract events where `type === "SPEECH"` and `text` is non-null. Truncate `text` to 10KB.

**Drafts sync**:
```
GET /api/volumes/drafts?startDate=...&endDate=...&lang=et&size=500
→ { _embedded: { content: [{ uuid, title, mark, draftType, draftStatus, initiated, initiators, ... }] },
    page: { size, totalElements, totalPages, number } }

GET /api/volumes/drafts/{uuid}?lang=et
→ { uuid, number, title, draftType, draftStatus, initiators, submitDate, relatedVotings }
```

**Database size monitoring**: Every 100 records, check `db.command("dbStats").dataSize`. If > 480MB, pause sync and log warning.

#### embeddings.py

- **Model**: Voyage AI `voyage-multilingual-2`, 1024 dimensions
- Embed: voting titles/descriptions, draft titles/summaries
- Batch: max 128 texts per API call
- Store: directly on document (`votings.embedding`, `drafts.embedding`)
- After embedding: create/verify Atlas Vector Search index `vector_index` on `embedding` field (cosine)

### Prediction Module

One pipeline. Every bill — known, upcoming, or hypothetical — goes through the same process.

```
bill → embed (Voyage AI)
     → vector search (find similar past votings)
     → analyze.py (LLM substantive analysis of political tensions)
     → features.py (statistical features + analysis signals)
     → model.py (predict)
     → calibrate.py (calibrate probabilities)
     → explain.py (bilingual explanation a citizen can understand)
     → response
```

No special cases. No "fast path" that skips analysis. No degraded mode that ignores what the bill means. The same model, the same reasoning, every time. A known bill gets richer statistical features because more history is available. A novel bill gets richer analysis because the LLM has more work to do. But the pipeline is one pipeline.

#### baseline.py

Naive party-line predictor — the floor. Not used in production. Exists only as the benchmark every prediction must beat.

1. For each voting in history, compute the majority decision per party
2. For each MP, compute `party_alignment_rate` = (votes matching party majority) / (total votes)
3. Prediction: MP votes the same as their party majority
4. **Dynamic coalition detection**: compute pairwise party voting correlation over last N votes. Parties correlating >70% on government-type bills are coalition partners. Derive, never hardcode.

#### analyze.py

Substantive bill analysis. Every bill gets analyzed — this is what makes the system intelligence rather than statistics.

```python
async def analyze_bill(db, bill: BillInput, party_profiles: list, similar_votings: list) -> BillAnalysis:
    """
    Analyze a bill's political substance.
    Returns structured analysis: which parties/MPs are expected to support,
    oppose, or split, and why.
    """
```

**Input**: Bill text/title/description, party profiles with ideological positions, top-N similar past votings with their actual results.

**Prompt** (`prompts/analyze_bill.md`): Given the bill, the parties' known positions, and how parliament voted on similar past bills, analyze:
1. Which parties are likely to support and why
2. Which parties are likely to oppose and why
3. Which MPs or factions are cross-pressured
4. Expected coalition dynamics on this specific bill
5. Controversy level and estimated party cohesion

**Output**: `BillAnalysis` — structured object with per-party position estimates, cross-pressure indicators, controversy level, and reasoning.

**Critical constraint**: The LLM analyzes the political landscape. It does not predict individual MP votes. It provides structured signals that feed into the model as features. The model decides. The LLM provides the substance that statistics cannot see.

**Cost**: ~$0.01–0.05 per analysis (Claude Haiku/Sonnet depending on complexity).

#### features.py

For each (MP, bill) pair, compute all features from both statistical history and substantive analysis:

| Feature | Source | Description |
|---------|--------|-------------|
| `party_loyalty_rate` | stats | % of last 100 votes matching party majority |
| `bill_topic_similarity` | stats | Cosine similarity: bill embedding vs MP's past vote embeddings |
| `bill_type` | stats | constitutional, budget, procedural, legislative, other |
| `committee_relevance` | stats | Is MP on a committee related to this bill? |
| `coalition_bill` | stats | Was this bill initiated by a coalition-affiliated party? |
| `defection_rate_by_topic` | stats | MP's defection rate on similar past bills |
| `party_cohesion_on_similar` | stats | How united was the party on similar past votes? |
| `days_since_last_defection` | stats | Recency of breaking rank |
| `mp_attendance_rate` | stats | Recent attendance % |
| `party_position_strength` | stats | Strength of party majority on similar bills |
| `analysis_party_position` | analysis | LLM's assessment: party likely FOR/AGAINST/SPLIT |
| `analysis_controversy_level` | analysis | 0–1, how politically divisive is this bill |
| `analysis_cross_pressure` | analysis | Is this MP cross-pressured on this bill |

Statistical features are richer when the bill has history. Analysis features are always available. The model learns to weight them appropriately.

#### model.py

1. **Start**: Logistic regression (scikit-learn). Interpretable, fast, strong baseline.
2. **If accuracy < 87%**: XGBoost gradient boosting. More capacity for nonlinear interaction effects.
3. **Training data**: Historical votes as labeled examples. All features from `features.py`. Target: `VoteDecision`.
4. **Train/test split**: Test set = post-cutoff votes only (`model_cutoff_date` from config). Never evaluate on training data.
5. **Multi-class**: FOR / AGAINST / ABSTAIN / ABSENT.
6. **Output**: `{ prediction, confidence, features_used: [{ name, value, importance }] }`

#### calibrate.py

- **Platt scaling** (sigmoid calibration) on held-out validation set
- If poorly calibrated: try isotonic regression
- Evaluate with reliability diagram and Brier score
- Goal: reported probability matches empirical frequency. "90% confident" = correct 90% of the time.

#### explain.py

After the model predicts, the LLM explains *why* — in language a citizen can understand, in both Estonian and English. The explanation must make the prediction interpretable (SOUL.md: "Explanation is not optional").

For novel bills, the explanation incorporates the substantive analysis: what political tensions were identified, which similar past votes informed the prediction, why specific MPs are expected to break from or follow their party.

**Prompt structure**:
```
MP {name} ({party}) is predicted to vote {decision} on "{bill_title}"
with {confidence}% confidence.

Statistical factors: party loyalty {rate}%, similar votes {n}/{total} {decision},
committee relevance: {yes/no}, recent defection history: {context}.

Political analysis: {summary from analyze.py — party positions, cross-pressures}.

Explain this prediction in 2-3 sentences that a citizen would find useful.
Do not restate the obvious (e.g. "EKRE opposes liberal bills" is not useful).
Focus on what is surprising or informative.
Provide both Estonian and English.
```

Cost: ~$0.001 per explanation.

### Simulation

The simulation endpoint is the answer to SOUL.md's first goal: "A citizen can ask how parliament will vote on any bill."

#### How simulation works

Simulation is the prediction pipeline run 101 times — once per MP — on the same bill. No special logic. No separate model. The same pipeline that predicts one MP's vote predicts all of them.

```
POST /simulate { title, description?, fullText? }
  → run the prediction pipeline for each of 101 current MPs
    (bill analysis is computed once and shared across all 101 predictions)
  → tally results, identify notable predictions
  → explain.py: generate overall simulation narrative
  → return full result
```

#### What the response contains

```json
{
  "id": "abc123",
  "status": "completed",
  "bill": { "title": "...", "description": "..." },
  "analysis": {
    "summary": "Political analysis of the bill...",
    "summaryEt": "Eelnõu poliitiline analüüs...",
    "controversyLevel": 0.8,
    "similarVotings": [{ "uuid": "...", "title": "...", "result": "REJECTED" }]
  },
  "tally": { "for": 34, "against": 55, "abstain": 7, "absent": 5 },
  "result": "REJECTED",
  "predictions": [
    {
      "slug": "martin-helme",
      "name": "Martin Helme",
      "partyCode": "EKRE",
      "prediction": "AGAINST",
      "confidence": 0.92,
      "reasoning": "..."
    }
  ],
  "notable": [
    {
      "slug": "someone-surprising",
      "description": "Expected to break from party line because..."
    }
  ]
}
```

The `notable` field is where the system optimizes for surprise — it highlights the predictions that carry the most information, the MPs whose votes are non-obvious.

#### Simulation quality checks (absurdity detection)

Before returning a simulation result, the system checks:

1. **Unanimity check**: If >90% of MPs predicted the same way, flag for review. Genuine unanimity exists (procedural votes) but is suspicious for substantive legislation.
2. **Input sensitivity check**: The prediction must actually depend on the bill content. If features from `analyze.py` contributed zero importance, the simulation is just restating party-line — log a warning.
3. **Confidence calibration**: Average confidence on a novel controversial bill should be moderate (0.6–0.8), not high (>0.9). High confidence on something the model has never seen is miscalibration.

### Scheduler

APScheduler, running inside the FastAPI process.

| Task | Interval | Loop | What it does |
|------|----------|------|-------------|
| `sync_data` | Every 6 hours | Metabolic | Sync from Riigikogu API → MongoDB. Checkpoint-resumable. |
| `generate_embeddings` | After sync | Metabolic | Embed new votings and drafts (Voyage AI) |
| `resolve_predictions` | After sync | Learning | Match `prediction_log` entries against actual votes |
| `backtest` | Weekly | Learning | Full accuracy evaluation on post-cutoff data |
| `retrain_model` | After backtest | Learning | Retrain on new data. Deploy only if accuracy improves. |
| `diagnose_errors` | After backtest | Diagnostic | Categorize prediction failures → update `model_state` |
| `plan_improvements` | After diagnosis | Planning | Identify weakest MPs/topics/features → write priorities |
| `detect_shifts` | After sync | Detection | Monitor party correlation changes, MP behavior shifts |
| `regenerate_stale_profiles` | Weekly | Pruning | Re-generate MP profiles where accuracy dropped |
| `prune_cache` | Daily | Pruning | TTL-expired prediction_cache entries |
| `health_check` | Every 5 min | Metabolic | DB connectivity, API reachability, disk, memory |
| `operator_check` | After plan + weekly + on error | Operator | Evaluate triggers → launch Claude Code session |

---

## Autonomy Architecture

*Concrete realization of the loops from SOUL.md. The database is the coordination layer.*

### The Metabolic Loop

```
scheduler.sync_data → riigikogu.py → MongoDB (members, votings, stenograms, drafts)
                    → embeddings.py → MongoDB (embedding fields)
                    → sync_progress (checkpoint state)
```

On failure: log error, retry next interval. On crash: Docker `restart: unless-stopped`; sync resumes from checkpoint. On disk pressure: pause if >480MB.

### The Learning Loop

```
prediction request → model.predict() → prediction_log (logged with features + confidence)
                                                          ↓
scheduler.resolve_predictions → match prediction_log against new votings
                              → set prediction_log.actual, .correct, .resolvedAt
                                                          ↓
scheduler.backtest → evaluate all resolved predictions
                   → update model_state.accuracy
                                                          ↓
scheduler.retrain_model → train new model on full dataset
                        → evaluate on held-out post-cutoff data
                        → deploy only if improved
```

### The Diagnostic Loop

```
scheduler.diagnose_errors → query prediction_log WHERE correct = false
                          → categorize each error:
                            - "free_vote": party cohesion on this voting < 60%
                            - "party_split": >30% of party voted against majority
                            - "stale_profile": MP accuracy dropped >15%
                            - "coalition_shift": party correlation changed significantly
                            - "feature_gap": high-confidence wrong prediction
                            - "substance_miss": novel bill analysis was wrong
                          → update model_state.error_categories
```

### The Planning Loop

```
scheduler.plan_improvements → read model_state
                            → rank improvement opportunities by expected gain
                            → write to model_state.improvement_priorities
```

### The Detection Loop

```
scheduler.detect_shifts → compute pairwise party voting correlation (rolling window)
                        → compare against previous period
                        → if correlation delta > threshold: flag coalition stress
                        → compute per-MP defection rate trend
                        → if defection rate trending up: flag potential realignment
                        → write alerts to model_state or dedicated collection
```

This is SOUL.md's goal: "The system detects political shifts before they are announced."

### The Pruning Loop

```
scheduler.prune_cache → TTL index handles automatically
scheduler.regenerate_stale_profiles → query mps WHERE backtest.accuracy < (baseline - 5%)
                                    → regenerate instruction for those MPs
```

### The Operator — Code Autonomy via Claude Code

The five loops above are the nervous system. The operator is the cognition.

#### Three Levels of Autonomy

**Level 1: Data autonomy** (Python loops). Weights shift. The same code processes better numbers.

**Level 2: Code autonomy** (Claude Code, event-triggered). New features engineered. Bugs fixed. Error handlers added. The code evolves.

**Level 3: Strategy autonomy** (Claude Code, monthly). Architecture reviewed. Larger structural changes, bounded by SOUL.md.

#### Trigger Conditions

| Trigger | Condition | Session Type |
|---------|-----------|-------------|
| Accuracy drop | `model_state.accuracy.overall` dropped >2% | `improvement` |
| New error pattern | An `errorCategories` type has >5 new examples | `investigation` |
| Feature stagnation | Feature importances unchanged across 3 retrains | `feature_engineering` |
| Persistent sync failure | `sync_progress.error` persists for >2 cycles | `bug_fix` |
| Weekly routine | Every Sunday | `review` |
| Post-backtest | After weekly backtest | `improvement` (if accuracy < target) |
| Monthly strategy | First of month | `review` (deep) |

If no trigger condition is met, the operator does nothing. Silence is the default.

#### Session Execution

```
operator_check() → evaluate triggers against model_state
                 → if triggered:
                   1. snapshot model_state → operator_sessions.stateSnapshot
                   2. select prompt template from prompts/{session_type}.md
                   3. inject current state + SOUL.md into prompt
                   4. create git branch: operator/{type}/{timestamp}
                   5. launch Claude Code with --print flag
                   6. run pytest service/tests/ (including test_scenarios.py)
                   7. if tests pass → merge to main → docker compose rebuild
                   8. if tests fail → discard branch → log failure
                   9. record session to operator_sessions collection
```

#### Prompt Templates

Each session type has a prompt template in `service/prompts/`. The template receives `model_state` as context.

**Core rules injected into every prompt:**

```
You are the autonomous operator of Riigikogu Radar.

Read SOUL.md first. It defines your purpose, beliefs, and method.
This document is your alignment specification. You never modify SOUL.md or SPECS.md.

Current system state:
{model_state JSON}

Rules:
- One problem per session. Do not scope-creep.
- Never modify SOUL.md, SPECS.md, or .env
- Always run tests before committing, including scenario confrontation tests
- Write commit messages that explain WHY, not just WHAT
- If uncertain, write to model_state.improvement_priorities instead of implementing
- Maximum {max_files} files changed per session
- Small, targeted changes. The minimum that addresses the issue.
```

**`review.md`** — weekly or monthly. Includes the meta-loop audit:

```
In addition to reviewing accuracy and errors, perform a soul audit:

1. SCENARIO TEST: Run these citizen questions against the current system and evaluate
   whether the answers are useful, non-trivial, and sensitive to bill content:
   - "Will parliament legalize cannabis?"
   - "Which MPs will break from their party on pension reform?"
   - "What happens if EKRE leaves the coalition?"
   If any answer is trivial or absurd, that is your top priority to fix.

2. PRINCIPLE AUDIT: For each belief in SOUL.md, verify that running code embodies it.
   If a principle exists only in the document, that is a defect.

3. INFORMATION CHECK: Review recent prediction outputs. Do they carry information
   a citizen didn't already know? Or do they restate the obvious?

4. ABSURDITY CHECK: Do predictions change when bill content changes?
   Does the system show dissent on controversial bills?

Write audit results to model_state.lastSoulAudit.
```

#### The Meta-Loop

```
Python loops → model_state (diagnosis) → operator_check (trigger)
                                              ↓
                                         Claude Code (modify code)
                                              ↓
                                         tests + scenarios pass? → merge → rebuild
                                              ↓
                                         Python loops (improved) → model_state (new diagnosis)
                                              ↓
                                         operator_sessions (did it help?)
```

The `accuracyAfter` and `scenariosPassed` fields close the meta-loop.

#### Cost

- Claude Code session: ~$0.05–0.50 depending on scope
- Bill analysis (analyze.py): ~$0.01–0.05 per novel bill
- Explanations: ~$0.001 per prediction
- Weekly operator: ~4 sessions/month ≈ $2
- Event-triggered: ~4–8 sessions/month ≈ $4
- Total: ~$10–20/month for intelligence + self-improvement

### API Endpoints

| Method | Path | Purpose | Response shape |
|--------|------|---------|----------------|
| GET | `/health` | System health | `{ status, db, model_version, last_sync, accuracy, uptime }` |
| GET | `/mps` | List MPs | `[{ slug, name, party, partyCode, stats, photoUrl }]` |
| GET | `/mps/{slug}` | MP detail | `{ slug, name, party, stats, instruction, backtest }` |
| POST | `/predict/{slug}` | Predict one MP | Body: `{ title, description?, fullText? }` → `{ prediction, confidence, reasoning, features, analysis? }` |
| POST | `/simulate` | Full parliament | Body: `{ title, description?, fullText? }` → `{ id, status }` (async) |
| GET | `/simulate/{id}` | Simulation result | `{ status, tally, predictions, analysis, notable }` |
| POST | `/sync` | Trigger sync | `{ status: "started" }` |
| GET | `/sync/status` | Sync progress | `{ types: { votings: {...}, members: {...}, ... } }` |
| POST | `/backtest` | Trigger backtest | `{ status: "started" }` |
| GET | `/backtest/status` | Accuracy metrics | `{ overall, byParty, byVoteType, byMP, trend }` |
| GET | `/votings` | List votings | Paginated |
| GET | `/drafts` | List drafts | Paginated |
| GET | `/stats` | Summary stats | `{ totalVotings, totalMPs, totalDrafts, lastVotingDate }` |
| GET | `/accuracy` | Public accuracy | `{ overall, baseline, improvement, honestPeriod, sampleSize }` |
| GET | `/model/status` | Model info | `{ version, trainedAt, features, weaknesses, lastSoulAudit }` |

---

## Next.js Frontend — Detail

### Pages

| Path | What it shows | Data source |
|------|--------------|-------------|
| `/` | Dashboard — stats, recent votes, accuracy, system health | `GET /stats`, `GET /accuracy` |
| `/mps` | All MPs — search, filter by party, sort by loyalty/attendance | `GET /mps` |
| `/mps/[slug]` | MP profile — political actor view: stats, positions, key issues, contradictions, prediction interface | `GET /mps/{slug}`, `POST /predict/{slug}` |
| `/simulate` | Parliament simulation — enter any bill, see predicted vote breakdown with political analysis | `POST /simulate`, `GET /simulate/{id}` |
| `/intelligence` | Political shift detection — coalition stress, realignment signals, anomalies | `GET /stats` (detection data) |
| `/accuracy` | Public accuracy — overall, by party, by MP, trend, baseline comparison | `GET /accuracy`, `GET /backtest/status` |
| `/about` | Project information — methodology, philosophy, data sources | Static content |

The MP profile page (`/mps/[slug]`) must present the MP as a political actor, not a statistical summary. Key issues, stances, contradictions, independence indicators — drawn from `mps.instruction`. A citizen should leave this page understanding *who* their representative is.

The simulation page (`/simulate`) must present results with the political analysis — not just a tally, but *why* the system predicts this outcome, which MPs are notable, what political tensions the bill activates. The `notable` predictions (surprising defections, unexpected alignments) should be visually prominent.

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
| Recharts | Data visualization |
| Zod | Client-side validation |
| clsx + tailwind-merge | Conditional class composition |

---

## Deployment

### Python Service (VPS)

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
{ "rootDirectory": "frontend" }
```

Deploy: push to `main` → Vercel auto-deploys.

### Environment Variables

```bash
MONGODB_URI=mongodb+srv://...
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
OPENAI_API_KEY=sk-...            # Failover
GOOGLE_AI_API_KEY=...            # Failover
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

The arc from SOUL.md determines the order.

```
Phase 0: Skeleton       service/ + Dockerfile + docker-compose
                        → docker compose up → curl :8000/health → OK

Phase 1: Legibility     sync/riigikogu.py + sync/embeddings.py + data router
                        → POST /sync → MongoDB populated
                        → GET /mps, /votings, /drafts, /stats return structured data
                        → the parliament is readable

Phase 2: Prediction     prediction/* + routers/predict.py
                        → POST /predict/martin-helme → beats baseline on known bills

Phase 3: Substance      prediction/analyze.py + simulation redesign
                        → POST /simulate with "legalize cannabis" produces
                          a non-trivial result with political analysis
                        → scenario confrontation tests pass
                        → the system reasons about what bills mean

Phase 4: Explanation    prediction/explain.py
                        → predictions include bilingual reasoning
                        → explanations carry information, not restatement

Phase 5: Autonomy       tasks/* + prediction_log + model_state + operator_sessions
                        → the five Python loops running
                        → operator.py with soul audit in review prompt
                        → Claude Code can read state, audit against SOUL.md,
                          modify code, test, deploy
                        → the system improves itself

Phase 6: Frontend       frontend/ (Next.js app)
                        → MP profiles show political actors, not stat summaries
                        → simulation shows analysis + notable predictions
                        → accuracy dashboard is public and honest

Phase 7: Deploy         Vercel + VPS
                        → seosetu.ee serves the full arc end-to-end
```

**Phase 1 is where legibility is achieved.** The system becomes useful.
**Phase 3 is where intelligence begins.** The system reasons about substance, not just patterns.
**Phase 5 is where the system comes alive.** The operator audits against the soul.

---

## Verification

| Phase | Test | Pass |
|-------|------|------|
| 0 | `curl localhost:8000/health` | `{"status": "ok"}` |
| 1 | `POST /sync` + inspect MongoDB | Collections populated; sync_progress complete |
| 2 | `POST /predict/martin-helme` | Returns prediction; backtest accuracy > 85% |
| 3 | **Scenario confrontation**: simulate "legalize cannabis", "raise defense budget to 5%", "ban TikTok" | Each produces different, non-trivial results with political analysis. No 101-0. Predictions change when bill changes. |
| 4 | Check prediction response | Contains `reasoning.et` and `reasoning.en` that carry information |
| 5 | Wait for one operator review cycle | `model_state.lastSoulAudit` exists; scenario tests ran; principle gaps identified if any |
| 6 | `cd frontend && npm run build` | Zero errors; MP profiles show political intelligence; simulation shows analysis |
| 7 | `curl https://seosetu.ee` | Full arc works end-to-end |

**Phase 3 verification is the most important.** It is the test that would have caught the 101-0 cannabis bug. It is now a permanent gate — no deployment passes without scenario confrontation.

---

*This is the body. SOUL.md is the soul. Express them together, phase by phase. Verify at each step. If a phase fails, fix it before moving on.*
