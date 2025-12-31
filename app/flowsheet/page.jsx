'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';

const patients = [
  { id: 'NB-2024-0892', name: 'Baby Martinez', weight: 1180 },
  { id: 'NB-2024-0891', name: 'Baby Thompson', weight: 1650 },
];

const flowsheetData = {
  hours: [
    { hour: '07:00', intake: { iv: 4.5, feeds: 0, meds: 0.5 }, output: { urine: 3, stool: 0, gastric: 0 }, vitals: { hr: 152, rr: 48, spo2: 96, temp: 36.8 } },
    { hour: '08:00', intake: { iv: 4.5, feeds: 14, meds: 0 }, output: { urine: 0, stool: 0, gastric: 0 }, vitals: { hr: 148, rr: 45, spo2: 97, temp: 36.9 } },
    { hour: '09:00', intake: { iv: 4.5, feeds: 0, meds: 0 }, output: { urine: 4, stool: 5, gastric: 0 }, vitals: { hr: 155, rr: 50, spo2: 95, temp: 36.8 } },
    { hour: '10:00', intake: { iv: 4.5, feeds: 0, meds: 1.0 }, output: { urine: 2, stool: 0, gastric: 0 }, vitals: { hr: 150, rr: 46, spo2: 96, temp: 36.7 } },
    { hour: '11:00', intake: { iv: 4.5, feeds: 14, meds: 0 }, output: { urine: 5, stool: 0, gastric: 1 }, vitals: { hr: 145, rr: 44, spo2: 97, temp: 36.9 } },
    { hour: '12:00', intake: { iv: 4.5, feeds: 0, meds: 0 }, output: { urine: 3, stool: 0, gastric: 0 }, vitals: { hr: 158, rr: 52, spo2: 94, temp: 37.0 } },
  ],
  totals: {
    intake: { iv: 108, feeds: 84, meds: 4.5, total: 196.5 },
    output: { urine: 52, stool: 15, gastric: 3, total: 70 },
    balance: 126.5,
  },
  urineOutput: 3.7, // mL/kg/hr
};

