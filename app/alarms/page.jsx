'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { formatTimeAgo } from '@/lib/data';
import { useToast } from '@/components/Toast';
import { useVitals } from '@/context/VitalsContext';

// Fallback alarm data for demo mode
const fallbackAlarms = [
  { id: 1, bed: '04', type: 'critical', param: 'SpO₂', value: 84, threshold: '< 88%', time: new Date(Date.now() - 120000), acknowledged: false, patient: 'WILLIAMS, BABY' },
  { id: 2, bed: '06', type: 'warning', param: 'RR', value: 68, threshold: '> 70', time: new Date(Date.now() - 300000), acknowledged: false, patient: 'BROWN, BABY' },
  { id: 3, bed: '02', type: 'apnea', param: 'Apnea', value: '22s', threshold: '> 20s', time: new Date(Date.now() - 180000), acknowledged: false, patient: 'MARTINEZ, BABY' },
];

export default function AlarmsPage() {
  const toast = useToast();
  const { patients } = useVitals();
  const [activeTab, setActiveTab] = useState('active');
  const [selectedBed, setSelectedBed] = useState('all');
  const [alarms, setAlarms] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState('api');
  const [alarmLimits, setAlarmLimits] = useState([
    { param: 'SpO₂', low: 88, high: 100, priority: 'High', audio: true, color: 'text-cyan-400' },
    { param: 'PR', low: 100, high: 180, priority: 'High', audio: true, color: 'text-cyan-400' },
    { param: 'RR', low: 25, high: 70, priority: 'Medium', audio: true, color: 'text-yellow-400' },
    { param: 'Temp', low: 36.0, high: 38.0, priority: 'Medium', audio: false, color: 'text-pink-400' },
    { param: 'Apnea', low: '-', high: '20s', priority: 'High', audio: true, color: 'text-orange-400' },
  ]);

  // Fetch alarms from API
  const fetchAlarms = useCallback(async () => {
    try {
      const response = await fetch('/api/alarms');
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - use fallback data
          setDataSource('demo');
          setAlarms(fallbackAlarms);
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }
      const result = await response.json();
      const apiAlarms = result.data || [];

      if (apiAlarms.length === 0) {
        // No alarms in database - use fallback for demo
        setDataSource('demo');
        setAlarms(fallbackAlarms);
        return;
      }

      // Transform API data - API already returns flat structure
      const transformedAlarms = apiAlarms.map(a => ({
        id: a.id,
        bed: a.bed || '--',
        type: a.type || 'warning',
        param: a.parameter,
        value: a.value,
        threshold: a.threshold,
        time: new Date(a.triggeredAt),
        acknowledged: a.status === 'acknowledged' || a.status === 'resolved',
        acknowledgedBy: a.acknowledgedBy || null,
        patient: a.patientName || 'Unknown',
      }));

      setAlarms(transformedAlarms);
      setDataSource('api');
    } catch (err) {
      console.error('Failed to fetch alarms:', err);
      setDataSource('demo');
      setAlarms(fallbackAlarms);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  // Poll for updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchAlarms, 10000);
    return () => clearInterval(interval);
  }, [fetchAlarms]);

  const handleAcknowledge = (alarmId) => {
    setAlarms(prev => prev.map(a =>
      a.id === alarmId ? { ...a, acknowledged: true, acknowledgedBy: 'Current User' } : a
    ));
  };

  const handleAcknowledgeAll = () => {
    setAlarms(prev => prev.map(a => ({ ...a, acknowledged: true, acknowledgedBy: 'Current User' })));
  };

  const toggleAudio = (index) => {
    setAlarmLimits(prev => prev.map((item, i) =>
      i === index ? { ...item, audio: !item.audio } : item
    ));
  };

  const activeAlarms = alarms.filter(a => !a.acknowledged);
  const acknowledgedAlarms = alarms.filter(a => a.acknowledged);
  
  const displayAlarms = activeTab === 'active' ? activeAlarms : acknowledgedAlarms;
  const filteredAlarms = selectedBed === 'all' 
    ? displayAlarms 
    : displayAlarms.filter(a => a.bed === selectedBed);
  
  const getAlarmColor = (type) => {
    switch (type) {
      case 'critical': return 'bg-red-500/10 border-red-500/50 text-red-400';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400';
      case 'apnea': return 'bg-orange-500/10 border-orange-500/50 text-orange-400';
      case 'brady': return 'bg-orange-500/10 border-orange-500/50 text-orange-400';
      default: return 'bg-slate-500/10 border-slate-500/50 text-slate-400';
    }
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading alarms from database...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Alarm Management</h1>
            <p className="text-sm text-slate-400 mt-1">
              {activeAlarms.length} active alarm{activeAlarms.length !== 1 ? 's' : ''}
              {dataSource === 'api' && <span className="ml-2 text-emerald-400">● Live Data</span>}
              {dataSource === 'demo' && <span className="ml-2 text-yellow-400">● Demo Mode</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Alarm Settings
            </button>
            <button
              onClick={handleAcknowledgeAll}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
            >
              Acknowledge All
            </button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-red-400 mb-1">CRITICAL</div>
                <div className="font-mono font-bold text-3xl text-red-400">
                  {alarms.filter(a => a.type === 'critical' && !a.acknowledged).length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-yellow-400 mb-1">WARNING</div>
                <div className="font-mono font-bold text-3xl text-yellow-400">
                  {alarms.filter(a => a.type === 'warning' && !a.acknowledged).length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-orange-400 mb-1">A/B EVENTS</div>
                <div className="font-mono font-bold text-3xl text-orange-400">
                  {alarms.filter(a => (a.type === 'apnea' || a.type === 'brady') && !a.acknowledged).length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 mb-1">SILENCED</div>
                <div className="font-mono font-bold text-3xl text-slate-300">
                  0
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs & Filters */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2" role="tablist" aria-label="Alarm categories">
            <button
              onClick={() => setActiveTab('active')}
              role="tab"
              aria-selected={activeTab === 'active'}
              aria-controls="alarm-list"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'active'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Active ({activeAlarms.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              role="tab"
              aria-selected={activeTab === 'history'}
              aria-controls="alarm-list"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              History ({acknowledgedAlarms.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="bed-filter" className="sr-only">Filter by bed</label>
            <select
              id="bed-filter"
              value={selectedBed}
              onChange={(e) => setSelectedBed(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Beds</option>
              {patients.map(p => (
                <option key={p.id} value={p.bed}>BED {p.bed}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Alarm List */}
        <div
          id="alarm-list"
          role="tabpanel"
          aria-label={`${activeTab === 'active' ? 'Active' : 'Historical'} alarms list`}
          className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden"
        >
          {filteredAlarms.length === 0 ? (
            <div className="p-8 text-center text-slate-500" role="status">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No {activeTab === 'active' ? 'active' : 'historical'} alarms</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800" role="list" aria-live="polite">
              {filteredAlarms.map((alarm) => (
                <article
                  key={alarm.id}
                  role="listitem"
                  className={`p-4 hover:bg-slate-800/50 transition-colors ${alarm.type === 'critical' && !alarm.acknowledged ? 'animate-pulse bg-red-900/10' : ''}`}
                  aria-label={`${alarm.type} alarm for Bed ${alarm.bed}, ${alarm.param}: ${alarm.value}${!alarm.acknowledged ? ', requires acknowledgement' : ', acknowledged'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getAlarmColor(alarm.type)}`}>
                        {(alarm.type || 'unknown').toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/patient/${patients.find(p => p.bed === alarm.bed)?.id || 1}`}
                            className="font-mono font-bold text-white hover:text-cyan-400 transition-colors"
                            aria-label={`Go to patient in Bed ${alarm.bed}`}
                          >
                            BED {alarm.bed} →
                          </Link>
                          <span className="text-slate-500" aria-hidden="true">•</span>
                          <span className="text-slate-300">{alarm.param}</span>
                        </div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          Value: <span className="text-white font-mono">{alarm.value}</span>
                          {' '}(Limit: {alarm.threshold})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-slate-400">{formatTimeAgo(alarm.time)}</div>
                        {alarm.acknowledged && (
                          <div className="text-xs text-slate-500">by {alarm.acknowledgedBy}</div>
                        )}
                      </div>

                      {!alarm.acknowledged && (
                        <button
                          onClick={() => handleAcknowledge(alarm.id)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                          aria-label={`Acknowledge ${alarm.type} alarm for Bed ${alarm.bed}`}
                        >
                          ACK
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        
        {/* Alarm Limits Configuration */}
        <section className="mt-8" aria-labelledby="alarm-limits-heading">
          <h2 id="alarm-limits-heading" className="text-lg font-bold text-white mb-4">Default Alarm Limits</h2>
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full" aria-label="Alarm limits configuration">
              <thead>
                <tr className="border-b border-slate-800">
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Parameter</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Low Limit</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">High Limit</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Priority</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Audio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {alarmLimits.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-800/50">
                    <th scope="row" className={`px-4 py-3 font-medium ${row.color}`}>{row.param}</th>
                    <td className="px-4 py-3">
                      <label htmlFor={`low-limit-${i}`} className="sr-only">{row.param} low limit</label>
                      <input
                        id={`low-limit-${i}`}
                        type="text"
                        value={row.low}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAlarmLimits(prev => prev.map((item, idx) =>
                            idx === i ? { ...item, low: isNaN(val) ? val : parseFloat(val) || val } : item
                          ));
                        }}
                        className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <label htmlFor={`high-limit-${i}`} className="sr-only">{row.param} high limit</label>
                      <input
                        id={`high-limit-${i}`}
                        type="text"
                        value={row.high}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAlarmLimits(prev => prev.map((item, idx) =>
                            idx === i ? { ...item, high: isNaN(val) ? val : parseFloat(val) || val } : item
                          ));
                        }}
                        className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <label htmlFor={`priority-${i}`} className="sr-only">{row.param} priority</label>
                      <select
                        id={`priority-${i}`}
                        value={row.priority}
                        onChange={(e) => {
                          setAlarmLimits(prev => prev.map((item, idx) =>
                            idx === i ? { ...item, priority: e.target.value } : item
                          ));
                        }}
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                      >
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAudio(i)}
                        role="switch"
                        aria-checked={row.audio}
                        aria-label={`Audio alarm for ${row.param}`}
                        className={`w-10 h-6 rounded-full transition-colors ${row.audio ? 'bg-cyan-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${row.audio ? 'translate-x-4' : 'translate-x-0.5'}`} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Alarm Settings Modal */}
        {showSettings && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowSettings(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 id="settings-modal-title" className="text-lg font-bold text-white">Alarm Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                  aria-label="Close settings"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="alarm-volume" className="block text-sm text-slate-400 mb-2">Alarm Volume</label>
                  <input
                    id="alarm-volume"
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="70"
                    className="w-full"
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <div>
                  <label htmlFor="silence-duration" className="block text-sm text-slate-400 mb-2">Default Silence Duration</label>
                  <select id="silence-duration" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
                    <option value="60">1 minute</option>
                    <option value="120">2 minutes</option>
                    <option value="300">5 minutes</option>
                    <option value="600">10 minutes</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="escalation-policy" className="block text-sm text-slate-400 mb-2">Escalation Policy</label>
                  <select id="escalation-policy" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
                    <option>Immediate notification</option>
                    <option>After 1 minute</option>
                    <option>After 2 minutes</option>
                  </select>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span id="night-mode-label" className="text-sm text-slate-300">Enable night mode (reduced volume)</span>
                  <button
                    role="switch"
                    aria-checked="false"
                    aria-labelledby="night-mode-label"
                    className="w-10 h-6 rounded-full bg-slate-700 transition-colors"
                  >
                    <div className="w-5 h-5 bg-white rounded-full translate-x-0.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast.success('Alarm settings saved!');
                    setShowSettings(false);
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
