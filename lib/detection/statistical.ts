import type { StatisticalScores } from './types';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

// Shannon entropy: H(X) = -SUM(p(x) * log2(p(x)))
// AI text has lower character-level entropy (more predictable sequences)
function shannonCharEntropy(text: string): number {
  const clean = text.toLowerCase().replace(/\s+/g, ' ');
  if (clean.length < 10) return 4.0;

  const freq = new Map<string, number>();
  for (const ch of clean) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / clean.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Word-level Shannon entropy
function shannonWordEntropy(words: string[]): number {
  if (words.length < 5) return 8.0;

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / words.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Bigram conditional entropy: H(X2|X1) = -SUM(p(x1,x2) * log2(p(x2|x1)))
// Lower = more predictable word sequences = more AI-like
function bigramEntropy(words: string[]): number {
  if (words.length < 10) return 6.0;

  const bigramFreq = new Map<string, number>();
  const unigramFreq = new Map<string, number>();

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    bigramFreq.set(bigram, (bigramFreq.get(bigram) ?? 0) + 1);
    unigramFreq.set(words[i], (unigramFreq.get(words[i]) ?? 0) + 1);
  }
  unigramFreq.set(
    words[words.length - 1],
    (unigramFreq.get(words[words.length - 1]) ?? 0) + 1
  );

  let entropy = 0;
  for (const [bigram, count] of bigramFreq) {
    const w1 = bigram.split(' ')[0];
    const pBigram = count / (words.length - 1);
    const pConditional = count / (unigramFreq.get(w1) ?? 1);
    if (pConditional > 0) {
      entropy -= pBigram * Math.log2(pConditional);
    }
  }
  return entropy;
}

// Trigram conditional entropy
function trigramEntropy(words: string[]): number {
  if (words.length < 20) return 8.0;

  const trigramFreq = new Map<string, number>();
  const bigramFreq = new Map<string, number>();

  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    const bigram = `${words[i]} ${words[i + 1]}`;
    trigramFreq.set(trigram, (trigramFreq.get(trigram) ?? 0) + 1);
    bigramFreq.set(bigram, (bigramFreq.get(bigram) ?? 0) + 1);
  }

  let entropy = 0;
  const totalTrigrams = words.length - 2;
  for (const [trigram, count] of trigramFreq) {
    const bigramPrefix = trigram.split(' ').slice(0, 2).join(' ');
    const pTrigram = count / totalTrigrams;
    const pConditional = count / (bigramFreq.get(bigramPrefix) ?? 1);
    if (pConditional > 0) {
      entropy -= pTrigram * Math.log2(pConditional);
    }
  }
  return entropy;
}

// Zipf's law: word frequency should follow a power law f(r) ~ 1/r^a
// AI text follows Zipf too perfectly; human text deviates more
function zipfDeviation(words: string[]): number {
  if (words.length < 50) return 0.5;

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  const sorted = [...freq.values()].sort((a, b) => b - a);
  if (sorted.length < 5) return 0.5;

  // Fit ideal Zipf: f(r) = f(1) / r
  const f1 = sorted[0];
  let sumSquaredError = 0;
  let sumSquaredTotal = 0;
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;

  for (let r = 0; r < Math.min(sorted.length, 100); r++) {
    const expected = f1 / (r + 1);
    const actual = sorted[r];
    sumSquaredError += Math.pow(actual - expected, 2);
    sumSquaredTotal += Math.pow(actual - mean, 2);
  }

  // R-squared: 1.0 = perfect Zipf, lower = more deviation
  const rSquared = sumSquaredTotal > 0 ? 1 - sumSquaredError / sumSquaredTotal : 0.5;
  return Math.max(0, Math.min(1, rSquared));
}

// Word rank consistency: how consistently the text uses medium-frequency words
// AI tends to use words of consistently medium rank; humans mix rare and common more
function wordRankConsistency(words: string[]): number {
  if (words.length < 30) return 50;

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  const ranks = words.map((w) => freq.get(w) ?? 1);
  const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  const variance = ranks.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / ranks.length;
  const cv = Math.sqrt(variance) / (mean || 1);

  // Low CV = consistent word frequency usage = likely AI
  if (cv < 0.5) return 85;
  if (cv < 0.8) return 65;
  if (cv < 1.2) return 45;
  if (cv < 1.8) return 25;
  return 10;
}

