'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function PatientsError({ error, reset }) {
  useEffect(() => {
    console.error('Patients list error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Patient List Error</h2>
        <p className="text-slate-400 mb-2">
          Unable to load patient list.
        </p>
        <p className="text-amber-400 text-sm mb-6">
          Use bedside census or backup patient records.
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
            href="/"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Main Monitor
          </Link>
        </div>
      </div>
    </div>
  );
}
