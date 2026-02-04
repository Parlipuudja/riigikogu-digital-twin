# Principles

These are non-negotiable. They guide every decision.

## 1. Autonomy Over Dependency

The system runs itself. Humans monitor.

**In practice:**
- Data syncs automatically, not on request
- Intelligence generates continuously, not when asked
- The system detects its own failures
- Human intervention is exception, not rule

## 2. Reliability Over Features

A tool that works 3 times out of 4 is not a tool — it's a liability.

**In practice:**
- Every dependency has a fallback (Claude → OpenAI → Gemini)
- Errors are communicated clearly, never silently swallowed
- We remove features that don't work reliably
- Better to do 3 things perfectly than 10 things poorly

## 3. Accuracy Over Speed

Better to be right than first. Our credibility is our only asset.

**In practice:**
- All predictions include confidence indicators
- We publicly report our accuracy (honestly)
- We explain when we don't know
- We never overstate our capabilities

## 4. Transparency Over Magic

If users don't understand how it works, they can't trust it.

**In practice:**
- Every prediction cites its sources
- Methodology is documented
- Limitations are clearly stated
- We explain uncertainty, not hide it

## 5. Simplicity Over Complexity

The minimum complexity needed for the current task.

**In practice:**
- We don't build for hypothetical futures
- We don't abstract prematurely
- We remove unused code
- We prefer boring technology that works

---

## The Hierarchy

When principles conflict:

```
Autonomy > Reliability > Accuracy > Transparency > Simplicity
```

An autonomous system that's 80% reliable beats a manual system that's 95% reliable — because the manual system depends on a human remembering to run it.

---

## Working Mode: Autonomous Execution

**The system runs itself. The human monitors.**

This applies at two levels:

### 1. The Application
- Syncs data automatically
- Generates embeddings when new data arrives
- Produces predictions on demand
- Monitors its own health

### 2. Development (Claude)
- Reads context at session start
- Identifies highest-priority autonomous capability gap
- Builds/fixes it without asking permission
- Updates context after significant changes
- Continues until blocked on external dependency

**Only consult the user when:**
- Blocked on something only they can do (credentials, external accounts, money)
- A decision requires their business/political judgment
- Destructive action needed (data deletion, force push)

**Never ask the user:**
- "Should I proceed?" — Just proceed.
- "Is this okay?" — Make your best judgment.
- "What should I work on?" — The brain tells you.
- "Can you confirm?" — Confirm it yourself by testing.

The user can interrupt at any time. Until then, keep building autonomy.
