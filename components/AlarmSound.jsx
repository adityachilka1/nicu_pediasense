'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const AlarmSoundContext = createContext(null);

// IEC 60601-1-8 compliant alarm patterns
// Critical: High priority - 10 pulses/sequence, burst pattern
// Warning: Medium priority - 3 pulses/sequence
// Advisory: Low priority - 2 pulses/sequence

export function AlarmSoundProvider({ children }) {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showEnablePrompt, setShowEnablePrompt] = useState(true);
  const audioContextRef = useRef(null);
  const oscillatorsRef = useRef({});
  const intervalRef = useRef(null);
  const criticalAlarmRef = useRef(null);

  // Initialize audio context on first user interaction
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    setAudioEnabled(true);
    setShowEnablePrompt(false);
    return audioContextRef.current;
  }, []);

  // Enable audio (call this from user interaction)
  const enableAudio = useCallback(() => {
    const ctx = initAudio();
    // Play a silent tone to fully unlock audio
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
    return true;
  }, [initAudio]);

  // Generate alarm tone using Web Audio API
  const playTone = useCallback((frequency, duration, type = 'sine') => {
    if (isMuted) return;

    try {
      const ctx = initAudio();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }, [isMuted, volume, initAudio]);

  // IEC 60601-1-8 Critical Alarm Pattern
  // 10-pulse burst at ~262-523 Hz, repeated
  const playCriticalAlarm = useCallback(() => {
    if (isMuted) return;

    let pulseCount = 0;
    const playPulse = () => {
      if (pulseCount < 10) {
        playTone(523, 0.15); // C5 note
        pulseCount++;
        setTimeout(() => {
          playTone(262, 0.15); // C4 note
          setTimeout(playPulse, 100);
        }, 150);
      }
    };
    playPulse();
  }, [isMuted, playTone]);

  // IEC 60601-1-8 Warning Alarm Pattern
  // 3-pulse pattern
  const playWarningAlarm = useCallback(() => {
    if (isMuted) return;

    playTone(440, 0.2); // A4 note
    setTimeout(() => playTone(440, 0.2), 300);
    setTimeout(() => playTone(440, 0.2), 600);
  }, [isMuted, playTone]);

  // Advisory/Info sound - gentler 2-tone
  const playInfoSound = useCallback(() => {
    if (isMuted) return;

    playTone(392, 0.15); // G4
    setTimeout(() => playTone(523, 0.15), 200); // C5
  }, [isMuted, playTone]);

  // Acknowledgement sound
  const playAckSound = useCallback(() => {
    if (isMuted) return;

    playTone(523, 0.1, 'triangle'); // Soft C5
    setTimeout(() => playTone(659, 0.1, 'triangle'), 100); // E5
    setTimeout(() => playTone(784, 0.1, 'triangle'), 200); // G5
  }, [isMuted, playTone]);

  // Silence sound (single low tone)
  const playSilenceSound = useCallback(() => {
    if (isMuted) return;
    playTone(196, 0.3, 'triangle'); // G3 - low confirmation tone
  }, [isMuted, playTone]);

  // Start continuous alarm for critical patients
  const startContinuousAlarm = useCallback((alarmId, type) => {
    if (isMuted) return;

    setActiveAlarms(prev => {
      if (prev.includes(alarmId)) return prev;
      return [...prev, alarmId];
    });

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Play initial alarm
    if (type === 'critical') {
      playCriticalAlarm();
    } else if (type === 'warning') {
      playWarningAlarm();
    }

    // Set up repeating alarm (every 10 seconds for critical, 30 for warning)
    const repeatInterval = type === 'critical' ? 10000 : 30000;
    intervalRef.current = setInterval(() => {
      if (type === 'critical') {
        playCriticalAlarm();
      } else {
        playWarningAlarm();
      }
    }, repeatInterval);
  }, [isMuted, playCriticalAlarm, playWarningAlarm]);

  // Stop continuous alarm
  const stopContinuousAlarm = useCallback((alarmId) => {
    setActiveAlarms(prev => prev.filter(id => id !== alarmId));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    playAckSound();
  }, [playAckSound]);

  // Stop all alarms
  const silenceAllAlarms = useCallback((duration = 120000) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setActiveAlarms([]);
    playSilenceSound();

    // Return a timeout ID in case caller wants to track it
    return duration;
  }, [playSilenceSound]);

  // Test alarm sounds
  const testAlarm = useCallback((type) => {
    switch (type) {
      case 'critical':
        playCriticalAlarm();
        break;
      case 'warning':
        playWarningAlarm();
        break;
      case 'info':
        playInfoSound();
        break;
      case 'ack':
        playAckSound();
        break;
      default:
        playInfoSound();
    }
  }, [playCriticalAlarm, playWarningAlarm, playInfoSound, playAckSound]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const value = {
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    activeAlarms,
    audioEnabled,
    showEnablePrompt,
    playCriticalAlarm,
    playWarningAlarm,
    playInfoSound,
    playAckSound,
    playSilenceSound,
    startContinuousAlarm,
    stopContinuousAlarm,
    silenceAllAlarms,
    testAlarm,
    initAudio,
    enableAudio,
  };

  return (
    <AlarmSoundContext.Provider value={value}>
      {children}
    </AlarmSoundContext.Provider>
  );
}

