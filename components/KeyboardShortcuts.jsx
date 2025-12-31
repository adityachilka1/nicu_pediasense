'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAlarmSound } from './AlarmSound';

// Keyboard shortcut definitions
export const SHORTCUTS = {
  // Navigation (with Ctrl/Cmd)
  navigation: [
    { key: 'm', description: 'Go to Monitor', path: '/' },
    { key: 'p', description: 'Go to Patients', path: '/patients' },
    { key: 'a', description: 'Go to Alarms', path: '/alarms' },
    { key: 'b', description: 'Go to Beds', path: '/beds' },
    { key: 't', description: 'Go to Trends', path: '/trends' },
    { key: 'r', description: 'Go to Reports', path: '/reports' },
    { key: 'h', description: 'Go to Handoff', path: '/handoff' },
    { key: 'c', description: 'Go to Calculators', path: '/calculators' },
  ],
  // Quick bed navigation (just the number)
  beds: [
    { key: '1', description: 'Go to Bed 01', path: '/patient/1' },
    { key: '2', description: 'Go to Bed 02', path: '/patient/2' },
    { key: '3', description: 'Go to Bed 03', path: '/patient/3' },
    { key: '4', description: 'Go to Bed 04', path: '/patient/4' },
    { key: '5', description: 'Go to Bed 05', path: '/patient/5' },
    { key: '6', description: 'Go to Bed 06', path: '/patient/6' },
    { key: '7', description: 'Go to Bed 07', path: '/patient/7' },
    { key: '8', description: 'Go to Bed 08', path: '/patient/8' },
  ],
  // Alarm actions
  alarms: [
    { key: 'Escape', description: 'Silence alarms', action: 'silence' },
    { key: 'Enter', description: 'Acknowledge alarm', action: 'acknowledge' },
  ],
  // Global actions
  global: [
    { key: '/', description: 'Show shortcuts help', action: 'help' },
    { key: '?', description: 'Show shortcuts help', action: 'help' },
    { key: 's', description: 'Toggle sound', action: 'toggleSound', requiresCtrl: true },
  ],
};

// Custom hook for keyboard shortcuts
export function useKeyboardShortcuts({ onAcknowledge, onSilence } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [showHelp, setShowHelp] = useState(false);
  const { setIsMuted, isMuted, playAckSound, silenceAllAlarms } = useAlarmSound();

  const handleKeyDown = useCallback((e) => {
    // Don't handle shortcuts when typing in inputs
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'SELECT' ||
      e.target.isContentEditable
    ) {
      return;
    }

    const key = e.key.toLowerCase();
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // Navigation shortcuts (Ctrl/Cmd + key)
    if (isCtrlOrCmd) {
      const navShortcut = SHORTCUTS.navigation.find(s => s.key === key);
      if (navShortcut) {
        e.preventDefault();
        router.push(navShortcut.path);
        return;
      }

      // Toggle sound
      if (key === 's') {
        e.preventDefault();
        setIsMuted(!isMuted);
        return;
      }
    }

    // Bed navigation (just numbers, no modifier)
    if (!isCtrlOrCmd && !e.altKey && !e.shiftKey) {
      const bedShortcut = SHORTCUTS.beds.find(s => s.key === key);
      if (bedShortcut) {
        router.push(bedShortcut.path);
        return;
      }
    }

    // Alarm actions
    if (e.key === 'Escape') {
      if (onSilence) {
        onSilence();
      }
      silenceAllAlarms();
      return;
    }

    if (e.key === 'Enter' && !isCtrlOrCmd) {
      // Only acknowledge on main monitor page
      if (pathname === '/' && onAcknowledge) {
        onAcknowledge();
        playAckSound();
      }
      return;
    }

    // Help modal
    if (key === '/' || key === '?') {
      e.preventDefault();
      setShowHelp(true);
      return;
    }
  }, [router, pathname, onAcknowledge, onSilence, setIsMuted, isMuted, playAckSound, silenceAllAlarms]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}

// Keyboard Shortcuts Help Modal
export function KeyboardShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full mx-4 animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
              <p className="text-xs text-slate-400">Quick navigation and actions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-6">
            {/* Navigation */}
            <div>
              <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Navigation
              </h3>
              <div className="space-y-2">
                {SHORTCUTS.navigation.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded text-xs font-mono text-cyan-400 border border-slate-700">
                      {modKey} + {shortcut.key.toUpperCase()}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* Bed Quick Access */}
            <div>
              <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Quick Bed Access
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {SHORTCUTS.beds.map((shortcut) => (
                  <div key={shortcut.key} className="flex flex-col items-center p-2 bg-slate-800/50 rounded border border-slate-700">
                    <kbd className="px-2 py-1 bg-slate-900 rounded text-sm font-mono text-green-400 border border-slate-600 mb-1">
                      {shortcut.key}
                    </kbd>
                    <span className="text-[10px] text-slate-400">Bed {shortcut.key.padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alarm Actions */}
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Alarm Actions
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Silence alarms</span>
                  <kbd className="px-2 py-1 bg-slate-800 rounded text-xs font-mono text-red-400 border border-slate-700">
                    Esc
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Acknowledge alarm</span>
                  <kbd className="px-2 py-1 bg-slate-800 rounded text-xs font-mono text-red-400 border border-slate-700">
                    Enter
                  </kbd>
                </div>
              </div>
            </div>

            {/* Global Actions */}
            <div>
              <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Global Actions
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Show this help</span>
                  <kbd className="px-2 py-1 bg-slate-800 rounded text-xs font-mono text-yellow-400 border border-slate-700">
                    ?
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Toggle sound</span>
                  <kbd className="px-2 py-1 bg-slate-800 rounded text-xs font-mono text-yellow-400 border border-slate-700">
                    {modKey} + S
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/30 rounded-b-xl">
          <p className="text-xs text-slate-500 text-center">
            Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-[10px] font-mono">Esc</kbd> to close this dialog
          </p>
        </div>
      </div>
    </div>
  );
}

// Help Button Component
export function KeyboardHelpButton() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowHelp(true)}
        className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        title="Keyboard Shortcuts (?)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
        </svg>
      </button>
      <KeyboardShortcutsModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
}
