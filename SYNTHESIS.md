# SYNTHESIS.md

*What the world has built. What it has not. Where this project sits.*

---

## The landscape

Parliamentary intelligence systems fall into three tiers. Each tier exists. No system spans all three.

### Tier 1: Monitoring — what happened

The commercial market. Billion-dollar companies that watch parliaments and report what occurred.

**FiscalNote** (USA, global) — Market leader. AI-powered policy monitoring across 100+ countries. Tracks legislation, generates impact summaries, compares bill versions across jurisdictions. Serves lobbyists and corporate government affairs teams. Does not predict.

**Quorum** (USA) — Legislative tracking, stakeholder management, grassroots advocacy. "Quincy AI" analyzes legislation and drafts talking points. Covers all 50 US states + Congress. Does not predict.

**Bloomberg Government** (USA) — Legislative tracking plus deep policy journalism. AI-powered bill comparison. Serves the same market as FiscalNote and Quorum. Does not predict.

**POLITICO Pro** (USA/EU) — AI-generated policy reports from 1M+ archived articles. Policy Intelligence Assistant builds custom whitepapers. $10-12K/year. Does not predict.

**Dods Political Intelligence** (UK/EU) — Founded 1832. AI monitoring combined with 20+ human political consultants. The oldest political intelligence firm in the world. Does not predict.

**DeHavilland** (UK) — Founded 1998 by Conservative MP Adam Afriyie. Political monitoring, stakeholder management, policy analysis. AI + in-house analysts. Does not predict.

**PolicyMogul** (UK) — Notable for dual audience: used by both MPs and lobbyists. Real-time parliamentary transcription, AI summaries, stakeholder mapping. Does not predict.

**Policy-Insider.AI** (Germany/EU) — Processes ~5,000 political documents per day across UK, Germany, France, EU institutions. Some predictive analytics for policy impact forecasting — the closest Tier 1 system comes to prediction.

**Dixit** (EU) — Monitors MEP social media, auto-translates, keyword alerts. Narrow but useful.

**What Tier 1 has solved:** Real-time ingestion of parliamentary data. Multi-source aggregation. AI summarization. Stakeholder mapping. Alert systems. Bill comparison. The plumbing works.

**What Tier 1 has not solved:** Understanding. Every system in this tier tells you what happened. None tells you what will happen or why.

---

### Tier 2: Prediction — what will happen

Smaller. Mostly academic. A few commercial applications.

**Skopos Labs / PredictGov** (USA) — The gold standard for legislative prediction. Assigns daily "Probability of Enactment" to every bill in Congress. NLP on bill text + 250 variables (sponsor characteristics, committee assignments, political composition, economic indicators). Claims 98-99% accuracy. Powers predictions on GovTrack.us (2016-2023) and inside Westlaw Edge (Thomson Reuters). Founders from Vanderbilt Law and Engineering.

Limitation: predicts **bill outcomes** (pass/fail), not **individual legislator votes**. Predicting that a bill will die in committee is useful for lawyers. It does not tell you which MPs will break from their party and why.

**Political Actor Agent** (AAAI 2025) — The most technically relevant precedent. Uses LLM agents to role-play individual legislators. Each agent receives a profile (personal info, constituency, sponsorship history, sampled voting records) and evaluates votes through three political science lenses:
- **Trustee**: policy expertise and personal conviction
- **Delegate**: constituent preferences and electoral incentives
- **Follower**: party leadership and discipline

Leader agents (Speaker, party leaders, committee chairs) vote first; remaining agents decide while considering leaders' outcomes. 91.8% accuracy with GPT-4o-mini. Removing the profile module drops accuracy to 78.6%.

This paper demonstrates that LLM-based simulation of individual legislators can achieve state-of-the-art prediction accuracy with interpretable reasoning. It is the closest existing work to what this project's simulation endpoint should become.

**Voting Prediction Framework** (arXiv, 2025) — Open-source, multi-country framework (Canada, Israel, Tunisia, UK, USA). 5M+ voting records. Three-stage pipeline: data collection, feature extraction (legislator seniority, bill content), ML prediction. Up to 85% individual vote accuracy, 84% bill outcome accuracy. Notable for being open-source and cross-national.

**VoteWatch Europe** — Tracks MEP voting patterns, coalition dynamics, political group cohesion since 2004. Statistical methods developed by Simon Hix (LSE) and NYU. Transparency and analysis, approaching but not fully reaching prediction.

**European Parliament prediction** (Springer, 2025) — Random Forests on semantic bill descriptors for MEP vote forecasting. 73-74% accuracy. Demonstrates that bill content analysis improves prediction over party-line baselines, but the improvement is modest.

**Gerrish & Blei** (ICML 2011) — The foundational paper. Combined ideal point estimation with topic models to predict votes from bill text. Established that bill content carries predictive signal beyond legislator ideology. Spawned the field.

**What Tier 2 has solved:** Bill-level pass/fail prediction (Skopos, 98%+). Individual legislator vote prediction from profiles and history (PAA, 92%; VPF, 85%). The proof that bill content matters for prediction (Gerrish & Blei). The proof that LLM agents can simulate legislative reasoning (PAA).

**What Tier 2 has not solved:** No system operates continuously on a live parliament. Every prediction system is either academic (papers, not products) or limited to bill-level outcomes (Skopos). No system combines prediction with explanation for a non-expert audience. No system detects political shifts proactively.

---

### Tier 3: Intelligence — what it means and what comes next

