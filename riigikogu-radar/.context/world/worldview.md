# Worldview

*The landscape we navigate. Read this to understand why decisions matter.*

---

## The Problem We're Solving

Parliamentary democracy has a transparency paradox: **everything is public, but nothing is legible.**

The Riigikogu publishes every vote, every speech, every draft bill. It's all there—thousands of documents, years of records, freely available. And yet:

- **Journalists** can't see patterns without weeks of manual analysis
- **Citizens** can't tell if their MP votes with their stated values
- **Researchers** can't study parliamentary behavior at scale
- **MPs themselves** often don't know how their voting compares to colleagues

The data exists. The understanding doesn't.

We solve this by making the implicit explicit—turning raw parliamentary data into legible patterns.

---

## The Stakeholders

### Primary: Journalists

Our core user. They need:
- **Speed**: Breaking news can't wait for weeks of research
- **Accuracy**: Their reputation depends on being right
- **Defensibility**: They need to cite sources when challenged
- **Narrative hooks**: Patterns that tell a story ("MP X votes against party 40% on environmental issues")

What they fear:
- Being wrong publicly
- Being seen as biased
- Being manipulated by their sources
- Missing the real story

### Secondary: Politically Engaged Citizens

People who vote, follow politics, care about accountability. They need:
- **Simplicity**: Not everyone understands parliamentary procedure
- **Trust signals**: Why should they believe us?
- **Actionable insight**: "Your MP voted against X" is useful; raw vote data isn't

What they fear:
- Being manipulated
- Information overload
- Feeling stupid for not understanding

### Tertiary: Researchers & Analysts

Political scientists, think tanks, policy analysts. They need:
- **Data access**: API, exports, bulk downloads
- **Methodology transparency**: How do we calculate things?
- **Historical depth**: Patterns over years, not just current session

What they fear:
- Black-box AI claims
- Unreproducible results

### Not Our Users (But They'll Show Up)

- **Political operatives** looking for opposition research
- **Lobbyists** looking to identify persuadable MPs
- **Foreign actors** looking for leverage points
- **MPs themselves** checking their own profiles

We serve them the same data as everyone else. No special access, no hidden features.

---

## The Estonian Context

### Parliament Structure

- **101 MPs**, single chamber (Riigikogu)
- **Convocations** last 4 years (currently XV, 2023-2027)
- **Factions** map roughly to parties, but MPs can be independent
- **Coalition** governs; opposition critiques
- **Committee work** is where real legislation happens (less visible than plenary)

### Current Political Landscape (as of 2024-2025)

- **Coalition**: Reform (liberal), Eesti 200 (centrist), SDE (social democratic)
- **Opposition**: EKRE (nationalist-conservative), Keskerakond (centrist, Russian-speaking base), Isamaa (conservative)
- **Key tensions**: Security (Russia/NATO), economy (tax reform), culture wars (LGBT, education)

### How Votes Actually Work

Most votes are **not close**. Coalition discipline is strong—80-95% of MPs vote with their faction on most issues.

The interesting cases:
- **Conscience votes**: Rare, usually on social issues
- **Coalition cracks**: When governing parties disagree
- **Faction defectors**: MPs who consistently vote against their party
- **Procedural votes**: Often unanimous, not interesting

Predicting the average vote is easy. Predicting the edge cases is where value lies.

### The Media Ecosystem

- **ERR** (public broadcaster): Most trusted, resource-constrained
- **Postimees, Delfi**: Major private outlets, competitive
- **Eesti Ekspress**: Investigative, slower cycle
- **Social media**: MPs are active on Facebook, X; stories can start there

Journalists are overworked. They cover parliament alongside many other beats. Tools that save them time win.

---

## The Information Gaps

### What Exists (Public Data)

| Source | Quality | Accessibility |
|--------|---------|---------------|
| Voting records | Complete | Good API |
| Stenograms (speeches) | Complete | Good API, Estonian only |
| Draft bills | Complete | Good API |
| MP profiles | Basic | Good API |
| Committee protocols | Partial | PDFs, harder to parse |
| Lobbying disclosure | Minimal | No structured data |

### What's Missing

