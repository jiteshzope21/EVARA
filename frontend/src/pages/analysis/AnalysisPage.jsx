import React from 'react';
import { Sparkles, Clock } from 'lucide-react';

export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">NLP / LMTA Analysis</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Academic language processing signals, sentiment, and theme inspection.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 md:p-8 text-center">
        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 border border-purple-100">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">NLP / LMTA Analysis Module</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
          Detailed sentiment scores, emotion classification, intent detection, TF-IDF terms, and semantic embeddings will be connected in Phase 6 Step 7.
        </p>
        <div className="inline-flex items-center space-x-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled for Step 7 Implementation</span>
        </div>
      </div>
    </div>
  );
}
