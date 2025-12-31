'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PatientHeader from '@/components/PatientHeader';
import PatientTabs from '@/components/PatientTabs';
import { initialPatients } from '@/lib/data';
import { useToast } from '@/components/Toast';

export default function PatientMedsPage() {
  const params = useParams();
  const patient = initialPatients.find(p => p.id === parseInt(params.id)) || initialPatients[0];
  const [showAddMed, setShowAddMed] = useState(false);
  const toast = useToast();
  
  const medications = [
    { 
      id: 1, 
      name: 'Caffeine Citrate', 
      dose: '10 mg', 
      route: 'IV', 
      frequency: 'Daily', 
      indication: 'Apnea of prematurity',
      startDate: '2024-12-21',
      nextDue: '2024-12-30T08:00:00',
      status: 'active',
      lastGiven: '2024-12-29T08:00:00',
      givenBy: 'RN J. Moore'
    },
    { 
      id: 2, 
      name: 'Vitamin D', 
      dose: '400 IU', 
      route: 'PO', 
      frequency: 'Daily', 
      indication: 'Supplementation',
      startDate: '2024-12-21',
      nextDue: '2024-12-30T08:00:00',
      status: 'active',
      lastGiven: '2024-12-29T08:00:00',
      givenBy: 'RN J. Moore'
    },
    { 
      id: 3, 
      name: 'Iron Supplement', 
      dose: '2 mg/kg', 
      route: 'PO', 
      frequency: 'Daily', 
      indication: 'Anemia prevention',
      startDate: '2024-12-25',
      nextDue: '2024-12-30T12:00:00',
      status: 'active',
      lastGiven: '2024-12-29T12:00:00',
      givenBy: 'RN A. Clark'
    },
    { 
      id: 4, 
      name: 'Ampicillin', 
      dose: '50 mg/kg', 
      route: 'IV', 
      frequency: 'q12h', 
      indication: 'Sepsis r/o',
      startDate: '2024-12-28',
      endDate: '2024-12-30',
      nextDue: '2024-12-29T20:00:00',
      status: 'active',
      lastGiven: '2024-12-29T08:00:00',
      givenBy: 'RN D. Park'
    },
    { 
      id: 5, 
      name: 'Gentamicin', 
      dose: '4 mg/kg', 
      route: 'IV', 
      frequency: 'q24h', 
      indication: 'Sepsis r/o',
      startDate: '2024-12-28',
      endDate: '2024-12-30',
      nextDue: '2024-12-30T08:00:00',
      status: 'active',
      lastGiven: '2024-12-29T08:00:00',
      givenBy: 'RN D. Park'
    },
  ];
  
  const prnMeds = [
    { id: 101, name: 'Acetaminophen', dose: '15 mg/kg', route: 'PO/PR', frequency: 'PRN q4h', indication: 'Pain/Fever', lastGiven: null },
    { id: 102, name: 'Simethicone', dose: '20 mg', route: 'PO', frequency: 'PRN', indication: 'Gas/Colic', lastGiven: '2024-12-29T14:00:00' },
  ];
  
  const marHistory = [
    { time: '08:00', meds: ['Caffeine Citrate', 'Vitamin D', 'Ampicillin', 'Gentamicin'], status: 'given' },
    { time: '12:00', meds: ['Iron Supplement'], status: 'given' },
    { time: '20:00', meds: ['Ampicillin'], status: 'due' },
  ];
  
  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <AppShell>
      <div className="p-6">
        <PatientHeader patient={patient} />
        <PatientTabs patientId={patient.id} />
        
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Medications</h2>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
              Print MAR
            </button>
            <button 
              onClick={() => setShowAddMed(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
            >
              Add Medication
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          {/* Medication List */}
          <div className="col-span-8 space-y-6">
            {/* Scheduled Medications */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Scheduled Medications</h2>
              <div className="space-y-3">
                {medications.map(med => (
                  <div key={med.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-white text-lg">{med.name}</h3>
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                            Active
                          </span>
                          {med.endDate && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                              Ends {new Date(med.endDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-slate-500 mb-1">Dose</div>
                            <div className="text-white font-medium">{med.dose}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Route</div>
                            <div className="text-white font-medium">{med.route}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Frequency</div>
                            <div className="text-white font-medium">{med.frequency}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Indication</div>
                            <div className="text-white font-medium">{med.indication}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-800 text-sm">
                          <div>
                            <span className="text-slate-500">Last given: </span>
                            <span className="text-slate-300">{formatTime(med.lastGiven)} by {med.givenBy}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Next due: </span>
                            <span className="text-cyan-400 font-medium">{formatTime(med.nextDue)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => toast.success(`${med.name} documented as given`)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Document Given
                        </button>
                        <button
                          onClick={() => toast.warning(`${med.name} placed on hold`)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Hold
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* PRN Medications */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4">PRN Medications</h2>
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Medication</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Dose</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Route</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Frequency</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Last Given</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {prnMeds.map(med => (
                      <tr key={med.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{med.name}</td>
                        <td className="px-4 py-3 text-slate-300">{med.dose}</td>
                        <td className="px-4 py-3 text-slate-300">{med.route}</td>
                        <td className="px-4 py-3 text-slate-300">{med.frequency}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {med.lastGiven ? formatTime(med.lastGiven) : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toast.success(`${med.name} PRN administered`)}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
                          >
                            Give
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* MAR Timeline */}
          <div className="col-span-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 sticky top-4">
              <h2 className="text-lg font-bold text-white mb-4">Today's MAR</h2>
              
              <div className="space-y-4">
                {marHistory.map((slot, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    slot.status === 'given' ? 'bg-emerald-500/10 border-emerald-500/30' :
                    slot.status === 'due' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-slate-800/50 border-slate-700'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-white">{slot.time}</span>
                      <span className={`text-xs font-medium ${
                        slot.status === 'given' ? 'text-emerald-400' :
                        slot.status === 'due' ? 'text-yellow-400' :
                        'text-slate-400'
                      }`}>
                        {slot.status === 'given' ? '✓ Given' : 
                         slot.status === 'due' ? '○ Due' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {slot.meds.map((med, j) => (
                        <span key={j} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
                          {med}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <button className="w-full mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                View Full MAR
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
