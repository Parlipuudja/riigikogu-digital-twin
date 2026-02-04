# Roadmap — Autonomous Intelligence Suite

*Building the three pillars: COLLECT → ANALYZE → PREDICT*

## Vision

An autonomous system that continuously collects parliamentary data, generates political intelligence, and produces actionable predictions — without human intervention.

---

## PILLAR 1: COLLECT ✅ Operational

**Goal:** Autonomous data ingestion from official sources.

### 1.1 Data Sources ✅
- [x] Riigikogu API integration
- [x] Voting records sync
- [x] Stenogram/speech sync
- [x] Draft legislation sync
- [x] MP data sync

### 1.2 Storage ✅
- [x] MongoDB Atlas database
- [x] Structured schema for all data types
- [x] 100% historical coverage (2019-present)

### 1.3 Automation 🔄
- [x] Manual sync scripts working
- [ ] **Vercel cron for auto-sync** (every 6 hours)
- [ ] Sync health monitoring
- [ ] Failure alerting

**Current state:** Manual sync works. Autonomy requires cron job.

---

## PILLAR 2: ANALYZE ✅ Operational

**Goal:** Transform raw data into structured intelligence.

### 2.1 Vector Intelligence ✅
- [x] Voyage AI embeddings for all votings (4,333)
- [x] Voyage AI embeddings for all stenograms (975)
- [x] MongoDB Atlas Vector Search index
- [x] Semantic similarity queries

### 2.2 MP Profiling ✅
- [x] Political stance extraction
- [x] Key issues identification
- [x] Quote extraction (52/101 MPs)
- [x] Party loyalty calculation

### 2.3 Pattern Detection 🔄
- [x] Cross-party alliance identification
- [x] Swing voter detection
- [ ] **Trend analysis over time**
- [ ] Coalition stability metrics
- [ ] MP influence scoring

**Current state:** Static analysis works. Temporal trends not yet tracked.

---

## PILLAR 3: PREDICT ✅ Operational

**Goal:** Anticipate parliamentary behavior before it happens.

### 3.1 Individual Predictions ✅
- [x] Single MP vote prediction
- [x] RAG context (similar votes + speeches)
- [x] Confidence scoring
- [x] 87-90% out-of-sample accuracy

### 3.2 Parliament Simulation ✅
- [x] Full 101-MP simulation
- [x] Seat plan visualization
- [x] Constitutional amendment detection (68-vote threshold)
- [x] Party breakdown display

### 3.3 Proactive Intelligence 📋
- [ ] **Batch predictions for upcoming agenda**
- [ ] Bill passage probability
- [ ] "What to watch" daily briefing
- [ ] Anomaly detection (unexpected votes)

**Current state:** On-demand predictions work. Proactive predictions not yet built.

---

## Infrastructure

### Reliability ✅
- [x] AI failover enabled (Claude → OpenAI → Gemini)
- [x] Database redundancy (MongoDB Atlas)
- [x] Error handling with graceful degradation

### Observability 🔄
- [x] Health endpoint
- [x] Accuracy tracking (backtests)
- [ ] Uptime monitoring
- [ ] Performance metrics dashboard

### API ✅
- [x] RESTful endpoints for all intelligence
- [x] Multi-language support (ET/EN)
- [x] Export functionality (CSV/JSON)

---

## Priority Queue

### Next: Autonomous Sync (COLLECT)
Add Vercel cron to sync every 6 hours. This makes COLLECT truly autonomous.

### Then: Proactive Predictions (PREDICT)
Build endpoint that predicts all upcoming votes. This makes PREDICT proactive.

### Then: Trend Detection (ANALYZE)
Track patterns over time, not just snapshots. This makes ANALYZE dynamic.

---

## Anti-Goals

Things this suite explicitly **won't** do:

- **Real-time notifications** — We're intelligence, not alerts
- **User accounts** — Admin-only, no public registration
- **Opinion/editorial** — Data and predictions only
- **Other parliaments** — Estonian Riigikogu focus only

---

## Success Metrics

| Pillar | Metric | Target | Current |
|--------|--------|--------|---------|
| COLLECT | Auto-sync | Every 6h | ❌ Manual |
| ANALYZE | Embeddings | 100% | ✅ 100% |
| PREDICT | Accuracy | 85%+ | ✅ 87-90% |
| ALL | Uptime | 99%+ | ✅ Healthy |

---

*Last updated: 2026-02-04*
