import React from 'react';
import { FileText, Clock } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Wellbeing Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Non-clinical reflection summaries, themes, and action-plan insights.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 md:p-8 text-center">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
          <FileText className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Wellbeing Reports Module</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
          Report generation, safety classification notes, theme summaries, and closure commitments will be connected in Phase 6 Step 7.
        </p>
        <div className="inline-flex items-center space-x-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled for Step 7 Implementation</span>
        </div>
      </div>
    </div>
  );
}
