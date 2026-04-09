export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high';

export interface StatisticalScores {
  perplexity: number;
  burstiness: number;
  vocabularyRichness: number;
  repetitionDensity: number;
  averageSentenceLength: number;
  sentenceLengthVariance: number;
  shannonEntropy: number;
  bigramEntropy: number;
  trigramEntropy: number;
  zipfDeviation: number;
  wordRankConsistency: number;
}

export interface PatternScores {
  hedgingFrequency: number;
  transitionOveruse: number;
  structureUniformity: number;
  passiveVoiceRatio: number;
  clicheScore: number;
  listPatternScore: number;
  paragraphOpenerRepetition: number;
  conjunctionProfile: number;
  sentenceStartDiversity: number;
  pronounChainScore: number;
}

export interface SimilarityScores {
  adjacentSentenceSimilarity: number;
  paragraphCohesionUniformity: number;
  tfidfHomogeneity: number;
  semanticRepetition: number;
}

export interface WindowScores {
  entropyVariance: number;
  readabilityVariance: number;
  complexityVariance: number;
  styleConsistency: number;
  crossChunkScore: number;
}

export interface LinguisticScores {
  readabilityGrade: number;
  readabilityVariance: number;
  avgWordLength: number;
  wordLengthVariance: number;
  contractionRatio: number;
  firstPersonRatio: number;
  questionRatio: number;
  exclamationRatio: number;
  vocabularySophisticationUniformity: number;
}

export interface LLMDetectionResult {
  provider: string;
  aiProbability: number;
  reasoning: string;
}

export interface AnalysisBreakdown {
  statistical: StatisticalScores;
  patterns: PatternScores;
  similarity: SimilarityScores;
  window: WindowScores;
  linguistic: LinguisticScores;
  llmAnalysis: LLMDetectionResult[];
  layerScores: {
    statistical: number;
    pattern: number;
    similarity: number;
    window: number;
    linguistic: number;
    llm: number;
  };
  layerWeights: {
    statistical: number;
    pattern: number;
    similarity: number;
    window: number;
    linguistic: number;
    llm: number;
  };
}

export interface TextChunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
}
