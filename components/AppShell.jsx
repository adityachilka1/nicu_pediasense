'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navigation from './Navigation';
import { initialPatients } from '@/lib/data';
import { AlarmSoundControls, useAlarmSound } from './AlarmSound';
import { ThemeToggle } from './ThemeProvider';
import { NotificationBell, NotificationsPanel } from './NotificationsPanel';
import { useVitals } from '@/context/VitalsContext';

// Data Source Indicator Component - Shows when running in simulation mode
function DataSourceIndicator() {
  const { dataSource, isSimulating, vitalsMap, refreshData } = useVitals();
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isStale, setIsStale] = useState(false);

  // Track last update time and detect stale data
  useEffect(() => {
    const vitalsArray = Object.values(vitalsMap);
    if (vitalsArray.length > 0) {
      const latestTimestamp = Math.max(...vitalsArray.map(v => v.timestamp || 0));
      setLastUpdate(latestTimestamp);
    }
  }, [vitalsMap]);

  // Check for stale data (no update in 10 seconds)
  useEffect(() => {
    const checkStale = setInterval(() => {
      const timeSinceUpdate = Date.now() - lastUpdate;
      setIsStale(timeSinceUpdate > 10000); // 10 seconds
    }, 1000);
    return () => clearInterval(checkStale);
  }, [lastUpdate]);

  const isSimulationMode = dataSource === 'simulation' || isSimulating;

  if (isSimulationMode) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 bg-yellow-900/30 border border-yellow-600/50 rounded"
        role="status"
        aria-live="polite"
      >
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" aria-hidden="true" />
        <span className="text-[10px] font-bold text-yellow-400">SIMULATION</span>
        <button
          onClick={() => refreshData?.()}
          className="ml-1 text-[9px] text-yellow-500 hover:text-yellow-300 underline"
          aria-label="Retry connecting to live data"
        >
          retry
        </button>
      </div>
    );
  }

  if (isStale) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 bg-orange-900/30 border border-orange-600/50 rounded"
        role="alert"
        aria-live="assertive"
      >
        <span className="w-2 h-2 rounded-full bg-orange-500" aria-hidden="true" />
        <span className="text-[10px] font-bold text-orange-400">STALE DATA</span>
        <button
          onClick={() => refreshData?.()}
          className="ml-1 text-[9px] text-orange-500 hover:text-orange-300 underline"
          aria-label="Refresh vitals data"
        >
          refresh
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 bg-emerald-900/30 border border-emerald-700/50 rounded"
      role="status"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
      <span className="text-[10px] font-bold text-emerald-400">LIVE</span>
    </div>
  );
}

// Wrapper to safely use VitalsContext (may not be available in all contexts)
function SafeDataSourceIndicator() {
  try {
    return <DataSourceIndicator />;
  } catch {
    // VitalsContext not available, show default connected status
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-900/30 border border-emerald-700/50 rounded">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-bold text-emerald-400">CONNECTED</span>
      </div>
    );
  }
}

export default function AppShell({ children, showNav = true }) {
  const [currentTime, setCurrentTime] = useState(null);

  // Calculate real alarm counts from patient data
  const alarmCounts = useMemo(() => {
    const critical = initialPatients.filter(p => p.status === 'critical').length;
    const warning = initialPatients.filter(p => p.status === 'warning').length;
    return { critical, warning, total: critical + warning };
  }, []);

  useEffect(() => {
    setCurrentTime(new Date()); // Set initial time on client only
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  if (!showNav) {
    return <>{children}</>;
  }
  
  return (
    <div className="min-h-screen flex">
      <Navigation alarmCount={alarmCounts.total} />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 flex-shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium text-slate-400">NICU CENTRAL STATION</h1>
            <span className="text-xs text-slate-600">Floor 3 West • Unit A</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Alarm Summary - Clickable */}
            <Link
              href="/alarms"
              className={`flex items-center gap-3 px-3 py-1.5 bg-black/40 border rounded text-[11px] transition-colors ${
                alarmCounts.critical > 0
                  ? 'border-red-500/50 hover:bg-red-900/20'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full bg-red-500 ${alarmCounts.critical > 0 ? 'animate-pulse' : 'opacity-30'}`} />
                <span className="font-mono font-bold text-red-400">{alarmCounts.critical}</span>
                <span className="text-slate-500">CRIT</span>
              </div>
              <span className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full bg-yellow-500 ${alarmCounts.warning > 0 ? '' : 'opacity-30'}`} />
                <span className="font-mono font-bold text-yellow-400">{alarmCounts.warning}</span>
                <span className="text-slate-500">WARN</span>
              </div>
            </Link>

            {/* Sound Controls */}
            <AlarmSoundControls />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <NotificationBell />

            {/* Clock */}
            <div className="text-right">
              <div className="text-base font-mono font-bold text-white tabular-nums">
                {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {currentTime ? currentTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '--/--/--'}
              </div>
            </div>
            
            {/* Data Source Status - Shows LIVE, SIMULATION, or STALE DATA */}
            <SafeDataSourceIndicator />
          </div>
        </header>

        {/* Notifications Panel */}
        <NotificationsPanel />

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
