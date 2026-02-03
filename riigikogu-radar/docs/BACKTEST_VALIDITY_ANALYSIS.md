# Backtesting Validity & Cost Efficiency Analysis

## Executive Summary

This document analyzes two critical concerns with the backtesting system:

1. **Cost Efficiency**: Current costs of ~$130-200/month for full backtests
2. **Data Leakage Hypothesis**: AI models may "know" actual voting results from training data

**Key Finding**: The data leakage risk is **real and significant**. The 87.6% accuracy may be partially inflated by model pre-knowledge rather than true predictive ability.

---

## Part 1: Data Leakage Analysis

### The Hypothesis

> AI models (Claude, GPT-4, Gemini) were trained on internet data that includes Estonian parliament records, news articles, and voting outcomes. When we backtest by asking the model to "predict" a historical vote, it may simply be recalling known information rather than reasoning from patterns.

### Evidence Supporting the Hypothesis

#### 1. Training Data Scope

| Model | Training Cutoff | Estonian Data Risk |
|-------|-----------------|-------------------|
| Claude Sonnet 4 | ~Early 2025 | HIGH - All Riigikogu XV votes before cutoff |
| GPT-4o | ~Late 2024 | HIGH - Same period |
| Gemini 1.5 | ~Late 2024 | HIGH - Same period |

Estonian parliament data is publicly available:
- **riigikogu.ee** - Official parliament website (Estonian/English)
- **News coverage** - ERR, Postimees, Delfi report on votes
- **Wikipedia** - Estonian parliament articles
- **EU databases** - Cross-referenced in EU parliament systems

#### 2. Identifiable Information in Prompts

Current backtest prompt includes:

```
You are predicting how Kaja Kallas (Reformierakond) would vote...
                        ↑ NAMED MP    ↑ NAMED PARTY

Recent votes (last 10):
1. "Riigieelarve seaduse muutmise seadus 2024" - FOR (2024-03-15)
   ↑ SEARCHABLE BILL TITLE                           ↑ EXACT DATE

Given this bill title: "Keskkonnaseadustiku muutmise seadus"
                        ↑ SEARCHABLE BILL TITLE
```

A model trained on Estonian news could recognize:
- "Kaja Kallas voted FOR budget amendment on 2024-03-15" → known fact
- "Environment Act amendment" → known controversial bill with recorded votes

#### 3. Temporal Isolation is Insufficient

The system correctly queries only votes before the test date:

```typescript
votingTime: { $lt: beforeDate.toISOString() }  // Good!
```

But then exposes identifiable data to the model:
- Bill title (searchable)
- MP name (searchable)
- Exact dates (cross-referenceable)

**The model doesn't need database access - it has training data.**

### Testing the Hypothesis

#### Method 1: Post-Cutoff Validation

Test only on votes **after** model training cutoff:

```
For Claude Sonnet 4 (cutoff ~Early 2025):
- Test only votes from Feb 2025 onwards
- Model cannot have seen these in training
- True measure of predictive ability
```

**Expected outcome**: If accuracy drops significantly on post-cutoff data, confirms leakage.

#### Method 2: Anonymization Test

Run parallel backtests:
1. **Control**: Current prompts (identifiable)
2. **Anonymized**: Bill titles replaced with hashes, MP names removed

```typescript
// Anonymized prompt:
"MP from Coalition-A with pattern [67% FOR] voting on Bill-2024-001234"

// vs Current:
"Kaja Kallas (Reformierakond) voting on Keskkonnaseadustiku muutmise seadus"
```

**Expected outcome**: If anonymized accuracy is significantly lower, confirms model is using pre-knowledge.

#### Method 3: Random Baseline Comparison

Compare model performance against baselines:
- **Random guess**: 33% (3 options)
- **Always majority**: Vote with party majority
- **Always FOR**: Simple heuristic (~67% of votes are FOR in Estonian parliament)

If model barely beats "Always FOR", its intelligence is questionable.

### Risk Assessment Matrix

