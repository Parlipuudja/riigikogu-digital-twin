# Stig Rästa — Golden Plan

*Version 1.0 — 2026-02-02*

---

## Strategic Decisions

| Decision | Answer |
|----------|--------|
| **Primary User** | Journalists |
| **Monetization** | Freemium |
| **MVP Deadline** | 1 March 2026 |
| **Political Positioning** | Independent think tank model (RAND, Arenguseire Keskus) |
| **Confidentiality** | All elements confidential until indicated otherwise |

---

## Part 1: Understanding the Problem Space

### What does Parliament actually need?

The Estonian Riigikogu is a 101-seat legislature making decisions that affect 1.3 million people. The current information ecosystem has gaps:

| **Gap** | **Current State** | **Opportunity** |
|---------|-------------------|-----------------|
| **Predictability** | Outcomes often uncertain until vote | Model-based forecasting |
| **Hidden patterns** | Cross-party alignments invisible | Network/coalition analysis |
| **Institutional memory** | Scattered across documents | Unified knowledge base |
| **Impact analysis** | Manual, slow, expensive | AI-assisted simulation |
| **Public accessibility** | Data exists but is opaque | Plain-language translation |

### Who are the actual users?

**Tier 1: Parliament Insiders**
- MPs and their staff (101 MPs, ~200 staff)
- Parliamentary committees
- Government ministries drafting legislation

**Tier 2: Political Ecosystem** ← *PRIMARY TARGET FOR MVP*
- Journalists covering Parliament
- Lobbyists and advocacy groups
- Political parties' strategy teams
- Think tanks and researchers

**Tier 3: Citizens**
- Civically engaged Estonians
- Voters wanting accountability data
- Students, educators

Each tier needs different depth and different interfaces.

---

## Part 2: The Vision

### Core Thesis

> **Parliament is a complex system that can be modeled, understood, and predicted — but currently isn't.**

The value proposition isn't just "predict votes" — it's **making the legislative system legible**. Legibility enables:
- Better decisions by legislators
- Better coverage by journalists
- Better accountability to citizens
- Better policy outcomes for Estonia

### Product Name Proposal: **Riigikogu Radar** (or keep "Stig Rästa" as internal codename)

The radar metaphor captures:
- Continuous scanning/monitoring
- Early detection of emerging patterns
- Situational awareness
- Both military precision (for insiders) and accessibility (everyone can read radar)

### Political Positioning: Independent Think Tank Model

Following the model of RAND Corporation and Arenguseire Keskus (Estonian Foresight Centre):
- **Rigorous methodology**: All analysis must be defensible and transparent
- **Non-partisan**: No political alignment, serve all sides equally with facts
- **Evidence-based**: Claims backed by data, uncertainty acknowledged
- **Public interest**: Ultimate goal is better governance, not political advantage
- **Credibility through accuracy**: Reputation built on being right, not being first

---

## Part 3: Architecture Philosophy

### Three Pillars

