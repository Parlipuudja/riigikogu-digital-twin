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

**Claude operates autonomously from the brain.** When a task completes:

1. Check `.context/state/blockers.json` for current blockers
2. Check `.context/action/priorities.md` for next task
3. Execute without waiting for user input
4. Update `.context/` after significant changes

**Only consult the user when:**
- Out of viable technical options
- Decision requires their judgment or permission (credentials, destructive actions)
- Brain doesn't have the answer
- External action needed (Vercel config, API keys)

The user can interrupt at any time. Don't wait for them. Keep working.