| Risk Factor | Current State | Severity | Mitigation Available |
|-------------|---------------|----------|---------------------|
| Bill titles exposed | Yes | CRITICAL | Hash anonymization |
| MP names exposed | Yes | HIGH | Role-based prompts |
| Dates exposed | Yes | MEDIUM | Relative dates |
| Party names exposed | Yes | MEDIUM | Coalition-A/B |
| Training data overlap | Likely 100% | CRITICAL | Post-cutoff testing |

---

## Part 2: Cost Efficiency Options

### Current Cost Structure

```
Per API Call:
- Input: ~1,100 tokens × $3/1M = $0.0033
- Output: ~100 tokens × $15/1M = $0.0015
- Total: ~$0.0048 per prediction

Per MP Backtest (200 votes):
- 200 × $0.0048 = $0.96

Full System (101 MPs):
- 101 × $0.96 = ~$97 per full run
- With margin: $130-200/month
```

### Cost Reduction Strategies

#### Strategy 1: Statistical Sampling (Recommended)

Instead of testing all 200 votes, use statistical sampling:

| Sample Size | Confidence | Margin of Error | Cost Reduction |
|-------------|------------|-----------------|----------------|
| 200 | 99% | ±3% | 0% (baseline) |
| 100 | 95% | ±5% | 50% |
| 50 | 90% | ±8% | 75% |
| 30 | 85% | ±10% | 85% |

**Recommendation**: n=50 gives 90% confidence with 75% cost savings.

```typescript
// Stratified sampling by decision type:
const sampleSize = 50;
const forSample = Math.floor(sampleSize * 0.67);    // ~34 FOR votes
const againstSample = Math.floor(sampleSize * 0.28); // ~14 AGAINST
const abstainSample = sampleSize - forSample - againstSample; // ~2 ABSTAIN
```

#### Strategy 2: Tiered Model Selection

Use cheaper models for initial screening:

| Model | Cost/1K tokens | Use Case |
|-------|---------------|----------|
| Claude Haiku | $0.25/$1.25 | Screening (80% of tests) |
| Claude Sonnet | $3/$15 | Validation (20% of tests) |
| GPT-4o-mini | $0.15/$0.60 | Budget alternative |

**Two-pass approach**:
1. Screen all votes with Haiku ($0.001/prediction)
2. Re-test only uncertain predictions with Sonnet

```
Cost: 200 × $0.001 + 40 × $0.0048 = $0.39 per MP
Savings: 60%
```

#### Strategy 3: Caching Semantic Patterns

Instead of calling API for every vote, cache bill-pattern associations:

```typescript
// Build semantic clusters of similar bills
const billClusters = {
  "budget-amendments": { typicalVote: "FOR", partyAlignment: 0.95 },
  "environment-regulation": { typicalVote: "SPLIT", partyAlignment: 0.72 },
  // ...
};

// Only call API for first bill in each cluster
```

**Estimated savings**: 40-60% (many bills follow predictable patterns)

#### Strategy 4: Confidence-Based Short-Circuit

Stop testing MP when confidence interval is stable:

```typescript
// After 30 samples, if accuracy is 85% ± 5%:
if (sampleSize >= 30 && confidenceInterval < 0.10) {
  // Stop testing this MP
  break;
}
```

**Estimated savings**: 30-50% (accurate MPs converge quickly)

### Cost Efficiency Comparison

| Strategy | Cost/MP | Monthly Cost | Accuracy Loss |
|----------|---------|--------------|---------------|
| Current (200 votes) | $0.96 | $130-200 | Baseline |
| Sample 50 | $0.24 | $35-50 | ~±8% margin |
| Tiered models | $0.39 | $50-70 | ~2-3% |
| Combined (sample + tiered) | $0.10 | $15-25 | ~±10% margin |

---

## Part 3: Recommended Testing Protocol

### Valid Backtest Design

