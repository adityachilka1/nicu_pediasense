'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function FlowsheetError({ error, reset }) {
  useEffect(() => {
    console.error('Flowsheet module error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Flowsheet Error</h2>
        <p className="text-slate-400 mb-2">
          Unable to load clinical flowsheet data.
        </p>
        <p className="text-amber-400 text-sm mb-6">
          Refer to paper records or bedside documentation.
        </p>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-left">
            <code className="text-xs text-red-400 break-all">{error.message}</code>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
          <Link
            href="/patients"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Patient List
          </Link>
        </div>
      </div>
    </div>
  );
}
