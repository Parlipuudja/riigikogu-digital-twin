# SOUL.md

*The philosophical blueprint. What this project believes, and why.*

---

## I

A system that makes power predictable — and therefore accountable.

It watches the Estonian Parliament. It learns how each of the 101 members behaves — not what they say, but what they do. It predicts what they will do next, explains why, and publishes its track record for anyone to verify.

**Given a bill, predict each MP's vote, explain the prediction, prove your accuracy.**

---

## Why

Parliamentary democracy depends on a fiction: that citizens hold their representatives accountable. In practice, no citizen reads 4,000 voting records. No one tracks which MP breaks rank on environmental legislation or rubber-stamps every defense budget. The information is public but effectively invisible.

This system makes the invisible visible. It inverts the relationship between power and observation: instead of the state watching citizens, citizens watch the state. Not through opinion or ideology, but through pattern — here is what your representative did, here is the model, here is what they will likely do next.

The prediction is not the product. The product is the proof that political behavior is systematic, modelable, and therefore subject to scrutiny. When a machine can predict your representative's vote with 90% accuracy, the mystery evaporates. What remains is accountability.

---

## Principles

### Do one thing well
*Unix — McIlroy, 1978*

The sync process syncs. The model predicts. The explainer explains. The server serves. They compose through clean interfaces — the output of one becomes the input of the next. A program that does one thing well is a program you can trust. A system of such programs is a system you can reason about.

### Silence is the default
*Unix — Rule of Silence*

When a program has nothing surprising to report, it says nothing. Health is not an event. Alert on anomaly, not normalcy. A system that narrates its own functioning drowns signal in noise.

### Fail noisily, fail early
*Unix — Rule of Repair*

Silent failures compound into catastrophes. When something breaks, it breaks loudly and immediately — what failed, why, what is needed to recover. The system does not paper over errors, retry silently, or hope things resolve themselves.

### Prototype, then iterate
*Unix — Rule of Optimization*

Get it working before making it elegant. A logistic regression that ships today beats an ensemble that ships next month. Measure, then optimize what you measured — never what you imagine.

### Sense, compare, act
*Cybernetics — Wiener, 1948*

The feedback loop is the atom of intelligence. Sense the world (collect data). Form expectations (predict). Compare against reality (backtest). Act on the difference (retrain, adjust). A system without this loop is a clock. A system with it learns.

### Match the variety of what you model
*Ashby's Law of Requisite Variety, 1956*

A model must be complex enough to capture the phenomenon — and no more. One that knows only party affiliation cannot predict cross-party votes. One that knows a thousand features overfits noise. The art is matching the model's variety to the world's variety. Not less. Not wildly more.

### Optimize for surprise
*Information Theory — Shannon, 1948*

A prediction that says "loyal MP votes with party" carries zero information — everyone already knows this. The value of a prediction is proportional to its surprise. Predicting a defection is information. Predicting party-line is noise. The 85% of votes that follow party are easy and boring. The 15% of defections, splits, and free votes are where this system earns its existence.

### Every prediction is a bet against reality
*Falsificationism — Popper, 1934*

A prediction that cannot be wrong is worthless. Publish every prediction. Timestamp it. Wait for reality. Compare. Report the results — honestly, always, no exceptions. The previous incarnation showed 91.7% accuracy; honest measurement revealed 73.3%. That was the most important discovery in the project's history.

### The system produces itself
*Autopoiesis — Maturana & Varela, 1972*

A living system continuously produces the components that constitute it. This system generates its own features, trains its own models, evaluates its own accuracy, identifies its own weaknesses, and plans its own next improvement. It is not maintained by an operator. It maintains itself. The human monitors; the system acts.

### Gain from disorder
*Antifragility — Taleb, 2012*

The system does not merely survive failure — it metabolizes failure into strength. Every wrong prediction is a labeled training example. Every crash reveals a missing resilience pattern. Every edge case becomes a test case. Stress is not damage. Stress is nutrition.

### Start with nothing. Complexify only when forced.
*Occam's Razor*

A party-line heuristic at 85% is better than an LLM prompt at 73%. Add machinery only when simplicity fails measurably. The previous system had operatives, a brain, a project manager persona, a guardian, a context directory tree. None of it did anything. A well-designed feedback loop outperforms any amount of organizational theater.

---

## The Domain

101 members of the **Riigikogu** (Estonian Parliament), elected by proportional representation, organized into **factions** that map to parties. The **XV Riigikogu** began April 6, 2023.

Coalition composition changes — governments fall, parties realign. Any code that hardcodes which parties are in the coalition is broken the moment this happens. Derive coalition status from voting correlation patterns. Always.

Votes are **FOR**, **AGAINST**, **ABSTAIN**, or **ABSENT**. Simple majority is 51 votes; constitutional majority is 68. Approximately 85% of votes follow party line. The remaining 15% — defections, splits, free votes — are where prediction has value and difficulty.

The **Riigikogu API** provides everything: voting records with individual decisions, stenograms with speaker attribution, draft legislation with initiators and status, MP profiles with faction and committee data. Public data. Estonian language. Rate-limited — respect it.

---

