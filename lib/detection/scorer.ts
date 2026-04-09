import type {
  StatisticalScores,
  PatternScores,
  SimilarityScores,
  WindowScores,
  LinguisticScores,
  LLMDetectionResult,
  AnalysisBreakdown,
  ConfidenceLevel,
} from './types';

const WEIGHTS_WITH_LLM = {
  statistical: 0.18,
  pattern: 0.20,
  similarity: 0.12,
  window: 0.08,
  linguistic: 0.12,
  llm: 0.30,
};

const WEIGHTS_NO_LLM = {
  statistical: 0.25,
  pattern: 0.32,
  similarity: 0.15,
  window: 0.05,
  linguistic: 0.23,
  llm: 0,
};

// Average that EXCLUDES neutral 50 values (unreliable metrics)
function reliableAvg(scores: number[], weights: number[]): number {
  let totalWeight = 0;
  let totalValue = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] === 50) continue; // skip unreliable metrics
    totalValue += scores[i] * weights[i];
    totalWeight += weights[i];
  }
  if (totalWeight === 0) return 50;
  return totalValue / totalWeight;
}

function computeStatisticalLayer(s: StatisticalScores): number {
  const allScores = [
    { s: s.perplexity, w: 1.0 },
    { s: s.burstiness, w: 1.8 },
    { s: s.vocabularyRichness, w: 0.8 },
    { s: s.repetitionDensity, w: 1.0 },
    { s: s.shannonEntropy, w: 1.2 },
    { s: s.bigramEntropy, w: 1.3 },
    { s: s.trigramEntropy, w: 1.0 },
    { s: s.zipfDeviation, w: 0.8 },
    { s: s.wordRankConsistency, w: 0.7 },
  ];

  const reliable = allScores.filter((x) => x.s !== 50);
  if (reliable.length === 0) return 50;

  let totalW = 0, totalV = 0;
  for (const { s, w } of reliable) { totalV += s * w; totalW += w; }
  const avg = totalV / totalW;

  const sorted = reliable.map((x) => x.s).sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3);
  const peakAvg = top3.reduce((a, b) => a + b, 0) / top3.length;

  return avg * 0.6 + peakAvg * 0.4;
}

function computePatternLayer(p: PatternScores): number {
  // Use MAX-boosted averaging: if the top signals are very high,
  // use the max of (average, boosted-peak) to prevent low-signal metrics from drowning strong ones
  const allScores = [
    { s: p.hedgingFrequency, w: 1.8 },
    { s: p.transitionOveruse, w: 1.5 },
    { s: p.structureUniformity, w: 1.0 },
    { s: p.passiveVoiceRatio, w: 0.8 },
    { s: p.clicheScore, w: 1.4 },
    { s: p.listPatternScore, w: 0.6 },
    { s: p.paragraphOpenerRepetition, w: 1.0 },
    { s: p.conjunctionProfile, w: 0.7 },
    { s: p.sentenceStartDiversity, w: 1.1 },
    { s: p.pronounChainScore, w: 0.8 },
  ];

  const reliable = allScores.filter((x) => x.s !== 50);
  if (reliable.length === 0) return 50;

  let totalW = 0, totalV = 0;
  for (const { s, w } of reliable) { totalV += s * w; totalW += w; }
  const avg = totalV / totalW;

  // Peak detection: sort descending, take top 3 strong signals
  const sorted = reliable.map((x) => x.s).sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3);
  const peakAvg = top3.reduce((a, b) => a + b, 0) / top3.length;

  // Final = blend of average (60%) and peak (40%)
  return avg * 0.6 + peakAvg * 0.4;
}

function computeSimilarityLayer(s: SimilarityScores): number {
  return reliableAvg(
    [s.adjacentSentenceSimilarity, s.paragraphCohesionUniformity,
     s.tfidfHomogeneity, s.semanticRepetition],
    [1.2, 1.0, 1.3, 0.8]
  );
}

function computeWindowLayer(w: WindowScores): number {
  return reliableAvg(
    [w.entropyVariance, w.readabilityVariance, w.complexityVariance,
     w.styleConsistency, w.crossChunkScore],
    [1.0, 1.0, 0.8, 1.2, 1.5]
  );
}

