import React from 'react';
import { MessageSquare, Clock } from 'lucide-react';

export default function ConversationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Conversations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Reflective dialogue sessions and stage progression.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 md:p-8 text-center">
        <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center mx-auto mb-4 border border-sky-100">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Conversations Module</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
          Session management, stage-based dialogues, and SLM assistant integration will be connected in Phase 6 Step 5 &amp; Step 6.
        </p>
        <div className="inline-flex items-center space-x-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled for Step 5 &amp; 6 Implementation</span>
        </div>
      </div>
    </div>
  );
}
