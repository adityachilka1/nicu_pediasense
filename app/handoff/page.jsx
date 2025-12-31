'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { initialPatients, staffList, getStatusColor } from '@/lib/data';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';

export default function HandoffPage() {
  const toast = useToast();
  const [selectedShift, setSelectedShift] = useState('day-to-night');
  const [notes, setNotes] = useState({});
  const [handoffCompleted, setHandoffCompleted] = useState(false);
  const [showConfirmNoNotes, setShowConfirmNoNotes] = useState(false);
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [acknowledgment, setAcknowledgment] = useState({
    nurseName: '',
    nurseId: '',
    acknowledged: false,
    timestamp: null,
    signature: '',
  });

  const handleCompleteHandoff = () => {
    const hasNotes = Object.values(notes).some(n => n && n.trim());
    if (!hasNotes) {
      setShowConfirmNoNotes(true);
      return;
    }
    setShowAcknowledgment(true);
  };

  const handleAcknowledge = () => {
    if (!acknowledgment.nurseName || !acknowledgment.nurseId) {
      toast.error('Please enter your name and ID to acknowledge');
      return;
    }
    setAcknowledgment(prev => ({
      ...prev,
      acknowledged: true,
      timestamp: new Date().toISOString(),
    }));
    setHandoffCompleted(true);
    setShowAcknowledgment(false);
    toast.success(`Handoff acknowledged by ${acknowledgment.nurseName} at ${new Date().toLocaleTimeString()}`);
  };

  const completeHandoff = () => {
    setShowAcknowledgment(true);
    setShowConfirmNoNotes(false);
  };

  const shifts = [
    { id: 'day-to-night', name: 'Day → Night', time: '19:00' },
    { id: 'night-to-day', name: 'Night → Day', time: '07:00' },
  ];
  
  // Group patients by acuity
  const criticalPatients = initialPatients.filter(p => p.status === 'critical');
  const warningPatients = initialPatients.filter(p => p.status === 'warning');
  const stablePatients = initialPatients.filter(p => p.status === 'normal');
  
  const PatientHandoffCard = ({ patient }) => (
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
          </div>
          <div className="text-xs text-slate-500">
            GA {patient.ga} • {patient.weight}kg • DOL {patient.dol}
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
          <div className="grid grid-cols-5 gap-2 text-sm">
            <div className="bg-slate-900/50 rounded px-3 py-2">
              <div className="text-xs text-cyan-400 mb-1">SpO₂</div>
              <div className="font-mono font-bold text-white">{patient.baseSPO2}%</div>
            </div>
            <div className="bg-slate-900/50 rounded px-3 py-2">
              <div className="text-xs text-green-400 mb-1">PR</div>
              <div className="font-mono font-bold text-white">{patient.basePR}</div>
            </div>
            <div className="bg-slate-900/50 rounded px-3 py-2">
              <div className="text-xs text-yellow-400 mb-1">RR</div>
              <div className="font-mono font-bold text-white">{patient.baseRR}</div>
            </div>
            <div className="bg-slate-900/50 rounded px-3 py-2">
              <div className="text-xs text-pink-400 mb-1">Temp</div>
              <div className="font-mono font-bold text-white">{patient.baseTemp}°C</div>
            </div>
            <div className="bg-slate-900/50 rounded px-3 py-2">
              <div className="text-xs text-purple-400 mb-1">BP</div>
              <div className="font-mono font-bold text-white text-xs">
                {patient.baseBP ? `${patient.baseBP.systolic}/${patient.baseBP.diastolic}` : 'N/A'}
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Respiratory: </span>
              <span className="text-white">{patient.ventilation} • FiO₂ {patient.fio2}%</span>
            </div>
            <div>
              <span className="text-slate-400">A/B Events: </span>
              <span className={patient.apnea > 3 || patient.brady > 3 ? 'text-yellow-400' : 'text-white'}>
                Apnea: {patient.apnea} • Brady: {patient.brady}
              </span>
            </div>
          </div>
        </div>

        {/* B - BACKGROUND: History & Diagnoses */}
        <div className="border-l-2 border-blue-500 pl-3">
          <h4 className="text-xs font-bold text-blue-400 uppercase mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px]">B</span>
            BACKGROUND - History
          </h4>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-slate-400">Active Diagnoses: </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {patient.diagnosis.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">{d}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Feeding: </span>
                <span className="text-white">{patient.feedingType} • {patient.feedingVolume}mL {patient.feedingFrequency}</span>
              </div>
              <div>
                <span className="text-slate-400">Access: </span>
                <span className="text-white">{patient.ivAccess}</span>
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400">Current Medications: </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {patient.medications.map((med, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-700/50 rounded text-xs text-slate-300">{med}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* A - ASSESSMENT: Clinical Judgment */}
        <div className="border-l-2 border-amber-500 pl-3">
          <h4 className="text-xs font-bold text-amber-400 uppercase mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">A</span>
            ASSESSMENT - Clinical Notes
          </h4>
          <p className="text-sm text-slate-300 bg-slate-900/50 rounded p-3">{patient.notes}</p>
        </div>

        {/* R - RECOMMENDATION: Handoff Notes */}
        <div className="border-l-2 border-green-500 pl-3">
          <h4 className="text-xs font-bold text-green-400 uppercase mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-[10px]">R</span>
            RECOMMENDATION - Handoff Notes
          </h4>
          <textarea
            placeholder="Add recommendations and notes for incoming shift..."
            value={notes[patient.id] || ''}
            onChange={(e) => setNotes(prev => ({ ...prev, [patient.id]: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500 text-sm resize-none"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
  
  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Shift Handoff</h1>
            <p className="text-sm text-slate-400 mt-1">Prepare and document shift transition</p>
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
                disabled={handoffCompleted}
                className={`px-4 py-2 rounded-lg font-medium transition-colors screen-only ${
                  handoffCompleted
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {handoffCompleted ? '✓ Handoff Completed' : 'Complete Handoff'}
              </button>
            </div>
          </div>
        </div>

        {/* Print Header - only visible when printing */}
        <div className="print-only print-header mb-6">
          <h1 className="text-xl font-bold">NICU Shift Handoff Report</h1>
          <p className="subtitle">Floor 3 West • Unit A • {new Date().toLocaleDateString()} {shifts.find(s => s.id === selectedShift)?.name}</p>
        </div>
        
        {/* Staff on Duty */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-2">OUTGOING SHIFT</h3>
              <div className="flex items-center gap-4">
                {staffList.filter(s => s.shift === 'Day').slice(0, 4).map(staff => (
                  <div key={staff.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white">
                      {staff.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm text-white">{staff.name}</div>
                      <div className="text-xs text-slate-500">{staff.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-slate-500">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-2">INCOMING SHIFT</h3>
              <div className="flex items-center gap-4">
                {staffList.filter(s => s.shift === 'Day').slice(4, 8).map(staff => (
                  <div key={staff.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white">
                      {staff.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm text-white">{staff.name}</div>
                      <div className="text-xs text-slate-500">{staff.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-400 mb-1">Total Patients</div>
            <div className="text-3xl font-bold text-white">{initialPatients.length}</div>
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
        </div>

        {/* Acknowledgment Status Banner */}
        {handoffCompleted && acknowledgment.acknowledged && (
          <div className="mt-6 bg-emerald-900/30 border border-emerald-500/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-emerald-400 font-bold">Handoff Acknowledged</h3>
                <p className="text-sm text-slate-400">
                  Received by <span className="text-white">{acknowledgment.nurseName}</span> (ID: {acknowledgment.nurseId}) at {new Date(acknowledgment.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
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

              <div>
                <label className="block text-sm text-slate-400 mb-1">Electronic Signature</label>
                <input
                  type="text"
                  value={acknowledgment.signature}
                  onChange={(e) => setAcknowledgment(prev => ({ ...prev, signature: e.target.value }))}
                  placeholder="Type your name as signature"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono italic"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAcknowledgment(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcknowledge}
                  className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Acknowledge Handoff
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
        message="No handoff notes have been added. Are you sure you want to complete the handoff without any recommendations?"
        confirmText="Complete Anyway"
        cancelText="Add Notes"
      />
    </AppShell>
  );
}
