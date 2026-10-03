import React from 'react'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">EVARA</h1>
        <p className="text-sm text-slate-500 mb-6">
          Academic AIML / NLP / LMTA Conversational Wellbeing Support Prototype
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 text-left mb-6">
          <strong>Non-Clinical Notice:</strong> EVARA is an academic reflection and wellbeing prototype. It does not provide clinical diagnoses, medical care, or emergency response services.
        </div>
        <div className="text-xs text-slate-400">
          Phase 6 Scaffold &amp; Build Foundation Initialized
        </div>
      </div>
    </div>
  )
}