- **Why** MPs vote the way they do (we infer, we don't know)
- **Coalition negotiations** (private)
- **Committee deliberations** (summarized, not verbatim)
- **Lobbying influence** (not disclosed meaningfully)
- **MP-constituent communication** (private)

### What We Uniquely Provide

- **Voting pattern analysis**: Who votes with whom, how often, on what topics
- **Prediction**: Probabilistic forecasts for upcoming votes
- **Cross-referencing**: Linking speeches to votes to bills
- **Historical context**: "This is similar to vote X in 2021"
- **Searchable embeddings**: Semantic search across parliamentary history

---

## Tensions We Navigate

### Prediction vs. Influence

We predict how MPs will vote. But predictions can become self-fulfilling:
- If we say "Bill X will fail," does that discourage supporters?
- If we say "MP Y is persuadable," does that invite pressure?

**Our stance**: We publish predictions, but we don't advise strategy. We say "here's the probability," not "here's how to change it."

### Transparency vs. Privacy

MPs are public figures. Their votes are public. But:
- Should we highlight "anomalous" personal votes (divorce, illness-related absence)?
- Should we surface patterns that feel invasive (always absent on Fridays)?

**Our stance**: We show voting patterns on public matters. We don't speculate on personal reasons. We present data, not narratives.

### Accuracy vs. Speed

Journalists want instant answers. But:
- Fast predictions may be wrong
- Confidence intervals are confusing
- "We don't know" is unsatisfying

**Our stance**: We show confidence levels. We say when we're uncertain. We'd rather be trusted than first.

### Simplicity vs. Nuance

Users want simple answers ("Will it pass?"). Reality is complex:
- "It depends on amendments"
- "If MP X shows up"
- "Coalition is split, could go either way"

**Our stance**: Lead with the simple answer, make nuance available. "67% likely to pass. [Why?]"

### Independence vs. Utility

Being useful to journalists means understanding their needs. But:
- Getting too close risks capture
- Optimizing for clicks risks sensationalism
- Feature requests may reflect bias

**Our stance**: We build for the use case (accountability journalism), not the user's every wish. We say no to features that could enable manipulation.

---

## Threat Model

### Misuse Scenarios

| Threat | Likelihood | Mitigation |
|--------|------------|------------|
| Opposition research ("dirt digging") | High | Same data for everyone; no special queries |
| Lobbying targeting ("persuadable MPs") | Medium | Don't highlight persuadability; show loyalty/consistency instead |
| Foreign influence mapping | Low-Medium | No private data; focus on public record |
| MP harassment campaigns | Low | Don't editorialize; present patterns not judgments |
| Misinformation amplification | Medium | Cite sources; be transparent about uncertainty |

### Reputation Risks

| Risk | Impact | Prevention |
|------|--------|------------|
| Wrong prediction on high-profile vote | High | Confidence intervals; track record transparency |
| Perceived political bias | High | Serve all sides equally; methodology is public |
| Data breach / security incident | Medium | No user data; no private information |
| Being cited in harmful context | Medium | Can't control downstream use; be defensible |

### Technical Risks

| Risk | Impact | Prevention |
|------|--------|------------|
| AI hallucination | High | RAG grounding; source citations; human review |
| Data staleness | Medium | Daily sync; show "last updated" timestamps |
| API dependency (Anthropic, etc.) | Medium | Provider failover; graceful degradation |

---

## Success Looks Like

### Short-term (6 months)
- Journalists cite us in published articles
- We predict a high-profile vote correctly with confidence
- Users return without being prompted

### Medium-term (1-2 years)
- We're a standard tool for Riigikogu coverage
- Political science papers cite our methodology
- MPs check their own profiles

### Long-term (3+ years)
- Other parliaments want similar tools
- We've influenced how parliamentary data is published
- Democratic accountability has measurably improved (hard to prove, but that's the goal)

### Failure Looks Like

- We're seen as a political actor, not a neutral tool
- We make a high-profile wrong prediction that damages trust
- We're used primarily for opposition research / attack ads
- We optimize for engagement over accuracy
- We become a black box nobody trusts

---

## Development Implications

When considering a feature, ask:

1. **Does it serve legibility?** Making patterns visible is core. Features that obscure or sensationalize fail this test.

2. **Who benefits?** If the primary beneficiary is a political operative rather than a journalist or citizen, reconsider.

3. **What's the failure mode?** How could this be misused? What happens if the data is wrong?

4. **Does it require editorial judgment?** We present patterns, not conclusions. If a feature requires us to decide "good vs. bad," it's out of scope.

5. **Can we defend it publicly?** If we'd be embarrassed explaining this feature to a journalist, don't build it.

---

*This document should evolve as we learn more about our users and the landscape. Update it when reality surprises us.*
