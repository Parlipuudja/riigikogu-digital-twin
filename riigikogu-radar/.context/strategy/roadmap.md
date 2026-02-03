# Roadmap — The Golden Plan

*Making parliament legible, one feature at a time.*

## Vision

A tool that journalists covering Riigikogu consider **essential** — trusted enough to cite in reporting.

---

## Phase 1: Foundation ✅ COMPLETE

**Goal:** Core prediction infrastructure that works.

- [x] Database with MPs, votings, stenograms, drafts
- [x] AI prediction pipeline (Claude + RAG)
- [x] Vector embeddings for semantic search
- [x] Basic UI for browsing MPs and predictions
- [x] Multi-language support (ET/EN)
- [x] Honest accuracy reporting (post-cutoff backtests)

**Status:** 87-90% out-of-sample accuracy achieved.

---

## Phase 2: Trust & Transparency 🔄 IN PROGRESS

**Goal:** Build credibility through transparency and reliability.

### 2.1 Accuracy Transparency ✅
- [x] OOS (out-of-sample) indicators on backtests
- [x] Methodology documentation
- [x] Post-cutoff testing to prevent data leakage

### 2.2 Authentication & Admin 🔄
- [x] Login system (NextAuth.js)
- [ ] Admin dashboard for system status
- [ ] Admin-triggered backtests
- [ ] Admin-triggered data sync

### 2.3 Data Quality
- [x] Vector search index working
- [x] Embeddings generation pipeline
- [ ] 80%+ embedding coverage (currently ~75%)
- [ ] Automated daily sync from Riigikogu API

### 2.4 Reliability
- [ ] AI failover (OpenAI/Gemini backup)
- [ ] Better error handling and user feedback
- [ ] Uptime monitoring

---

## Phase 3: Journalist Features 📋 PLANNED

**Goal:** Features journalists actually need.

### 3.1 Predictions & Analysis
- [ ] Batch predictions for upcoming votes
- [ ] Coalition vs opposition breakdown
- [ ] Vote outcome predictions (will it pass?)
- [ ] Historical voting pattern analysis

### 3.2 Alerts & Tracking
- [ ] Email alerts for specific MPs or topics
- [ ] Watchlist functionality
- [ ] RSS feeds for votes

### 3.3 Export & Integration
- [ ] Better export formats (Excel, PDF reports)
- [ ] API for third-party integration
- [ ] Embeddable widgets

---

## Phase 4: Advanced Intelligence 🔮 FUTURE

**Goal:** Deeper political insights.

- [ ] Coalition dynamics tracking
- [ ] MP influence scoring
- [ ] Topic clustering and trend analysis
- [ ] Comparison with EU parliament voting
- [ ] Historical parliament comparisons

---

## Anti-Goals

Things we explicitly **won't** do:

- **Real-time features** - We're analysis, not news
- **Mobile app** - Web-first for journalists at desks
- **User accounts for everyone** - Admin-only for now
- **Social features** - We're a tool, not a platform
- **Paid features** - Free public resource (for now)

---

## Success Metrics

1. **Accuracy:** 85%+ on out-of-sample predictions
2. **Coverage:** All 101 MPs with predictions
3. **Trust:** Cited in at least one news article
4. **Reliability:** 99%+ uptime

---

*Last updated: 2026-02-03*
