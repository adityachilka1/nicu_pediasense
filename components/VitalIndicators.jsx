'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { TREND } from '@/context/VitalsContext';

/**
 * Visual indicators for real-time vital signs
 * - TrendArrow: Shows trend direction (up/down/stable)
 * - ValueFlash: Flash animation when value changes
 * - AnimatedValue: Value display with change animation
 */

// Trend arrow indicator - memoized since it only depends on trend and color
export const TrendArrow = memo(function TrendArrow({ trend, color, size = 'sm' }) {
  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (trend === TREND.STABLE) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center opacity-40`}
        title="Stable"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3">
          <line x1="4" y1="12" x2="20" y2="12" />
        </svg>
      </div>
    );
  }

  const isUp = trend === TREND.UP;

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center ${isUp ? 'animate-bounce-subtle-up' : 'animate-bounce-subtle-down'}`}
      title={isUp ? 'Increasing' : 'Decreasing'}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isUp ? '' : 'rotate-180'}
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </div>
  );
});

// Flash animation wrapper for value changes - memoized
export const ValueFlash = memo(function ValueFlash({ children, flash, color = '#00FFFF', duration = 500 }) {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevFlashRef = useRef(flash);

  useEffect(() => {
    if (flash && !prevFlashRef.current) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), duration);
      return () => clearTimeout(timer);
    }
    prevFlashRef.current = flash;
  }, [flash, duration]);

  return (
    <span
      className={`relative inline-block transition-all duration-150 ${isFlashing ? 'scale-110' : 'scale-100'}`}
      style={{
        textShadow: isFlashing ? `0 0 20px ${color}, 0 0 40px ${color}` : `0 0 10px ${color}40`,
      }}
    >
      {children}
      {isFlashing && (
        <span
          className="absolute inset-0 animate-ping-once rounded"
          style={{ backgroundColor: color, opacity: 0.3 }}
        />
      )}
    </span>
  );
});

// Animated value with trend and flash - memoized
export const AnimatedValue = memo(function AnimatedValue({
  value,
  previousValue,
  trend,
  changed,
  color,
  unit,
  size = 'normal',
  showTrend = true,
}) {
  const sizeClasses = {
    small: 'text-lg',
    normal: 'text-2xl',
    medium: 'text-3xl',
    large: 'text-5xl',
  };

  return (
    <div className="flex items-baseline gap-1">
      <ValueFlash flash={changed} color={color}>
        <span
          className={`font-mono font-bold ${sizeClasses[size]} leading-none tracking-tight`}
          style={{
            color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
      </ValueFlash>
      {unit && <span className="text-xs text-slate-400">{unit}</span>}
      {showTrend && trend && (
        <TrendArrow trend={trend} color={color} size="sm" />
      )}
    </div>
  );
});

// Compact vital display with all features - memoized for performance
export const VitalDisplay = memo(function VitalDisplay({
  label,
  value,
  unit,
  color,
  trend,
  changed,
  limits,
  alarmState = 'none',
  size = 'normal',
}) {
  const isAlarm = alarmState === 'high' || alarmState === 'crisis';
  const isWarning = alarmState === 'medium';

  const bgColor = isAlarm
    ? 'rgba(127, 29, 29, 0.4)'
    : isWarning
    ? 'rgba(113, 63, 18, 0.3)'
    : 'transparent';

  const displayColor = isAlarm ? '#FF0000' : isWarning ? '#FFFF00' : color;

  return (
    <div
      className={`flex items-center justify-between px-2 py-1 rounded ${isAlarm ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase" style={{ color }}>
          {label}
        </span>
        <AnimatedValue
          value={value}
          trend={trend}
          changed={changed}
          color={displayColor}
          unit={unit}
          size={size}
          showTrend={true}
        />
      </div>
      {limits && (
        <div className="flex flex-col items-end text-[9px] font-mono opacity-60" style={{ color }}>
          <span>{limits[1]}</span>
          <span>{limits[0]}</span>
        </div>
      )}
    </div>
  );
});

// Real-time update indicator (shows when data was last updated)
export const UpdateIndicator = memo(function UpdateIndicator({ timestamp, interval = 2000 }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Date.now() - timestamp);
    }, 100);
    return () => clearInterval(timer);
  }, [timestamp]);

  const progress = Math.min(1, elapsed / interval);
  const isStale = elapsed > interval * 2;

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full transition-all ${isStale ? 'bg-red-500' : 'bg-emerald-500'}`}
        style={{
          opacity: isStale ? 1 : 0.5 + progress * 0.5,
          transform: `scale(${0.8 + progress * 0.2})`,
        }}
      />
      <span className="text-[9px] font-mono text-slate-500">
        {isStale ? 'STALE' : 'LIVE'}
      </span>
    </div>
  );
});

// Simulation control button - memoized
export const SimulationToggle = memo(function SimulationToggle({ isSimulating, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
        isSimulating
          ? 'bg-emerald-900/50 border border-emerald-700/50 text-emerald-400 hover:bg-emerald-900'
          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'
      }`}
      title={isSimulating ? 'Pause simulation' : 'Resume simulation'}
    >
      {isSimulating ? (
        <>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          <span>Live</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          <span>Paused</span>
        </>
      )}
    </button>
  );
});

// Speed control for simulation - memoized
export const SpeedControl = memo(function SpeedControl({ speed, onSpeedChange, speeds = [500, 1000, 2000, 5000] }) {
  const labels = {
    500: '0.5s',
    1000: '1s',
    2000: '2s',
    5000: '5s',
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded border border-slate-700/50">
      <span className="text-[9px] text-slate-500 uppercase mr-1">Speed</span>
      {speeds.map(s => (
        <button
          key={s}
          onClick={() => onSpeedChange(s)}
          className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
            speed === s
              ? 'bg-cyan-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          {labels[s] || `${s}ms`}
        </button>
      ))}
    </div>
  );
});

// CSS for custom animations (add to global styles)
export const vitalIndicatorStyles = `
  @keyframes bounce-subtle-up {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }

  @keyframes bounce-subtle-down {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(2px); }
  }

  @keyframes ping-once {
    0% { transform: scale(1); opacity: 0.3; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  .animate-bounce-subtle-up {
    animation: bounce-subtle-up 1s ease-in-out infinite;
  }

  .animate-bounce-subtle-down {
    animation: bounce-subtle-down 1s ease-in-out infinite;
  }

  .animate-ping-once {
    animation: ping-once 0.5s ease-out forwards;
  }
`;
