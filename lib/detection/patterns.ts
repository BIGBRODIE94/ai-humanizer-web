import type { PatternScores } from './types';

const HEDGING_PHRASES = [
  'it is important to note', 'it is worth noting', 'it should be noted',
  'it is essential to', 'in today\'s world', 'in today\'s society',
  'in conclusion', 'to summarize', 'in summary', 'overall',
  'furthermore', 'moreover', 'additionally', 'consequently',
  'nevertheless', 'in other words', 'for instance', 'for example',
  'specifically', 'as a result', 'on the other hand', 'in contrast',
  'it can be argued', 'one might argue', 'this suggests that',
  'this indicates that', 'it is clear that', 'it is evident that',
  'plays a crucial role', 'plays a vital role', 'plays an important role',
  'it is imperative', 'delve into', 'delving into', 'tapestry',
  'landscape of', 'navigating the', 'in the realm of', 'multifaceted',
  'underscores the', 'pivotal', 'nuanced', 'paradigm', 'holistic',
  'synergy', 'leverage', 'robust', 'comprehensive', 'cutting-edge',
  'groundbreaking', 'this highlights', 'this underscores',
  'this demonstrates', 'it is noteworthy', 'it bears mentioning',
  'worthy of note', 'in this context', 'in light of',
  'with respect to', 'pertaining to', 'in terms of',
  'from the perspective of', 'in the context of',
  'it goes without saying', 'needless to say',
  'it stands to reason', 'it follows that',
  'by the same token', 'to that end', 'in this regard',
  'along these lines', 'in a similar vein',
  'it is widely recognized', 'it is generally accepted',
  'it is commonly understood', 'it has been established',
  'research has shown', 'studies have demonstrated',
  'scholars have argued', 'experts agree',
  'there is a growing consensus', 'the evidence suggests',
  'data indicates', 'findings reveal',
  'the following section', 'the next section',
  'the preceding discussion', 'the above analysis',
  'as previously mentioned', 'as noted earlier',
  'as discussed above', 'turning now to',
  'having established', 'building on this',
  'with this in mind', 'given the above',
  'taken together', 'collectively',
  'in the final analysis', 'upon closer examination',
  'a closer look reveals', 'when examined more closely',
  'at its core', 'fundamentally',
  'inherently', 'intrinsically',
  'serves as a testament', 'stands as a testament',
  'offers a window into', 'sheds light on',
  'brings to light', 'comes to the fore',
  'remains to be seen', 'only time will tell',
  'the jury is still out', 'food for thought',
  'in the ever-evolving', 'in an era of',
  'as we navigate', 'the power of',
  'unlock the potential', 'harness the power',
  'the importance of', 'a comprehensive guide',
  'everything you need to know', 'the ultimate guide',
  'game-changer', 'revolutionize', 'empower', 'foster',
  'enhance', 'streamline', 'facilitate', 'optimize',
  'maximize', 'transformative', 'prodigious', 'juxtaposed',
  'attributable', 'exacerbating', 'cognizance', 'elucidate',
  'perennial', 'conundrum', 'quandary', 'incongruity',
  'engender', 'treatise', 'endeavors', 'proliferation',
  'coexist with', 'progressively reshaping',
  'contemporary', 'foundational determinants',
  'behavioral incentives', 'administrative adjuncts',
  'increasingly cognizant', 'fundamentally attributable',
];

const TRANSITION_WORDS = [
  'however', 'therefore', 'furthermore', 'moreover', 'additionally',
  'consequently', 'nevertheless', 'nonetheless', 'meanwhile', 'subsequently',
  'accordingly', 'thus', 'hence', 'conversely', 'similarly',
  'likewise', 'alternatively', 'notably', 'significantly', 'importantly',
  'specifically', 'essentially', 'fundamentally', 'ultimately',
  'increasingly', 'interestingly', 'remarkably', 'undeniably',
  'unquestionably', 'indisputably', 'arguably', 'evidently',
  'ostensibly', 'presumably', 'conceivably', 'correspondingly',
];