export default function FlowsheetPage() {
  const [selectedPatient, setSelectedPatient] = useState(patients[0]);
  const [selectedDate, setSelectedDate] = useState('2024-12-29');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [hours, setHours] = useState(flowsheetData.hours);
  const [newEntry, setNewEntry] = useState({
    time: '',
    intake: { iv: '', feeds: '', meds: '' },
    output: { urine: '', stool: '', gastric: '' },
    vitals: { hr: '', rr: '', spo2: '', temp: '' }
  });

  const handleSaveEntry = () => {
    if (newEntry.time) {
      const entry = {
        hour: newEntry.time,
        intake: {
          iv: parseFloat(newEntry.intake.iv) || 0,
          feeds: parseFloat(newEntry.intake.feeds) || 0,
          meds: parseFloat(newEntry.intake.meds) || 0
        },
        output: {
          urine: parseFloat(newEntry.output.urine) || 0,
          stool: parseFloat(newEntry.output.stool) || 0,
          gastric: parseFloat(newEntry.output.gastric) || 0
        },
        vitals: {
          hr: parseInt(newEntry.vitals.hr) || 0,
          rr: parseInt(newEntry.vitals.rr) || 0,
          spo2: parseInt(newEntry.vitals.spo2) || 0,
          temp: parseFloat(newEntry.vitals.temp) || 0
        }
      };
      setHours([...hours, entry].sort((a, b) => a.hour.localeCompare(b.hour)));
      setNewEntry({
        time: '',
        intake: { iv: '', feeds: '', meds: '' },
        output: { urine: '', stool: '', gastric: '' },
        vitals: { hr: '', rr: '', spo2: '', temp: '' }
      });
      setShowAddEntry(false);
    }
  };

  // Calculate totals from state
  const totals = {
    intake: {
      iv: hours.reduce((sum, h) => sum + (h.intake.iv || 0), 0),
      feeds: hours.reduce((sum, h) => sum + (h.intake.feeds || 0), 0),
      meds: hours.reduce((sum, h) => sum + (h.intake.meds || 0), 0),
      total: hours.reduce((sum, h) => sum + (h.intake.iv || 0) + (h.intake.feeds || 0) + (h.intake.meds || 0), 0)
    },
    output: {
      urine: hours.reduce((sum, h) => sum + (h.output.urine || 0), 0),
      stool: hours.reduce((sum, h) => sum + (h.output.stool || 0), 0),
      gastric: hours.reduce((sum, h) => sum + (h.output.gastric || 0), 0),
      total: hours.reduce((sum, h) => sum + (h.output.urine || 0) + (h.output.stool || 0) + (h.output.gastric || 0), 0)
    }
  };
  totals.balance = totals.intake.total - totals.output.total;
  const urineOutput = (totals.output.urine / selectedPatient.weight * 1000 / hours.length).toFixed(1);

  const getUrineColor = (rate) => {
    if (rate < 1) return 'text-red-400';
    if (rate < 2) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">I/O Flowsheet</h1>
            <p className="text-slate-400 text-sm">Hourly intake and output documentation</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPatient.id}
              onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
            />
            <button
              onClick={() => setShowAddEntry(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Entry
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Total Intake</div>
            <div className="text-2xl font-bold text-cyan-400">{totals.intake.total.toFixed(1)} mL</div>
            <div className="text-xs text-slate-500 mt-1">
              {(totals.intake.total / selectedPatient.weight * 1000 / 24).toFixed(1)} mL/kg/day
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Total Output</div>
            <div className="text-2xl font-bold text-purple-400">{totals.output.total.toFixed(1)} mL</div>
            <div className="text-xs text-slate-500 mt-1">
              {(totals.output.total / selectedPatient.weight * 1000 / 24).toFixed(1)} mL/kg/day
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Net Balance</div>
            <div className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totals.balance >= 0 ? '+' : ''}{totals.balance.toFixed(1)} mL
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Urine Output</div>
            <div className={`text-2xl font-bold ${getUrineColor(parseFloat(urineOutput))}`}>
              {urineOutput} mL/kg/hr
            </div>
            <div className="text-xs text-slate-500 mt-1">Target: 1-3 mL/kg/hr</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Last Void</div>
            <div className="text-2xl font-bold text-white">1.5 hr</div>
            <div className="text-xs text-green-400 mt-1">ago</div>
          </div>
        </div>

        {/* Intake/Output Breakdown */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-semibold text-white mb-3">Intake Breakdown (24hr)</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">IV Fluids/TPN</span>
                <span className="text-cyan-400 font-medium">{totals.intake.iv.toFixed(1)} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Enteral Feeds</span>
                <span className="text-green-400 font-medium">{totals.intake.feeds.toFixed(1)} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Medications</span>
                <span className="text-yellow-400 font-medium">{totals.intake.meds.toFixed(1)} mL</span>
              </div>
              <div className="border-t border-slate-700 pt-2 mt-2 flex items-center justify-between font-medium">
                <span className="text-white">Total</span>
                <span className="text-white">{totals.intake.total.toFixed(1)} mL</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-semibold text-white mb-3">Output Breakdown (24hr)</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Urine</span>
                <span className="text-purple-400 font-medium">{totals.output.urine.toFixed(1)} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Stool</span>
                <span className="text-amber-400 font-medium">{totals.output.stool.toFixed(1)} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Gastric/Residuals</span>
                <span className="text-red-400 font-medium">{totals.output.gastric.toFixed(1)} mL</span>
              </div>
              <div className="border-t border-slate-700 pt-2 mt-2 flex items-center justify-between font-medium">
                <span className="text-white">Total</span>
                <span className="text-white">{totals.output.total.toFixed(1)} mL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Flowsheet Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-white">Hourly Flowsheet</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded">Shift: 07:00-19:00</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-700 bg-slate-800/50">
                  <th className="p-3 sticky left-0 bg-slate-800">Time</th>
                  <th className="p-3 text-center border-l border-slate-700" colSpan={3}>
                    <span className="text-cyan-400">INTAKE (mL)</span>
                  </th>
                  <th className="p-3 text-center border-l border-slate-700" colSpan={3}>
                    <span className="text-purple-400">OUTPUT (mL)</span>
                  </th>
                  <th className="p-3 text-center border-l border-slate-700" colSpan={4}>
                    <span className="text-green-400">VITALS</span>
                  </th>
                </tr>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                  <th className="p-2 sticky left-0 bg-slate-800"></th>
                  <th className="p-2 border-l border-slate-700">IV</th>
                  <th className="p-2">Feeds</th>
                  <th className="p-2">Meds</th>
                  <th className="p-2 border-l border-slate-700">Urine</th>
                  <th className="p-2">Stool</th>
                  <th className="p-2">Gastric</th>
                  <th className="p-2 border-l border-slate-700">HR</th>
                  <th className="p-2">RR</th>
                  <th className="p-2">SpO2</th>
                  <th className="p-2">Temp</th>
                </tr>
              </thead>
              <tbody>
                {hours.map((row, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="p-2 font-medium text-white sticky left-0 bg-slate-800">{row.hour}</td>
                    <td className="p-2 text-cyan-400 border-l border-slate-700">{row.intake.iv || '-'}</td>
                    <td className="p-2 text-green-400">{row.intake.feeds || '-'}</td>
                    <td className="p-2 text-yellow-400">{row.intake.meds || '-'}</td>
                    <td className="p-2 text-purple-400 border-l border-slate-700">{row.output.urine || '-'}</td>
                    <td className="p-2 text-amber-400">{row.output.stool || '-'}</td>
                    <td className="p-2 text-red-400">{row.output.gastric || '-'}</td>
                    <td className="p-2 text-slate-300 border-l border-slate-700">{row.vitals.hr || '-'}</td>
                    <td className="p-2 text-slate-300">{row.vitals.rr || '-'}</td>
                    <td className="p-2 text-slate-300">{row.vitals.spo2 ? `${row.vitals.spo2}%` : '-'}</td>
                    <td className="p-2 text-slate-300">{row.vitals.temp ? `${row.vitals.temp}°` : '-'}</td>
                  </tr>
                ))}
                {/* Shift Total Row */}
                <tr className="bg-slate-700/50 font-medium">
                  <td className="p-2 text-white sticky left-0 bg-slate-700">TOTAL</td>
                  <td className="p-2 text-cyan-400 border-l border-slate-700">{totals.intake.iv.toFixed(1)}</td>
                  <td className="p-2 text-green-400">{totals.intake.feeds.toFixed(0)}</td>
                  <td className="p-2 text-yellow-400">{totals.intake.meds.toFixed(1)}</td>
                  <td className="p-2 text-purple-400 border-l border-slate-700">{totals.output.urine.toFixed(0)}</td>
                  <td className="p-2 text-amber-400">{totals.output.stool.toFixed(0)}</td>
                  <td className="p-2 text-red-400">{totals.output.gastric.toFixed(0)}</td>
                  <td className="p-2 text-slate-400 border-l border-slate-700" colSpan={4}>-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Entry Modal */}
        {showAddEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Add I/O Entry</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={newEntry.time}
                    onChange={(e) => setNewEntry({ ...newEntry, time: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Intake</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">IV (mL)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newEntry.intake.iv}
                        onChange={(e) => setNewEntry({ ...newEntry, intake: { ...newEntry.intake, iv: e.target.value } })}
                        placeholder="4.5"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Feeds (mL)</label>
                      <input
                        type="number"
                        value={newEntry.intake.feeds}
                        onChange={(e) => setNewEntry({ ...newEntry, intake: { ...newEntry.intake, feeds: e.target.value } })}
                        placeholder="14"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Meds (mL)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newEntry.intake.meds}
                        onChange={(e) => setNewEntry({ ...newEntry, intake: { ...newEntry.intake, meds: e.target.value } })}
                        placeholder="0.5"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Output</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Urine (mL)</label>
                      <input
                        type="number"
                        value={newEntry.output.urine}
                        onChange={(e) => setNewEntry({ ...newEntry, output: { ...newEntry.output, urine: e.target.value } })}
                        placeholder="3"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Stool (mL)</label>
                      <input
                        type="number"
                        value={newEntry.output.stool}
                        onChange={(e) => setNewEntry({ ...newEntry, output: { ...newEntry.output, stool: e.target.value } })}
                        placeholder="0"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Gastric (mL)</label>
                      <input
                        type="number"
                        value={newEntry.output.gastric}
                        onChange={(e) => setNewEntry({ ...newEntry, output: { ...newEntry.output, gastric: e.target.value } })}
                        placeholder="0"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowAddEntry(false)} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">Cancel</button>
                  <button onClick={handleSaveEntry} className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
