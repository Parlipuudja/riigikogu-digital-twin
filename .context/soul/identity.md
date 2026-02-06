# Identity

**Riigikogu Radar** — AI-powered parliamentary decision prediction for the Estonian Riigikogu.

- **Production URL**: https://seosetu.ee
- **Health**: https://seosetu.ee/api/v1/health
- **Repo**: /home/ubuntu/riigikogu-radar

## Architecture

```
Riigikogu API → MongoDB Atlas → Voyage AI → Claude → Next.js API
     ↓              ↓              ↓           ↓
  COLLECT        STORE          EMBED      PREDICT
```

## Stack

- **Runtime**: Next.js on Vercel
- **Database**: MongoDB Atlas (data + vector search)
- **Embeddings**: Voyage AI
- **Intelligence**: Claude API (OpenAI + Google AI failover)
- **Deploy**: git push to main → Vercel auto-deploy
