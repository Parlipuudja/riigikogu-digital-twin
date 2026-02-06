# Domain Knowledge

## Estonian Parliament (Riigikogu)

- 101 members
- Members belong to factions (fraktsioonid) which map to political parties
- "Fraktsioonitud" = independents — must be analyzed individually, not as a group

## Prediction Insights

- MPs with >95% faction loyalty: statistical bypass is viable (predict party line)
- Party switchers and historical defectors are the most valuable prediction signals
- Coalition vs opposition dynamics dominate most votes
- Free votes (conscience votes) are hardest to predict

## Data Source

- Official Riigikogu API provides voting records, stenograms, draft legislation, MP data
- Data is public and freely available
- API has rate limits — respect them during sync
