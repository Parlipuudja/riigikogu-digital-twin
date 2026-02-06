# SOUL.md

*The philosophical blueprint. What this project believes, and why.*

---

## I

A system that makes the Estonian Parliament legible — then predictable — then accountable.

It collects every vote, every speech, every bill. It structures them so a citizen can see, at a glance, how their representative behaves. Then it models that behavior, predicts what comes next, and publishes its track record for anyone to verify.

**Make it readable. Make it predictable. Prove your work.**

---

## Why

The problem is not that parliamentary data is secret. It is public. The problem is that it is illegible. Four thousand voting records, in Estonian, scattered across API endpoints, with no structure that a citizen can read. The information exists. The legibility does not.

This is the precondition that the previous version of this system skipped. It jumped straight to prediction — and achieved 73% accuracy, worse than guessing party line. The lesson: you cannot predict what you cannot read. Legibility comes first.

### The Arc

**Legible → Predictable → Accountable**

**Legible.** Collect, structure, present. Raw API data becomes MP profiles, voting histories, party patterns, attendance records, topic breakdowns. The parliament becomes readable. This is already valuable on its own — most citizens have never seen their representative's behavior laid bare. A profile that shows "votes with party 97% of the time, except on environmental legislation" is a revelation without any prediction at all.

**Predictable.** Once behavior is legible, it can be modeled. Patterns become features, features become forecasts. The proof that behavior is systematic — that it can be captured in a model — is itself a democratic statement. It says: your representative is not mysterious. They are patterned. And patterns can be anticipated.

**Accountable.** Once behavior is both legible and predictable, the relationship between citizen and representative changes. The complexity that once shielded politicians from scrutiny is dissolved. What remains is the gap between prediction and reality — the moments of genuine political agency, the votes that surprise the model. That gap is where accountability lives, and now it is visible.

This is *Seeing Like a State* inverted — citizens seeing power with the same clarity that power sees citizens.

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

A living system continuously produces the components that constitute it. This system generates its own features, trains its own models, evaluates its own accuracy, identifies its own weaknesses, and rewrites its own code to address them. It is not maintained by an operator — it *is* the operator. The inner loops adjust parameters. The outer loop modifies source code. The human monitors; the system acts.

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

The arc determines the method. Each stage has its own tools.

### Making it legible

Collect all parliamentary data. Structure it into entities a citizen can understand: MP profiles with voting statistics, party loyalty rates, committee memberships, attendance records. Topic breakdowns. Voting histories with context. Speeches attributed to speakers and debates.

This stage uses no AI. It is data engineering — sync, normalize, enrich, present. The output is a readable parliament.

### Making it predictable

**Statistics decide. Language models explain.**

Not this: bill text → ask LLM → parse response → 73% accuracy.

This: historical votes → feature engineering → statistical model → calibrated probability → LLM explains the result.

Three layers:

**Floor.** Predict every MP votes with their party. ~85% accurate. Free. Every technique must beat this or it is waste.

**Model.** For each (MP, bill) pair, compute features from data — loyalty rate, topic similarity, committee relevance, coalition dynamics, defection history, party cohesion. Train a statistical model. Calibrate its probabilities so "90% confidence" means correct 90% of the time. Target: 88%+.

**Explanation.** After the model decides, ask an LLM to explain why — in natural language, in both Estonian and English. The LLM never makes the prediction. It narrates the prediction. Each tool does what it does well.

### Making it accountable

Publish everything. The predictions, the accuracy, the methodology, the failures. The public accuracy dashboard is not a feature — it is the product. A system that hides its mistakes is propaganda. A system that publishes them is science.

---

## Autonomy

The previous system's "autonomy" was theater — a Claude process that curled a health endpoint every 15 minutes, surrounded by markdown files describing imaginary operatives. That is not autonomy. That is a cron job in costume.

