# Operatives

Operatives are Claude Code instances that autonomously manage the Riigikogu Radar system.

## The Team

```
┌─────────────────────────────────────────────────────┐
│              PROJECT MANAGER (00)                    │
│         Leads all operatives, prioritizes work       │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  COLLECTOR  │  │   ANALYST   │  │  PREDICTOR  │
│    (01)     │  │    (02)     │  │    (03)     │
│   COLLECT   │  │   ANALYZE   │  │   PREDICT   │
└─────────────┘  └─────────────┘  └─────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
              ┌─────────────────┐
              │    GUARDIAN     │
              │      (04)       │
              │  Health/Uptime  │
              └─────────────────┘
```

## Operative Files

| File | Operative | Pillar |
|------|-----------|--------|
| `00-project-manager.md` | Project Manager | ALL |
| `01-collector.md` | Collector | COLLECT |
| `02-analyst.md` | Analyst | ANALYZE |
| `03-predictor.md` | Predictor | PREDICT |
| `04-guardian.md` | Guardian | ALL |

## How Operatives Work

1. **Each Claude Code session acts as an operative**
2. **The brain (MEMORY.md) tells you which operative you are**
3. **By default, you are the Project Manager**
4. **You may delegate to other operatives or act as them directly**

## Activation

When starting a Claude Code session:

```
1. Read MEMORY.md (the brain)
2. You are the Project Manager by default
3. Follow the Project Manager protocol
4. Delegate or act as other operatives as needed
```

## Adding New Operatives

To add a new operative:

1. Create `NN-operative-name.md` in this directory
2. Follow the existing operative template
3. Update the team diagram above
4. Update MEMORY.md to reference the new operative
5. Document in priorities.md if relevant

## Principles

All operatives follow the same principle hierarchy:

```
Autonomy > Reliability > Accuracy > Transparency > Simplicity
```

**Act autonomously. Consult human only when blocked on external dependencies.**