const SUBORDINATING_CONJUNCTIONS = [
  'although', 'whereas', 'notwithstanding', 'inasmuch',
  'insofar', 'whilst', 'albeit', 'provided that',
  'given that', 'considering that', 'in order that',
];

const COORDINATING_STARTS = ['and', 'but', 'so', 'or', 'yet', 'because'];

function countOccurrences(text: string, phrases: string[]): number {
  const lower = text.toLowerCase();
  return phrases.reduce((count, phrase) => {
    let idx = 0;
    let found = 0;
    while ((idx = lower.indexOf(phrase, idx)) !== -1) { found++; idx += phrase.length; }
    return count + found;
  }, 0);
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
}

function computeHedgingFrequency(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 50;
  const count = countOccurrences(text, HEDGING_PHRASES);
  const density = count / sentences.length;
  if (density > 0.4) return 98;
  if (density > 0.25) return 85;
  if (density > 0.15) return 70;
  if (density > 0.08) return 52;
  if (density > 0.03) return 30;
  return Math.max(5, density * 600);
}

function computeTransitionOveruse(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return 50;
  let transitionStarts = 0;
  for (const sentence of sentences) {
    const firstWord = sentence.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (firstWord && TRANSITION_WORDS.includes(firstWord)) transitionStarts++;
  }
  const ratio = transitionStarts / sentences.length;
  if (ratio > 0.35) return 98;
  if (ratio > 0.25) return 82;
  if (ratio > 0.15) return 62;
  if (ratio > 0.08) return 38;
  return Math.max(5, ratio * 400);
}

function computeStructureUniformity(text: string): number {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length < 2) return 50;
  const lengths = paragraphs.map((p) => p.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((s, l) => s + Math.pow(l - mean, 2), 0) / lengths.length;
  const cv = Math.sqrt(variance) / (mean || 1);

  // Also check sentence count uniformity per paragraph
  const sentCounts = paragraphs.map((p) => splitSentences(p).length);
  const sentMean = sentCounts.reduce((a, b) => a + b, 0) / sentCounts.length;
  const sentVar = sentCounts.reduce((s, c) => s + Math.pow(c - sentMean, 2), 0) / sentCounts.length;
  const sentCv = Math.sqrt(sentVar) / (sentMean || 1);

  const avgCv = (cv + sentCv) / 2;

  if (avgCv < 0.15) return 92;
  if (avgCv < 0.25) return 72;
  if (avgCv < 0.4) return 52;
  if (avgCv < 0.6) return 32;
  return Math.max(5, 22 - (avgCv - 0.6) * 25);
}

function computePassiveVoiceRatio(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 50;
  const passivePattern = /\b(is|are|was|were|be|been|being)\s+(being\s+)?\w+(ed|en|t)\b/gi;
  let passiveCount = 0;
  for (const sentence of sentences) {
    if (passivePattern.test(sentence)) passiveCount++;
    passivePattern.lastIndex = 0;
  }
  const ratio = passiveCount / sentences.length;
  if (ratio > 0.45) return 88;
  if (ratio > 0.3) return 68;
  if (ratio > 0.18) return 48;
  if (ratio > 0.08) return 28;
  return Math.max(5, ratio * 300);
}

function computeClicheScore(text: string): number {
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 10) return 50;
  const count = countOccurrences(text, HEDGING_PHRASES.slice(80)); // AI-specific clichés
  const density = (count / wordCount) * 100;
  if (density > 2) return 95;
  if (density > 1.2) return 78;
  if (density > 0.6) return 58;
  if (density > 0.3) return 35;
  return Math.max(5, density * 100);
}

function computeListPatternScore(text: string): number {
  const lines = text.split('\n');
  if (lines.length < 3) return 25;
  const listPattern = /^\s*(\d+[.)]\s|[-*•]\s|[a-z][.)]\s)/;
  const listLines = lines.filter((l) => listPattern.test(l)).length;
  const ratio = listLines / lines.length;
  if (ratio > 0.5) return 88;
  if (ratio > 0.3) return 65;
  if (ratio > 0.15) return 42;
  return Math.max(5, ratio * 250);
}

