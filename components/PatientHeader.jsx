'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getStatusColor } from '@/lib/data';
import { useToast } from '@/components/Toast';

export default function PatientHeader({ patient }) {
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const toast = useToast();

  // Default limits based on patient data or standard values
  const [limits, setLimits] = useState({
    hrLow: patient?.limits?.pr?.[0] || 100,
    hrHigh: patient?.limits?.pr?.[1] || 180,
    spo2Low: patient?.limits?.spo2?.[0] || 88,
    spo2High: patient?.limits?.spo2?.[1] || 100,
    rrLow: patient?.limits?.rr?.[0] || 25,
    rrHigh: patient?.limits?.rr?.[1] || 70,
    tempLow: patient?.limits?.temp?.[0] || 36.0,
    tempHigh: patient?.limits?.temp?.[1] || 38.0,
  });

  const handleSaveLimits = () => {
    toast.success('Alarm limits updated successfully');
    setShowLimitsModal(false);
  };

  const handleSilenceAlarms = () => {
    setSilenced(!silenced);
    if (!silenced) {
      toast.warning('Alarms silenced for 2 minutes');
      setTimeout(() => {
        setSilenced(false);
        toast.info('Alarms reactivated');
      }, 120000); // 2 minutes
    } else {
      toast.success('Alarms reactivated');
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/patients" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">BED {patient.bed}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(patient.status)}`}>
                {patient.status === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />}
                {patient.status.toUpperCase()}
              </span>
              {silenced && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                  SILENCED
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">{patient.name} • {patient.mrn}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLimitsModal(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Edit Limits
          </button>
          <button
            onClick={handleSilenceAlarms}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              silenced
                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {silenced ? 'Reactivate Alarms' : 'Silence Alarms'}
          </button>
          <Link href="/" className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors">
            Back to Monitor
          </Link>
        </div>
      </div>

      {/* Edit Limits Modal */}
      {showLimitsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Edit Alarm Limits</h3>
              <button
                onClick={() => setShowLimitsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Heart Rate */}
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-cyan-400 font-bold">HR</span>
                  <span className="text-slate-400 text-sm">Heart Rate (bpm)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Low Limit</label>
                    <input
                      type="number"
                      value={limits.hrLow}
                      onChange={(e) => setLimits({...limits, hrLow: parseInt(e.target.value)})}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">High Limit</label>
                    <input
                      type="number"
                      value={limits.hrHigh}
                      onChange={(e) => setLimits({...limits, hrHigh: parseInt(e.target.value)})}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* SpO2 */}
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-cyan-400 font-bold">SpO₂</span>
                  <span className="text-slate-400 text-sm">Oxygen Saturation (%)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Low Limit</label>
                    <input
                      type="number"
                      value={limits.spo2Low}
                      onChange={(e) => setLimits({...limits, spo2Low: parseInt(e.target.value)})}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">High Limit</label>
                    <input
                      type="number"
                      value={limits.spo2High}
                      onChange={(e) => setLimits({...limits, spo2High: parseInt(e.target.value)})}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Respiratory Rate */}
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-yellow-400 font-bold">RR</span>
                  <span className="text-slate-400 text-sm">Respiratory Rate (/min)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Low Limit</label>
                    <input
                      type="number"
                      value={limits.rrLow}
                      onChange={(e) => setLimits({...limits, rrLow: parseInt(e.target.value)})}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">High Limit</label>
                    <input
                      type="number"
                      value={limits.rrHigh}
                      onChange={(e) => setLimits({...limits, rrHigh: parseInt(e.target.value)})}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Temperature */}
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-pink-400 font-bold">TEMP</span>
                  <span className="text-slate-400 text-sm">Temperature (°C)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Low Limit</label>
                    <input
                      type="number"
                      step="0.1"
                      value={limits.tempLow}
                      onChange={(e) => setLimits({...limits, tempLow: parseFloat(e.target.value)})}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">High Limit</label>
                    <input
                      type="number"
                      step="0.1"
                      value={limits.tempHigh}
                      onChange={(e) => setLimits({...limits, tempHigh: parseFloat(e.target.value)})}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => setShowLimitsModal(false)}
                className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLimits}
                className="flex-1 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
