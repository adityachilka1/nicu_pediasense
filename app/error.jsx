'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log error to console in development
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#000508' }}>
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-xl bg-red-900/30 border border-red-700/50 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">System Error</h1>
        <p className="text-slate-400 mb-6">
          An unexpected error occurred. Patient monitoring continues on backup systems.
        </p>
        
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-6">
          <div className="text-xs text-slate-500 font-mono text-left">
            {error?.message || 'Unknown error occurred'}
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
          <Link 
            href="/"
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Monitor
          </Link>
        </div>
        
        <p className="text-xs text-slate-600 mt-8">
          If this problem persists, contact IT Support
        </p>
      </div>
    </div>
  );
}
