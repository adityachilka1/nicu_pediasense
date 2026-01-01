'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AlarmsError({ error, reset }) {
  useEffect(() => {
    console.error('Alarms module error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center animate-pulse">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Alarm System Error</h2>
        <p className="text-red-400 font-medium mb-2">
          Critical: Alarm monitoring temporarily unavailable
        </p>
        <p className="text-amber-400 text-sm mb-6">
          Maintain direct patient observation. Check bedside alarms.
        </p>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-left">
            <code className="text-xs text-red-400 break-all">{error.message}</code>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Retry Immediately
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Main Monitor
          </Link>
        </div>

        <p className="text-xs text-red-400/70 mt-4">
          Contact IT Support if alarm system remains unavailable
        </p>
      </div>
    </div>
  );
}
