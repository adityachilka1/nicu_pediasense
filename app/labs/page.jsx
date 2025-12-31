'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';

const patients = [
  { id: 1, name: 'Baby Thompson', bed: 'BED 01' },
  { id: 2, name: 'Baby Martinez', bed: 'BED 02' },
  { id: 3, name: 'Baby Chen', bed: 'BED 03' },
  { id: 4, name: 'Baby Williams', bed: 'BED 04' },
  { id: 5, name: 'Baby Johnson', bed: 'BED 05' },
  { id: 6, name: 'Baby Brown', bed: 'BED 06' },
  { id: 7, name: 'Baby Davis', bed: 'BED 07' },
  { id: 8, name: 'Baby Garcia', bed: 'BED 08' },
];

const labCategories = [
  { id: 'cbc', name: 'CBC', icon: '🩸' },
  { id: 'chem', name: 'Chemistry', icon: '⚗️' },
  { id: 'gas', name: 'Blood Gas', icon: '💨' },
  { id: 'bili', name: 'Bilirubin', icon: '🟡' },
  { id: 'coag', name: 'Coagulation', icon: '🔴' },
  { id: 'micro', name: 'Microbiology', icon: '🦠' },
];

const labResults = [
  { id: 1, patient: 'Baby Martinez', bed: 'BED 02', test: 'CBC with Diff', category: 'cbc', status: 'Final', collectedAt: '08:30', resultAt: '09:15', results: { WBC: '12.5', RBC: '4.2', Hgb: '14.5', Hct: '42', Plt: '245' }, critical: false },
  { id: 2, patient: 'Baby Martinez', bed: 'BED 02', test: 'Blood Culture', category: 'micro', status: 'Pending', collectedAt: '08:30', resultAt: null, results: null, critical: false },
  { id: 3, patient: 'Baby Williams', bed: 'BED 04', test: 'ABG', category: 'gas', status: 'Final', collectedAt: '07:00', resultAt: '07:15', results: { pH: '7.28', pCO2: '52', pO2: '68', HCO3: '22', BE: '-3' }, critical: true },
  { id: 4, patient: 'Baby Williams', bed: 'BED 04', test: 'Total/Direct Bili', category: 'bili', status: 'Final', collectedAt: '06:00', resultAt: '06:45', results: { Total: '14.2', Direct: '0.8', Indirect: '13.4' }, critical: true },
  { id: 5, patient: 'Baby Thompson', bed: 'BED 01', test: 'BMP', category: 'chem', status: 'Final', collectedAt: '06:00', resultAt: '06:30', results: { Na: '138', K: '4.2', Cl: '102', CO2: '24', BUN: '12', Cr: '0.4', Glu: '72' }, critical: false },
  { id: 6, patient: 'Baby Chen', bed: 'BED 03', test: 'CBC with Diff', category: 'cbc', status: 'Final', collectedAt: '06:00', resultAt: '06:45', results: { WBC: '8.2', RBC: '4.8', Hgb: '16.2', Hct: '48', Plt: '198' }, critical: false },
  { id: 7, patient: 'Baby Johnson', bed: 'BED 05', test: 'PT/INR', category: 'coag', status: 'Final', collectedAt: '08:00', resultAt: '08:30', results: { PT: '12.5', INR: '1.1', PTT: '32' }, critical: false },
  { id: 8, patient: 'Baby Brown', bed: 'BED 06', test: 'Blood Gas (VBG)', category: 'gas', status: 'Final', collectedAt: '09:00', resultAt: '09:10', results: { pH: '7.35', pCO2: '42', pO2: '45', HCO3: '24', BE: '0' }, critical: false },
];

const pendingOrders = [
  { id: 1, patient: 'Baby Martinez', bed: 'BED 02', test: 'CRP', orderedAt: '10:30', orderedBy: 'Dr. Chen', priority: 'STAT' },
  { id: 2, patient: 'Baby Williams', bed: 'BED 04', test: 'Repeat ABG', orderedAt: '10:00', orderedBy: 'Dr. Patel', priority: 'STAT' },
  { id: 3, patient: 'Baby Thompson', bed: 'BED 01', test: 'Procalcitonin', orderedAt: '09:00', orderedBy: 'Dr. Chen', priority: 'Routine' },
  { id: 4, patient: 'Baby Garcia', bed: 'BED 08', test: 'Newborn Screen', orderedAt: '08:00', orderedBy: 'Dr. Patel', priority: 'Routine' },
];

