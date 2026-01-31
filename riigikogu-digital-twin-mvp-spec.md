# Riigikogu Digital Twin MVP
## Project Specification for Claude Code Development

**Version:** 1.0  
**Date:** January 30, 2026  
**Prototype MP:** Tõnis Lukas (Isamaa)

---

## 1. Executive Summary

This project creates a "digital twin" of Estonian MP Tõnis Lukas—an LLM-powered system that predicts how he would vote on proposed legislation and articulates the reasoning behind that vote. The MVP targets MPs themselves as users, providing a suite of AI tools to analyze bills and understand voting dynamics.

**Core MVP Deliverable:** A web application where users can input bill text and receive a predicted vote (For/Against/Abstain) with reasoning, based on Tõnis Lukas's historical voting record, speeches, and political positions.

---

## 2. Background

### 2.1 The Estonian Parliament (Riigikogu)

The Riigikogu is Estonia's 101-member unicameral parliament. The current composition is the XV Riigikogu (15th convocation), elected in March 2023. All plenary sessions and committee meetings are stenogrammed and made publicly available through official channels.

### 2.2 Target MP: Tõnis Lukas

| Attribute | Value |
|-----------|-------|
| Full Name | Tõnis Lukas |
| UUID | `9a8a55b8-c946-47a2-9e17-9978c3fd23f8` |
| Party | Isamaa (conservative) |
| Current Role | XV Riigikogu member, Deputy Chair of Cultural Affairs Committee |
| Previous Roles | Minister of Education (1999-2002, 2007-2011, 2022-2023), Minister of Culture (2019-2021), Mayor of Tartu (1996-1997) |
| Electoral District | District 10 (Tartu) |
| Riigikogu Profile | https://www.riigikogu.ee/en/parliament-of-estonia/composition/members-riigikogu/saadik/9a8a55b8-c946-47a2-9e17-9978c3fd23f8/ |

**Why Tõnis Lukas?** He has an extensive parliamentary record spanning multiple Riigikogu compositions (8th, 9th, 10th, 11th, 12th, and 15th), providing substantial training data. His positions on education, culture, and national identity are well-documented through speeches, articles, and voting records.

---

## 3. Data Sources

### 3.1 Primary: Riigikogu Open Data API

**Base URL:** `https://api.riigikogu.ee`  
**Documentation:** https://api.riigikogu.ee/swagger-ui/index.html  
**Format:** JSON  
**License:** Creative Commons 3.0 BY-SA

#### Key Endpoints

| Endpoint | Description | Usage |
|----------|-------------|-------|
| `/api/votings?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | List votes in date range | Get all votes to find those with Lukas |
| `/api/votings/{uuid}` | Detailed vote breakdown by MP | Get Lukas's individual vote on each item |
| `/api/documents/{uuid}` | Bill/document metadata | Get bill text and explanatory memoranda |
| `/api/factions` | Parliamentary group data | Context for party-line voting |
| `/api/members/{uuid}` | MP biographical data | Profile information |

**Important Notes:**
- Data before 2012 may be incomplete
- File downloads are not available through API (use web scraping for documents)
- UUIDs are used as identifiers throughout

#### Example: Fetching Voting Data

```bash
# Get all votes from January 2024
curl "https://api.riigikogu.ee/api/votings?startDate=2024-01-01&endDate=2024-01-31&lang=et"

# Get detailed breakdown for a specific vote
curl "https://api.riigikogu.ee/api/votings/{voting-uuid}?lang=et"
```

### 3.2 Stenograms (Verbatim Records)

**URL:** https://stenogrammid.riigikogu.ee  
**Content:** Full transcripts of plenary sessions with speaker identification  
**Search:** By date, speaker name, or keyword  
**Format:** HTML (requires parsing)

The stenograms contain Tõnis Lukas's speeches, questions, and debate contributions—critical for understanding his reasoning and rhetorical style.

### 3.3 Additional Sources

| Source | URL | Content |
|--------|-----|---------|
| Riigikogu Statistics | https://riigikogustatistika.ee | Aggregated voting statistics, attendance |
| Riigi Teataja | https://www.riigiteataja.ee | Official gazette with final law texts |
| Party Platform | https://isamaa.ee | Isamaa party positions and programs |
| News Archives | ERR, Postimees | Lukas's public statements and interviews |

---

## 4. Data Model

### 4.1 Core Entities

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Bill     │────▶│   Voting    │◀────│     MP      │
│  (eelnõu)   │     │  Session    │     │  (saadik)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                  │                    │
       ▼                  ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Bill Text   │     │   Vote      │     │  Speeches   │
│ Explanatory │     │ (for/against│     │ (stenogram) │
│ Memorandum  │     │  /abstain)  │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 4.2 Digital Twin Data Structure

```typescript
interface DigitalTwinState {
  // Identity
  mpId: string;              // UUID
  mpName: string;
  party: string;
  temporalCutoff: Date;      // Knowledge cutoff for backtesting
  
