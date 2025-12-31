'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { initialPatients } from '@/lib/data';

export default function AlarmLimitsPage() {
  const [selectedPatient, setSelectedPatient] = useState(initialPatients[0]);
  const [limits, setLimits] = useState({
    spo2: { low: 88, high: 100, enabled: true },
    pr: { low: 100, high: 180, enabled: true },
    rr: { low: 25, high: 70, enabled: true },
    temp: { low: 36.0, high: 38.0, enabled: true },
    apnea: { duration: 20, enabled: true },
    brady: { threshold: 80, duration: 10, enabled: true },
  });
  
  const presets = [
    { name: 'Extremely Preterm (<28 weeks)', spo2Low: 85, spo2High: 95, prLow: 100, prHigh: 190 },
    { name: 'Very Preterm (28-32 weeks)', spo2Low: 88, spo2High: 95, prLow: 100, prHigh: 180 },
    { name: 'Moderate Preterm (32-34 weeks)', spo2Low: 90, spo2High: 98, prLow: 100, prHigh: 170 },
    { name: 'Late Preterm (34-37 weeks)', spo2Low: 92, spo2High: 100, prLow: 100, prHigh: 160 },
    { name: 'Term (>37 weeks)', spo2Low: 95, spo2High: 100, prLow: 100, prHigh: 160 },
  ];

  const updateLimit = (param, field, value) => {
    setLimits(prev => ({
      ...prev,
      [param]: { ...prev[param], [field]: value }
    }));
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Alarm Limits</h1>
            <p className="text-sm text-slate-400 mt-1">Configure patient-specific alarm thresholds</p>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          {/* Patient Selector */}
          <div className="col-span-3">
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h2 className="font-bold text-white">Select Patient</h2>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {initialPatients.map(patient => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      selectedPatient.id === patient.id
                        ? 'bg-cyan-500/10 border-l-2 border-cyan-500'
                        : 'hover:bg-slate-800 border-l-2 border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      patient.status === 'critical' ? 'bg-red-500/20 text-red-400' :
                      patient.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {patient.bed}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">{patient.name}</div>
                      <div className="text-xs text-slate-500">GA {patient.ga} • DOL {patient.dol}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Limits Editor */}
          <div className="col-span-9 space-y-6">
            {/* Patient Header */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold ${
                    selectedPatient.status === 'critical' ? 'bg-red-500/20 text-red-400' :
                    selectedPatient.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {selectedPatient.bed}
                  </div>
                  <div>
                    <div className="text-lg text-white font-bold">{selectedPatient.name}</div>
                    <div className="text-sm text-slate-400">
                      GA {selectedPatient.ga} • DOL {selectedPatient.dol} • {selectedPatient.weight} kg
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                    <option value="">Apply Preset...</option>
                    {presets.map((preset, i) => (
                      <option key={i} value={i}>{preset.name}</option>
                    ))}
                  </select>
                  <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
                    Reset to Default
                  </button>
                </div>
              </div>
            </div>
            
            {/* Vital Signs Limits */}
            <div className="grid grid-cols-2 gap-6">
              {/* SpO2 */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-cyan-400" />
                    <h3 className="text-white font-bold">SpO2 Limits</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={limits.spo2.enabled}
                      onChange={(e) => updateLimit('spo2', 'enabled', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-400">Enabled</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Low Limit (%)</label>
                    <input
                      type="number"
                      value={limits.spo2.low}
                      onChange={(e) => updateLimit('spo2', 'low', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">High Limit (%)</label>
                    <input
                      type="number"
                      value={limits.spo2.high}
                      onChange={(e) => updateLimit('spo2', 'high', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 via-emerald-500 to-red-500"
                    style={{ 
                      marginLeft: `${limits.spo2.low}%`,
                      width: `${limits.spo2.high - limits.spo2.low}%`
                    }}
                  />
                </div>
              </div>
              
              {/* Pulse Rate */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <h3 className="text-white font-bold">Pulse Rate Limits</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={limits.pr.enabled}
                      onChange={(e) => updateLimit('pr', 'enabled', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-400">Enabled</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Low Limit (bpm)</label>
                    <input
                      type="number"
                      value={limits.pr.low}
                      onChange={(e) => updateLimit('pr', 'low', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">High Limit (bpm)</label>
                    <input
                      type="number"
                      value={limits.pr.high}
                      onChange={(e) => updateLimit('pr', 'high', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
              
              {/* Respiratory Rate */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <h3 className="text-white font-bold">Respiratory Rate Limits</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={limits.rr.enabled}
                      onChange={(e) => updateLimit('rr', 'enabled', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-400">Enabled</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Low Limit (br/min)</label>
                    <input
                      type="number"
                      value={limits.rr.low}
                      onChange={(e) => updateLimit('rr', 'low', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">High Limit (br/min)</label>
                    <input
                      type="number"
                      value={limits.rr.high}
                      onChange={(e) => updateLimit('rr', 'high', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
              
              {/* Temperature */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-pink-400" />
                    <h3 className="text-white font-bold">Temperature Limits</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={limits.temp.enabled}
                      onChange={(e) => updateLimit('temp', 'enabled', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-400">Enabled</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Low Limit (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={limits.temp.low}
                      onChange={(e) => updateLimit('temp', 'low', parseFloat(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">High Limit (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={limits.temp.high}
                      onChange={(e) => updateLimit('temp', 'high', parseFloat(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Apnea & Bradycardia */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <h3 className="text-white font-bold">Apnea Detection</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={limits.apnea.enabled}
                      onChange={(e) => updateLimit('apnea', 'enabled', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-400">Enabled</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Apnea Duration (seconds)</label>
                  <input
                    type="number"
                    value={limits.apnea.duration}
                    onChange={(e) => updateLimit('apnea', 'duration', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-xs text-slate-500 mt-2">Alarm triggers if no breath detected for this duration</p>
                </div>
              </div>
              
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-orange-400" />
                    <h3 className="text-white font-bold">Bradycardia Detection</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={limits.brady.enabled}
                      onChange={(e) => updateLimit('brady', 'enabled', e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-400">Enabled</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">HR Threshold (bpm)</label>
                    <input
                      type="number"
                      value={limits.brady.threshold}
                      onChange={(e) => updateLimit('brady', 'threshold', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Duration (seconds)</label>
                    <input
                      type="number"
                      value={limits.brady.duration}
                      onChange={(e) => updateLimit('brady', 'duration', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
                Cancel
              </button>
              <button className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors">
                Save Limits
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