function computeBurstiness(sentences: string[]): number {
  if (sentences.length < 3) return 50;

  const lengths = sentences.map((s) => s.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
  const cv = Math.sqrt(variance) / (mean || 1);

  // Also check for adjacent-sentence length correlation
  // AI tends to have similar-length adjacent sentences
  let adjacentCorrelation = 0;
  for (let i = 0; i < lengths.length - 1; i++) {
    const ratio = Math.min(lengths[i], lengths[i + 1]) / Math.max(lengths[i], lengths[i + 1]) || 0;
    adjacentCorrelation += ratio;
  }
  adjacentCorrelation /= (lengths.length - 1) || 1;

  // Combine CV and adjacent correlation
  let score: number;
  if (cv < 0.25) score = 92;
  else if (cv < 0.35) score = 75;
  else if (cv < 0.5) score = 55;
  else if (cv < 0.7) score = 35;
  else score = Math.max(5, 25 - (cv - 0.7) * 25);

  // High adjacent correlation = even more AI-like
  if (adjacentCorrelation > 0.7) score = Math.min(98, score + 15);
  else if (adjacentCorrelation > 0.55) score = Math.min(98, score + 8);
  else if (adjacentCorrelation < 0.35) score = Math.max(2, score - 10);

  return score;
}

function computeRepetitionDensity(words: string[]): number {
  if (words.length < 10) return 50;

  // Check trigrams
  const trigrams = new Map<string, number>();
  for (let i = 0; i < words.length - 2; i++) {
    const gram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    trigrams.set(gram, (trigrams.get(gram) ?? 0) + 1);
  }
  const trigramRepeats = [...trigrams.values()].filter((c) => c > 1).length;

  // Check 4-grams (stronger AI signal)
  const fourgrams = new Map<string, number>();
  for (let i = 0; i < words.length - 3; i++) {
    const gram = `${words[i]} ${words[i + 1]} ${words[i + 2]} ${words[i + 3]}`;
    fourgrams.set(gram, (fourgrams.get(gram) ?? 0) + 1);
  }
  const fourgramRepeats = [...fourgrams.values()].filter((c) => c > 1).length;

  const totalTrigrams = Math.max(1, words.length - 2);
  const totalFourgrams = Math.max(1, words.length - 3);

  const trigramRate = trigramRepeats / totalTrigrams;
  const fourgramRate = fourgramRepeats / totalFourgrams;

  // 4-gram repetition is weighted 2x because it's a stronger signal
  const combined = trigramRate + fourgramRate * 2;

  if (combined > 0.2) return 95;
  if (combined > 0.12) return 75;
  if (combined > 0.06) return 55;
  if (combined > 0.03) return 35;
  return Math.max(5, combined * 800);
}

function computePerplexityScore(charEntropy: number, wordEntropy: number): number {
  // AI: char entropy ~3.8-4.2, word entropy ~7-9
  // Human: char entropy ~4.0-4.5, word entropy ~9-12
  let score = 50;

  if (charEntropy < 3.9) score += 20;
  else if (charEntropy < 4.1) score += 10;
  else if (charEntropy > 4.3) score -= 15;
  else if (charEntropy > 4.2) score -= 8;

  if (wordEntropy < 8) score += 15;
  else if (wordEntropy < 9.5) score += 5;
  else if (wordEntropy > 11) score -= 15;
  else if (wordEntropy > 10) score -= 8;

  return Math.max(2, Math.min(98, score));
}

function computeVocabularyRichness(words: string[]): number {
  if (words.length === 0) return 50;

  const unique = new Set(words);
  const ttr = unique.size / words.length;
  const lengthFactor = Math.min(1, words.length / 200);
  const adjustedTTR = ttr * (0.5 + 0.5 * lengthFactor);

  // Also measure hapax legomena ratio (words appearing only once)
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const hapax = [...freq.values()].filter((c) => c === 1).length;
  const hapaxRatio = hapax / unique.size;

  let score: number;
  if (adjustedTTR < 0.3) score = 82;
  else if (adjustedTTR < 0.4) score = 62;
  else if (adjustedTTR < 0.5) score = 42;
  else if (adjustedTTR < 0.65) score = 25;
  else score = Math.max(5, 15 - (adjustedTTR - 0.65) * 40);

  // Low hapax ratio = AI reuses words more
  if (hapaxRatio < 0.4) score = Math.min(98, score + 10);
  else if (hapaxRatio > 0.65) score = Math.max(2, score - 8);

  return score;
}

function entropyToScore(entropy: number, low: number, high: number, wordCount: number, minWords: number): number {
  // Not enough data for reliable entropy measurement
  if (wordCount < minWords) return 50;
  // Lower entropy = more predictable = more AI
  if (entropy <= low) return 90;
  if (entropy >= high) return 10;
  const range = high - low;
  const normalized = (entropy - low) / range;
  return Math.round(90 - normalized * 80);
}

function zipfToScore(rSquared: number): number {
  // Higher R-squared = follows Zipf too perfectly = more AI
  if (rSquared > 0.95) return 90;
  if (rSquared > 0.85) return 70;
  if (rSquared > 0.7) return 50;
  if (rSquared > 0.5) return 30;
  return 15;
}

export function analyzeStatistical(text: string): StatisticalScores {
  const words = tokenize(text);
  const sentences = splitSentences(text);
  const lengths = sentences.map((s) => s.split(/\s+/).length);
  const meanLen = lengths.length > 0
    ? lengths.reduce((a, b) => a + b, 0) / lengths.length
    : 0;
  const varianceLen = lengths.length > 1
    ? lengths.reduce((sum, l) => sum + Math.pow(l - meanLen, 2), 0) / lengths.length
    : 0;

  const charEnt = shannonCharEntropy(text);
  const wordEnt = shannonWordEntropy(words);
  const biEnt = bigramEntropy(words);
  const triEnt = trigramEntropy(words);
  const zipf = zipfDeviation(words);

  return {
    perplexity: computePerplexityScore(charEnt, wordEnt),
    burstiness: computeBurstiness(sentences),
    vocabularyRichness: computeVocabularyRichness(words),
    repetitionDensity: computeRepetitionDensity(words),
    averageSentenceLength: Math.round(meanLen * 10) / 10,
    sentenceLengthVariance: Math.round(varianceLen * 10) / 10,
    shannonEntropy: entropyToScore(charEnt, 3.7, 4.5, words.length, 30),
    bigramEntropy: entropyToScore(biEnt, 4.0, 8.0, words.length, 80),
    trigramEntropy: entropyToScore(triEnt, 3.0, 10.0, words.length, 150),
    zipfDeviation: zipfToScore(zipf),
    wordRankConsistency: wordRankConsistency(words),
  };
}
