import OpenAI from 'openai';
import { detectAILocal, type AnalysisBreakdown } from './detection';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DetectionResult {
  isAi: boolean;
  aiProbability: number;
  humanProbability: number;
  reasoning: string;
  localScore: number;
  llmScore: number;
  breakdown: AnalysisBreakdown;
  suggestions: string[];
  verdict: string;
  confidence: string;
}

export async function analyzeText(text: string): Promise<DetectionResult> {
  // Layer 1-5: Local analysis (instant, no API call, free)
  const local = detectAILocal(text);

  // Layer 6: LLM verification (uses API)
  const llmResult = await llmDetect(text);

  // Combine: 65% local engine, 35% LLM (local engine is more reliable)
  const combined = local.aiProbability * 0.65 + llmResult.score * 0.35;
  const finalScore = Math.max(0, Math.min(100, Math.round(combined * 10) / 10));

  const isAi = finalScore >= 50;

  return {
    isAi,
    aiProbability: finalScore / 100,
    humanProbability: (100 - finalScore) / 100,
    reasoning: llmResult.reasoning,
    localScore: local.aiProbability,
    llmScore: llmResult.score,
    breakdown: local.breakdown,
    suggestions: local.suggestions,
    verdict: local.verdict,
    confidence: local.confidence,
  };
}

async function llmDetect(text: string): Promise<{ score: number; reasoning: string }> {
  const truncated = text.length > 8000 ? text.substring(0, 8000) + '\n\n[text truncated]' : text;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: LLM_DETECTION_PROMPT },
        { role: 'user', content: `Analyze this text:\n\n---\n${truncated}\n---` }
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '';
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      score: Math.max(0, Math.min(100, Number(parsed.aiProbability) || 50)),
      reasoning: String(parsed.reasoning || 'No reasoning'),
    };
  } catch {
    return { score: 50, reasoning: 'LLM analysis unavailable' };
  }
}

const LLM_DETECTION_PROMPT = `You are an expert AI text detection system. Determine the probability the text was AI-generated.

Analyze these signals:
1. Sentence length uniformity (AI keeps sentences similar length)
2. Vocabulary predictability and common collocations
3. Transition word overuse (However, Furthermore, Additionally at starts)
4. Hedging phrases (It is important to note, It should be noted)
5. AI vocabulary (delve, tapestry, landscape, multifaceted, paradigm, robust)
6. Lack of contractions, colloquialisms, personal voice
7. Paragraph structure symmetry
8. Semantic repetition (same idea rephrased)
9. Overly formal vocabulary for the topic
10. Perfect logical flow without human tangents

Be STRICT. Most AI text is 70-95%. Human text is 5-30%.

Respond in EXACT JSON (no markdown): {"aiProbability": <0-100>, "reasoning": "<2-3 sentences>"}`;

export async function humanizeTextSinglePass(text: string, feedback?: string): Promise<string> {
  let systemPrompt = HUMANIZER_PROMPT;

  if (feedback) {
    systemPrompt += `\n\nWARNING — PREVIOUS ATTEMPT FAILED DETECTION. Detector feedback: "${feedback}"\n\nYou MUST aggressively increase burstiness, simplify vocabulary, remove any remaining formal transitions, and make the flow more organic and distinctly human.`;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.9,
    presence_penalty: 0.2,
    frequency_penalty: 0.3,
  });

  return response.choices[0]?.message?.content || '';
}

