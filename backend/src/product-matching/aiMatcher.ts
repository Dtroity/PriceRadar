import { completeJson } from '../ai/client.js';

export interface AiMatchResult {
  same_product: boolean;
  confidence: number;
}

const MATCH_PROMPT_BASE = `
Determine if two product names refer to the same product.

Ignore:
- packaging (weight, volume, pack size, count)
- language differences
- small wording differences
- formatting and punctuation

Focus on the core product: type, variety, brand and key attributes (like fat content for cheese).

Return JSON only:

{
  "same_product": true,
  "confidence": 92
}
`.trim();

export async function aiMatch(
  nameA: string,
  nameB: string
): Promise<AiMatchResult> {
  const prompt = `${MATCH_PROMPT_BASE}\n\nName A: ${nameA}\nName B: ${nameB}`;
  return completeJson<AiMatchResult>(prompt);
}

