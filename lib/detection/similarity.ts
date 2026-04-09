import type { SimilarityScores } from './types';

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s'-]/g, '').split(/\s+/).filter((w) => w.length > 1);
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 5);
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 10);
}

// TF-IDF vector for a text segment
function buildTFIDF(
  segments: string[],
  stopWords: Set<string>
): Map<string, number>[] {
  const docs = segments.map((s) =>
    tokenize(s).filter((w) => !stopWords.has(w))
  );

  // Document frequency
  const df = new Map<string, number>();
  for (const doc of docs) {
    const unique = new Set(doc);
    for (const word of unique) {
      df.set(word, (df.get(word) ?? 0) + 1);
    }
  }

  const n = docs.length;
  return docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const word of doc) tf.set(word, (tf.get(word) ?? 0) + 1);

    const tfidf = new Map<string, number>();
    for (const [word, count] of tf) {
      const idf = Math.log((n + 1) / ((df.get(word) ?? 0) + 1)) + 1;
      tfidf.set(word, (count / doc.length) * idf);
    }
    return tfidf;
  });
}

// Cosine similarity between two TF-IDF vectors
function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [word, val] of a) {
    normA += val * val;
    if (b.has(word)) dotProduct += val * b.get(word)!;
  }
  for (const val of b.values()) normB += val * val;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dotProduct / denom : 0;
}

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'is', 'are', 'was', 'were', 'been', 'has', 'had', 'its', 'than',
]);

// Average cosine similarity between adjacent sentences
// AI text tends to have higher adjacent-sentence similarity (more "on topic" sentence-to-sentence)
function adjacentSentenceSim(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length < 4) return 50;

  const vectors = buildTFIDF(sentences, STOP_WORDS);
  let totalSim = 0;
  let count = 0;

  for (let i = 0; i < vectors.length - 1; i++) {
    if (vectors[i].size > 0 && vectors[i + 1].size > 0) {
      totalSim += cosineSimilarity(vectors[i], vectors[i + 1]);
      count++;
    }
  }

  const avgSim = count > 0 ? totalSim / count : 0.3;

  // For short texts (< 8 sentences), similarity is unreliable as a detector
  if (sentences.length < 8) return 50;

  // AI: avg similarity 0.15-0.35 (very consistent topic adherence)
  // Human: avg similarity 0.05-0.20 (more topic jumping, tangents)
  if (avgSim > 0.3) return 90;
  if (avgSim > 0.22) return 72;
  if (avgSim > 0.15) return 55;
  if (avgSim > 0.1) return 35;
  return Math.max(5, avgSim * 300);
}

// How uniform is paragraph-to-paragraph cohesion?
// AI maintains very consistent cohesion; humans have variable cohesion
function paragraphCohesionUniformity(text: string): number {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length < 3) return 50;

  const vectors = buildTFIDF(paragraphs, STOP_WORDS);
  const similarities: number[] = [];

  for (let i = 0; i < vectors.length - 1; i++) {
    if (vectors[i].size > 0 && vectors[i + 1].size > 0) {
      similarities.push(cosineSimilarity(vectors[i], vectors[i + 1]));
    }
  }

  if (similarities.length < 2) return 50;

  const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
  const variance = similarities.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / similarities.length;
  const cv = Math.sqrt(variance) / (mean || 0.01);

  // Low CV = very uniform cohesion = AI
  if (cv < 0.2) return 88;
  if (cv < 0.4) return 68;
  if (cv < 0.6) return 48;
  if (cv < 0.9) return 28;
  return 12;
}

// Overall TF-IDF homogeneity across the entire document
// Split text into ~500-word windows and compare all pairs
function tfidfHomogeneity(text: string): number {
  const words = tokenize(text);
  if (words.length < 100) return 50;

  const windowSize = Math.min(150, Math.floor(words.length / 3));
  const windows: string[] = [];

  for (let i = 0; i < words.length - windowSize; i += windowSize) {
    windows.push(words.slice(i, i + windowSize).join(' '));
  }

  if (windows.length < 3) return 50;

  const vectors = buildTFIDF(windows, STOP_WORDS);
  const similarities: number[] = [];

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      if (vectors[i].size > 0 && vectors[j].size > 0) {
        similarities.push(cosineSimilarity(vectors[i], vectors[j]));
      }
    }
  }

  if (similarities.length === 0) return 50;

  const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;

  // High homogeneity = all windows sound the same = AI
  if (avgSim > 0.4) return 90;
  if (avgSim > 0.3) return 72;
  if (avgSim > 0.2) return 52;
  if (avgSim > 0.12) return 32;
  return Math.max(5, avgSim * 200);
}

// Detect semantic repetition: same ideas expressed with slightly different words
function semanticRepetition(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length < 10) return 50;

  const vectors = buildTFIDF(sentences, STOP_WORDS);
  let highSimCount = 0;
  let totalPairs = 0;

  // Check non-adjacent sentence pairs (adjacent similarity is natural)
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 2; j < Math.min(vectors.length, i + 8); j++) {
      if (vectors[i].size > 0 && vectors[j].size > 0) {
        const sim = cosineSimilarity(vectors[i], vectors[j]);
        if (sim > 0.35) highSimCount++;
        totalPairs++;
      }
    }
  }

  if (totalPairs === 0) return 50;

  const repetitionRate = highSimCount / totalPairs;

  if (repetitionRate > 0.25) return 90;
  if (repetitionRate > 0.15) return 70;
  if (repetitionRate > 0.08) return 50;
  if (repetitionRate > 0.03) return 30;
  return Math.max(5, repetitionRate * 500);
}

export function analyzeSimilarity(text: string): SimilarityScores {
  return {
    adjacentSentenceSimilarity: adjacentSentenceSim(text),
    paragraphCohesionUniformity: paragraphCohesionUniformity(text),
    tfidfHomogeneity: tfidfHomogeneity(text),
    semanticRepetition: semanticRepetition(text),
  };
}
