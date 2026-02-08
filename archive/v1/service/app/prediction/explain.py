"""
LLM explanation generation.

After the model predicts, ask Claude Haiku to explain why.
The LLM never makes the prediction. It narrates the prediction.
Each tool does what it does well.
"""

import logging

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)


async def generate_explanation(
    mp_name: str,
    party: str,
    prediction: str,
    confidence: float,
    features: list[dict],
    bill_title: str,
) -> dict | None:
    """
    Generate bilingual explanation for a prediction.

    Returns {"et": "...", "en": "..."} or None on failure.
    """
    # Build feature context
    feature_lines = []
    for f in features[:5]:  # Top 5 features
        feature_lines.append(f"- {f['name']}: {f.get('value', 'N/A')}")
    feature_text = "\n".join(feature_lines) if feature_lines else "No feature data"

    prompt = f"""MP {mp_name} ({party}) is predicted to vote {prediction} on "{bill_title}" with {confidence:.0%} confidence.

Key factors:
{feature_text}

Explain this prediction in 2-3 sentences. Be specific about which factors matter most.
Provide your response in this exact format:
ET: [Estonian explanation]
EN: [English explanation]"""

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()

        # Parse bilingual response
        et_text = ""
        en_text = ""
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("ET:"):
                et_text = line[3:].strip()
            elif line.startswith("EN:"):
                en_text = line[3:].strip()

        if not et_text and not en_text:
            # Fallback: use full text as English
            en_text = text
            et_text = text

        return {"et": et_text, "en": en_text}

    except Exception as e:
        logger.error(f"Explanation generation failed: {e}")
        return None