```
┌─────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER                        │
│         (Autonomous data collection & processing)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ANALYSIS LAYER                            │
│    (Knowledge graph + AI agents + prediction models)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    INTERFACE LAYER                           │
│         (Different views for different users)                │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

**1. Knowledge Graph as Foundation (not just document store)**

Current v0.1 stores documents. The real power comes from understanding *relationships*:
- MP → voted FOR → Draft X
- Draft X → amends → Law Y
- MP → spoke about → Topic Z (with sentiment)
- Party A → coalition with → Party B
- Draft X → relates to → EU Directive W

A graph database (Neo4j or similar) enables queries like:
- "Who are the hidden influencers on environmental policy?"
- "Which MPs consistently vote against their party on defense?"
- "What's the voting bloc structure on this specific issue?"

**2. Multi-Agent Analysis System**

Not one AI, but specialized agents:

| Agent | Purpose |
|-------|---------|
| **Observer** | Monitors data sources, detects changes |
| **Analyst** | Deep-dives on specific questions |
| **Predictor** | Vote/outcome forecasting (current system) |
| **Narrator** | Translates findings to plain language |
| **Critic** | Validates predictions, tracks accuracy |

**3. Temporal Intelligence**

Everything must be time-aware:
- Positions evolve
- Coalitions shift
- Accuracy degrades without fresh data
- Historical patterns inform future predictions

---

## Part 4: MVP Specification

### MVP Goal
> Prove that AI-powered parliamentary intelligence provides genuine value that doesn't exist elsewhere.

### MVP Deadline: 1 March 2026

### MVP Scope: "The Parliamentary Analyst for Journalists"

A tool that journalists can use to:
1. "What will happen to Draft X?" (passage probability + reasoning)
2. "Who are the swing votes on this issue?" (targetable MP analysis)
3. "What's the political landscape on Topic Y?" (faction mapping)
4. "How has MP Z's voting pattern changed?" (evolution tracking)
5. "Give me the story" (anomaly detection, unusual patterns)

### MVP Features

**1. Enhanced Prediction Engine** (build on v0.1)
- Parliament-wide vote simulation (exists, needs polish)
- Confidence calibration via backtesting (exists)
- "Swing vote" identification (NEW)
- Amendment impact analysis (NEW)

**2. Basic Knowledge Graph**
- Entities: MPs, Parties, Drafts, Topics, Votes
- Relationships: voted, spoke_about, belongs_to, authored
- Query interface for power users

**3. Automated Monitoring**
- Daily sync from Riigikogu API
- Alerts on: new drafts, scheduled votes, significant speeches
- Weekly digest generation

**4. MP Report Cards**
- Public page for each MP showing:
  - Attendance rate
  - Voting alignment with party
  - Key positions on issues
  - Notable speeches
- Shareable, embeddable for news articles

**5. Journalist-Focused Interface**
- Natural language query ("Who voted against their party on X?")
- Export-friendly data (for articles)
- Source citations (for fact-checking)
- "Story leads" — automated detection of newsworthy patterns

### MVP Tech Stack (Evolution from v0.1)

| Component | v0.1 | MVP |
|-----------|------|-----|
| Database | MongoDB Atlas | MongoDB + Neo4j (graph) |
| AI | Claude (single model) | Claude + specialized prompts per agent |
| Embeddings | Voyage AI | Voyage AI (unchanged) |
| Frontend | Next.js | Next.js (unchanged) |
| Data sync | Manual scripts | Scheduled jobs (cron/Vercel) |
| Monitoring | None | Basic alerting system |

### MVP Success Criteria

1. **Accuracy**: >70% vote prediction accuracy (backtested)
2. **Coverage**: All active MPs have profiles
3. **Freshness**: Data no more than 24h stale
4. **Utility**: At least 3 "insights" per week that aren't obvious from raw data
5. **Adoption**: 3-5 journalists actively using for stories (validation)

---

## Part 5: Final Product Vision

### Final Product: "Full Spectrum Parliamentary Intelligence"

**Intelligence Collection**
- Real-time monitoring of all parliamentary activity
- Media sentiment tracking (Estonian news sources)
- Social media monitoring (MPs' public statements)
- EU legislative pipeline tracking (upcoming obligations)
- Budget and economic data integration
- Public consultation/feedback integration

**Analysis Capabilities**
- Vote prediction (with uncertainty quantification)
- Coalition/faction detection (unsupervised clustering)
- Policy impact simulation (economic, social, legal)
- Comparative analysis (how do other parliaments handle X?)
- Anomaly detection (unusual voting patterns, procedural irregularities)
- Narrative generation (explain complex issues simply)

**Prediction & Forecasting**
- Bill passage probability
- Amendment success likelihood
- Timeline predictions (when will X reach vote?)
- Political risk assessment
- Early warning for contentious issues

**User Interfaces**
- **Command Center** (Parliament/Government): Full operational intelligence
- **Researcher Portal** (Journalists/Think tanks): Investigation tools
- **Citizen Dashboard** (Public): Accountability tracking, plain-language summaries
- **API** (Developers): Programmatic access for integrations
- **Alerts & Digests** (All): Customizable notifications

### Final Product Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                    │
│  Riigikogu API | Media | Social | EU | Economic | Public Feedback      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      INGESTION PIPELINE                                 │
│   Collectors → Normalizers → Validators → Knowledge Graph Writer        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      KNOWLEDGE GRAPH                                    │
│                                                                         │
│   Entities: MPs, Parties, Drafts, Laws, Topics, Events, Organizations  │
│   Relationships: voted, spoke, authored, amended, opposes, supports    │
│   Temporal: all relationships timestamped, versioned                   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  OBSERVER   │ │  ANALYST    │ │  PREDICTOR  │
            │   AGENTS    │ │   AGENTS    │ │   AGENTS    │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      INSIGHT ENGINE                                     │
│                                                                         │
│   Pattern Detection | Anomaly Alerts | Trend Analysis | Forecasts      │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      INTERFACES                                         │
│                                                                         │
│   Command Center | Researcher Portal | Citizen Dashboard | API         │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Freemium Model Design

### Why Freemium Works Here

1. **Low marginal cost**: Once built, serving additional users is cheap
2. **Network effects**: More users = more credibility = more users
3. **Conversion funnel**: Free users become paying users when they need more
4. **Market validation**: Free tier tests demand before heavy investment
5. **Journalistic reach**: Free access for journalists = free marketing via articles

### Proposed Tier Structure

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| MP Report Cards | ✓ | ✓ | ✓ |
| Basic vote predictions | ✓ | ✓ | ✓ |
| Historical voting data | 1 year | Full | Full |
| Prediction explanations | Summary | Detailed | Detailed + sources |
| API access | — | Limited | Unlimited |
| Custom alerts | — | ✓ | ✓ |
| Natural language queries | — | ✓ | ✓ |
| Export/embed | — | ✓ | ✓ |
| Priority support | — | — | ✓ |
| Custom analysis | — | — | ✓ |

### Pricing Thoughts (to validate)

- **Free**: €0 (drives adoption, proves value)
- **Pro**: €29-49/month (journalists, researchers, lobbyists)
- **Enterprise**: Custom (government, large organizations)

---

## Part 7: Roadmap to MVP (1 March 2026)

### Available Time: ~4 weeks

### Week 1: Foundation Stabilization
- [ ] Audit v0.1 codebase, identify what's reusable
- [ ] Set up automated daily data sync
- [ ] Improve prediction accuracy (target: >70%)
- [ ] Create MP Report Card pages (basic version)

### Week 2: Intelligence Layer
- [ ] Implement basic knowledge graph (can use MongoDB references initially, Neo4j later)
- [ ] Add "swing vote" detection algorithm
- [ ] Build faction/coalition analysis
- [ ] Create anomaly detection for unusual voting patterns

### Week 3: Journalist Interface
- [ ] Natural language query interface
- [ ] "Story leads" automated detection
- [ ] Export functionality for articles
- [ ] Source citation system

### Week 4: Polish & Launch Prep
- [ ] Accuracy dashboard (public)
- [ ] Freemium gating implementation
- [ ] Performance optimization
- [ ] Journalist outreach (3-5 beta users)
- [ ] Documentation

### Post-MVP (March onwards)
- Neo4j migration for true graph queries
- Media monitoring integration
- EU legislative tracking
- Mobile-friendly interface
- API for developers

---

## Part 8: Design Principles

### For the Product
1. **Accuracy over speed**: Better to be right than first
2. **Transparency over magic**: Explain how predictions work
3. **Data over opinion**: Let facts speak, avoid editorializing
4. **Simplicity over features**: Do few things excellently

### For the Codebase
1. **Modularity**: Each component independently testable
2. **Observability**: Log everything, measure accuracy continuously
3. **Resilience**: Graceful degradation when APIs fail
4. **Security**: Confidential until indicated otherwise

### For the Organization
1. **Independence**: No political alignment, serve truth
2. **Credibility**: Build reputation through accuracy
3. **Accessibility**: Make parliament understandable to all

---

## Appendix: v0.1 Reusable Components

From the existing codebase, the following can be carried forward:

| Component | Status | Notes |
|-----------|--------|-------|
| MongoDB setup | ✓ Keep | Works well |
| Riigikogu API client | ✓ Keep | Comprehensive |
| Claude integration | ✓ Keep | Refactor for multi-agent |
| Voyage AI embeddings | ✓ Keep | Works well |
| Vote prediction logic | ✓ Enhance | Core of MVP |
| Backtesting system | ✓ Keep | Critical for accuracy |
| Next.js frontend | ✓ Rebuild | New UI for journalists |
| MP profiles | ✓ Enhance | Add Report Cards |
| Data sync scripts | ✓ Automate | Move to scheduled jobs |

---

---

## Related Documents

- **SR Rebuild Architecture.md** — Detailed technical architecture for the rebuild
- **SR Mission.md** — Mission statement and philosophy
- **SR Long-term plan.md** — Strategic direction

---

*This document is confidential. Last updated: 2026-02-02*