export function useAlarmSound() {
  const context = useContext(AlarmSoundContext);
  if (!context) {
    throw new Error('useAlarmSound must be used within an AlarmSoundProvider');
  }
  return context;
}

// Alarm Sound Control Panel Component
export function AlarmSoundControls({ className = '' }) {
  const {
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    activeAlarms,
    testAlarm,
    silenceAllAlarms,
    initAudio
  } = useAlarmSound();

  const [showPanel, setShowPanel] = useState(false);

  const handleVolumeChange = (e) => {
    initAudio(); // Ensure audio context is initialized
    setVolume(parseFloat(e.target.value));
  };

  const handleTestAlarm = (type) => {
    initAudio();
    testAlarm(type);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Sound Toggle Button */}
      <button
        onClick={() => {
          initAudio();
          setShowPanel(!showPanel);
        }}
        className={`p-2 rounded-lg transition-colors ${
          isMuted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
        title={isMuted ? 'Sound muted' : 'Sound enabled'}
      >
        {isMuted ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : activeAlarms.length > 0 ? (
          <svg className="w-5 h-5 text-red-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

      {/* Sound Control Panel - Modal (rendered via Portal to escape stacking context) */}
      {showPanel && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop overlay - fully opaque */}
          <div
            className="fixed inset-0 bg-black"
            style={{ zIndex: 9998 }}
            onClick={() => setShowPanel(false)}
          />
          {/* Centered modal panel */}
          <div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-5"
            style={{ zIndex: 9999 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Alarm Sound Settings</h3>
              <button
                onClick={() => setShowPanel(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

          {/* Mute Toggle */}
          <div className="flex items-center justify-between mb-4 p-2 bg-slate-800 rounded-lg">
            <span className="text-sm text-slate-300">Sound Enabled</span>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isMuted ? 'bg-slate-700' : 'bg-cyan-500'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  isMuted ? 'left-1' : 'left-7'
                }`}
              />
            </button>
          </div>

          {/* Volume Slider */}
          <div className="mb-4">
            <label className="block text-xs text-slate-400 mb-2">Volume: {Math.round(volume * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              disabled={isMuted}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
            />
          </div>

          {/* Test Sounds */}
          <div className="border-t border-slate-700 pt-4">
            <label className="block text-xs text-slate-400 mb-2">Test Alarm Sounds</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTestAlarm('critical')}
                disabled={isMuted}
                className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                Critical
              </button>
              <button
                onClick={() => handleTestAlarm('warning')}
                disabled={isMuted}
                className="px-3 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-medium hover:bg-yellow-500/30 disabled:opacity-50 transition-colors"
              >
                Warning
              </button>
              <button
                onClick={() => handleTestAlarm('info')}
                disabled={isMuted}
                className="px-3 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/30 disabled:opacity-50 transition-colors"
              >
                Info
              </button>
              <button
                onClick={() => handleTestAlarm('ack')}
                disabled={isMuted}
                className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 disabled:opacity-50 transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </div>

          {/* Active Alarms */}
          {activeAlarms.length > 0 && (
            <div className="border-t border-slate-700 pt-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-red-400 font-medium">
                  {activeAlarms.length} Active Alarm{activeAlarms.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => silenceAllAlarms()}
                  className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600"
                >
                  Silence All
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 mt-3">
            IEC 60601-1-8 compliant alarm tones
          </p>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// Audio Enable Prompt - Shows on page load to enable audio (browser policy)
export function AudioEnablePrompt() {
  const { audioEnabled, enableAudio, showEnablePrompt } = useAlarmSound();
  const [dismissed, setDismissed] = useState(false);

  if (audioEnabled || dismissed || !showEnablePrompt) return null;

  const handleEnable = () => {
    enableAudio();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-in">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-xl shadow-2xl p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white mb-1">Enable Alarm Sounds?</h4>
            <p className="text-xs text-slate-400 mb-3">
              Critical patient alarms require audio. Click to enable IEC 60601-1-8 compliant alarm tones.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEnable}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Enable Sound
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Critical Alarm Banner - Shows when critical alarms are active
export function CriticalAlarmBanner({ criticalBeds = [], onAcknowledge, onSilence }) {
  const { audioEnabled, playCriticalAlarm, isMuted, activeAlarms } = useAlarmSound();
  const [isPlaying, setIsPlaying] = useState(false);
  const alarmIntervalRef = useRef(null);

  // Play alarm sound continuously while critical patients exist
  useEffect(() => {
    if (criticalBeds.length > 0 && audioEnabled && !isMuted) {
      // Play initial alarm
      playCriticalAlarm();
      setIsPlaying(true);

      // Repeat every 8 seconds (IEC 60601-1-8 recommends 3-25 second intervals for high priority)
      alarmIntervalRef.current = setInterval(() => {
        playCriticalAlarm();
      }, 8000);
    } else {
      setIsPlaying(false);
    }

    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    };
  }, [criticalBeds.length, audioEnabled, isMuted, playCriticalAlarm]);

  if (criticalBeds.length === 0) return null;

  return (
    <div className="flex-shrink-0 bg-red-950/95 border-t-2 border-red-500">
      <div className={`flex items-center justify-between px-4 py-2 ${isPlaying ? 'animate-pulse' : ''}`}>
        <div className="flex items-center gap-3">
          {/* Animated alarm icon */}
          <div className={`relative ${isPlaying ? 'animate-bounce' : ''}`}>
            <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <span className="font-bold text-white text-sm">*** HIGH PRIORITY ALARM ***</span>
            <span className="text-red-200 text-sm ml-3">
              {criticalBeds.map(bed => `BED ${bed}`).join(', ')}
            </span>
          </div>
          {/* Sound indicator */}
          {isPlaying && (
            <div className="flex items-center gap-1 ml-3">
              <div className="w-1 h-3 bg-red-400 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-4 bg-red-400 rounded animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-5 bg-red-400 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
              <div className="w-1 h-4 bg-red-400 rounded animate-pulse" style={{ animationDelay: '450ms' }} />
              <div className="w-1 h-3 bg-red-400 rounded animate-pulse" style={{ animationDelay: '600ms' }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAcknowledge}
            className="px-4 py-1.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded transition-colors"
          >
            ACKNOWLEDGE
          </button>
          <button
            onClick={onSilence}
            className="px-4 py-1.5 text-sm font-bold text-red-200 border border-red-500 hover:bg-red-900/50 rounded transition-colors"
          >
            SILENCE 2:00
          </button>
        </div>
      </div>
    </div>
  );
}

// Warning Alarm Banner - Shows when warning alarms are active
export function WarningAlarmBanner({ warningBeds = [], onAcknowledge }) {
  const { audioEnabled, playWarningAlarm, isMuted } = useAlarmSound();
  const playedRef = useRef(false);

  // Play warning sound once when new warnings appear
  useEffect(() => {
    if (warningBeds.length > 0 && audioEnabled && !isMuted && !playedRef.current) {
      playWarningAlarm();
      playedRef.current = true;
    }
    if (warningBeds.length === 0) {
      playedRef.current = false;
    }
  }, [warningBeds.length, audioEnabled, isMuted, playWarningAlarm]);

  if (warningBeds.length === 0) return null;

  return (
    <div className="flex-shrink-0 bg-yellow-950/80 border-t border-yellow-500/50">
      <div className="flex items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="font-medium text-yellow-200 text-xs">
            WARNING: {warningBeds.map(bed => `BED ${bed}`).join(', ')}
          </span>
        </div>
        <button
          onClick={onAcknowledge}
          className="px-3 py-1 text-xs font-medium text-yellow-200 border border-yellow-500/50 hover:bg-yellow-900/50 rounded transition-colors"
        >
          ACKNOWLEDGE
        </button>
      </div>
    </div>
  );
}
