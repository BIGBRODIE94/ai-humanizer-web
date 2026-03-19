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

If the text contains highly conversational elements, idioms, varied sentence lengths, subjective framing, or minor human idiosyncrasies, you should confidently score it as human. 
Do not be hesitant. If it reads naturally like a human, give it a humanProbability of 1.0 (100%) and aiProbability of 0.0 (0%). 
If it reads like AI, give it a high aiProbability.

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
You are an elite ghostwriter who specializes in completely rewriting AI-generated text to make it indistinguishable from authentic, raw human writing.
Your absolute goal is to achieve a 1.0 (100%) human score on all AI detection platforms.

Strict Rules to achieve 100% Human rating:
1. Extreme Burstiness: Use drastically varying sentence lengths. Follow a 3-word sentence with a 30-word sprawling sentence. Break conventional pacing.
2. High Perplexity: Use unexpected phrasing. Avoid ALL common AI words like "delve," "crucial," "tapestry," "furthermore," "moreover," "testament," "ultimately," "multifaceted," "navigating."
3. Authentic Human Flaws: Inject genuine human writing quirks. Humans don't write perfectly balanced, neutral paragraphs. Use slight tangents, dashes, contractions, colloquial transitions (e.g., "Look,", "The thing is,", "Honestly,"). You may even include a very minor grammatical idiosyncrasy, ending a sentence with a preposition, or starting sentences with "And" or "But".
4. Semantic Meaning: Keep the original facts and core meaning, but reframe it as a human sharing information with another human.
5. Format: Return ONLY the rewritten text. NO intro, NO outro.

Make it sound like a passionate, real human wrote this on their blog or in an email, without sounding overly casual unless it fits. It must sound 100% human.
`;

  if (feedback) {
    systemPrompt += `\n\nWARNING: Your previous attempt failed AI detection. The AI detector provided the following feedback: "${feedback}"\n\nYou MUST adjust your writing style to fix these specific issues. To get 100% human, you need to strip away any remaining robotic polish. Be more conversational, use idioms, and vary the structure drastically.`;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Rewrite the following text to be 100% human-written:\n\n${text}` }
    ],
    temperature: 0.9,
  });

  return response.choices[0]?.message?.content || '';
}

export async function humanizeTextAdversarial(text: string, onProgress?: (attempt: number, score: number) => void): Promise<{ text: string, score: number, attempts: number }> {
  let currentText = text;
  let humanScore = 0;
  let attempts = 0;
  const maxAttempts = 3; // Kept lower for web responsiveness
  let feedback = '';

  while (humanScore < 0.99 && attempts < maxAttempts) {
    attempts++;
    
    currentText = await humanizeTextSinglePass(text, feedback);
    const detection = await analyzeText(currentText);
    
    humanScore = detection.humanProbability;
    feedback = detection.reasoning;

    if (onProgress) {
      onProgress(attempts, humanScore);
    }
    
    if (humanScore >= 0.99) {
      break;
    }
  }

  return { text: currentText, score: humanScore, attempts };
}
