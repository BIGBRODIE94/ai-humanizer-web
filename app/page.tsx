'use client';

import { useState } from 'react';

interface LayerScore {
  name: string;
  score: number;
  weight: number;
  metrics: { name: string; value: number | string }[];
}

function ScoreBar({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 'h-4' : size === 'md' ? 'h-2.5' : 'h-1.5';
  const color = score >= 70 ? 'bg-red-500' : score >= 45 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className={`w-full bg-gray-200 rounded-full ${h}`}>
      <div className={`${color} ${h} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, score)}%` }} />
    </div>
  );
}

function LayerCard({ layer }: { layer: LayerScore }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-700 truncate">{layer.name}</span>
          <span className="text-xs text-gray-400">{(layer.weight * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center space-x-3 ml-2">
          <div className="w-24"><ScoreBar score={layer.score} size="sm" /></div>
          <span className={`text-sm font-bold min-w-[3rem] text-right ${layer.score >= 70 ? 'text-red-600' : layer.score >= 45 ? 'text-yellow-600' : 'text-green-600'}`}>
            {layer.score.toFixed(1)}%
          </span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-gray-100 pt-2">
          {layer.metrics.map((m, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{m.name}</span>
              <span className={`font-medium ${typeof m.value === 'number' ? (m.value >= 70 ? 'text-red-600' : m.value >= 45 ? 'text-yellow-600' : 'text-green-600') : 'text-gray-600'}`}>
                {typeof m.value === 'number' ? `${m.value.toFixed(1)}%` : m.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'detect' | 'humanize' | 'upload' | null>(null);
  const [chunkProgress, setChunkProgress] = useState('');
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [humanizeStats, setHumanizeStats] = useState<any>(null);

  const chunkText = (text: string, maxChars = 3000) => {
    const paragraphs = text.split('\n\n');
    const chunks: string[] = [];
    let current = '';
    for (const p of paragraphs) {
      if (current.length + p.length > maxChars && current.length > 200) {
        chunks.push(current);
        current = '';
      }
      current += (current ? '\n\n' : '') + p;
    }
    if (current) chunks.push(current);
    return chunks.flatMap(chunk => {
      if (chunk.length > maxChars * 1.5) {
        const sub: string[] = [];
        for (let i = 0; i < chunk.length; i += maxChars) sub.push(chunk.substring(i, i + maxChars));
        return sub;
      }
      return chunk;
    });
  };

  const handleDetect = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setAction('detect');
    setDetectionResult(null);
    setHumanizeStats(null);
    setOutputText('');
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setDetectionResult(data);
    } catch (err: any) {
      alert(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handleHumanize = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setAction('humanize');
    setDetectionResult(null);
    setHumanizeStats(null);
    setOutputText('');
    setChunkProgress('');
    try {
      const chunks = chunkText(inputText, 3000);
      let fullOutput = '';
      let totalScore = 0;
      let totalAttempts = 0;
      for (let i = 0; i < chunks.length; i++) {
        if (chunks.length > 1) setChunkProgress(`Processing part ${i + 1} of ${chunks.length}...`);
        const res = await fetch('/api/humanize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunks[i] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unknown error');
        fullOutput += (i > 0 ? '\n\n' : '') + data.text;
        totalScore += data.score;
        totalAttempts += data.attempts;
        setOutputText(fullOutput);
      }
      setHumanizeStats({ score: totalScore / chunks.length, attempts: totalAttempts });
    } catch (err: any) {
      alert(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setAction(null);
      setChunkProgress('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setAction('upload');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setInputText(data.text);
    } catch (err: any) {
      alert(err.message || 'Failed to read file');
    } finally {
      setLoading(false);
      setAction(null);
      e.target.value = '';
    }
  };

  const buildLayers = (): LayerScore[] => {
    if (!detectionResult?.breakdown) return [];
    const b = detectionResult.breakdown;
    const ls = b.layerScores;
    const lw = b.layerWeights;
    return [
      {
        name: '1. Statistical Analysis',
        score: ls.statistical,
        weight: lw.statistical,
        metrics: [
          { name: 'Perplexity', value: b.statistical.perplexity },
          { name: 'Burstiness', value: b.statistical.burstiness },
          { name: 'Shannon Entropy', value: b.statistical.shannonEntropy },
          { name: 'Bigram Entropy', value: b.statistical.bigramEntropy },
          { name: 'Trigram Entropy', value: b.statistical.trigramEntropy },
          { name: "Zipf's Law Deviation", value: b.statistical.zipfDeviation },
          { name: 'Vocabulary Richness', value: b.statistical.vocabularyRichness },
          { name: 'Repetition Density', value: b.statistical.repetitionDensity },
          { name: 'Word Rank Consistency', value: b.statistical.wordRankConsistency },
        ],
      },
      {
        name: '2. Pattern Analysis',
        score: ls.pattern,
        weight: lw.pattern,
        metrics: [
          { name: 'Hedging/Filler Phrases', value: b.patterns.hedgingFrequency },
          { name: 'Transition Overuse', value: b.patterns.transitionOveruse },
          { name: 'Structure Uniformity', value: b.patterns.structureUniformity },
          { name: 'Passive Voice', value: b.patterns.passiveVoiceRatio },
          { name: 'AI Clichés', value: b.patterns.clicheScore },
          { name: 'Paragraph Openers', value: b.patterns.paragraphOpenerRepetition },
          { name: 'Sentence Start Diversity', value: b.patterns.sentenceStartDiversity },
          { name: 'Conjunction Profile', value: b.patterns.conjunctionProfile },
          { name: 'Pronoun Chains', value: b.patterns.pronounChainScore },
        ],
      },
      {
        name: '3. TF-IDF Similarity',
        score: ls.similarity,
        weight: lw.similarity,
        metrics: [
          { name: 'Adjacent Sentence Similarity', value: b.similarity.adjacentSentenceSimilarity },
          { name: 'Paragraph Cohesion', value: b.similarity.paragraphCohesionUniformity },
          { name: 'TF-IDF Homogeneity', value: b.similarity.tfidfHomogeneity },
          { name: 'Semantic Repetition', value: b.similarity.semanticRepetition },
        ],
      },
      {
        name: '4. Window Analysis',
        score: ls.window,
        weight: lw.window,
        metrics: [
          { name: 'Entropy Variance', value: b.window.entropyVariance },
          { name: 'Readability Variance', value: b.window.readabilityVariance },
          { name: 'Complexity Variance', value: b.window.complexityVariance },
          { name: 'Style Consistency', value: b.window.styleConsistency },
          { name: 'Cross-Chunk Score', value: b.window.crossChunkScore },
        ],
      },
      {
        name: '5. Linguistic Analysis',
        score: ls.linguistic,
        weight: lw.linguistic,
        metrics: [
          { name: 'Readability Grade', value: `${b.linguistic.readabilityGrade.toFixed(1)}` },
          { name: 'Readability Variance', value: b.linguistic.readabilityVariance },
          { name: 'Word Length Variance', value: b.linguistic.wordLengthVariance },
          { name: 'Vocab Sophistication', value: b.linguistic.vocabularySophisticationUniformity },
          { name: 'Contraction Ratio', value: `${(b.linguistic.contractionRatio * 100).toFixed(2)}%` },
          { name: 'First-Person Ratio', value: `${(b.linguistic.firstPersonRatio * 100).toFixed(2)}%` },
        ],
      },
      ...(ls.llm > 0 ? [{
        name: '6. LLM Verification',
        score: ls.llm,
        weight: lw.llm,
        metrics: [
          { name: 'GPT-4o Score', value: detectionResult.llmScore },
          { name: 'Reasoning', value: detectionResult.reasoning?.substring(0, 80) || 'N/A' },
        ],
      }] : []),
    ];
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        <header className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
            BIGBRODIE94 <span className="text-blue-600">AI Humanizer</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            6-layer detection engine with Shannon entropy, TF-IDF similarity, and Zipf&apos;s law analysis. Supports up to 30,000 characters.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left: Input */}
          <div className="flex flex-col space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Original Text</h2>
              <div className="flex items-center space-x-3">
                <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-full">
                  {inputText.length.toLocaleString()} chars
                </span>
                <label className="cursor-pointer text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold px-3 py-1 rounded-full transition-colors flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Upload File
                  <input type="file" accept=".txt,.pdf,.docx" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
            <textarea
              className="flex-1 min-h-[350px] w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all text-sm"
              placeholder="Paste your text here (up to 30,000 characters)..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              maxLength={30000}
            />
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button onClick={handleDetect} disabled={loading || !inputText.trim()}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center">
                {loading && action === 'detect' ? <span className="animate-pulse">Analyzing...</span> : '🔍 Detect AI'}
              </button>
              <button onClick={handleHumanize} disabled={loading || !inputText.trim()}
                className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center">
                {loading && action === 'humanize' ? <span className="animate-pulse">Humanizing...</span> : '✨ Humanize Text'}
              </button>
            </div>
          </div>

          {/* Right: Results */}
          <div className="flex flex-col space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold">Results</h2>

            <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-100 overflow-y-auto min-h-[350px] max-h-[700px]">

              {!detectionResult && !outputText && !loading && (
                <div className="h-full flex items-center justify-center text-gray-400 text-center">
                  <p>Run a detection or humanize your text to see results here.</p>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-blue-600 space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-center font-medium animate-pulse">
                    {action === 'detect' ? 'Running 6-layer analysis...' :
                     action === 'upload' ? 'Extracting text from document...' :
                     chunkProgress || 'Running adversarial feedback loop...'}
                  </p>
                </div>
              )}

              {/* Detection */}
              {detectionResult && !loading && (
                <div className="space-y-5">
                  {/* Big Score */}
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-full ${detectionResult.isAi ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {detectionResult.isAi ? (
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      ) : (
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{detectionResult.verdict}</h3>
                      <p className="text-sm text-gray-500">Confidence: {detectionResult.confidence}</p>
                    </div>
                  </div>

                  {/* Score Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                      <div className="text-xs text-gray-500 font-semibold mb-1">AI Probability</div>
                      <div className="text-2xl font-black text-red-500">{(detectionResult.aiProbability * 100).toFixed(1)}%</div>
                      <ScoreBar score={detectionResult.aiProbability * 100} size="sm" />
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                      <div className="text-xs text-gray-500 font-semibold mb-1">Human Probability</div>
                      <div className="text-2xl font-black text-green-500">{(detectionResult.humanProbability * 100).toFixed(1)}%</div>
                      <ScoreBar score={100 - detectionResult.aiProbability * 100} size="sm" />
                    </div>
                  </div>

                  {/* Local vs LLM */}
                  {detectionResult.localScore !== undefined && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-2 rounded-lg text-center">
                        <div className="text-xs text-gray-400">Local Engine</div>
                        <div className="text-lg font-bold text-gray-700">{detectionResult.localScore.toFixed(1)}%</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-lg text-center">
                        <div className="text-xs text-gray-400">LLM (GPT-4o)</div>
                        <div className="text-lg font-bold text-gray-700">{detectionResult.llmScore.toFixed(1)}%</div>
                      </div>
                    </div>
                  )}

                  {/* Layer Breakdown */}
                  {detectionResult.breakdown && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-600">6-Layer Breakdown</h4>
                      {buildLayers().map((layer, i) => <LayerCard key={i} layer={layer} />)}
                    </div>
                  )}

                  {/* Reasoning */}
                  {detectionResult.reasoning && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-900">
                      <h4 className="text-xs font-semibold mb-1">LLM Reasoning</h4>
                      <p className="text-xs leading-relaxed">{detectionResult.reasoning}</p>
                    </div>
                  )}

                  {/* Suggestions */}
                  {detectionResult.suggestions?.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-gray-600">Suggestions</h4>
                      {detectionResult.suggestions.map((s: string, i: number) => (
                        <div key={i} className="text-xs text-gray-600 flex items-start space-x-2">
                          <span className="text-yellow-500 mt-0.5">→</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Humanize Results */}
              {outputText && !loading && (
                <div className="space-y-4 flex flex-col h-full">
                  {humanizeStats && (
                    <div className="flex justify-between items-center bg-green-50 text-green-800 px-4 py-3 rounded-xl border border-green-100">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="font-semibold">Target Achieved!</span>
                      </div>
                      <div className="text-sm font-medium">
                        {(humanizeStats.score * 100).toFixed(0)}% Humanized <span className="text-green-600/50 mx-1">·</span> {humanizeStats.attempts} attempt{humanizeStats.attempts > 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                  <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 relative group">
                    <button onClick={() => navigator.clipboard.writeText(outputText)}
                      className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Copy">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{outputText}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