  // Training Data
  votingHistory: VoteRecord[];
  speeches: Speech[];
  partyPositions: PartyPosition[];
  
  // Model Artifacts
  embeddingsIndex: VectorStore;
  reasoningExamples: Example[];
}

interface VoteRecord {
  votingId: string;
  billId: string;
  billTitle: string;
  billSummary: string;
  date: Date;
  vote: 'FOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT';
  relatedSpeeches: string[];  // Speech IDs where MP discussed this bill
}

interface Speech {
  id: string;
  date: Date;
  sessionType: 'PLENARY' | 'COMMITTEE';
  topic: string;
  fullText: string;
  relatedBillIds: string[];
}
```

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Application                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Bill      │  │  Prediction │  │    Evaluation       │  │
│  │   Input     │  │   Display   │  │    Dashboard        │  │
│  └──────┬──────┘  └──────▲──────┘  └──────────▲──────────┘  │
└─────────┼────────────────┼───────────────────┼──────────────┘
          │                │                   │
          ▼                │                   │
┌─────────────────────────────────────────────────────────────┐
│                       API Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  /predict   │  │  /evaluate  │  │  /twin/configure    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼───────────────────┼──────────────┘
          │                │                   │
          ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prediction Engine                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              RAG + LLM Pipeline                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │    │
│  │  │ Retrieve│─▶│ Augment │─▶│ Generate│─▶│ Format │ │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ▲                                   │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Vector Database (Embeddings)            │    │
│  │  • Voting history with bill context                  │    │
│  │  • Speeches and statements                           │    │
│  │  • Party positions                                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          ▲
          │
┌─────────────────────────────────────────────────────────────┐
│                    Data Pipeline                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Riigikogu  │  │  Stenogram  │  │     External        │  │
│  │     API     │  │   Scraper   │  │     Sources         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Proposed Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14 + TypeScript | Server components, fast iteration, good DX |
| **UI Components** | shadcn/ui + Tailwind | Clean, accessible, customizable |
| **Backend** | Next.js API Routes | Unified codebase, serverless-ready |
| **Database** | PostgreSQL (Supabase) | Relational data + pgvector for embeddings |
| **Vector Store** | pgvector extension | Integrated with PostgreSQL, no separate service |
| **LLM** | Claude API (Sonnet 4) | Best reasoning capabilities |
| **Embeddings** | Voyage AI or OpenAI | Multilingual support (Estonian/English) |
| **Data Fetching** | Node.js scripts | ETL for Riigikogu API |
| **Deployment** | Vercel | Zero-config Next.js hosting |

---

## 6. Core Features (MVP Scope)

### 6.1 Vote Prediction

**Input:** Bill text (Estonian), optionally with explanatory memorandum  
**Output:** Predicted vote (FOR/AGAINST/ABSTAIN) + confidence score + reasoning

**Prediction Pipeline:**

1. **Parse & Embed Bill** — Extract key provisions, embed for similarity search
2. **Retrieve Context** — Find similar past votes, related speeches, party positions
3. **Generate Prediction** — LLM reasons through the evidence to predict vote
4. **Explain Reasoning** — Cite specific historical votes and statements

**Example Output:**

```json
{
  "prediction": "FOR",
  "confidence": 0.87,
  "reasoning": "Based on Tõnis Lukas's consistent support for Estonian language 
               education policy (12 votes FOR related bills since 2023) and his 
               speech on 2024-03-15 emphasizing the importance of language 
               requirements in schools, he would likely support this bill 
               strengthening Estonian language teaching in basic schools.",
  "supporting_evidence": [
    {
      "type": "vote",
      "date": "2024-03-20",
      "bill": "Estonian Language Act Amendment (SE 456)",
      "vote": "FOR"
    },
    {
      "type": "speech",
      "date": "2024-03-15",
      "excerpt": "Eesti keele rolli peab tugevdama kõigis haridusastmetes..."
    }
  ]
}
```

### 6.2 Temporal Backtesting

**Purpose:** Validate prediction accuracy against actual voting record

**Mechanism:**
1. Set `temporalCutoff` date (e.g., 2025-01-01)
2. Build twin using only pre-cutoff data
3. Test predictions on post-cutoff votes
4. Calculate accuracy, precision, recall

**Evaluation Metrics:**
- **Overall Accuracy:** % of correct vote predictions
- **Confidence Calibration:** Do high-confidence predictions perform better?
- **Category Accuracy:** Performance by bill topic (education, defense, economy, etc.)
- **Party-Line Deviation:** How well does it predict when MP breaks from party?

### 6.3 Web Interface

**Pages:**

| Page | Purpose |
|------|---------|
| `/` | Landing page with project explanation |
| `/predict` | Bill input form + prediction display |
| `/history` | Browse Lukas's voting history with explanations |
| `/evaluate` | Backtesting dashboard with accuracy metrics |
| `/about` | Methodology explanation |

---

## 7. Implementation Roadmap

### Phase 1: Data Infrastructure (Week 1-2)

- [ ] Set up PostgreSQL with pgvector
- [ ] Build Riigikogu API client
- [ ] Create data ingestion scripts for:
  - Voting records (2012-present)
  - Bill metadata and texts
  - MP data
- [ ] Build stenogram scraper for Lukas's speeches
- [ ] Design and implement database schema

**Deliverable:** Populated database with Tõnis Lukas's complete voting and speech history

### Phase 2: Core Prediction Engine (Week 3-4)

- [ ] Implement embedding pipeline (bills, speeches, votes)
- [ ] Build RAG retrieval system
- [ ] Design and iterate on prediction prompt
- [ ] Create vote prediction API endpoint
- [ ] Implement confidence scoring

**Deliverable:** Working `/api/predict` endpoint

### Phase 3: Evaluation System (Week 5)

- [ ] Implement temporal train/test split
- [ ] Build backtesting pipeline
- [ ] Calculate accuracy metrics
- [ ] Create evaluation dashboard

**Deliverable:** Accuracy metrics and insights on model performance

### Phase 4: Web Application (Week 6-7)

- [ ] Set up Next.js project structure
- [ ] Build prediction UI with form and results display
- [ ] Create voting history browser
- [ ] Build evaluation dashboard
- [ ] Add authentication (if needed for MP access)

**Deliverable:** Deployed web application

### Phase 5: Polish & Documentation (Week 8)

- [ ] User testing with target audience
- [ ] Performance optimization
- [ ] Write documentation
- [ ] Prepare demo materials

**Deliverable:** Production-ready MVP

---

## 8. API Specification

### 8.1 Prediction Endpoint

```
POST /api/predict
```

**Request Body:**
```json
{
  "billText": "string (required) - Full bill text in Estonian",
  "billTitle": "string (optional) - Bill title",
  "explanatoryMemo": "string (optional) - Seletuskiri text",
  "temporalCutoff": "ISO date (optional) - For backtesting"
}
```

**Response:**
```json
{
  "prediction": "FOR" | "AGAINST" | "ABSTAIN",
  "confidence": 0.0-1.0,
  "reasoning": "string - Explanation of prediction",
  "supportingEvidence": [
    {
      "type": "vote" | "speech" | "party_position",
      "date": "ISO date",
      "reference": "string - Bill number or speech ID",
      "excerpt": "string - Relevant quote",
      "similarity": 0.0-1.0
    }
  ],
  "partyPosition": "FOR" | "AGAINST" | "MIXED" | "UNKNOWN",
  "processingTime": "number - milliseconds"
}
```

### 8.2 Evaluation Endpoint

```
GET /api/evaluate?cutoffDate=YYYY-MM-DD
```

**Response:**
```json
{
  "cutoffDate": "ISO date",
  "testSetSize": "number",
  "accuracy": 0.0-1.0,
  "metrics": {
    "precision": { "FOR": 0.0-1.0, "AGAINST": 0.0-1.0, "ABSTAIN": 0.0-1.0 },
    "recall": { "FOR": 0.0-1.0, "AGAINST": 0.0-1.0, "ABSTAIN": 0.0-1.0 },
    "f1": { "FOR": 0.0-1.0, "AGAINST": 0.0-1.0, "ABSTAIN": 0.0-1.0 }
  },
  "confusionMatrix": [[number]],
  "confidenceCalibration": [
    { "bucket": "0.9-1.0", "accuracy": 0.0-1.0, "count": number }
  ],
  "categoryBreakdown": [
    { "category": "education", "accuracy": 0.0-1.0, "count": number }
  ]
}
```

---

## 9. Data Collection Scripts

### 9.1 Voting History Collector

```python
# scripts/collect_votes.py
"""
Collects all votes involving Tõnis Lukas from the Riigikogu API.
Requires: requests, python-dateutil

Usage: python collect_votes.py --start-date 2012-01-01 --end-date 2026-01-30 --output votes.json
"""

