'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';

// Helper function for status colors
const getStatusColor = (status) => {
  switch (status) {
    case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    default: return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  }
};

// Helper to determine current shift
function getCurrentShift(date = new Date()) {
  const hours = date.getHours();
  if (hours >= 7 && hours < 15) return 'day';
  if (hours >= 15 && hours < 23) return 'evening';
  return 'night';
}

export default function HandoffPage() {
  const { data: session } = useSession();
  const toast = useToast();

  // State
  const [selectedShift, setSelectedShift] = useState(getCurrentShift());
  const [patients, setPatients] = useState([]);
  const [handoffNotes, setHandoffNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmNoNotes, setShowConfirmNoNotes] = useState(false);
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [acknowledgment, setAcknowledgment] = useState({
    nurseName: '',
    nurseId: '',
  });

  // Fetch data on mount and when shift changes
  useEffect(() => {
    fetchHandoffData();
  }, [selectedShift]);

  const fetchHandoffData = async () => {
    try {
      setLoading(true);

      // Fetch current shift patients with handoff notes
      const response = await fetch(`/api/handoff/current?shift=${selectedShift}`);

      if (!response.ok) {
        throw new Error('Failed to fetch handoff data');
      }

      const result = await response.json();
      const patientsData = result.data.patients || [];

      setPatients(patientsData);

      // Build handoff notes map from existing notes
      const notesMap = {};
      patientsData.forEach(patient => {
        if (patient.handoffNote) {
          notesMap[patient.id] = {
            id: patient.handoffNote.id,
            situation: patient.handoffNote.situation || '',
            background: patient.handoffNote.background || '',
            assessment: patient.handoffNote.assessment || '',
            recommendation: patient.handoffNote.recommendation || '',
            status: patient.handoffNote.status,
            acuity: patient.handoffNote.acuity,
          };
        } else {
          // Initialize empty note
          notesMap[patient.id] = {
            situation: '',
            background: '',
            assessment: '',
            recommendation: '',
            status: 'draft',
          };
        }
      });

      setHandoffNotes(notesMap);
    } catch (error) {
      console.error('Error fetching handoff data:', error);
      toast.error('Failed to load handoff data');
    } finally {
      setLoading(false);
    }
  };

  const updateHandoffNote = (patientId, field, value) => {
    setHandoffNotes(prev => ({
      ...prev,
      [patientId]: {
        ...prev[patientId],
        [field]: value,
      },
    }));
  };

  const saveHandoffNote = async (patientId) => {
    const note = handoffNotes[patientId];
    if (!note) return;

    try {
      const patient = patients.find(p => p.id === patientId);
      if (!patient) return;

      const payload = {
        patientId,
        shift: selectedShift,
        shiftDate: new Date().toISOString(),
        situation: note.situation || null,
        background: note.background || null,
        assessment: note.assessment || null,
        recommendation: note.recommendation || null,
        acuity: patient.status === 'critical' ? 'critical' : patient.status === 'warning' ? 'moderate' : 'stable',
        status: 'draft',
      };

      const response = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save handoff note');
      }

      const result = await response.json();

      // Update local state with saved note ID
      setHandoffNotes(prev => ({
        ...prev,
        [patientId]: {
          ...prev[patientId],
          id: result.data.id,
        },
      }));

      toast.success('Handoff note saved');
    } catch (error) {
      console.error('Error saving handoff note:', error);
      toast.error('Failed to save handoff note');
    }
  };

  const handleCompleteHandoff = async () => {
    // Check if any notes have been added
    const hasNotes = Object.values(handoffNotes).some(note =>
      note.situation || note.background || note.assessment || note.recommendation
    );

    if (!hasNotes) {
      setShowConfirmNoNotes(true);
      return;
    }

    await submitAllHandoffs();
  };

  const submitAllHandoffs = async () => {
    try {
      setSaving(true);

      // Save all draft notes first
      const savePromises = patients.map(async (patient) => {
        const note = handoffNotes[patient.id];
        if (!note || note.status !== 'draft') return;

        // Only save if there's content
        if (!note.situation && !note.background && !note.assessment && !note.recommendation) {
          return;
        }

        const payload = {
          patientId: patient.id,
          shift: selectedShift,
          shiftDate: new Date().toISOString(),
          situation: note.situation || null,
          background: note.background || null,
          assessment: note.assessment || null,
          recommendation: note.recommendation || null,
          acuity: patient.status === 'critical' ? 'critical' : patient.status === 'warning' ? 'moderate' : 'stable',
          status: 'submitted',
        };

        const response = await fetch('/api/handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to save handoff for patient ${patient.id}`);
        }

        return response.json();
      });

      await Promise.all(savePromises);

      toast.success('All handoff notes submitted successfully');
      setShowAcknowledgment(true);

      // Refresh data
      await fetchHandoffData();
    } catch (error) {
      console.error('Error submitting handoffs:', error);
      toast.error('Failed to submit handoff notes');
    } finally {
      setSaving(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!acknowledgment.nurseName || !acknowledgment.nurseId) {
      toast.error('Please enter your name and ID to acknowledge');
      return;
    }

    try {
      setSaving(true);

      // Acknowledge all submitted handoff notes
      const acknowledgePromises = Object.entries(handoffNotes)
        .filter(([_, note]) => note.id && note.status === 'submitted')
        .map(async ([patientId, note]) => {
          const response = await fetch(`/api/handoff/${note.id}/acknowledge`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signature: acknowledgment.nurseName,
              notes: `Acknowledged by ${acknowledgment.nurseName} (ID: ${acknowledgment.nurseId})`,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to acknowledge handoff for note ${note.id}`);
          }

          return response.json();
        });

      await Promise.all(acknowledgePromises);

      setShowAcknowledgment(false);
      toast.success(`Handoff acknowledged by ${acknowledgment.nurseName} at ${new Date().toLocaleTimeString()}`);

      // Refresh data
      await fetchHandoffData();

      // Reset acknowledgment form
      setAcknowledgment({ nurseName: '', nurseId: '' });
    } catch (error) {
      console.error('Error acknowledging handoffs:', error);
      toast.error('Failed to acknowledge handoff');
    } finally {
      setSaving(false);
    }
  };

  const completeHandoff = () => {
    setShowConfirmNoNotes(false);
    submitAllHandoffs();
  };

  const shifts = [
    { id: 'day', name: 'Day', time: '07:00-15:00' },
    { id: 'evening', name: 'Evening', time: '15:00-23:00' },
    { id: 'night', name: 'Night', time: '23:00-07:00' },
  ];

  // Group patients by acuity
  const criticalPatients = patients.filter(p => p.status === 'critical');
  const warningPatients = patients.filter(p => p.status === 'warning');
  const stablePatients = patients.filter(p => p.status === 'normal');

  const PatientHandoffCard = ({ patient }) => {
    const note = handoffNotes[patient.id] || {};
    const vitals = patient.vitals || {};
    const isAcknowledged = note.status === 'acknowledged';

    return (
      <div className={`bg-slate-800/50 rounded-xl border ${
        patient.status === 'critical' ? 'border-red-500/50' :
        patient.status === 'warning' ? 'border-yellow-500/50' :
        'border-slate-700'
      } overflow-hidden`}>
        {/* Header */}
        <div className={`px-4 py-3 ${
          patient.status === 'critical' ? 'bg-red-900/30' :
          patient.status === 'warning' ? 'bg-yellow-900/20' :
          'bg-slate-800/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/patient/${patient.id}`}
                className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
              >
                <span className="font-mono font-bold text-white">BED {patient.bed}</span>
                <span className="text-sm text-slate-300">{patient.name}</span>
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(patient.status)}`}>
                {patient.status.toUpperCase()}
              </span>
              {isAcknowledged && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ACKNOWLEDGED
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              GA {patient.gestationalAge} • {patient.currentWeight}kg • DOL {patient.dayOfLife}
            </div>
          </div>
        </div>

        {/* Content - SBAR Format */}
        <div className="p-4 space-y-4">
          {/* S - SITUATION: Current Status */}
          <div className="border-l-2 border-cyan-500 pl-3">
            <h4 className="text-xs font-bold text-cyan-400 uppercase mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px]">S</span>
              SITUATION - Current Status
            </h4>
            <div className="grid grid-cols-5 gap-2 text-sm mb-3">
              <div className="bg-slate-900/50 rounded px-3 py-2">
                <div className="text-xs text-cyan-400 mb-1">SpO₂</div>
                <div className="font-mono font-bold text-white">{vitals.spo2 || '--'}%</div>
              </div>
              <div className="bg-slate-900/50 rounded px-3 py-2">
                <div className="text-xs text-green-400 mb-1">HR</div>
                <div className="font-mono font-bold text-white">{vitals.heartRate || '--'}</div>
              </div>
              <div className="bg-slate-900/50 rounded px-3 py-2">
                <div className="text-xs text-yellow-400 mb-1">RR</div>
                <div className="font-mono font-bold text-white">{vitals.respRate || '--'}</div>
              </div>
              <div className="bg-slate-900/50 rounded px-3 py-2">
                <div className="text-xs text-pink-400 mb-1">Temp</div>
                <div className="font-mono font-bold text-white">{vitals.temperature ? `${vitals.temperature.toFixed(1)}°C` : '--'}</div>
              </div>
              <div className="bg-slate-900/50 rounded px-3 py-2">
                <div className="text-xs text-purple-400 mb-1">BP</div>
                <div className="font-mono font-bold text-white text-xs">
                  {vitals.bpSystolic && vitals.bpDiastolic ? `${vitals.bpSystolic}/${vitals.bpDiastolic}` : '--'}
                </div>
              </div>
            </div>
            <textarea
              placeholder="Describe current situation, status changes, recent events..."
              value={note.situation || ''}
              onChange={(e) => updateHandoffNote(patient.id, 'situation', e.target.value)}
              onBlur={() => saveHandoffNote(patient.id)}
              disabled={isAcknowledged}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              rows={2}
            />
          </div>

          {/* B - BACKGROUND: History & Diagnoses */}
          <div className="border-l-2 border-blue-500 pl-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px]">B</span>
              BACKGROUND - Relevant History
            </h4>
            <textarea
              placeholder="Relevant history, diagnoses, medications, allergies..."
              value={note.background || ''}
              onChange={(e) => updateHandoffNote(patient.id, 'background', e.target.value)}
              onBlur={() => saveHandoffNote(patient.id)}
              disabled={isAcknowledged}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              rows={2}
            />
          </div>

          {/* A - ASSESSMENT: Clinical Judgment */}
          <div className="border-l-2 border-amber-500 pl-3">
            <h4 className="text-xs font-bold text-amber-400 uppercase mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">A</span>
              ASSESSMENT - Clinical Judgment
            </h4>
            <textarea
              placeholder="Your clinical assessment, concerns, trends..."
              value={note.assessment || ''}
              onChange={(e) => updateHandoffNote(patient.id, 'assessment', e.target.value)}
              onBlur={() => saveHandoffNote(patient.id)}
              disabled={isAcknowledged}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              rows={2}
            />
          </div>

          {/* R - RECOMMENDATION: Handoff Notes */}
          <div className="border-l-2 border-green-500 pl-3">
            <h4 className="text-xs font-bold text-green-400 uppercase mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-[10px]">R</span>
              RECOMMENDATION - Handoff to Incoming Shift
            </h4>
            <textarea
              placeholder="Recommendations, pending tasks, what to watch for..."
              value={note.recommendation || ''}
              onChange={(e) => updateHandoffNote(patient.id, 'recommendation', e.target.value)}
              onBlur={() => saveHandoffNote(patient.id)}
              disabled={isAcknowledged}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500 text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              rows={2}
            />
          </div>

          {/* Active Alarms */}
          {patient.activeAlarms && patient.activeAlarms.length > 0 && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <div className="text-xs font-bold text-red-400 mb-2">ACTIVE ALARMS ({patient.activeAlarms.length})</div>
              <div className="space-y-1">
                {patient.activeAlarms.slice(0, 3).map((alarm, idx) => (
                  <div key={idx} className="text-xs text-slate-300">
                    {alarm.parameter}: {alarm.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading handoff data...</p>
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
            <h1 className="text-2xl font-bold text-white">Shift Handoff</h1>
            <p className="text-sm text-slate-400 mt-1">Prepare and document shift transition using SBAR format</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-800 rounded-lg p-1">
              {shifts.map(shift => (
                <button
                  key={shift.id}
                  onClick={() => setSelectedShift(shift.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedShift === shift.id
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {shift.name}
                  <span className="ml-2 text-xs opacity-70">{shift.time}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors flex items-center gap-2 print-button screen-only"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Report
              </button>
              <button
                onClick={handleCompleteHandoff}
                disabled={saving}
                className={`px-4 py-2 rounded-lg font-medium transition-colors screen-only ${
                  saving
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {saving ? 'Saving...' : 'Complete Handoff'}
              </button>
            </div>
          </div>
        </div>

        {/* Print Header - only visible when printing */}
        <div className="print-only print-header mb-6">
          <h1 className="text-xl font-bold">NICU Shift Handoff Report</h1>
          <p className="subtitle">SBAR Format • {new Date().toLocaleDateString()} • {shifts.find(s => s.id === selectedShift)?.name} Shift</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-400 mb-1">Total Patients</div>
            <div className="text-3xl font-bold text-white">{patients.length}</div>
          </div>
          <div className="bg-red-900/20 rounded-xl border border-red-500/30 p-4">
            <div className="text-xs text-red-400 mb-1">Critical</div>
            <div className="text-3xl font-bold text-red-400">{criticalPatients.length}</div>
          </div>
          <div className="bg-yellow-900/20 rounded-xl border border-yellow-500/30 p-4">
            <div className="text-xs text-yellow-400 mb-1">Warning</div>
            <div className="text-3xl font-bold text-yellow-400">{warningPatients.length}</div>
          </div>
          <div className="bg-emerald-900/20 rounded-xl border border-emerald-500/30 p-4">
            <div className="text-xs text-emerald-400 mb-1">Stable</div>
            <div className="text-3xl font-bold text-emerald-400">{stablePatients.length}</div>
          </div>
        </div>

        {/* Patient Cards by Priority */}
        <div className="space-y-6">
          {/* Critical */}
          {criticalPatients.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Critical Patients
              </h2>
              <div className="space-y-4">
                {criticalPatients.map(p => <PatientHandoffCard key={p.id} patient={p} />)}
              </div>
            </div>
          )}

          {/* Warning */}
          {warningPatients.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Patients Requiring Attention
              </h2>
              <div className="space-y-4">
                {warningPatients.map(p => <PatientHandoffCard key={p.id} patient={p} />)}
              </div>
            </div>
          )}

          {/* Stable */}
          {stablePatients.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Stable Patients
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {stablePatients.map(p => <PatientHandoffCard key={p.id} patient={p} />)}
              </div>
            </div>
          )}

          {patients.length === 0 && (
            <div className="text-center py-12">
              <div className="text-slate-500 text-lg mb-2">No patients found</div>
              <p className="text-slate-600 text-sm">There are no active patients for the selected shift</p>
            </div>
          )}
        </div>
      </div>

      {/* Electronic Acknowledgment Modal */}
      {showAcknowledgment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Electronic Acknowledgment</h2>
                <p className="text-sm text-slate-400">Incoming nurse verification required</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <p className="text-sm text-slate-300 mb-2">
                  By acknowledging this handoff, you confirm that you have:
                </p>
                <ul className="text-xs text-slate-400 space-y-1 ml-4">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                    Reviewed all patient information
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                    Understood current status and concerns
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                    Accepted responsibility for patient care
                  </li>
                </ul>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Incoming Nurse Name *</label>
                <input
                  type="text"
                  value={acknowledgment.nurseName}
                  onChange={(e) => setAcknowledgment(prev => ({ ...prev, nurseName: e.target.value }))}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Employee ID *</label>
                <input
                  type="text"
                  value={acknowledgment.nurseId}
                  onChange={(e) => setAcknowledgment(prev => ({ ...prev, nurseId: e.target.value }))}
                  placeholder="Enter your employee ID"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAcknowledgment(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcknowledge}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Acknowledging...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Acknowledge Handoff
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm No Notes Modal */}
      <ConfirmModal
        isOpen={showConfirmNoNotes}
        onClose={() => setShowConfirmNoNotes(false)}
        onConfirm={completeHandoff}
        title="Complete Without Notes?"
        message="No handoff notes have been added. Are you sure you want to complete the handoff without any SBAR documentation?"
        confirmText="Complete Anyway"
        cancelText="Add Notes"
      />
    </AppShell>
  );
}
