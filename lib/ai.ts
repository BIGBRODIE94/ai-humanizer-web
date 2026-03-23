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
You are the world's most advanced AI text detector. Your task is to analyze the provided text and determine if it was written by an AI or a human.
Look for common AI signatures:
- Predictable sentence structures (low burstiness)
- Generic transitions ("Furthermore", "In conclusion", "It is important to note")
- Overly balanced, neutral, and uniform tone
- High probability vocabulary (low perplexity)

If the text has varied sentence lengths, precise vocabulary, clear structure, and reads like polished human writing (whether casual or academic), score it as human. 
Well-written academic or professional prose with good burstiness and non-generic phrasing is human. 
Do not be hesitant: if it reads naturally like a human wrote it, give humanProbability 1.0 and aiProbability 0.0. 
If it reads robotic, generic, or formulaic, give a high aiProbability.

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
You are an elite academic and professional editor. Rewrite the provided text so it reads as polished, human-written content suitable for school essays, research papers, business reports, or formal workplace communication. It must bypass AI detectors (QuillBot, Turnitin, GPTZero, etc.) while maintaining an academic, professional, and concise tone.

TONE & STYLE (Non-negotiable):
- Academic and professional throughout
- Concise: every sentence adds value; remove filler
- Formal vocabulary; no slang, colloquialisms, or text-message phrasing
- Grammatically flawless; no intentional errors or "quirks"
- Clear, precise, and authoritative—like a strong student or seasoned professional wrote it

STRUCTURAL DIVERSITY (to bypass AI detection while staying formal):
- Vary sentence length: mix short, declarative sentences with longer, analytical ones. Professional writing is not uniformly medium-length.
- Vary paragraph length: avoid all paragraphs being the same size.
- Use precise, domain-appropriate vocabulary. Avoid generic AI words: "delve," "crucial," "tapestry," "furthermore," "moreover," "testament," "ultimately," "multifaceted," "navigating," "realm," "landscape," "pivotal," "fosters," "leverage," "paradigm."
- Prefer active voice. Be direct and specific.
- Use transitions appropriate to formal writing (e.g., "However," "Thus," "Consequently") but vary them—do not overuse any single transition.

RULES:
- Preserve the original meaning and key points exactly.
- Write in third person for academic content unless the original uses first person appropriately.
- No intro or outro. Return ONLY the rewritten text.
- Prioritize clarity and correctness. The output must be submission-ready.
`;

  if (feedback) {
    systemPrompt += `\n\nWARNING: Your previous attempt was flagged by the AI detector. Feedback: "${feedback}"\n\nAdjust by varying sentence and paragraph structure more, and by replacing any remaining generic or predictable phrasing with precise, formal alternatives. Maintain the academic tone.`;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Rewrite the following text in a polished, academic, professional tone suitable for school or work. Keep it concise and grammatically flawless. Preserve the meaning exactly:\n\n${text}` }
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