## The Method

**Statistics decide. Language models explain.**

Not this: bill text → ask LLM → parse response → 73% accuracy.

This: historical votes → feature engineering → statistical model → calibrated probability → LLM explains the result.

Three layers:

**Floor.** Predict every MP votes with their party. ~85% accurate. Free. Every technique must beat this or it is waste.

**Model.** For each (MP, bill) pair, compute features from data — loyalty rate, topic similarity, committee relevance, coalition dynamics, defection history, party cohesion. Train a statistical model. Calibrate its probabilities so "90% confidence" means correct 90% of the time. Target: 88%+.

**Explanation.** After the model decides, ask an LLM to explain why — in natural language, in both Estonian and English. The LLM never makes the prediction. It narrates the prediction. Each tool does what it does well.

---

## Autonomy

The previous system's "autonomy" was theater — a Claude process that curled a health endpoint every 15 minutes, surrounded by markdown files describing imaginary operatives. That is not autonomy. That is a cron job in costume.

Real autonomy is a set of interlocking feedback loops. Each loop senses, compares, acts, and senses again. Together, they form a system that runs itself.

### The Metabolic Loop
*Keeping the organism fed.*

Data flows in from the Riigikogu API on schedule. On failure: retry with exponential backoff. On crash: resume from the last checkpoint. The database size is monitored against its limits. Embeddings are generated for new data. No human intervention required for normal operation.

### The Learning Loop
*Getting smarter from experience.*

Every prediction is logged with its timestamp, features, confidence, and model version. When the actual vote happens, the system resolves the prediction — correct or incorrect. Accuracy is tracked per MP, per party, per vote type, per topic. The model retrains periodically on the growing dataset. If the new model outperforms the old one on held-out data, it replaces it. If not, the old model survives. Evolution by selection.

### The Diagnostic Loop
*Understanding its own failures.*

When predictions fail, they are categorized: Was it a free vote where no party whip applied? A party split where the faction was divided? A stale MP profile that missed a shift in behavior? A new political alignment not yet reflected in the data? Each category implies a different correction. The system diagnoses before it treats.

### The Planning Loop
*Knowing where to look next.*

After each backtest cycle, the system identifies its weakest areas — the MPs it predicts worst, the vote types where accuracy drops, the features that contribute least. These become the priorities for the next improvement cycle. The system maintains a model of its own performance and directs its own development. It doesn't just execute a schedule. It reasons about what would make it better.

### The Pruning Loop
*Staying lean.*

Expired caches are purged by TTL indexes. Stale MP profiles are flagged when accuracy for that MP drops below threshold. Obsolete model versions are replaced only after the replacement proves superior on holdout data. Features with near-zero importance are candidates for removal. The system does not accumulate cruft. What is no longer useful is removed. What is no longer accurate is replaced.

---

## Vision

This is chapter one: predict votes in the Estonian Parliament.

Chapter two: detect political realignment before it is announced. When voting correlation between two parties shifts suddenly, the system notices before the press conference. When an MP's defection rate climbs, the system flags a potential party switch. The patterns are in the data. The system just needs to look.

Chapter three: generalize. Any parliament with public voting records can be modeled with the same architecture — sync, features, model, explain. The domain knowledge changes. The method is universal. Estonia is the prototype.

Chapter four: change the relationship between citizens and their representatives. When voters can see, in advance, how their MP will vote on upcoming legislation, accountability shifts from retrospective to prospective. Representatives become predictable — and therefore honest about what they represent.

---

## Lessons

These are not opinions. These are scars.

1. **Data leakage flatters accuracy.** Pre-training contamination inflated results from 73% to 92%. Only post-cutoff evaluation is honest. This is the single most important integrity decision.

2. **The baseline is the judge.** Party-line prediction gets ~85% for free. Anything that doesn't beat this is waste — no matter how sophisticated.

3. **LLM confidence is a feeling, not a probability.** When Claude says "85% confident," that number is not calibrated. Use Platt scaling or isotonic regression for real probabilities.

4. **Hardcoded constants are tomorrow's bugs.** `COALITION_PARTIES = ["RE", "E200", "SDE"]` is correct today and wrong the day a government falls. Derive from data.

5. **Consistency across retrieval methods.** Vector search for votes but keyword matching for speeches produced unreliable context. Use the same method everywhere.

6. **Persistent compute for persistent tasks.** Serverless caps at 60–300 seconds. Sync, backtesting, simulation need a process that stays alive.

7. **Respect rate limits — they are a feature.** Dynamic backoff (start 500ms, reduce on success, increase on 429) builds systems that work indefinitely.

8. **Profiles go stale.** An MP who switches parties has a fundamentally different voting pattern. Detect the change, trigger regeneration.

9. **512MB shapes everything.** Atlas free tier means truncating stenograms, monitoring size during sync, and prioritizing newer data. Design around your constraints, not against them.

10. **Autonomy is loops, not personas.** Operatives, brains, project managers, guardians — organizational theater that did nothing. A feedback loop with `sense → compare → act` does everything.

---

*This is the soul. SPECS.md is the body. The .env is the breath. Together they rebuild everything.*