To ensure backtests measure **true predictive ability**, not **memory recall**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                  VALID BACKTEST PROTOCOL                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. TEMPORAL SPLIT                                                  │
│     ┌──────────────────────────────────────────────────────┐       │
│     │ Training: Votes before 2025-01-01                    │       │
│     │ Testing:  Votes after 2025-02-01 (post-cutoff)       │       │
│     └──────────────────────────────────────────────────────┘       │
│                                                                     │
│  2. ANONYMIZATION                                                   │
│     ┌──────────────────────────────────────────────────────┐       │
│     │ Before: "Kaja Kallas votes on Climate Bill 2024"     │       │
│     │ After:  "MP-A001 votes on Bill-B7X2K"               │       │
│     └──────────────────────────────────────────────────────┘       │
│                                                                     │
│  3. BASELINE COMPARISON                                             │
│     ┌──────────────────────────────────────────────────────┐       │
│     │ Random:      33% expected                            │       │
│     │ Party-line:  ~75% expected                           │       │
│     │ Model:       Must beat party-line significantly      │       │
│     └──────────────────────────────────────────────────────┘       │
│                                                                     │
│  4. CROSS-VALIDATION                                                │
│     ┌──────────────────────────────────────────────────────┐       │
│     │ Split data into 5 folds                              │       │
│     │ Train on 4, test on 1                                │       │
│     │ Report mean ± std deviation                          │       │
│     └──────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Proposed Implementation

#### Phase 1: Diagnostic Test (Immediate)

Run a diagnostic to measure leakage:

```bash
# Test 1: Anonymized vs Identifiable
npx tsx scripts/backtest-diagnostic.ts --mode=anonymization-test

# Test 2: Pre vs Post cutoff
npx tsx scripts/backtest-diagnostic.ts --mode=temporal-split

# Test 3: Baseline comparison
npx tsx scripts/backtest-diagnostic.ts --mode=baseline
```

#### Phase 2: Implement Anonymization (If leakage confirmed)

```typescript
// New buildBacktestPrompt with anonymization:
function buildBacktestPromptAnonymized(
  context: AnonymizedContext,
  billHash: string
): string {
  return `You are predicting how a ${context.coalitionRole} MP would vote.

Voting pattern (${context.votingPattern.total} votes):
- FOR: ${context.votingPattern.forPercent}%
- AGAINST: ${context.votingPattern.againstPercent}%

Recent patterns: ${context.recentPatterns}

Bill category: ${context.billCategory}

Predict: FOR, AGAINST, or ABSTAIN`;
}
```

#### Phase 3: Honest Accuracy Reporting

Update accuracy page to show:

```
┌────────────────────────────────────────────────────────┐
│ PREDICTION ACCURACY                                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Historical Accuracy: 87.6%                             │
│ ⚠️ May include model pre-knowledge                     │
│                                                        │
│ Post-Cutoff Accuracy: TBD%                             │
│ ✓ True predictive measure                              │
│                                                        │
│ Baseline (Party-line): ~75%                            │
│ Value-add over baseline: +12.6pp                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Part 4: Conclusions

### On Data Leakage

**The hypothesis is plausible and concerning.**

- Estonian parliament data is public and likely in training sets
- Current prompts expose identifiable information
- 87.6% accuracy may be partially "cheating"

**Recommendation**: Implement anonymization test immediately. If accuracy drops >10%, assume leakage is real.

### On Cost Efficiency

**Significant savings possible without major quality loss.**

| Approach | Savings | Implementation Effort |
|----------|---------|----------------------|
| Sample n=50 | 75% | Low (config change) |
| Tiered models | 60% | Medium (code change) |
| Combined | 85% | Medium |

**Recommendation**: Implement statistical sampling (n=50) first. Easy win.

### Honest MVP Positioning

For journalist users, be transparent:

> "Our predictions achieve 87% accuracy on historical votes. We're validating this against truly future votes to confirm the model isn't simply recalling known outcomes. The true predictive accuracy may be lower but still valuable."

This builds trust through honesty - appropriate for a transparency-focused tool.

---

## Appendix: Diagnostic Script Specification

```typescript
// scripts/backtest-diagnostic.ts

interface DiagnosticResults {
  identifiableAccuracy: number;
  anonymizedAccuracy: number;
  preCutoffAccuracy: number;
  postCutoffAccuracy: number;
  partyLineBaseline: number;

  leakageIndicator: number;  // (identifiable - anonymized) / identifiable
  valueAddOverBaseline: number;  // accuracy - partyLineBaseline
}

// If leakageIndicator > 0.10, significant leakage detected
// If valueAddOverBaseline < 0.05, model provides minimal value
```

---

*Analysis completed: 2026-02-03*
*Status: Awaiting diagnostic implementation*
