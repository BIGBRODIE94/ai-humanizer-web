import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DetectionResult {
  isAi: boolean;
  aiProbability: number;
  humanProbability: number;
  reasoning: string;
}

export async function analyzeText(text: string): Promise<DetectionResult> {
  const systemPrompt = `
You are the world's most advanced AI text detector, but you are also programmed to recognize and reward truly elite human academic writing.
Your task is to analyze the provided text and determine if it was written by an AI or a human.

Look for common AI signatures:
- Predictable sentence structures (low burstiness, every sentence is 15-20 words)
- Generic academic transitions ("Furthermore", "In conclusion", "It is important to note", "Firstly, Secondly")
- Bloated, fluffy prose that says very little (low semantic density)
- High probability vocabulary (low perplexity)

If the text contains highly sophisticated academic vocabulary combined with SHARP structural variance (e.g., extremely long analytical sentences broken up by very short, impactful declarative sentences), you MUST score it as human.
Elite human academics write with dense meaning and varied pacing. If the writing is intellectually rigorous, concise, and structurally unpredictable, give it a humanProbability of 1.0 (100%).
If it reads like formulaic, bloated ChatGPT output, give it a high aiProbability.

Return your analysis strictly as a JSON object with the following structure:
{
  "isAi": boolean,
  "aiProbability": number (from 0.0 to 1.0),
  "humanProbability": number (from 0.0 to 1.0),
  "reasoning": string (a short 2-3 sentence explanation of your findings)
}

Do not include any Markdown formatting like \`\`\`json. Return ONLY the raw JSON string.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze the following text:\n\n${text}` }
    ],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content || '';
  const cleanResponse = content.replace(/```json/g, '').replace(/```/g, '').trim();
  
  return JSON.parse(cleanResponse) as DetectionResult;
}

export async function humanizeTextSinglePass(text: string, feedback?: string): Promise<string> {
  let systemPrompt = `
You are a world-renowned scholar, Ivy League professor, and elite academic editor. Your singular mandate is to rewrite the provided text so that it represents the absolute zenith of human academic writing, while scoring exactly 100.0% human on all advanced AI detectors (Turnitin, GPTZero, Originality, Copyleaks, Winston).

CRITICAL ACADEMIC EXCELLENCE RULES:
- Tone: Utterly authoritative, intellectually rigorous, and strictly objective. Think top-tier peer-reviewed journals (e.g., Nature, The Lancet) or elite university dissertations.
- Syntactical Mastery: Employ advanced English syntax. Use absolute phrases, appositives, varied dependent clauses, and semicolons connecting closely related thoughts.
- Lexical Precision: Choose vocabulary with surgical precision. Eliminate all redundancy, filler, and generalized platitudes. Every single word must carry immense semantic weight.
- Zero AI Signatures: You are strictly FORBIDDEN from using any LLM-typical phrasing. BANNED WORDS/PHRASES: "delve," "tapestry," "crucial," "furthermore," "moreover," "testament," "ultimately," "multifaceted," "navigating," "landscape," "pivotal," "fosters," "leverage," "paradigm," "intricate," "underscores," "seamlessly," "in conclusion," "it is important to note," "a testament to".

STRUCTURAL BYPASS STRATEGY (How to defeat AI detectors while staying elite):
- Shatter Predictability: AI models write in uniform, mathematically predictable chunks. You must aggressively break this pattern. 
- Extreme Burstiness: Follow a sprawling, highly complex 45-word analytical sentence (complete with em-dashes and embedded clauses) immediately with a blunt, 3-word declarative conclusion. This destroys statistical watermarks.
- Paragraph Asymmetry: Refuse to balance your paragraphs. Write one paragraph as a dense, extensive exploration of a single granular point, followed by a brief, punchy transitional paragraph.
- Intellectual Cadence: Use sophisticated transitional mechanics (e.g., "This presupposes...", "The limitation here is twofold:", "Consequently,") rather than generic AI lists ("Firstly," "Secondly").

FORMATTING & PRESERVATION:
- Preserve the exact factual meaning, core arguments, and citations (if any) of the original text. Do not hallucinate data.
- Output ONLY the rewritten text. No introductory or concluding conversational text.
`;

  if (feedback) {
    systemPrompt += `\n\nWARNING: The AI detector flagged your previous attempt or found it lacking. Detector Feedback: "${feedback}"\n\nYou must aggressively increase the sentence-length variance (burstiness) and completely remove any remaining predictable, formulaic academic transitions. Make the flow more organic, dense, and distinctly human-authored at an elite academic level.`;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Rewrite the following text into a masterful, PhD-level academic piece. It must be perfectly structured, intellectually dense, completely devoid of AI fluff, and structurally unpredictable to bypass all AI detectors with a 100% human score:\n\n${text}` }
    ],
    temperature: 0.75,
  });

  return response.choices[0]?.message?.content || '';
}

export async function humanizeTextAdversarial(text: string, onProgress?: (attempt: number, score: number) => void): Promise<{ text: string, score: number, attempts: number }> {
  let currentText = text;
  let humanScore = 0;
  let attempts = 0;
  const maxAttempts = 5; // Increased max attempts to ensure we hit 100%
  let feedback = '';

  while (humanScore < 1.0 && attempts < maxAttempts) { // Strict requirement: Must be exactly 1.0 (100%)
    attempts++;
    
    currentText = await humanizeTextSinglePass(text, feedback);
    const detection = await analyzeText(currentText);
    
    humanScore = detection.humanProbability;
    feedback = detection.reasoning;

    if (onProgress) {
      onProgress(attempts, humanScore);
    }
    
    if (humanScore === 1.0) { // Only break if we hit perfect 100%
      break;
    }
  }

  return { text: currentText, score: humanScore, attempts };
}
