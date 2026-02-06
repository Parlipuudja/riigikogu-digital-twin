# Failures & Lessons

## 1. Fire-and-Forget in Serverless

**Problem**: Background tasks in serverless die silently after response returns.
**Lesson**: All long-running work must complete before response, or use dedicated workers.

## 2. Data Leakage in Accuracy Reporting

**Problem**: Pre-training cutoff votes inflated accuracy (87.6% vs true 73.3%).
**Lesson**: Always test on post-cutoff data. Report honestly. See ADR-001.

## 3. Single AI Provider Dependency

**Problem**: Anthropic API outage = total system failure.
**Lesson**: Failover chain implemented (Claude → OpenAI → Google AI). Set `ENABLE_AI_FAILOVER=true`.

## 4. Credentials in Repo

**Problem**: Secrets committed to git history.
**Lesson**: Environment variables only. Never commit `.env` files.

## 5. Silent Degradation

**Problem**: Features broke without anyone noticing.
**Lesson**: Health checks must report all component status. Guardian operative monitors.

## 6. Unmonitored Background Processes

**Problem**: Long-running processes died without alerts.
**Lesson**: All operatives must log state to MongoDB. Brain checks operative health.