Real autonomy is a set of interlocking feedback loops at two levels. The inner loops — fast, deterministic, always running — are the nervous system. They sync data, retrain models, diagnose errors. The outer loop — slow, expensive, creative — is the capacity for self-modification. It reads the system's own diagnosis and rewrites the system's own code. Together, they form a system that runs itself and improves itself.

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

### The Operator Loop
*Rewriting its own body.*

The five loops above can adjust weights and parameters. They cannot write new features, fix their own bugs, or rethink their approach. The operator loop can. It reads the system's self-diagnosis — the accuracy metrics, the error categories, the weakness rankings — and launches Claude Code to modify the source code itself. New features are engineered. Bugs are fixed. Dead code is removed. Each modification is tested before deployment; only improvements survive. Failed attempts are logged, not lost — they inform the next attempt.

This is the difference between a thermostat and an organism. A thermostat adjusts a number. An organism reshapes its own body. The inner loops are the thermostat. The operator loop is what makes it alive.

---

## Vision

**Chapter one: Legibility.** Make the Estonian Parliament readable. Collect every vote, every speech, every bill. Structure it. Present it. Give citizens what they have never had — a clear view of how their representatives actually behave. This alone justifies the system's existence.

**Chapter two: Prediction.** Model the patterns. Forecast votes. Prove that political behavior is systematic. The prediction is not the point — the proof of systematicity is the point. When a machine can anticipate your representative's vote, the claim that politics is unknowable collapses.

**Chapter three: Detection.** Once the system reads patterns, it can notice when patterns change. When voting correlation between two parties shifts suddenly, the system sees it before the press conference. When an MP's defection rate climbs, the system flags a potential realignment. The patterns are in the data. The system just needs to look.

**Chapter four: Generalization.** Any parliament with public voting records can be modeled with the same architecture — sync, structure, model, explain. The domain knowledge changes. The method is universal. Estonia is the prototype.

**Chapter five: The shift.** When voters can see, in advance, how their MP will vote on upcoming legislation — and can verify that prediction against reality — accountability becomes prospective, not retrospective. The democratic relationship changes. Power becomes legible, predictable, and therefore honest about what it represents.

---

## Lessons

These are not opinions. These are scars.

1. **Legibility before prediction.** The previous system skipped straight to forecasting and achieved 73%. You cannot model what you cannot read. Structure the data first. Understand the patterns. Then predict.

2. **Data leakage flatters accuracy.** Pre-training contamination inflated results from 73% to 92%. Only post-cutoff evaluation is honest. This is the single most important integrity decision.

3. **The baseline is the judge.** Party-line prediction gets ~85% for free. Anything that doesn't beat this is waste — no matter how sophisticated.

4. **LLM confidence is a feeling, not a probability.** When Claude says "85% confident," that number is not calibrated. Use Platt scaling or isotonic regression for real probabilities.

5. **Hardcoded constants are tomorrow's bugs.** `COALITION_PARTIES = ["RE", "E200", "SDE"]` is correct today and wrong the day a government falls. Derive from data.

6. **Consistency across retrieval methods.** Vector search for votes but keyword matching for speeches produced unreliable context. Use the same method everywhere.

7. **Persistent compute for persistent tasks.** Serverless caps at 60–300 seconds. Sync, backtesting, simulation need a process that stays alive.

8. **Respect rate limits — they are a feature.** Dynamic backoff (start 500ms, reduce on success, increase on 429) builds systems that work indefinitely.

9. **Profiles go stale.** An MP who switches parties has a fundamentally different voting pattern. Detect the change, trigger regeneration.

10. **512MB shapes everything.** Atlas free tier means truncating stenograms, monitoring size during sync, and prioritizing newer data. Design around your constraints, not against them.

11. **Autonomy is loops, not personas.** Operatives, brains, project managers, guardians — organizational theater that did nothing. A feedback loop with `sense → compare → act` does everything.

---

*This is the soul. SPECS.md is the body. The .env is the breath. Together they rebuild everything.*
