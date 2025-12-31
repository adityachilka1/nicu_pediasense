'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';

const patients = [
  { id: 1, name: 'Baby Martinez', ga: '30+3', dol: 14, readiness: 45, eta: '2-3 weeks' },
  { id: 2, name: 'Baby Thompson', ga: '36+2', dol: 7, readiness: 85, eta: '2-3 days' },
  { id: 3, name: 'Baby Williams', ga: '28+5', dol: 19, readiness: 30, eta: '4-6 weeks' },
];

// AAP Discharge Criteria for Preterm/High-Risk Infants
const dischargeChecklist = {
  physiologic: [
    { id: 1, item: 'Temperature stable in open crib for 24-48 hours', status: 'complete', standard: 'AAP: Maintain 36.5-37.4°C in open crib' },
    { id: 2, item: 'No apnea/bradycardia/desaturation events for 5-8 days', status: 'pending', note: '3 days event-free', standard: 'Event-free period required off caffeine if applicable' },
    { id: 3, item: 'Stable respiratory support (room air or home O2 qualified)', status: 'complete', standard: 'If home O2: SpO2 >90% on ≤0.5 LPM' },
    { id: 4, item: 'Consistent weight gain (20-30 g/day)', status: 'complete', standard: 'Minimum 15-20 g/kg/day or 20-30 g/day' },
    { id: 5, item: 'Full oral feeds (PO or stable G-tube)', status: 'pending', note: 'Currently gavage + bottle', standard: 'Must demonstrate feeding competency' },
    { id: 6, item: 'Adequate urine output (6-8 wet diapers/day)', status: 'complete', standard: 'Evidence of adequate hydration' },
  ],
  medical: [
    { id: 7, item: 'Newborn metabolic screen complete (and repeated if needed)', status: 'complete', standard: 'Repeat at 2 weeks if initial <24hrs of age' },
    { id: 8, item: 'Hearing screen passed (both ears)', status: 'complete', standard: 'AAP Universal Newborn Hearing Screening' },
    { id: 9, item: 'ROP screening: cleared or follow-up scheduled', status: 'pending', note: 'Next exam 12/30', standard: 'Per AAP/AAO guidelines; <31wks or <1500g' },
    { id: 10, item: 'Cranial ultrasound complete (if indicated)', status: 'complete', standard: 'Indicated for <32 weeks GA' },
    { id: 11, item: 'Immunizations up to date (Hep B, others per age)', status: 'pending', standard: 'Follow AAP immunization schedule' },
    { id: 12, item: 'Car seat challenge passed (90 min observation)', status: 'not-started', standard: 'Required for <37 weeks GA per AAP' },
    { id: 13, item: 'Hepatitis B vaccine given', status: 'complete', standard: 'Before discharge per AAP' },
    { id: 14, item: 'RSV prophylaxis discussed (if eligible)', status: 'pending', standard: 'Palivizumab if meets AAP criteria' },
  ],
  family: [
    { id: 15, item: 'Infant CPR training completed', status: 'pending', standard: 'All caregivers trained' },
    { id: 16, item: 'Feeding demonstration (breast/bottle/tube)', status: 'complete', standard: 'Observed competency by RN' },
    { id: 17, item: 'Medication administration training', status: 'not-started', standard: 'Return demonstration required' },
    { id: 18, item: 'Equipment training (monitors, O2, feeding pump)', status: 'not-applicable', standard: 'If home equipment ordered' },
    { id: 19, item: 'Safe sleep education (Back to Sleep)', status: 'pending', standard: 'AAP Safe Sleep Guidelines' },
    { id: 20, item: 'Shaken baby prevention education', status: 'pending', standard: 'Period of PURPLE Crying' },
    { id: 21, item: 'Home environment assessed (smoke-free, safe)', status: 'complete', standard: 'Social work clearance' },
    { id: 22, item: 'Signs of illness teaching (when to call/go to ED)', status: 'not-started', standard: 'Fever, breathing, feeding concerns' },
  ],
  administrative: [
    { id: 23, item: 'Primary care provider identified', status: 'complete', standard: 'PCP appointment within 2-3 days' },
    { id: 24, item: 'Insurance verified/Medicaid enrolled', status: 'complete', standard: 'Coverage for home care needs' },
    { id: 25, item: 'Discharge summary completed', status: 'not-started', standard: 'Within 24 hours of discharge' },
    { id: 26, item: 'Prescriptions written and filled', status: 'not-started', standard: 'Pharmacy confirmation' },
    { id: 27, item: 'Home nursing arranged (if needed)', status: 'not-applicable', standard: 'For home O2, tube feeds, etc.' },
    { id: 28, item: 'Follow-up appointments scheduled', status: 'not-started', standard: 'All specialty and PCP visits' },
    { id: 29, item: 'Early Intervention referral (if indicated)', status: 'pending', standard: 'Required for <1500g or <32 weeks' },
    { id: 30, item: 'Birth certificate completed', status: 'complete', standard: 'Before discharge' },
  ],
};

