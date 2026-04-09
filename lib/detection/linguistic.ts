import type { LinguisticScores } from './types';

const CONTRACTIONS = new Set([
  "i'm", "i've", "i'll", "i'd", "we're", "we've", "we'll", "we'd",
  "you're", "you've", "you'll", "you'd", "they're", "they've", "they'll",
  "they'd", "he's", "she's", "it's", "that's", "there's", "here's",
  "what's", "who's", "how's", "where's", "when's", "why's",
  "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "won't", "wouldn't", "don't", "doesn't", "didn't", "can't", "couldn't",
  "shouldn't", "mightn't", "mustn't", "let's", "ain't",
]);

const FIRST_PERSON = new Set([
  'i', "i'm", "i've", "i'll", "i'd", 'me', 'my', 'mine', 'myself',
  'we', "we're", "we've", "we'll", "we'd", 'us', 'our', 'ours', 'ourselves',
]);

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
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
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 8;
  const syllables = words.reduce((t, w) => t + countSyllables(w), 0);
  const grade = 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
  return Math.max(0, Math.min(20, Math.round(grade * 10) / 10));
}

// Readability variance across paragraphs
// AI maintains extremely consistent readability; humans vary paragraph by paragraph
function readabilityVariance(text: string): number {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 30);
  if (paragraphs.length < 3) return 50;

  const grades = paragraphs.map((p) => fleschKincaidGrade(p));
  const mean = grades.reduce((a, b) => a + b, 0) / grades.length;
  const variance = grades.reduce((s, g) => s + Math.pow(g - mean, 2), 0) / grades.length;
  const cv = Math.sqrt(variance) / (mean || 1);

  // Low CV = too consistent = AI
  if (cv < 0.05) return 90;
  if (cv < 0.1) return 72;
  if (cv < 0.18) return 52;
  if (cv < 0.3) return 32;
  return 15;
}

// Word length variance across sentences
// AI uses consistently similar word lengths; humans mix short and long words erratically
function wordLengthVariance(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length < 5) return 50;

  const sentenceAvgLens = sentences.map((s) => {
    const words = s.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    return words.length > 0
      ? words.reduce((sum, w) => sum + w.replace(/[^a-z]/g, '').length, 0) / words.length
      : 0;
  });

  const mean = sentenceAvgLens.reduce((a, b) => a + b, 0) / sentenceAvgLens.length;
  const variance = sentenceAvgLens.reduce((s, l) => s + Math.pow(l - mean, 2), 0) / sentenceAvgLens.length;
  const cv = Math.sqrt(variance) / (mean || 1);

  if (cv < 0.06) return 88;
  if (cv < 0.1) return 68;
  if (cv < 0.16) return 48;
  if (cv < 0.25) return 28;
  return 12;
}

// Vocabulary sophistication uniformity
// AI maintains consistent word complexity; humans mix common and rare words unevenly
function vocabularySophisticationUniformity(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length < 5) return 50;

  const sentenceSophistication = sentences.map((s) => {
    const words = s.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return 0;
    // Sophistication proxy: average syllable count per word
    const avgSyllables = words.reduce((t, w) => t + countSyllables(w), 0) / words.length;
    return avgSyllables;
  });

  const mean = sentenceSophistication.reduce((a, b) => a + b, 0) / sentenceSophistication.length;
  const variance = sentenceSophistication.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / sentenceSophistication.length;
  const cv = Math.sqrt(variance) / (mean || 1);

  // Low CV = AI uses same complexity everywhere
  if (cv < 0.08) return 90;
  if (cv < 0.14) return 70;
  if (cv < 0.22) return 50;
  if (cv < 0.32) return 30;
  return 12;
}

export function analyzeLinguistic(text: string): LinguisticScores {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const sentences = splitSentences(text);

  const avgWl = words.length > 0
    ? words.reduce((s, w) => s + w.replace(/[^a-z]/g, '').length, 0) / words.length
    : 0;

  const questionCount = sentences.filter((s) => s.trim().endsWith('?')).length;
  const exclamationCount = sentences.filter((s) => s.trim().endsWith('!')).length;
  const contractionCount = words.filter((w) => CONTRACTIONS.has(w.replace(/[^a-z']/g, ''))).length;
  const firstPersonCount = words.filter((w) => FIRST_PERSON.has(w.replace(/[^a-z']/g, ''))).length;

  return {
    readabilityGrade: fleschKincaidGrade(text),
    readabilityVariance: readabilityVariance(text),
    avgWordLength: Math.round(avgWl * 100) / 100,
    wordLengthVariance: wordLengthVariance(text),
    contractionRatio: words.length > 0 ? contractionCount / words.length : 0,
    firstPersonRatio: words.length > 0 ? firstPersonCount / words.length : 0,
    questionRatio: sentences.length > 0 ? questionCount / sentences.length : 0,
    exclamationRatio: sentences.length > 0 ? exclamationCount / sentences.length : 0,
    vocabularySophisticationUniformity: vocabularySophisticationUniformity(text),
  };
}
