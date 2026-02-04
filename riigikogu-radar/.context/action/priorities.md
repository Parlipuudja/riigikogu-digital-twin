# Current Priorities

*Last updated: 2026-02-04 21:00 UTC*

## System Status

| Pillar | Status | Autonomy |
|--------|--------|----------|
| COLLECT | ✅ Operational | ❌ Manual |
| ANALYZE | ✅ Operational | ✅ Auto-embed on sync |
| PREDICT | ✅ Operational | ✅ On-demand |

| Metric | Value |
|--------|-------|
| Votings | 4,333 (100% embedded) |
| Stenograms | 975 (100% embedded) |
| MPs | 101 (52 with quotes) |
| Accuracy | 87-90% OOS |
| Failover | ✅ Enabled |
| Production | ✅ Healthy |

---

## Priority Queue

### P0: Make COLLECT Autonomous
**The system should sync itself.**

- [ ] Add Vercel cron job for auto-sync (every 6 hours)
- [ ] Add sync health monitoring
- [ ] Trigger embedding generation on new data

**Why first:** Without autonomous collection, the system degrades over time.

### P1: Make PREDICT Proactive
**The system should predict upcoming votes without being asked.**

- [ ] Fetch upcoming agenda from Riigikogu
- [ ] Batch predict all upcoming votes
- [ ] Expose `/api/v1/upcoming` endpoint
- [ ] Generate "what to watch" daily briefing

**Why second:** This is the killer feature — anticipating parliament, not just analyzing history.

### P2: Enhance Insights Page
**Make the existing Insights page actionable for journalists.**

Current state: `/insights` shows rebels, alliances, close votes, attendance patterns.

Enhancements needed:
- [ ] **Time filtering** — "What happened today/this week/this month"
- [ ] **AI story summaries** — Narrative context, not just data points
- [ ] **Significance indicators** — Why is this newsworthy?
- [ ] **Historical context** — "This is unusual because X voted with party 95% of the time"
- [ ] **Coalition impact** — What does a rebel vote mean for government stability?
- [ ] **Trend detection** — Is this a one-off or part of a pattern?

**Why now:** The data infrastructure exists. Need to transform raw patterns into journalist-ready intelligence.

### P3: Make ANALYZE Temporal
**The system should track patterns over time.**

- [ ] Store historical snapshots of MP stances
- [ ] Detect stance shifts
- [ ] Coalition stability metrics
- [ ] MP influence scoring

**Why later:** Adds depth to intelligence but not urgently needed.

---

## Completed (Feb 4, 2026)

### Infrastructure
- ✅ AI failover enabled (Claude → OpenAI → Gemini)
- ✅ 100% embedding coverage
- ✅ MongoDB query optimization (10x faster)
- ✅ Production deployed and healthy

### COLLECT Pillar
- ✅ All sync scripts operational
- ✅ Historical data complete (2019-present)

### ANALYZE Pillar
- ✅ Vector search index working
- ✅ MP profiling with quotes (52/101)
- ✅ Cross-party alliance detection
- ✅ Swing voter identification

### PREDICT Pillar
- ✅ Individual MP predictions (87-90% accuracy)
- ✅ Full parliament simulation
- ✅ Seat plan visualization
- ✅ Constitutional amendment detection

---

## Anti-Priorities

Things we're explicitly NOT working on:

- Mobile app
- User accounts/registration
- Email alerts
- Other parliaments
- UI polish

---

## Operative System ✅ DEFINED

The project is self-managed by Claude Code operatives:

| Operative | Role | Status |
|-----------|------|--------|
| Project Manager | Lead, prioritize, coordinate | ✅ Active |
| Collector | COLLECT pillar execution | ✅ Defined |
| Analyst | ANALYZE pillar execution | ✅ Defined |
| Predictor | PREDICT pillar validation | ✅ Defined |
| Guardian | Health monitoring | ✅ Defined |

See: `.context/operatives/` for full role definitions.

---

*Focus: Build autonomy into each pillar. Operatives manage the system.*