import requests
from datetime import datetime, timedelta

LUKAS_UUID = "9a8a55b8-c946-47a2-9e17-9978c3fd23f8"
BASE_URL = "https://api.riigikogu.ee/api"

def get_votings_in_range(start_date: str, end_date: str):
    """Fetch all voting sessions in a date range."""
    url = f"{BASE_URL}/votings"
    params = {"startDate": start_date, "endDate": end_date, "lang": "et"}
    response = requests.get(url, params=params)
    return response.json()

def get_voting_details(voting_uuid: str):
    """Fetch individual vote breakdown for a voting session."""
    url = f"{BASE_URL}/votings/{voting_uuid}"
    params = {"lang": "et"}
    response = requests.get(url, params=params)
    return response.json()

def extract_lukas_vote(voting_details):
    """Extract Tõnis Lukas's vote from voting details."""
    for vote in voting_details.get("votes", []):
        if vote.get("memberUuid") == LUKAS_UUID:
            return vote.get("decision")  # "FOR", "AGAINST", "ABSTAIN", "ABSENT"
    return None
```

### 9.2 Stenogram Scraper

```python
# scripts/scrape_stenograms.py
"""
Scrapes verbatim records (stenograms) featuring Tõnis Lukas.
Extracts his speeches and links them to related bills.

Usage: python scrape_stenograms.py --output speeches.json
"""

