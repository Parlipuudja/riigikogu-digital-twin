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

### P2: Make ANALYZE Temporal
**The system should track patterns over time.**

- [ ] Store historical snapshots of MP stances
- [ ] Detect stance shifts
- [ ] Coalition stability metrics
- [ ] MP influence scoring

**Why third:** Adds depth to intelligence but not urgently needed.

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

*Focus: Build autonomy into each pillar.*