function computeLinguisticLayer(l: LinguisticScores): number {
  const reliable = [l.readabilityVariance, l.wordLengthVariance, l.vocabularySophisticationUniformity]
    .filter((v) => v !== 50);
  let score = reliable.length > 0
    ? reliable.reduce((a, b) => a + b, 0) / reliable.length
    : 50;

  if (l.contractionRatio < 0.003) score += 15;
  else if (l.contractionRatio < 0.008) score += 8;
  else if (l.contractionRatio > 0.025) score -= 12;

  if (l.firstPersonRatio < 0.003) score += 10;
  else if (l.firstPersonRatio > 0.035) score -= 8;

  if (l.questionRatio === 0 && l.exclamationRatio === 0) score += 8;
  if (l.questionRatio > 0.08) score -= 5;

  if (l.readabilityGrade >= 16) score += 22;
  else if (l.readabilityGrade >= 14) score += 14;
  else if (l.readabilityGrade >= 12) score += 6;

  return Math.max(0, Math.min(100, score));
}

// Consensus amplification: when multiple independent layers agree on "AI",
// the probability should be much higher than a simple weighted average.
// This models the Bayesian principle that independent agreeing evidence compounds.
function consensusAmplification(layerScores: number[]): number {
  const aiLayers = layerScores.filter((s) => s > 55);
  const strongAiLayers = layerScores.filter((s) => s > 70);
  const reliableLayers = layerScores.filter((s) => s !== 50);

  if (reliableLayers.length === 0) return 0;

  // What fraction of reliable layers say "AI"?
  const aiAgreement = aiLayers.length / reliableLayers.length;

  // Amplification curve: more layers agreeing = exponential boost
  if (strongAiLayers.length >= 3 && aiAgreement >= 0.7) return 25;
  if (strongAiLayers.length >= 2 && aiAgreement >= 0.6) return 18;
  if (aiLayers.length >= 3 && aiAgreement >= 0.5) return 12;
  if (aiLayers.length >= 2 && aiAgreement >= 0.4) return 6;

  // If most layers say human, apply negative amplification
  const humanLayers = layerScores.filter((s) => s < 35);
  const humanAgreement = humanLayers.length / reliableLayers.length;
  if (humanLayers.length >= 3 && humanAgreement >= 0.6) return -15;
  if (humanLayers.length >= 2 && humanAgreement >= 0.5) return -8;

  return 0;
}

// Peak signal detection: the single strongest AI signal matters more
// than the average suggests, because one very high metric is a red flag
function peakSignalBoost(layerScores: number[]): number {
  const maxScore = Math.max(...layerScores.filter((s) => s !== 50));
  if (maxScore >= 90) return 10;
  if (maxScore >= 80) return 5;
  return 0;
}

export function computeCompositeScore(
  statistical: StatisticalScores,
  patterns: PatternScores,
  similarity: SimilarityScores,
  window: WindowScores,
  linguistic: LinguisticScores,
  llmResults: LLMDetectionResult[]
): { score: number; confidence: ConfidenceLevel; breakdown: AnalysisBreakdown } {
  const hasLLM = llmResults.length > 0;
  const w = hasLLM ? WEIGHTS_WITH_LLM : WEIGHTS_NO_LLM;

  const statScore = computeStatisticalLayer(statistical);
  const patternScore = computePatternLayer(patterns);
  const simScore = computeSimilarityLayer(similarity);
  const windowScore = computeWindowLayer(window);
  const lingScore = computeLinguisticLayer(linguistic);
  const llmScore = llmResults.length > 0
    ? llmResults.reduce((s, r) => s + r.aiProbability, 0) / llmResults.length
    : 0;

  // Weighted base score
  let composite =
    statScore * w.statistical +
    patternScore * w.pattern +
    simScore * w.similarity +
    windowScore * w.window +
    lingScore * w.linguistic +
    llmScore * w.llm;

  // Apply consensus amplification and peak signal boost
  const allScores = [statScore, patternScore, simScore, lingScore];
  if (windowScore !== 50) allScores.push(windowScore);
  if (hasLLM) allScores.push(llmScore);

  composite += consensusAmplification(allScores);
  composite += peakSignalBoost(allScores);

  composite = Math.max(0, Math.min(100, Math.round(composite * 10) / 10));

  const confidence = determineConfidence(allScores, hasLLM, llmResults.length);

  const breakdown: AnalysisBreakdown = {
    statistical,
    patterns,
    similarity,
    window,
    linguistic,
    llmAnalysis: llmResults,
    layerScores: {
      statistical: Math.round(statScore * 10) / 10,
      pattern: Math.round(patternScore * 10) / 10,
      similarity: Math.round(simScore * 10) / 10,
      window: Math.round(windowScore * 10) / 10,
      linguistic: Math.round(lingScore * 10) / 10,
      llm: Math.round(llmScore * 10) / 10,
    },
    layerWeights: w,
  };

  return { score: composite, confidence, breakdown };
}

