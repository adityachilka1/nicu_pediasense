'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';

// Session timeout configuration
const WARNING_THRESHOLD_MS = 2 * 60 * 1000; // Show warning 2 minutes before expiry
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];
const ACTIVITY_DEBOUNCE_MS = 10000; // Don't update more than once per 10 seconds

export function SessionTimeoutMonitor() {
  const { data: session, update: updateSession } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const lastActivityRef = useRef(Date.now());
  const activityTimeoutRef = useRef(null);
  const checkIntervalRef = useRef(null);

  // Calculate time until session expires
  const getTimeUntilExpiry = useCallback(() => {
    if (!session?.expiresAt) return null;
    return Math.max(0, session.expiresAt - Date.now());
  }, [session?.expiresAt]);

  // Handle user activity - debounced to avoid excessive updates
  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_DEBOUNCE_MS) return;

    lastActivityRef.current = now;

    // Clear any existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Debounce the session update
    activityTimeoutRef.current = setTimeout(() => {
      if (session) {
        // Trigger session update to refresh activity timestamp
        updateSession();
      }
    }, 1000);
  }, [session, updateSession]);

  // Extend session by updating it
  const handleExtendSession = useCallback(async () => {
    try {
      await updateSession();
      setShowWarning(false);
      lastActivityRef.current = Date.now();
    } catch (error) {
      console.error('Failed to extend session:', error);
    }
  }, [updateSession]);

  // Sign out immediately
  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  // Check session expiry status
  useEffect(() => {
    if (!session?.expiresAt) return;

    const checkExpiry = () => {
      const remaining = getTimeUntilExpiry();

      if (remaining === null) return;

      setTimeRemaining(remaining);

      if (remaining <= 0) {
        // Session expired
        signOut({ callbackUrl: '/login?reason=timeout' });
      } else if (remaining <= WARNING_THRESHOLD_MS && !showWarning) {
        // Show warning
        setShowWarning(true);
      } else if (remaining > WARNING_THRESHOLD_MS && showWarning) {
        // Hide warning if session was extended
        setShowWarning(false);
      }
    };

    // Check immediately and then every second
    checkExpiry();
    checkIntervalRef.current = setInterval(checkExpiry, 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [session?.expiresAt, getTimeUntilExpiry, showWarning]);

  // Track user activity
  useEffect(() => {
    if (!session) return;

    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [session, handleActivity]);

  // Don't render if no session or warning not needed
  if (!session || !showWarning) return null;

  const minutes = Math.floor((timeRemaining || 0) / 60000);
  const seconds = Math.floor(((timeRemaining || 0) % 60000) / 1000);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-description"
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 id="session-timeout-title" className="text-lg font-semibold text-white">
                Session Expiring
              </h2>
              <p className="text-sm text-amber-400">
                Due to inactivity
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p id="session-timeout-description" className="text-slate-300 mb-4">
            Your session will expire due to inactivity. For security and patient safety,
            you will be signed out automatically.
          </p>

          {/* Countdown */}
          <div className="bg-slate-900 rounded-lg p-4 mb-6 text-center">
            <p className="text-sm text-slate-400 mb-1">Time remaining</p>
            <p className="text-3xl font-mono font-bold text-white">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleExtendSession}
              className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800"
              autoFocus
            >
              Continue Working
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-900/50 px-6 py-3 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center">
            Session timeout is required for HIPAA compliance and patient safety.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SessionTimeoutMonitor;