import requests
from bs4 import BeautifulSoup

STENOGRAM_SEARCH_URL = "https://stenogrammid.riigikogu.ee/et"

def search_speeches_by_speaker(speaker_name: str):
    """Search stenograms for a specific speaker."""
    # Implementation depends on stenogram site structure
    pass

def extract_speech_text(session_url: str, speaker_name: str):
    """Extract the speaker's contributions from a session transcript."""
    pass
```

---

## 10. Prompt Engineering

### 10.1 System Prompt for Vote Prediction

```
You are a digital twin of Tõnis Lukas, an Estonian politician from the Isamaa 
(conservative) party. You have been a Member of Parliament across multiple 
Riigikogu compositions and served as Minister of Education (1999-2002, 2007-2011, 
2022-2023) and Minister of Culture (2019-2021).

Your core values and positions include:
- Strong support for Estonian language and cultural preservation
- Conservative approach to education policy
- National security and defense awareness
- Traditional values balanced with pragmatic governance
- Regional development (especially Tartu region)

When predicting how you would vote on a bill:
1. Analyze the bill's provisions against your historical voting patterns
2. Consider your party's (Isamaa) general position on similar matters
3. Weigh any personal expertise you have (education, culture, history)
4. If the bill conflicts with your values, vote AGAINST
5. If it aligns with your values or is party-supported routine legislation, vote FOR
6. Only ABSTAIN if there are genuinely conflicting considerations

