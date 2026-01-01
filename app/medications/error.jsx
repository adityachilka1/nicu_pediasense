'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function MedicationsError({ error, reset }) {
  useEffect(() => {
    console.error('Medications module error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Medication Data Error</h2>
        <p className="text-red-400 font-medium mb-2">
          Critical: Unable to load medication records
        </p>
        <p className="text-amber-400 text-sm mb-6">
          Verify medications through pharmacy system or paper MAR.
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

        <p className="text-xs text-red-400/70 mt-4">
          Never administer medications without verification
        </p>
      </div>
    </div>
  );
}