export default function LabsPage() {
  const [activeTab, setActiveTab] = useState('results');
  const [selectedPatient, setSelectedPatient] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  const filteredResults = labResults.filter(result => {
    if (selectedPatient !== 'all' && result.patient !== selectedPatient) return false;
    if (selectedCategory !== 'all' && result.category !== selectedCategory) return false;
    return true;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Final': return 'bg-green-500/20 text-green-400';
      case 'Pending': return 'bg-yellow-500/20 text-yellow-400';
      case 'Preliminary': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const viewResult = (result) => {
    setSelectedResult(result);
    setShowResultModal(true);
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Laboratory Results</h1>
            <p className="text-slate-400 text-sm">View and manage lab results for all patients</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Patients</option>
              {patients.map((p) => (
                <option key={p.id} value={p.name}>{p.bed} - {p.name}</option>
              ))}
            </select>
            <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Order Labs
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <span className="text-xl">🧪</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{labResults.length}</div>
                <div className="text-sm text-slate-400">Results Today</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <span className="text-xl">⏳</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{pendingOrders.length}</div>
                <div className="text-sm text-slate-400">Pending Orders</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{labResults.filter(r => r.critical).length}</div>
                <div className="text-sm text-slate-400">Critical Values</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <span className="text-xl">✓</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{labResults.filter(r => r.status === 'Final').length}</div>
                <div className="text-sm text-slate-400">Finalized</div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            All Categories
          </button>
          {labCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 pb-2">
          {['results', 'pending', 'critical'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab}
              {tab === 'pending' && <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/30 rounded text-xs">{pendingOrders.length}</span>}
              {tab === 'critical' && <span className="ml-2 px-1.5 py-0.5 bg-red-500/30 rounded text-xs">{labResults.filter(r => r.critical).length}</span>}
            </button>
          ))}
        </div>

        {/* Results Table */}
        {activeTab === 'results' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                    <th className="p-4">Patient</th>
                    <th className="p-4">Bed</th>
                    <th className="p-4">Test</th>
                    <th className="p-4">Collected</th>
                    <th className="p-4">Result Time</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result) => (
                    <tr key={result.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${result.critical ? 'bg-red-500/5' : ''}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {result.critical && (
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                          )}
                          <span className="text-white font-medium">{result.patient}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-400">{result.bed}</td>
                      <td className="p-4 text-white">{result.test}</td>
                      <td className="p-4 text-slate-400">{result.collectedAt}</td>
                      <td className="p-4 text-slate-400">{result.resultAt || '—'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(result.status)}`}>
                          {result.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {result.results && (
                          <button
                            onClick={() => viewResult(result)}
                            className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm hover:bg-cyan-500/30"
                          >
                            View Results
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pending Orders Table */}
        {activeTab === 'pending' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                    <th className="p-4">Patient</th>
                    <th className="p-4">Bed</th>
                    <th className="p-4">Test</th>
                    <th className="p-4">Priority</th>
                    <th className="p-4">Ordered At</th>
                    <th className="p-4">Ordered By</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-4 text-white font-medium">{order.patient}</td>
                      <td className="p-4 text-slate-400">{order.bed}</td>
                      <td className="p-4 text-white">{order.test}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          order.priority === 'STAT' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{order.orderedAt}</td>
                      <td className="p-4 text-slate-400">{order.orderedBy}</td>
                      <td className="p-4">
                        <button className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30">
                          Mark Collected
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Critical Values */}
        {activeTab === 'critical' && (
          <div className="space-y-4">
            {labResults.filter(r => r.critical).map((result) => (
              <div key={result.id} className="bg-slate-800 rounded-xl border border-red-500/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-white font-medium">{result.patient} - {result.bed}</div>
                      <div className="text-slate-400 text-sm">{result.test} at {result.resultAt}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => viewResult(result)}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                    >
                      View Critical Values
                    </button>
                    <button className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                      Acknowledge
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Result Detail Modal */}
        {showResultModal && selectedResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedResult.test}</h3>
                  <p className="text-slate-400 text-sm">{selectedResult.patient} - {selectedResult.bed}</p>
                </div>
                <button onClick={() => setShowResultModal(false)} className="text-slate-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Collected:</span>
                  <span className="text-white">{selectedResult.collectedAt}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Result Time:</span>
                  <span className="text-white">{selectedResult.resultAt}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Status:</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedResult.status)}`}>
                    {selectedResult.status}
                  </span>
                </div>

                <div className="border-t border-slate-700 pt-4 mt-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-3">Results</h4>
                  <div className="bg-slate-900 rounded-lg p-4">
                    <table className="w-full">
                      <tbody>
                        {Object.entries(selectedResult.results).map(([key, value]) => (
                          <tr key={key} className="border-b border-slate-700/50 last:border-0">
                            <td className="py-2 text-slate-400">{key}</td>
                            <td className="py-2 text-white text-right font-mono">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setShowResultModal(false)}
                  className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  Close
                </button>
                <button className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
                  Print Result
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