// Do paragraphs start with the same word or same structure?
function computeParagraphOpenerRepetition(text: string): number {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 10);
  if (paragraphs.length < 3) return 50;

  const openers = paragraphs.map((p) => {
    const firstSentence = splitSentences(p)[0] ?? p;
    return firstSentence.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase().replace(/[^a-z\s]/g, '');
  });

  // Check first-word repetition
  const firstWords = openers.map((o) => o.split(' ')[0]);
  const firstWordFreq = new Map<string, number>();
  for (const w of firstWords) firstWordFreq.set(w, (firstWordFreq.get(w) ?? 0) + 1);
  const maxFirstWord = Math.max(...firstWordFreq.values());
  const firstWordRepRate = maxFirstWord / firstWords.length;

  // Check 2-word opener repetition
  const twoWords = openers.map((o) => o.split(' ').slice(0, 2).join(' '));
  const twoWordFreq = new Map<string, number>();
  for (const w of twoWords) twoWordFreq.set(w, (twoWordFreq.get(w) ?? 0) + 1);
  const maxTwoWord = Math.max(...twoWordFreq.values());
  const twoWordRepRate = maxTwoWord / twoWords.length;

  const combined = firstWordRepRate * 0.4 + twoWordRepRate * 0.6;

  if (combined > 0.6) return 92;
  if (combined > 0.45) return 72;
  if (combined > 0.3) return 52;
  if (combined > 0.18) return 32;
  return 15;
}

// AI uses more subordinating conjunctions; humans use more coordinating
function computeConjunctionProfile(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length < 5) return 50;

  let coordinating = 0;
  let subordinating = 0;

  for (const sentence of sentences) {
    const firstWord = sentence.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (firstWord && COORDINATING_STARTS.includes(firstWord)) coordinating++;
  }

  subordinating = countOccurrences(text, SUBORDINATING_CONJUNCTIONS);

  const total = coordinating + subordinating;
  if (total === 0) return 60; // no conjunctions = slightly AI

  const subRatio = subordinating / total;

  // High subordinating ratio = more formal/AI-like
  if (subRatio > 0.8) return 85;
  if (subRatio > 0.6) return 65;
  if (subRatio > 0.4) return 45;
  if (subRatio > 0.2) return 25;
  return 12;
}

// How diverse are sentence starts?
function computeSentenceStartDiversity(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length < 5) return 50;

  const starts = sentences.map((s) =>
    s.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
  );

  const unique = new Set(starts);
  const diversity = unique.size / starts.length;

  // Low diversity = many sentences start the same way = AI
  if (diversity < 0.3) return 92;
  if (diversity < 0.45) return 72;
  if (diversity < 0.6) return 52;
  if (diversity < 0.75) return 32;
  return 15;
}

// Pronoun reference chain analysis
// AI uses very clean pronoun chains; humans are messier
function computePronounChainScore(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length < 5) return 50;

  const pronouns = ['it', 'they', 'this', 'these', 'those', 'such', 'its', 'their'];
  let pronounStarts = 0;

  for (const sentence of sentences) {
    const firstWord = sentence.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (firstWord && pronouns.includes(firstWord)) pronounStarts++;
  }

  // AI loves starting sentences with "This" and "It" for clean reference chains
  const ratio = pronounStarts / sentences.length;
  if (ratio > 0.35) return 85;
  if (ratio > 0.25) return 65;
  if (ratio > 0.15) return 45;
  if (ratio > 0.08) return 25;
  return 12;
}

export function analyzePatterns(text: string): PatternScores {
  return {
    hedgingFrequency: computeHedgingFrequency(text),
    transitionOveruse: computeTransitionOveruse(text),
    structureUniformity: computeStructureUniformity(text),
    passiveVoiceRatio: computePassiveVoiceRatio(text),
    clicheScore: computeClicheScore(text),
    listPatternScore: computeListPatternScore(text),
    paragraphOpenerRepetition: computeParagraphOpenerRepetition(text),
    conjunctionProfile: computeConjunctionProfile(text),
    sentenceStartDiversity: computeSentenceStartDiversity(text),
    pronounChainScore: computePronounChainScore(text),
  };
}
