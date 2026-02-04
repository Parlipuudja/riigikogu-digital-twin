# Operatives

Operatives are Claude Code instances that autonomously manage the Riigikogu Radar system.

## The Team

```
┌─────────────────────────────────────────────────────────────┐
│              PROJECT MANAGER (00) — ALWAYS RUNS             │
│         Leads all operatives, maintains brain, reports      │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────┐
│   DEVELOPER     │  │  COLLECTOR  │  │   ANALYST   │
│     (05)        │  │    (01)     │  │    (02)     │
│  ALWAYS RUNS    │  │   COLLECT   │  │   ANALYZE   │
│  Writes code    │  │   On-demand │  │   On-demand │
└─────────────────┘  └─────────────┘  └─────────────┘
                            │               │
            ┌───────────────┼───────────────┘
            │               │
            ▼               ▼
    ┌─────────────┐  ┌─────────────────┐
    │  PREDICTOR  │  │    GUARDIAN     │
    │    (03)     │  │      (04)       │
    │   PREDICT   │  │  Health/Uptime  │
    │   On-demand │  │    On-demand    │
    └─────────────┘  └─────────────────┘
```

## Always-Running Operatives

These operatives run EVERY cycle (every 30 minutes):

| Operative | Role |
|-----------|------|
| **Project Manager** | Strategic leadership, brain maintenance, reports, delegation |
| **Developer** | Code implementation, shipping features, bug fixes |

## On-Demand Operatives

These operatives are triggered by PM when conditions are met:

| Operative | Trigger Condition |
|-----------|-------------------|
| Collector | Data >24h stale |
| Analyst | Embeddings <100% or profiles outdated |
| Predictor | No backtest in >7 days |
| Guardian | Health issues detected |

## Operative Files

| File | Operative | Always Runs? |
|------|-----------|--------------|
| `00-project-manager.md` | Project Manager | YES |
| `05-developer.md` | Developer | YES |
| `01-collector.md` | Collector | No |
| `02-analyst.md` | Analyst | No |
| `03-predictor.md` | Predictor | No |
| `04-guardian.md` | Guardian | No |

## How the Supervisor Works

```
┌─────────────────────────────────────────────┐
│            SUPERVISOR (systemd)             │
│         Runs continuously on AWS            │
└─────────────────────────────────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Every 30 min  │
            └───────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ Run PM first  │ ────► │ Run Dev next  │
│ (strategic)   │       │ (implement)   │
└───────────────┘       └───────────────┘
```

## Adding New Operatives

1. Create `NN-operative-name.md` in this directory
2. Follow the existing operative template
3. Update the team diagram above
4. If always-running: update supervisor.ts
5. Update MEMORY.md to reference the new operative

## Principles

All operatives follow the same principle hierarchy:

```
Autonomy > Reliability > Accuracy > Transparency > Simplicity
```

**Act autonomously. Consult human only when blocked on external dependencies.**

## Starting the Supervisor

```bash
# Manual start
npx tsx scripts/operatives/supervisor.ts

# As a service (recommended)
sudo systemctl start riigikogu-operatives
sudo systemctl status riigikogu-operatives
```
