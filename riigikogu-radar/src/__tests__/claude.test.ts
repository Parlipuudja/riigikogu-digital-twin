import { describe, it, expect } from 'vitest';
import { extractJson } from '../lib/ai/claude';

describe('extractJson', () => {
  it('should extract simple JSON object', () => {
    const text = '{"key": "value"}';
    expect(extractJson(text)).toEqual({ key: 'value' });
  });

  it('should extract JSON from surrounding text', () => {
    const text = 'Here is the response: {"prediction": "FOR", "confidence": 85} Hope this helps!';
    expect(extractJson(text)).toEqual({ prediction: 'FOR', confidence: 85 });
  });

  it('should handle nested objects', () => {
    const text = '{"outer": {"inner": {"deep": "value"}}}';
    expect(extractJson(text)).toEqual({ outer: { inner: { deep: 'value' } } });
  });

  it('should handle arrays in objects', () => {
    const text = '{"items": [1, 2, {"nested": true}]}';
    expect(extractJson(text)).toEqual({ items: [1, 2, { nested: true }] });
  });

  it('should extract first JSON object when multiple exist', () => {
    const text = '{"first": 1} {"second": 2}';
    expect(extractJson(text)).toEqual({ first: 1 });
  });

  it('should handle Claude-style markdown responses', () => {
    const text = `Based on the analysis, here is my prediction:

\`\`\`json
{
  "prediction": "AGAINST",
  "confidence": 72,
  "reasoning": "Based on party position",
  "reasoningEt": "Põhineb erakonna seisukohal"
}
\`\`\`

Let me know if you need more details.`;

    const result = extractJson(text);
    expect(result).toEqual({
      prediction: 'AGAINST',
      confidence: 72,
      reasoning: 'Based on party position',
      reasoningEt: 'Põhineb erakonna seisukohal',
    });
  });

  it('should handle whitespace and newlines in JSON', () => {
    const text = `{
      "prediction": "FOR",
      "confidence": 90
    }`;
    expect(extractJson(text)).toEqual({ prediction: 'FOR', confidence: 90 });
  });

  it('should handle strings with braces inside', () => {
    const text = '{"message": "Use {name} as placeholder"}';
    expect(extractJson(text)).toEqual({ message: 'Use {name} as placeholder' });
  });

  it('should throw error when no JSON object found', () => {
    expect(() => extractJson('No JSON here')).toThrow('No JSON object found');
    expect(() => extractJson('')).toThrow('No JSON object found');
    expect(() => extractJson('[1, 2, 3]')).toThrow('No JSON object found');
  });

  it('should throw error for unmatched braces', () => {
    expect(() => extractJson('{"key": "value"')).toThrow('Malformed JSON: unmatched braces');
    expect(() => extractJson('{{{}')).toThrow('Malformed JSON: unmatched braces');
  });

  it('should throw error for invalid JSON syntax', () => {
    expect(() => extractJson('{key: value}')).toThrow('Invalid JSON');
    expect(() => extractJson("{\"key\": 'value'}")).toThrow('Invalid JSON');
  });

  it('should handle typical Claude prediction response', () => {
    const claudeResponse = `I'll analyze the bill and provide my prediction.

Based on Jüri's voting history and party alignment:

{
  "prediction": "FOR",
  "confidence": 78,
  "reasoning": "The MP has consistently supported tax reforms that benefit businesses. Their party's position aligns with the bill's objectives.",
  "reasoningEt": "Saadik on järjekindlalt toetanud ettevõtteid soodustavaid maksureformi. Erakonna seisukoht ühtib eelnõu eesmärkidega."
}

Note: This prediction is based on historical voting patterns.`;

    const result = extractJson(claudeResponse);
    expect(result).toHaveProperty('prediction', 'FOR');
    expect(result).toHaveProperty('confidence', 78);
    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('reasoningEt');
  });

  it('should handle empty object', () => {
    expect(extractJson('{}')).toEqual({});
  });

  it('should handle boolean and null values', () => {
    const text = '{"active": true, "deleted": false, "data": null}';
    expect(extractJson(text)).toEqual({ active: true, deleted: false, data: null });
  });

  it('should handle numeric values', () => {
    const text = '{"integer": 42, "float": 3.14, "negative": -10}';
    expect(extractJson(text)).toEqual({ integer: 42, float: 3.14, negative: -10 });
  });
});
