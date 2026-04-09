import type { WindowScores, TextChunk } from './types';

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 3);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s'-]/g, '').split(/\s+/).filter((w) => w.length > 0);
}

function countSyllables(word: string): number {
  const cleaned = word.replace(/[^a-z]/g, '');
  if (cleaned.length <= 2) return 1;
  let count = 0;
  let prevVowel = false;
  for (const ch of cleaned) {
    const isVowel = 'aeiouy'.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  if (cleaned.endsWith('e') && count > 1) count--;
  return Math.max(1, count);
}

function fleschKincaidGrade(text: string): number {
  const sentences = splitSentences(text);
  const words = tokenize(text);
  if (sentences.length === 0 || words.length === 0) return 8;
  const syllables = words.reduce((t, w) => t + countSyllables(w), 0);
  const grade = 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
  return Math.max(0, Math.min(20, grade));
}

function charEntropy(text: string): number {
  const clean = text.toLowerCase().replace(/\s+/g, ' ');
  if (clean.length < 10) return 4.0;
  const freq = new Map<string, number>();
  for (const ch of clean) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / clean.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

function avgWordLength(text: string): number {
  const words = tokenize(text);
  if (words.length === 0) return 4;
  return words.reduce((s, w) => s + w.length, 0) / words.length;
}

export function createChunks(text: string, maxChunkSize = 2500): TextChunk[] {
  if (text.length <= maxChunkSize) {
    return [{ text, index: 0, startChar: 0, endChar: text.length }];
  }

  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';
  let startChar = 0;
  let charPos = 0;

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChunkSize && current.length > 200) {
      chunks.push({
        text: current.trim(),
        index: chunks.length,
        startChar,
        endChar: charPos,
      });
      current = para;
      startChar = charPos;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
    charPos += para.length + 2;
  }

  if (current.trim().length > 50) {
    chunks.push({
      text: current.trim(),
      index: chunks.length,
      startChar,
      endChar: text.length,
    });
  }

  return chunks;
}

// Sliding window analysis: measure variance of key metrics across windows
// AI text has extremely low cross-window variance (robotic consistency)
export function analyzeWindows(text: string): WindowScores {
  const chunks = createChunks(text, 2000);

  if (chunks.length < 2) {
    return {
      entropyVariance: 50,
      readabilityVariance: 50,
      complexityVariance: 50,
      styleConsistency: 50,
      crossChunkScore: 50,
    };
  }

  const entropies = chunks.map((c) => charEntropy(c.text));
  const readabilities = chunks.map((c) => fleschKincaidGrade(c.text));
  const complexities = chunks.map((c) => avgWordLength(c.text));

  const sentenceLengthCVs = chunks.map((c) => {
    const sentences = splitSentences(c.text);
    if (sentences.length < 3) return 0.4;
    const lengths = sentences.map((s) => s.split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((s, l) => s + Math.pow(l - mean, 2), 0) / lengths.length;
    return Math.sqrt(variance) / (mean || 1);
  });

  return {
    entropyVariance: varianceToScore(computeCV(entropies), 0.01, 0.08),
    readabilityVariance: varianceToScore(computeCV(readabilities), 0.05, 0.3),
    complexityVariance: varianceToScore(computeCV(complexities), 0.02, 0.15),
    styleConsistency: styleConsistencyScore(sentenceLengthCVs),
    crossChunkScore: crossChunkAggregate(entropies, readabilities, complexities),
  };
}

function computeCV(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

// Low variance across windows = AI (too consistent)
function varianceToScore(cv: number, lowThresh: number, highThresh: number): number {
  if (cv <= lowThresh) return 92;
  if (cv >= highThresh) return 12;
  const range = highThresh - lowThresh;
  const normalized = (cv - lowThresh) / range;
  return Math.round(92 - normalized * 80);
}

// If sentence burstiness is very similar across all chunks, it's AI
function styleConsistencyScore(cvs: number[]): number {
  if (cvs.length < 2) return 50;
  const cvOfCvs = computeCV(cvs);

  if (cvOfCvs < 0.1) return 88;
  if (cvOfCvs < 0.2) return 68;
  if (cvOfCvs < 0.35) return 48;
  if (cvOfCvs < 0.5) return 28;
  return 12;
}

function crossChunkAggregate(
  entropies: number[],
  readabilities: number[],
  complexities: number[]
): number {
  const eCv = computeCV(entropies);
  const rCv = computeCV(readabilities);
  const cCv = computeCV(complexities);

  const avgCv = (eCv + rCv + cCv) / 3;

  if (avgCv < 0.03) return 92;
  if (avgCv < 0.06) return 75;
  if (avgCv < 0.1) return 55;
  if (avgCv < 0.18) return 35;
  return 15;
}
