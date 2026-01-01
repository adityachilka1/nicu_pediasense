'use client';

import { useState, useRef } from 'react';
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
  const [newMed, setNewMed] = useState({
    name: '',
    dose: '',
    route: 'PO',
    frequency: 'Daily',
    indication: ''
  });
  const toast = useToast();
  const printRef = useRef(null);

  // Print MAR handler
  const handlePrintMAR = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Medication Administration Record - ${patient.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px; }
          .patient-info { margin-bottom: 20px; background: #f0f4f8; padding: 15px; border-radius: 8px; }
          .patient-info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
          th { background: #1a365d; color: white; }
          tr:nth-child(even) { background: #f8f9fa; }
          .time-header { text-align: center; background: #e2e8f0 !important; }
          .status-given { color: green; font-weight: bold; }
          .status-due { color: orange; font-weight: bold; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h1>Medication Administration Record (MAR)</h1>
        <div class="patient-info">
          <p><strong>Patient:</strong> ${patient.name}</p>
          <p><strong>MRN:</strong> ${patient.mrn || 'N/A'}</p>
          <p><strong>Bed:</strong> BED ${String(patient.id).padStart(2, '0')}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Weight:</strong> ${patient.weight || 'N/A'} kg</p>
        </div>
        <h2>Scheduled Medications</h2>
        <table>
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dose</th>
              <th>Route</th>
              <th>Frequency</th>
              <th>08:00</th>
              <th>12:00</th>
              <th>20:00</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Caffeine Citrate</td>
              <td>10 mg</td>
              <td>IV</td>
              <td>Daily</td>
              <td class="status-given">✓ Given</td>
              <td>-</td>
              <td>-</td>
            </tr>
            <tr>
              <td>Vitamin D</td>
              <td>400 IU</td>
              <td>PO</td>
              <td>Daily</td>
              <td class="status-given">✓ Given</td>
              <td>-</td>
              <td>-</td>
            </tr>
            <tr>
              <td>Iron Supplement</td>
              <td>2 mg/kg</td>
              <td>PO</td>
              <td>Daily</td>
              <td>-</td>
              <td class="status-given">✓ Given</td>
              <td>-</td>
            </tr>
            <tr>
              <td>Ampicillin</td>
              <td>50 mg/kg</td>
              <td>IV</td>
              <td>q12h</td>
              <td class="status-given">✓ Given</td>
              <td>-</td>
              <td class="status-due">○ Due</td>
            </tr>
            <tr>
              <td>Gentamicin</td>
              <td>4 mg/kg</td>
              <td>IV</td>
              <td>q24h</td>
              <td class="status-given">✓ Given</td>
              <td>-</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
        <h2>PRN Medications</h2>
        <table>
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dose</th>
              <th>Route</th>
              <th>Indication</th>
              <th>Last Given</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Acetaminophen</td>
              <td>15 mg/kg</td>
              <td>PO/PR</td>
              <td>Pain/Fever</td>
              <td>Never</td>
            </tr>
            <tr>
              <td>Simethicone</td>
              <td>20 mg</td>
              <td>PO</td>
              <td>Gas/Colic</td>
              <td>14:00</td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          <p>Printed: ${new Date().toLocaleString()}</p>
          <p>PEDIASENSE NestWatch - Medication Administration Record</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Handle add medication form
  const handleAddMedication = (e) => {
    e.preventDefault();
    if (!newMed.name || !newMed.dose) {
      toast.error('Please fill in medication name and dose');
      return;
    }
    toast.success(`${newMed.name} added to medication list`);
    setShowAddMed(false);
    setNewMed({ name: '', dose: '', route: 'PO', frequency: 'Daily', indication: '' });
  };
  
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
            <button
              onClick={handlePrintMAR}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
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

        {/* Add Medication Modal */}
        {showAddMed && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Add New Medication</h3>
                <button
                  onClick={() => setShowAddMed(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddMedication} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Medication Name *</label>
                  <input
                    type="text"
                    value={newMed.name}
                    onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                    placeholder="e.g., Caffeine Citrate"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Dose *</label>
                    <input
                      type="text"
                      value={newMed.dose}
                      onChange={(e) => setNewMed({...newMed, dose: e.target.value})}
                      placeholder="e.g., 10 mg"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Route</label>
                    <select
                      value={newMed.route}
                      onChange={(e) => setNewMed({...newMed, route: e.target.value})}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="PO">PO (Oral)</option>
                      <option value="IV">IV (Intravenous)</option>
                      <option value="IV Push">IV Push</option>
                      <option value="IV Drip">IV Drip</option>
                      <option value="IM">IM (Intramuscular)</option>
                      <option value="SQ">SQ (Subcutaneous)</option>
                      <option value="PR">PR (Rectal)</option>
                      <option value="INH">INH (Inhalation)</option>
                      <option value="TOP">TOP (Topical)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Frequency</label>
                    <select
                      value={newMed.frequency}
                      onChange={(e) => setNewMed({...newMed, frequency: e.target.value})}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="Daily">Daily</option>
                      <option value="BID">BID (Twice daily)</option>
                      <option value="TID">TID (Three times daily)</option>
                      <option value="QID">QID (Four times daily)</option>
                      <option value="q4h">q4h (Every 4 hours)</option>
                      <option value="q6h">q6h (Every 6 hours)</option>
                      <option value="q8h">q8h (Every 8 hours)</option>
                      <option value="q12h">q12h (Every 12 hours)</option>
                      <option value="q24h">q24h (Every 24 hours)</option>
                      <option value="PRN">PRN (As needed)</option>
                      <option value="Continuous">Continuous</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Indication</label>
                    <input
                      type="text"
                      value={newMed.indication}
                      onChange={(e) => setNewMed({...newMed, indication: e.target.value})}
                      placeholder="e.g., Apnea of prematurity"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-yellow-400">New medication orders require physician approval</span>
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowAddMed(false)}
                    className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Medication
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
