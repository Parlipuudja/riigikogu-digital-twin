import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
});

const MODEL = 'claude-sonnet-4-20250514';

export interface PredictionInput {
  billTitle: string;
  billDescription: string;
  billFullText?: string;
  category?: string;
  similarVotes: {
    title: string;
    decision: string;
    date: string;
    similarity: number;
  }[];
  relevantSpeeches: {
    topic: string;
    excerpt: string;
    date: string;
    similarity: number;
  }[];
}

export interface PredictionOutput {
  prediction: 'FOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT';
  confidence: number;
  reasoning: string;
  reasoningEt: string;
}

/**
 * Build the prompt for vote prediction
 */
function buildPrompt(input: PredictionInput): string {
  const similarVotesText = input.similarVotes.length > 0
    ? input.similarVotes.map((v, i) =>
        `${i + 1}. "${v.title}" - Voted: ${v.decision} (${v.date}, similarity: ${(v.similarity * 100).toFixed(0)}%)`
      ).join('\n')
    : 'No similar past votes found.';

  const speechesText = input.relevantSpeeches.length > 0
    ? input.relevantSpeeches.map((s, i) =>
        `${i + 1}. Topic: ${s.topic} (${s.date})\n   "${s.excerpt.substring(0, 300)}..."`
      ).join('\n')
    : 'No relevant speeches found.';

  return `You are an AI system that predicts how Estonian Member of Parliament Tõnis Lukas would vote on legislation.

Tõnis Lukas is a member of Isamaa (conservative party). He is known for:
- Strong support for Estonian language and culture
- Conservative family values
- Support for traditional education
- Pro-Estonian sovereignty positions
- Cultural heritage preservation

Based on the following information, predict how he would vote on this bill.

## Bill Information
Title: ${input.billTitle}
Description: ${input.billDescription}
${input.category ? `Category: ${input.category}` : ''}
${input.billFullText ? `\nFull Text (excerpt):\n${input.billFullText.substring(0, 2000)}` : ''}

## Similar Past Votes by Tõnis Lukas
${similarVotesText}

## Relevant Speeches by Tõnis Lukas
${speechesText}

## Instructions
1. Analyze the bill content and context
2. Compare with similar past votes
3. Consider relevant speeches and stated positions
4. Predict the vote: FOR, AGAINST, ABSTAIN, or ABSENT
5. Provide confidence level (0-100%)
6. Explain your reasoning

Respond in JSON format:
{
  "prediction": "FOR" | "AGAINST" | "ABSTAIN" | "ABSENT",
  "confidence": <number 0-100>,
  "reasoning": "<explanation in English>",
  "reasoningEt": "<explanation in Estonian>"
}`;
}

/**
 * Predict vote using Claude
 */
export async function predictVote(input: PredictionInput): Promise<PredictionOutput> {
  const prompt = buildPrompt(input);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract text content
  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from response');
  }

  try {
    const result = JSON.parse(jsonMatch[0]);

    return {
      prediction: result.prediction as PredictionOutput['prediction'],
      confidence: Math.min(100, Math.max(0, result.confidence)),
      reasoning: result.reasoning || 'No reasoning provided',
      reasoningEt: result.reasoningEt || result.reasoning || 'Põhjendus puudub',
    };
  } catch {
    throw new Error('Failed to parse prediction response');
  }
}

/**
 * Simple translation helper using Claude
 */
export async function translateToEstonian(text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Translate the following English text to Estonian. Only respond with the translation, nothing else.\n\n${text}`,
      },
    ],
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return text;
  }

  return textContent.text.trim();
}
