```
┌─────────────────────────────────────────────────────────────────┐
│                RIIGIKOGU RADAR - ARCHITECTURE                 │
│                   Auto-generated 2026-02-03                   │
├─────────────────────────────────────────────────────────────────┤
│                                                               │
│  PRESENTATION LAYER (9 pages, 12 components)                  │
│  ├── /about         page                                      │
│  ├── /accuracy      page                                      │
│  ├── /drafts/[uuid] page                                      │
│  ├── /drafts        page                                      │
│  ├── /insights      page                                      │
│  ├── /mps/[slug]    page                                      │
│  └── ... and 15 more                                          │
│                                                               │
│  API LAYER (15 routes)                                        │
│  ├── /api/photos/:uuid                                        │
│  ├── /api/v1/ai-status                                        │
│  ├── /api/v1/drafts                                           │
│  ├── /api/v1/export (2 routes)                                │
│  ├── /api/v1/health                                           │
│                                                               │
│  DOMAIN LAYER (6 modules)                                     │
│  ├── ai/                                                      │
│  ├── data/                                                    │
│  ├── prediction/                                              │
│  ├── simulation/                                              │
│  ├── sync/                                                    │
│  ├── utils/                                                   │
│                                                               │
│  INFRASTRUCTURE                                               │
│  ├── MongoDB Atlas    Document storage                        │
│  ├── Voyage AI        Vector embeddings                       │
│  ├── Claude/OpenAI    AI predictions                          │
│  └── Vercel           Hosting + Edge                          │
│                                                               │
│  STATS: 110 files | 15 API routes | 9 pages                   │
└─────────────────────────────────────────────────────────────────┘
```