function determineConfidence(
  layerScores: number[],
  hasLLM: boolean,
  llmCount: number
): ConfidenceLevel {
  const reliable = layerScores.filter((s) => s !== 50);
  if (reliable.length < 2) return 'low';

  const max = Math.max(...reliable);
  const min = Math.min(...reliable);
  const spread = max - min;

  if (hasLLM && llmCount >= 2 && spread < 15) return 'very_high';
  if (spread < 18) return 'very_high';
  if (spread < 28) return 'high';
  if (spread < 40) return 'medium';
  return 'low';
}

export function getVerdict(score: number): string {
  if (score >= 85) return 'Almost certainly AI-generated';
  if (score >= 70) return 'Very likely AI-generated';
  if (score >= 55) return 'Likely AI-generated';
  if (score >= 40) return 'Possibly AI-generated or AI-assisted';
  if (score >= 25) return 'Likely human-written with possible AI assistance';
  if (score >= 10) return 'Very likely human-written';
  return 'Almost certainly human-written';
}

export function getSuggestions(score: number, breakdown: AnalysisBreakdown): string[] {
  const suggestions: string[] = [];
  const { statistical: s, patterns: p, similarity: sim, window: w, linguistic: l } = breakdown;

  if (s.burstiness > 60)
    suggestions.push('Vary sentence lengths drastically — mix 3-word sentences with 30-word ones');
  if (s.shannonEntropy > 60)
    suggestions.push('Increase character-level entropy — use less predictable character sequences');
  if (s.bigramEntropy > 60)
    suggestions.push('Reduce word-pair predictability — avoid common word collocations');
  if (s.zipfDeviation > 60)
    suggestions.push('Break Zipf\'s law conformity — use a less uniform word frequency distribution');
  if (s.vocabularyRichness > 55)
    suggestions.push('Use more diverse vocabulary — avoid repeating the same words');
  if (s.repetitionDensity > 55)
    suggestions.push('Eliminate repeated 3-4 word phrases throughout the text');

  if (p.hedgingFrequency > 50)
    suggestions.push('Remove hedging and filler phrases ("it is important to note", "furthermore")');
  if (p.transitionOveruse > 50)
    suggestions.push('Stop starting sentences with transition words (However, Therefore, etc.)');
  if (p.paragraphOpenerRepetition > 55)
    suggestions.push('Start each paragraph with a different word/structure');
  if (p.sentenceStartDiversity > 55)
    suggestions.push('Diversify sentence starters — don\'t begin multiple sentences the same way');
  if (p.passiveVoiceRatio > 50)
    suggestions.push('Convert passive voice to active voice');
  if (p.structureUniformity > 55)
    suggestions.push('Make paragraph lengths wildly uneven — one sentence vs. one long block');

  if (sim.adjacentSentenceSimilarity > 55)
    suggestions.push('Reduce sentence-to-sentence semantic similarity — add tangents and asides');
  if (sim.tfidfHomogeneity > 55)
    suggestions.push('Vary vocabulary and topics across different sections of the text');
  if (sim.semanticRepetition > 55)
    suggestions.push('Avoid repeating the same idea in different words across the text');

  if (w.crossChunkScore > 60)
    suggestions.push('Vary writing style across different parts of the text (consistency is an AI tell)');

  if (l.readabilityVariance > 60)
    suggestions.push('Vary paragraph complexity — mix simple and complex paragraphs');
  if (l.vocabularySophisticationUniformity > 60)
    suggestions.push('Mix simple everyday words with occasional specialized terms (not uniformly complex)');

  if (l.readabilityGrade >= 14)
    suggestions.push('Simplify vocabulary — use 8th-10th grade reading level, not graduate-level');
  if (l.contractionRatio < 0.005)
    suggestions.push('Add contractions (don\'t, can\'t, it\'s) — their absence is a major AI tell');

  if (score < 25) {
    suggestions.length = 0;
    suggestions.push('Text appears human-written — no major changes needed');
  }

  return suggestions;
}
