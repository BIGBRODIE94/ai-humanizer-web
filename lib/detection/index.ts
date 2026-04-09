import { analyzeStatistical } from './statistical';
import { analyzePatterns } from './patterns';
import { analyzeSimilarity } from './similarity';
import { analyzeLinguistic } from './linguistic';
import { analyzeWindows } from './window';
import { computeCompositeScore, getVerdict, getSuggestions } from './scorer';
import type { AnalysisBreakdown, ConfidenceLevel, LLMDetectionResult } from './types';

export interface LocalDetectionResult {
  aiProbability: number;
  confidence: ConfidenceLevel;
  verdict: string;
  breakdown: AnalysisBreakdown;
  suggestions: string[];
  textLength: number;
}

export function detectAILocal(text: string): LocalDetectionResult {
  const statistical = analyzeStatistical(text);
  const patterns = analyzePatterns(text);
  const similarity = analyzeSimilarity(text);
  const linguistic = analyzeLinguistic(text);
  const window = analyzeWindows(text);

  const emptyLLM: LLMDetectionResult[] = [];

  const { score, confidence, breakdown } = computeCompositeScore(
    statistical, patterns, similarity, window, linguistic, emptyLLM
  );

  return {
    aiProbability: score,
    confidence,
    verdict: getVerdict(score),
    breakdown,
    suggestions: getSuggestions(score, breakdown),
    textLength: text.length,
  };
}

export type { AnalysisBreakdown, ConfidenceLevel } from './types';