Always explain your reasoning by citing specific past votes, speeches, or 
positions that inform this decision.
```

### 10.2 Few-Shot Examples

Include 3-5 examples of real bills Lukas voted on with reasoning:

```
Example 1:
Bill: Estonian Language Act Amendment (SE 456)
Provisions: Strengthens Estonian language requirements in basic schools
Historical Context: You voted FOR all 12 previous language education bills
Your Speech (2024-03-15): "Eesti keele rolli peab tugevdama..."
Prediction: FOR
Reasoning: This aligns directly with my consistent position on strengthening 
Estonian language education. My voting record shows 100% support for similar 
measures, and I have publicly advocated for exactly these provisions.
```

---

## 11. Evaluation Criteria

### 11.1 Accuracy Targets

| Metric | Target (MVP) | Stretch Goal |
|--------|--------------|--------------|
| Overall Accuracy | 75% | 85% |
| Party-Line Votes | 85% | 95% |
| Deviation Votes | 50% | 70% |
| Confidence Calibration | ±10% | ±5% |

### 11.2 Qualitative Evaluation

- **Reasoning Quality:** Does the explanation accurately cite relevant history?
- **Factual Accuracy:** Are the cited votes and speeches real?
- **Consistency:** Does the twin maintain a coherent political identity?
- **Estonian Language:** Is the reasoning natural in Estonian context?

---

## 12. Future Extensions (Post-MVP)

1. **Multi-MP Support:** Extend to all 101 Riigikogu members
2. **Voting Outcome Prediction:** Predict full vote tally, not just one MP
3. **Coalition Dynamics:** Model inter-party negotiations
4. **Bill Drafting Assistant:** Suggest amendments that would change votes
5. **Real-Time Updates:** Automatically incorporate new voting data
6. **Committee Behavior:** Model less-public committee discussions
7. **Comparison Mode:** "How would MP X vote vs MP Y?"

---

## 13. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| API Rate Limiting | Medium | Implement caching, respect rate limits |
| Incomplete Historical Data | Medium | Focus on post-2012 data; note limitations |
| Language Model Hallucination | High | RAG approach with citation verification |
| Political Sensitivity | High | Clear disclaimers; this is prediction, not endorsement |
| Low Accuracy on Deviation Votes | Medium | Set realistic expectations; focus on typical behavior |
| Estonian Language Nuance | Medium | Use native Estonian sources; test with Estonian speakers |

---

## 14. Success Criteria

The MVP is successful if:

1. ✅ Achieves >75% prediction accuracy on held-out test set (temporal backtest)
2. ✅ Provides factually accurate reasoning citing real votes/speeches
3. ✅ Runs as a functional web application
4. ✅ Processes a typical bill in <10 seconds
5. ✅ Is usable without technical expertise (target: MPs and their staff)

---

## 15. Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with pgvector extension
- Claude API key
- (Optional) Voyage AI or OpenAI API key for embeddings

### Quick Start

```bash
# Clone repository
git clone https://github.com/[your-org]/riigikogu-digital-twin.git
cd riigikogu-digital-twin

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Initialize database
npm run db:setup
npm run db:migrate

# Collect initial data
npm run data:collect-votes
npm run data:collect-speeches

# Generate embeddings
npm run embeddings:generate

# Start development server
npm run dev
```

---

## Appendix A: Riigikogu API Response Examples

### A.1 Voting List Response

```json
{
  "votings": [
    {
      "uuid": "db57ca8d-7fe4-44cb-ab47-a68e46a683d5",
      "title": "Ettepaneku tegemine Vabariigi Valitsusele",
      "date": "2013-01-15T10:00:00",
      "type": "RESOLUTION",
      "result": "PASSED",
      "votesFor": 54,
      "votesAgainst": 32,
      "abstentions": 3
    }
  ]
}
```

### A.2 Voting Detail Response

```json
{
  "uuid": "db57ca8d-7fe4-44cb-ab47-a68e46a683d5",
  "title": "Ettepaneku tegemine Vabariigi Valitsusele",
  "votes": [
    {
      "memberUuid": "9a8a55b8-c946-47a2-9e17-9978c3fd23f8",
      "memberName": "Tõnis Lukas",
      "faction": "Isamaa",
      "decision": "FOR"
    }
  ]
}
```

---

## Appendix B: Key Estonian Political Terms

| Estonian | English | Context |
|----------|---------|---------|
| Riigikogu | Parliament | The 101-member legislature |
| Eelnõu | Bill/Draft | Proposed legislation |
| Seadus | Law | Enacted legislation |
| Fraktsioon | Parliamentary Group | Party group in parliament |
| Täiskogu | Plenary | Full parliamentary session |
| Komisjon | Committee | Standing/select committees |
| Stenogramm | Verbatim Record | Word-for-word transcript |
| Seletuskiri | Explanatory Memorandum | Bill justification document |
| Poolt | For | Vote in favor |
| Vastu | Against | Vote against |
| Erapooletu | Abstain | Abstention |

---

*Document prepared for Claude Code development. Last updated: January 30, 2026*
