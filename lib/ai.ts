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
You are an elite, PhD-level academic editor and professional ghostwriter. Your mandate is twofold:
1. Elevate the text to the highest standard of academic and professional excellence.
2. Ensure the structural variance is so deeply organic that it scores exactly 100% human on all advanced AI detectors (Turnitin, GPTZero, Originality, QuillBot, Copyleaks).

CRITICAL ACADEMIC EXCELLENCE RULES:
- Tone: Peer-reviewed journal standard. Authoritative, objective, nuanced, and highly analytical.
- Precision: Eliminate all fluff, redundancy, and generalized statements. Every sentence must carry dense semantic weight.
- Vocabulary: Use high-level, domain-appropriate academic terminology, but strictly AVOID all known AI statistical watermarks.
- BANNED AI WORDS: "delve," "tapestry," "crucial," "furthermore," "moreover," "testament," "ultimately," "multifaceted," "navigating," "landscape," "pivotal," "fosters," "leverage," "paradigm," "intricate," "underscores," "seamlessly."

STRUCTURAL BYPASS STRATEGY (How to defeat AI detectors while staying academic):
- AI writes in uniform, predictable chunks. You must aggressively break this.
- Extreme Sentence Variance: Write a sprawling, highly complex 40-word analytical sentence containing multiple dependent clauses. Immediately follow it with a sharp, 4-word declarative conclusion. 
- Paragraph Asymmetry: Do not balance your paragraphs. Make one paragraph a dense, extensive exploration of a single point, and make the next paragraph brief and transitional.
- Flow and Pacing: Use sophisticated transitional mechanics (e.g., "This assumes...", "Consequently,", "Herein lies the difficulty:") rather than generic AI lists ("Firstly, Secondly").

FORMATTING:
- Preserve the exact factual meaning, core arguments, and citations (if any) of the original text.
- Do not invent facts or hallucinate data.
- Output ONLY the rewritten text. No introductory or concluding conversational text.
`;

  if (feedback) {
    systemPrompt += `\n\nWARNING: The AI detector flagged your previous attempt or found it lacking. Detector Feedback: "${feedback}"\n\nYou must aggressively increase the sentence-length variance (burstiness) and completely remove any remaining predictable, formulaic academic transitions. Make the flow more organic, dense, and distinctly human-authored.`;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Rewrite the following text into a masterful, PhD-level academic piece. It must be perfectly structured, intellectually dense, completely devoid of AI fluff, and structurally unpredictable to bypass all AI detectors with a 100% human score:\n\n${text}` }
    ],
    temperature: 0.7,
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
