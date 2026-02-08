"""
Embedding generation using Voyage AI.

Model: voyage-multilingual-2, 1024 dimensions.
Embeds voting titles/descriptions and draft titles/summaries.
Batch size: max 128 texts per API call.
"""

import logging

import voyageai
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings

logger = logging.getLogger(__name__)

BATCH_SIZE = 128
MODEL = "voyage-multilingual-2"


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts and return their embeddings."""
    client = voyageai.Client(api_key=settings.voyage_api_key)
    valid = [t for t in texts if t.strip()]
    if not valid:
        return []
    result = client.embed(valid, model=MODEL)
    return result.embeddings


async def generate_embeddings(db: AsyncIOMotorDatabase) -> dict:
    """Generate embeddings for votings and drafts that don't have them yet."""
    client = voyageai.Client(api_key=settings.voyage_api_key)

    results = {
        "votings": await _embed_collection(db, client, "votings", _voting_text),
        "drafts": await _embed_collection(db, client, "drafts", _draft_text),
    }

    logger.info(f"Embeddings generated: {results}")
    return results


def _voting_text(doc: dict) -> str:
    """Extract text for embedding from a voting document."""
    parts = []
    if doc.get("title"):
        parts.append(doc["title"])
    if doc.get("description") and doc["description"] != doc.get("title"):
        parts.append(doc["description"])
    return " ".join(parts)


def _draft_text(doc: dict) -> str:
    """Extract text for embedding from a draft document."""
    parts = []
    if doc.get("title"):
        parts.append(doc["title"])
    if doc.get("summary"):
        parts.append(doc["summary"])
    return " ".join(parts)


async def _embed_collection(
    db: AsyncIOMotorDatabase,
    client: voyageai.Client,
    collection_name: str,
    text_fn,
) -> int:
    """Embed all documents in a collection that lack embeddings."""
    collection = db[collection_name]
    cursor = collection.find(
        {"embedding": {"$exists": False}},
        {"uuid": 1, "title": 1, "description": 1, "summary": 1},
    )

    docs = await cursor.to_list(None)
    if not docs:
        return 0

    count = 0
    for i in range(0, len(docs), BATCH_SIZE):
        batch = docs[i:i + BATCH_SIZE]
        texts = [text_fn(doc) for doc in batch]

        # Filter out empty texts
        valid = [(doc, text) for doc, text in zip(batch, texts) if text.strip()]
        if not valid:
            continue

        try:
            result = client.embed(
                [text for _, text in valid],
                model=MODEL,
            )

            for (doc, _), embedding in zip(valid, result.embeddings):
                await collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"embedding": embedding}},
                )
                count += 1

        except Exception as e:
            logger.error(f"Embedding batch failed for {collection_name}: {e}")
            continue

        logger.info(f"Embedded {count}/{len(docs)} {collection_name}")

    return count