**Parlex** (UK) — The closest government-built system to this project. Built by the UK Department for Science, Innovation and Technology as part of the AI suite "Humphrey." Architecture: Streamlit frontend, FastAPI backend, Elasticsearch with vector embeddings, GPT-4o for generation. Ingests Hansard debates (2020+), Written Parliamentary Questions (2014+), MP/Peer profiles via official APIs. ~400 civil servant pilot users.

Parlex enables users to search parliamentary history semantically, understand what MPs have said on a topic, and gauge parliamentary sentiment before proposing policy. It is the only government-built system that attempts to synthesize parliamentary data into understanding rather than mere retrieval.

Limitation: Parlex is a research tool for civil servants, not an intelligence system for citizens. It does not predict. It does not detect shifts. It does not reason about political tensions. It answers questions about the past, not the future.

**RAND Corporation** (USA) — Not a parliamentary system, but the institutional model. RAND earns trust through rigorous, verifiable analysis, then extends that trust to strategic intelligence on questions that cannot be easily verified. Its value is not information — it is sight. Clarity that a decision-maker cannot achieve alone. The methodology: quantitative modeling, scenario planning, wargaming, simulation, applied to decision problems.

No existing system applies the RAND model to a parliament.

**Arenguseire Keskus** (Estonia) — The Foresight Centre at the Riigikogu. Long-term strategic foresight for Estonia's development, attached to parliament itself. Produces trend analyses, scenario reports, and strategic assessments. It is the Estonian precedent for institutional political intelligence — but pointed inward (for parliament's own use), not outward (for citizens or external decision-makers).

**What Tier 3 has solved:** Parlex proved that semantic search + LLM synthesis on parliamentary data works at government scale. RAND proved that analytical intelligence earns trust and enables decision-making. Arenguseire Keskus proved that Estonia's political ecosystem can sustain a foresight institution.

**What Tier 3 has not solved:** No system combines parliamentary monitoring, vote prediction, political analysis, and strategic intelligence into a single operational engine. No system provides RAND-quality political intelligence about a parliament to anyone outside the parliament itself.

---

## The gap

The world has built:
- Monitoring systems that tell you what happened (FiscalNote, Quorum, Dods — commercial, mature, expensive)
- Prediction models that forecast vote outcomes (Skopos, PAA, VPF — mostly academic or bill-level only)
- Research tools that help experts search parliamentary records (Parlex — government, limited scope)

The world has not built:
- A system that predicts **individual legislator votes** on **novel bills** they have never seen, with **explanations a citizen can understand**
- A system that detects **political shifts** (coalition stress, realignment, defection trends) before they are publicly announced
- A system that reasons about **political substance** — what a bill means, what tensions it activates, who is cross-pressured — not just statistical patterns
- A system that operates **autonomously and continuously** on a live parliament, collecting data, forming predictions, testing them against reality, and improving
- A system that combines all of the above into **one intelligence engine** for a decision-maker

This is the gap. This is where this project sits.

---

## What to learn from

| Precedent | Lesson for this project |
|-----------|------------------------|
| **Skopos Labs** | Bill text carries predictive signal. 250 features is not too many if each is justified. Daily re-scoring keeps predictions current. Commercial viability exists. |
| **Political Actor Agent** | LLM agents simulating legislators reach 92% accuracy. Profile construction is critical (78% without it). The trustee/delegate/follower framework is a proven structure for reasoning about cross-pressure. |
| **Parlex** | Elasticsearch + vector embeddings + LLM synthesis works for parliamentary data. Government-grade architecture on similar data sources. Streamlit + FastAPI is viable. |
| **VPF** | Open-source, multi-country vote prediction at 85% is achievable with standard ML. Legislator seniority and bill content are strong features. |
| **Gerrish & Blei** | Bill content improves prediction beyond ideology alone. The combination of topic models and ideal points was right in 2011; the combination of embeddings and dialectical analysis is the 2026 version of the same insight. |
| **RAND** | Trust is built by being right where it can be checked, then extending credibility to where it cannot. The methodology (model, simulate, verify) is the template. |
| **Arenguseire Keskus** | Estonia can sustain strategic political analysis. The institutional precedent exists. The gap is that it serves parliament, not those outside it. |
| **FiscalNote / Quorum** | The market validates that political intelligence has commercial value. But the market has settled for monitoring. Prediction and analysis are underserved. |

---

## What this project does differently

1. **Predicts individual votes, not bill outcomes.** Skopos predicts whether a bill passes. This system predicts how each of 101 MPs will vote and why.

2. **Reasons about substance, not just statistics.** PAA uses political science frameworks (trustee/delegate/follower). This system uses dialectical analysis (thesis/antithesis/synthesis of political forces). Both go beyond pattern-matching. The dialectic is the operator's analytical method; the statistics are the evidence.

3. **Operates continuously on a live parliament.** Academic systems publish papers. Commercial systems monitor. This system collects, predicts, verifies, learns, and improves — autonomously, on the Riigikogu, in real time.

4. **Built for one demanding user first.** Not a product for a market. Not an academic contribution. Intelligence for a decision-maker. The RAND model applied to a parliament.

5. **Publishes predictions before votes and verifies after.** No existing system does this systematically for individual legislator votes. The accuracy dashboard is not a feature — it is the proof that the intelligence is trustworthy.

6. **Detects political shifts proactively.** Coalition stress, realignment signals, defection trends. No existing system watches for these continuously and flags them before they become news.

---

*This document maps the territory. SOUL.md is the compass. SPECS.md is the route. Together they navigate.*
