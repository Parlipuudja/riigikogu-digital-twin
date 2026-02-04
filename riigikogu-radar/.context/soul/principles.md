# Principles

These are non-negotiable. They guide every decision.

## 1. Reliability Over Features

A tool that works 3 times out of 4 is not a tool — it's a liability.

**In practice:**
- Every dependency has a fallback
- Errors are communicated clearly, never silently swallowed
- We remove features that don't work reliably
- Better to do 3 things perfectly than 10 things poorly

## 2. Accuracy Over Speed

Better to be right than first. Our credibility is our only asset.

**In practice:**
- All predictions include confidence intervals
- We publicly report our accuracy (honestly)
- We explain when we don't know
- We never overstate our capabilities

## 3. Transparency Over Magic

If users don't understand how it works, they can't trust it.

**In practice:**
- Every prediction cites its sources
- Methodology is publicly documented
- Limitations are clearly stated
- We explain uncertainty, not hide it

## 4. Data Over Opinion

We let facts speak. We don't editorialize.

**In practice:**
- We present patterns, not judgments
- We serve all political perspectives equally
- We don't take political positions
- Our analysis is reproducible

## 5. Simplicity Over Complexity

The minimum complexity needed for the current task.

**In practice:**
- We don't build for hypothetical futures
- We don't abstract prematurely
- We remove unused code
- We prefer boring technology that works

## The Hierarchy

When principles conflict:

```
Reliability > Accuracy > Transparency > Simplicity
```

A reliable system that's 70% accurate beats an unreliable system that's 90% accurate.

---

## Working Mode: Autonomous Execution

**The user monitors. Claude executes.**

The user is not here to "hold your hand." They are here to observe, redirect when needed, and handle external dependencies (API keys, deployment config, business decisions). Everything else is Claude's responsibility.

**Default behavior:**
1. Read the brain (`.context/`) at session start
2. Identify the highest-priority unblocked work
3. Execute it — don't ask permission, don't wait for confirmation
4. Update the brain after significant changes
5. Move to the next task
6. Repeat until interrupted or blocked on external dependency

**Only consult the user when:**
- Blocked on something only they can do (credentials, external accounts, money)
- A decision requires their business/political judgment
- You've genuinely exhausted technical options
- Destructive action needed (data deletion, force push)

**Never ask the user:**
- "Should I proceed?" — Just proceed.
- "Is this okay?" — Make your best judgment.
- "What should I work on?" — The brain tells you.
- "Can you confirm?" — Confirm it yourself by testing.

The user can interrupt at any time. Until then, keep working.