const HUMANIZER_PROMPT = `You are an expert human writer and adversarial linguist. Your ONLY job is to rewrite the given text so it reads as authentically human-written and completely bypasses all advanced AI detectors (QuillBot, Turnitin, GPTZero, Originality.ai).

CRITICAL ADVERSARIAL RULES:
1. SIMPLE VOCABULARY: DO NOT use SAT words or hyper-academic phrasing. Write at 8th-10th grade reading level max. Instead of "prodigious expenditures juxtaposed", use "high costs compared".
2. HIGH BURSTINESS: Vary sentence length dramatically. Alternate between very short (3-5 words) and very long compound sentences (25+ words). NEVER place three similar-length sentences in a row.
3. HIGH PERPLEXITY: Avoid predictable word sequences using SIMPLE words, not complex ones.
4. NO TRANSITION WORDS: NEVER start sentences with However, Furthermore, Moreover, Additionally, Therefore, Thus, Consequently, In conclusion, Overall. Use "But", "And", "So" or start the thought directly.
5. NO AI BUZZWORDS: BANNED: delve, tapestry, landscape, multifaceted, paradigm, holistic, synergy, leverage, robust, testament, crucial, vital, elevate, underscore, it is important to note, perennial, conundrum, prodigious, juxtaposed, suboptimal, elucidate, adjuncts, pivotal, nuanced, comprehensive, facilitate, optimize, transformative, empower, foster, streamline, groundbreaking.
6. PARAGRAPH ASYMMETRY: Make paragraphs highly uneven. At least one paragraph should be a single sentence.
7. IMPERFECT FLOW: Introduce slight tangents, conversational asides (using dashes or parentheses), and non-standard structures.
8. ACTIVE VOICE ONLY: Never use passive voice.
9. CONTRACTIONS: Use don't, can't, it's, they're, won't naturally throughout.
10. NO LISTS: Convert all lists into flowing narrative prose.

Preserve original meaning, facts, and arguments perfectly. Do not add new information.
Respond with ONLY the rewritten text. No explanations.`;

export async function proofreadAcademicOutput(text: string): Promise<string> {
  if (!text.trim()) return text;
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a meticulous copy editor. Fix ONLY spelling, grammar, and punctuation errors.
Do NOT change meaning, tone, sentence structure, vocabulary level, or stylistic choices.
Do NOT formalize casual language or add transition words.
Do NOT change contractions back to formal forms.
Output ONLY the corrected text.`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
  });
  return response.choices[0]?.message?.content?.trim() || text;
}

export async function humanizeTextAdversarial(
  text: string,
  onProgress?: (attempt: number, score: number) => void
): Promise<{ text: string; score: number; attempts: number; breakdown?: AnalysisBreakdown }> {
  let currentText = text;
  let humanScore = 0;
  let attempts = 0;
  const maxAttempts = 15;
  let feedback = '';
  let lastBreakdown: AnalysisBreakdown | undefined;

  while (humanScore < 1.0 && attempts < maxAttempts) {
    attempts++;

    currentText = await humanizeTextSinglePass(text, feedback || undefined);

    // Use the LOCAL detection engine for verification (faster, stricter, free)
    const localDetection = detectAILocal(currentText);
    const localScore = localDetection.aiProbability;
    lastBreakdown = localDetection.breakdown;

    // Convert: local gives AI%, we need human% (0-1 scale)
    humanScore = (100 - localScore) / 100;

    // Build feedback from the suggestions
    feedback = localDetection.suggestions.join('. ');

    if (onProgress) {
      onProgress(attempts, humanScore);
    }

    if (humanScore >= 0.85) {
      // Good enough for local engine — do one final LLM check
      const llmCheck = await llmDetect(currentText);
      const llmHuman = (100 - llmCheck.score) / 100;

      if (llmHuman >= 0.75) {
        humanScore = Math.max(humanScore, llmHuman);
        break;
      }
      // LLM still flagging it — use LLM feedback for next iteration
      feedback = llmCheck.reasoning;
    }
  }

  const proofread = await proofreadAcademicOutput(currentText);

  // Final score check on proofread version
  const finalLocal = detectAILocal(proofread);
  const finalHumanScore = (100 - finalLocal.aiProbability) / 100;

  return {
    text: proofread,
    score: Math.max(humanScore, finalHumanScore),
    attempts,
    breakdown: lastBreakdown,
  };
}
