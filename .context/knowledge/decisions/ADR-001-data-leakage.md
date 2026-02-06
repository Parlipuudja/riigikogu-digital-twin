# ADR-001: Data Leakage in Accuracy Testing

## Status: Resolved

## Context

Backtesting showed 87.6% accuracy, but this included votes from before Claude's pre-training cutoff (May 2025). The model may have seen these votes during training.

## Decision

- Always test primarily on post-cutoff data
- Report both figures transparently
- Post-cutoff accuracy (73.3%) is the honest number

## Consequence

True predictive accuracy is lower than headline number. This is honest. Improvement efforts target the post-cutoff metric.