const followUpAppointments = [
  { provider: 'Primary Care', timing: '2-3 days post-discharge', scheduled: false },
  { provider: 'Neonatology', timing: '2 weeks post-discharge', scheduled: false },
  { provider: 'Ophthalmology (ROP)', timing: '2 weeks post-discharge', scheduled: true, date: '2025-01-15' },
  { provider: 'Early Intervention', timing: 'Within 1 month', scheduled: false },
];

export default function DischargePage() {
  const [selectedPatient, setSelectedPatient] = useState(patients[1]);
  const [checklist, setChecklist] = useState(dischargeChecklist);

  const handleToggleItem = (category, itemId) => {
    setChecklist({
      ...checklist,
      [category]: checklist[category].map(item => {
        if (item.id === itemId && item.status !== 'not-applicable') {
          const newStatus = item.status === 'complete' ? 'pending' :
                           item.status === 'pending' ? 'complete' :
                           item.status === 'not-started' ? 'pending' : item.status;
          return { ...item, status: newStatus };
        }
        return item;
      })
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete': return <span className="text-green-400">✓</span>;
      case 'pending': return <span className="text-yellow-400">○</span>;
      case 'not-started': return <span className="text-slate-500">○</span>;
      case 'not-applicable': return <span className="text-slate-500">—</span>;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete': return 'bg-green-500/20 border-green-500/50';
      case 'pending': return 'bg-yellow-500/20 border-yellow-500/50';
      case 'not-started': return 'bg-slate-700/50 border-slate-600';
      case 'not-applicable': return 'bg-slate-700/30 border-slate-700';
      default: return '';
    }
  };

  const calculateProgress = (categoryKey) => {
    const items = checklist[categoryKey];
    const applicable = items.filter(i => i.status !== 'not-applicable');
    const complete = applicable.filter(i => i.status === 'complete');
    return applicable.length > 0 ? Math.round((complete.length / applicable.length) * 100) : 0;
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Discharge Planning</h1>
            <p className="text-slate-400 text-sm">Track discharge readiness and requirements</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Complete Discharge
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Patient List */}
          <div className="col-span-3 space-y-4">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Pending Discharges</h3>
              <div className="space-y-2">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedPatient.id === patient.id
                        ? 'bg-cyan-500/20 border border-cyan-500/50'
                        : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white text-sm">{patient.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        patient.readiness >= 80 ? 'bg-green-500/20 text-green-400' :
                        patient.readiness >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {patient.readiness}%
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">PCA: {patient.ga} • DOL {patient.dol}</div>
                    <div className="text-xs text-cyan-400 mt-1">ETA: {patient.eta}</div>
                    <div className="h-1.5 bg-slate-600 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full ${patient.readiness >= 80 ? 'bg-green-500' : patient.readiness >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${patient.readiness}%` }}
                      ></div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Discharge Checklist */}
          <div className="col-span-9 space-y-4">
            {/* Overview Cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { title: 'Physiologic', key: 'physiologic', color: 'cyan' },
                { title: 'Medical', key: 'medical', color: 'purple' },
                { title: 'Family', key: 'family', color: 'green' },
                { title: 'Administrative', key: 'administrative', color: 'yellow' },
              ].map((category) => (
                <div key={category.title} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <div className="text-sm text-slate-400 mb-2">{category.title}</div>
                  <div className={`text-2xl font-bold text-${category.color}-400`}>
                    {calculateProgress(category.key)}%
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full bg-${category.color}-500`} style={{ width: `${calculateProgress(category.key)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Checklist */}
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(checklist).map(([category, items]) => (
                <div key={category} className="bg-slate-800 rounded-xl border border-slate-700">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="font-semibold text-white capitalize">{category} Criteria</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleToggleItem(category, item.id)}
                        disabled={item.status === 'not-applicable'}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${getStatusColor(item.status)} ${
                          item.status !== 'not-applicable' ? 'hover:opacity-80 cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{getStatusIcon(item.status)}</div>
                          <div className="flex-1">
                            <div className={`text-sm ${item.status === 'complete' ? 'text-slate-300' : 'text-white'}`}>
                              {item.item}
                            </div>
                            {item.note && (
                              <div className="text-xs text-yellow-400 mt-1">{item.note}</div>
                            )}
                            {item.standard && (
                              <div className="text-xs text-slate-500 mt-1 italic">{item.standard}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Follow-up Appointments */}
            <div className="bg-slate-800 rounded-xl border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold text-white">Follow-up Appointments</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  {followUpAppointments.map((appt, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div>
                        <div className="font-medium text-white">{appt.provider}</div>
                        <div className="text-xs text-slate-400">{appt.timing}</div>
                      </div>
                      {appt.scheduled ? (
                        <div className="text-right">
                          <span className="text-xs text-green-400">Scheduled</span>
                          <div className="text-sm text-white">{appt.date}</div>
                        </div>
                      ) : (
                        <button className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm">
                          Schedule
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
