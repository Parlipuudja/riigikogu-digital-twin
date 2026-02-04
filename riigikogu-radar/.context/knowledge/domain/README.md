# Domain Knowledge

*Accumulated understanding of Estonian parliament.*

## Critical: Fraktsioonitud MPs

**"Fraktsioonitud" = non-affiliated MPs (independents)**

These MPs are NOT in a party. They:
- Left their original party or were expelled
- Vote based on individual conviction, not party line
- Cannot be predicted using party-based heuristics
- Require entirely different analysis tools

**Current gap**: System treats "Fraktsioonitud" as a party and calculates "party loyalty" — this is meaningless. A 71% "party loyalty" for an independent just means they voted with other independents 71% of the time, which is coincidental, not disciplined.

**What independents need**:
- Individual historical pattern analysis (not party-based)
- Issue-based clustering (what topics do they care about?)
- Speech analysis to understand their positions
- Comparison with their FORMER party (before they left)
- Network analysis (who do they vote WITH most often?)

## Key Learnings

- MPs with >95% faction loyalty can use statistical bypass
- Stenograms provide speech context for predictions
- Historical voting similarity is strong predictor
- **Fraktsioonitud require individual-level analysis, not party-based**

## Data Quirks

- Riigikogu API returns "Fraktsioonitud" as a faction name
- Some MPs have multiple faction affiliations over time (party switchers)
