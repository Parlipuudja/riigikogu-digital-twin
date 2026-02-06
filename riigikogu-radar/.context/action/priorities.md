# Current Priorities

*Last updated: 2026-02-06 08:21 UTC*

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
| Accuracy | 91.7% overall |
| Failover | ✅ Enabled |
| Production | ✅ Healthy |
| **Brain** | ✅ **ALIVE** (self-healing, auto-restart) |

---

## Priority Queue

### P0: THE LIVING BRAIN (Operatives Overhaul)

**Goal:** Fully autonomous, self-healing operative system that never stops running.

**Problem:** Current supervisor crashed (missing MONGODB_URI in systemd env). System has single point of failure with no recovery mechanism.

**Solution:** Multi-layer defense system:

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS EC2 (The Brain)                      │
│                                                             │
│  LAYER 0: Cron Watchdog (every minute)                     │
│    → Checks if brain alive, restarts if dead               │
│                                                             │
│  LAYER 1: systemd (riigikogu-brain.service)                │
│    → Restart=always, WatchdogSec=300, MemoryMax=2G         │
│                                                             │
│  LAYER 2: brain.ts (the supervisor)                        │
│    → Runs operative cycles                                  │
│    → Sends heartbeats to MongoDB                           │
│    → Manages resources                                      │
│                                                             │
│  LAYER 3: Operatives (Claude CLI instances)                │
│    → Spawned with 30-min timeout                           │
│    → Isolated: one failure doesn't kill brain              │
└─────────────────────────────────────────────────────────────┘
```

#### Phase 1: Foundation ✅ COMPLETE

- [x] Create `/etc/riigikogu/env` with environment variables
- [x] Create `brain.ts` — new supervisor with proper architecture
- [x] Create `riigikogu-brain.service` — systemd with restart policies
- [x] Create `/etc/cron.d/riigikogu-watchdog` — backup restart mechanism
- [x] Test restart behavior (verified: 31s recovery after kill)

#### Phase 2: Intelligence

- [ ] Smart operative scheduling (priority queue based on need)
- [ ] Real-time output streaming to MongoDB
- [ ] Operative timeout handling (kill stuck processes)
- [ ] Resource monitoring and bounds (memory, disk, logs)

#### Phase 3: Observability

- [ ] `/api/v1/brain/status` endpoint
- [ ] Dashboard showing brain state in real-time
- [ ] Optional alerting (Discord webhook when brain dies)

#### Operative Priority Queue

| Priority | Operative | Trigger |
|----------|-----------|---------|
| P0 | Guardian | Health degraded |
| P1 | Collector | Data > 24h stale |
| P2 | Project Manager | Every cycle |
| P3 | Developer | Every cycle |
| P4 | Analyst | Embeddings incomplete |
| P5 | Predictor | No backtest > 7 days |

---

### P1: Make COLLECT Autonomous

**The system should sync itself.**

- [ ] Add Vercel cron job for auto-sync (every 6 hours)
- [ ] Add sync health monitoring
- [ ] Trigger embedding generation on new data

### P2: Proactive Predictions (/upcoming)

**Predict upcoming votes without being asked.**

- [ ] Fetch upcoming agenda from Riigikogu
- [ ] Batch predict all upcoming votes
- [ ] Expose `/api/v1/upcoming` endpoint

### P3: Enhance Insights Page

**Make Insights actionable for journalists.**

- [ ] Fix Fraktsioonitud handling (independents aren't a party)
- [ ] Time filtering (today/week/month)
- [ ] AI story summaries
- [ ] Historical context

### P4: Temporal Analysis

**Track patterns over time.**

- [ ] Historical snapshots of MP stances
- [ ] Detect stance shifts
- [ ] Coalition stability metrics

---

## Completed (Feb 4-6, 2026)

### Infrastructure
- ✅ AI failover enabled (Claude → OpenAI → Gemini)
- ✅ 100% embedding coverage
- ✅ MongoDB query optimization (10x faster)
- ✅ Production deployed and healthy
- ✅ Root vercel.json locked

### The Living Brain ✅ ALIVE
- ✅ Operative definitions created
- ✅ `brain.ts` supervisor with MongoDB heartbeat
- ✅ `riigikogu-brain.service` with Restart=always
- ✅ Cron watchdog as backup restart mechanism
- ✅ Auto-restart verified (31s recovery)
- ✅ Resource limits (2GB RAM, 80% CPU)

---

## Anti-Priorities

Things we're explicitly NOT working on:

- Mobile app
- User accounts/registration
- Email alerts
- Other parliaments
- UI polish

---

*Focus: Bring the brain to life. Everything else depends on autonomy.*
