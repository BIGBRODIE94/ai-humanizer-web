'use client';

import { useState } from 'react';

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'detect' | 'humanize' | null>(null);
  
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [humanizeStats, setHumanizeStats] = useState<any>(null);

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
      
      if (!res.ok) throw new Error(data.error);
      
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

    try {
      const res = await fetch('/api/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      setOutputText(data.text);
      setHumanizeStats({ score: data.score, attempts: data.attempts });
    } catch (err: any) {
      alert(err.message || 'Something went wrong. The text might be too long or the API timed out.');
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
            Advanced <span className="text-blue-600">AI Humanizer</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Detect AI-generated content with precision, or bypass detectors completely with our multi-pass adversarial rewriting engine.
          </p>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Input */}
          <div className="flex flex-col space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Original Text</h2>
              <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-full">
                {inputText.length} chars
              </span>
            </div>
            
            <textarea 
              className="flex-1 min-h-[300px] w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
              placeholder="Paste your AI-generated text here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button 
                onClick={handleDetect}
                disabled={loading || !inputText.trim()}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {loading && action === 'detect' ? (
                  <span className="animate-pulse">Analyzing...</span>
                ) : (
                  '🔍 Detect AI'
                )}
              </button>
              
              <button 
                onClick={handleHumanize}
                disabled={loading || !inputText.trim()}
                className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center"
              >
                {loading && action === 'humanize' ? (
                  <span className="animate-pulse">Humanizing...</span>
                ) : (
                  '✨ Humanize Text'
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Output / Results */}
          <div className="flex flex-col space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold">Results</h2>
            
            <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-100 overflow-y-auto min-h-[300px]">
              
              {!detectionResult && !outputText && !loading && (
                <div className="h-full flex items-center justify-center text-gray-400 text-center">
                  <p>Run a detection or humanize your text to see results here.</p>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-blue-600 space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-medium animate-pulse">
                    {action === 'detect' ? 'Scanning text for AI signatures...' : 'Running adversarial feedback loop...'}
                  </p>
                </div>
              )}

              {/* Detection Results */}
              {detectionResult && !loading && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center space-x-4">
                    <div className={\`p-4 rounded-full \${detectionResult.isAi ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}\`}>
                      {detectionResult.isAi ? (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      ) : (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {detectionResult.isAi ? 'Likely AI Generated' : 'Likely Human Written'}
                      </h3>
                      <p className="text-gray-500">Confidence analysis based on perplexity & burstiness</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <div className="text-sm text-gray-500 font-semibold mb-1">AI Probability</div>
                      <div className="text-3xl font-black text-red-500">{(detectionResult.aiProbability * 100).toFixed(1)}%</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <div className="text-sm text-gray-500 font-semibold mb-1">Human Probability</div>
                      <div className="text-3xl font-black text-green-500">{(detectionResult.humanProbability * 100).toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-blue-900">
                    <h4 className="font-semibold mb-2 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Detector Reasoning
                    </h4>
                    <p className="text-sm leading-relaxed">{detectionResult.reasoning}</p>
                  </div>
                </div>
              )}

              {/* Humanize Results */}
              {outputText && !loading && (
                <div className="space-y-4 animate-fade-in h-full flex flex-col">
                  {humanizeStats && (
                    <div className="flex justify-between items-center bg-green-50 text-green-800 px-4 py-3 rounded-xl border border-green-100">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="font-semibold">Target Achieved!</span>
                      </div>
                      <div className="text-sm font-medium">
                        {(humanizeStats.score * 100).toFixed(1)}% Human <span className="text-green-600/50 mx-1">•</span> {humanizeStats.attempts} attempt{humanizeStats.attempts > 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 relative group">
                    <button 
                      onClick={() => navigator.clipboard.writeText(outputText)}
                      className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy to clipboard"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{outputText}</p>
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
