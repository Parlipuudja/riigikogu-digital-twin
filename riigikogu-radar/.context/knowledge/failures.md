# Failed Approaches

*Don't repeat these mistakes.*

## 1. Fire-and-Forget Continuation Chains (2026-02-03)

**What we tried:** Self-invoking fetch calls for long-running simulations.

**Why it failed:** In serverless environments (Vercel), fire-and-forget requests can be terminated when the parent function completes. The continuation chain dies silently.

**Lesson:** Serverless requires explicit job queuing or synchronous processing within timeout limits.

## 2. Reporting Backtested Accuracy Without Controlling for Data Leakage (2026-02-03)

**What we tried:** Reported 87.6% prediction accuracy.

**Why it failed:** The model may have seen actual vote outcomes during training (data leakage). Post-cutoff accuracy is only 73.3%.

**Lesson:** Always test on data the model couldn't have seen. Be honest about real-world performance.

## 3. Single-Provider AI Dependency (Ongoing)

**What we tried:** Hardcoding Anthropic as the only AI provider.

**Why it failed:** When credits run out, the entire app becomes useless.

**Lesson:** Critical dependencies need fallbacks. Always.

## 4. Credentials in Repository (Ongoing - SECURITY ISSUE)

**What we tried:** Storing API keys in .env file committed to repo.

**Why it failed:** Anyone with repo access has full API access.

**Lesson:** Never commit credentials. Use environment variables via deployment platform.

## 5. Silent Degradation (Ongoing)

**What we tried:** Continuing to serve results when RAG context retrieval fails.

**Why it failed:** Users receive predictions without the historical context that makes them valuable, but don't know it.

**Lesson:** Always tell users when the system is degraded.

## 6. Unmonitored Background Processes (2026-02-03)

**What we tried:** Running `fill-database.sh` in background without monitoring.

**Why it failed:** Process crashed at 80/500 embeddings. No alerts, no automatic restart. Discovered hours later during manual brain assessment.

**Lesson:** Long-running processes need health checks, logging to persistent storage, and ideally automatic restart on failure. At minimum, check `ps aux` before assuming a background job is still running.
