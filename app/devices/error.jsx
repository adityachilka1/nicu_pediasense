'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DevicesError({ error, reset }) {
  useEffect(() => {
    console.error('Devices module error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Device Management Error</h2>
        <p className="text-slate-400 mb-2">
          Unable to load device information.
        </p>
        <p className="text-amber-400 text-sm mb-6">
          Device monitoring continues at bedside.
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
