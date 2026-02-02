# Riigikogu Radar

AI-powered parliamentary decision prediction for the Estonian Riigikogu.

## Overview

Riigikogu Radar analyzes historical voting records, speeches, and political positions to predict how Members of Parliament will vote on proposed legislation.

**Internal codename:** Stig Rästa

## Features

- **Vote Prediction**: Predict how individual MPs or the entire parliament will vote
- **MP Report Cards**: Comprehensive profiles with voting history and political positioning
- **Parliament Simulation**: Batch predictions with passage probability calculation
- **Accuracy Tracking**: Public accuracy metrics with rigorous backtesting

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB Atlas with Vector Search
- **AI**: Claude Sonnet 4, Voyage AI (embeddings)
- **Styling**: Tailwind CSS
- **i18n**: next-intl (Estonian/English)

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Run development server
npm run dev
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [locale]/          # i18n pages
│   └── api/v1/            # API routes
├── components/
│   ├── ui/                # Base components
│   ├── data/              # Data display (badges, charts)
│   ├── layout/            # Header, footer, nav
│   └── forms/             # Input forms
├── lib/
│   ├── ai/                # Claude, Voyage integrations
│   ├── data/              # Database queries
│   ├── prediction/        # Prediction engine
│   └── analysis/          # Analytics features
├── types/                 # TypeScript types
└── i18n/                  # Translations
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `VOYAGE_API_KEY` | Voyage AI API key |

## License

Confidential. All rights reserved.
