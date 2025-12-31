'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';

const patients = [
  { id: 1, name: 'Baby Thompson', bed: 'BED 01', weight: 2.1 },
  { id: 2, name: 'Baby Martinez', bed: 'BED 02', weight: 1.2 },
  { id: 3, name: 'Baby Chen', bed: 'BED 03', weight: 2.8 },
  { id: 4, name: 'Baby Williams', bed: 'BED 04', weight: 0.9 },
  { id: 5, name: 'Baby Johnson', bed: 'BED 05', weight: 1.8 },
  { id: 6, name: 'Baby Brown', bed: 'BED 06', weight: 1.5 },
  { id: 7, name: 'Baby Davis', bed: 'BED 07', weight: 2.4 },
  { id: 8, name: 'Baby Garcia', bed: 'BED 08', weight: 1.9 },
];

const medicationCategories = [
  { id: 'antibiotics', name: 'Antibiotics', icon: '💊', color: 'text-blue-400' },
  { id: 'respiratory', name: 'Respiratory', icon: '🫁', color: 'text-cyan-400' },
  { id: 'cardiovascular', name: 'Cardiovascular', icon: '❤️', color: 'text-red-400' },
  { id: 'analgesics', name: 'Pain/Sedation', icon: '😴', color: 'text-purple-400' },
  { id: 'nutrition', name: 'Nutrition', icon: '🍼', color: 'text-green-400' },
  { id: 'other', name: 'Other', icon: '💉', color: 'text-slate-400' },
];

const activeMedications = [
  { id: 1, patient: 'Baby Martinez', bed: 'BED 02', medication: 'Ampicillin', dose: '50 mg/kg', route: 'IV', frequency: 'Q12H', nextDue: '14:00', status: 'Active', category: 'antibiotics' },
  { id: 2, patient: 'Baby Martinez', bed: 'BED 02', medication: 'Gentamicin', dose: '4 mg/kg', route: 'IV', frequency: 'Q36H', nextDue: '20:00', status: 'Active', category: 'antibiotics' },
  { id: 3, patient: 'Baby Williams', bed: 'BED 04', medication: 'Caffeine Citrate', dose: '5 mg/kg', route: 'IV', frequency: 'Daily', nextDue: '08:00', status: 'Active', category: 'respiratory' },
  { id: 4, patient: 'Baby Williams', bed: 'BED 04', medication: 'Dopamine', dose: '5 mcg/kg/min', route: 'IV Drip', frequency: 'Continuous', nextDue: 'Cont', status: 'Active', category: 'cardiovascular' },
  { id: 5, patient: 'Baby Williams', bed: 'BED 04', medication: 'Fentanyl', dose: '1 mcg/kg/hr', route: 'IV Drip', frequency: 'Continuous', nextDue: 'Cont', status: 'Active', category: 'analgesics' },
  { id: 6, patient: 'Baby Thompson', bed: 'BED 01', medication: 'Vitamin D', dose: '400 IU', route: 'PO', frequency: 'Daily', nextDue: '09:00', status: 'Active', category: 'nutrition' },
  { id: 7, patient: 'Baby Thompson', bed: 'BED 01', medication: 'Iron Supplement', dose: '2 mg/kg', route: 'PO', frequency: 'Daily', nextDue: '09:00', status: 'Active', category: 'nutrition' },
  { id: 8, patient: 'Baby Chen', bed: 'BED 03', medication: 'Caffeine Citrate', dose: '5 mg/kg', route: 'PO', frequency: 'Daily', nextDue: '08:00', status: 'Active', category: 'respiratory' },
];

const recentAdministrations = [
  { id: 1, patient: 'Baby Martinez', bed: 'BED 02', medication: 'Ampicillin', dose: '60 mg', time: '08:00', givenBy: 'RN Smith', status: 'Given' },
  { id: 2, patient: 'Baby Martinez', bed: 'BED 02', medication: 'Gentamicin', dose: '4.8 mg', time: '08:00', givenBy: 'RN Smith', status: 'Given' },
  { id: 3, patient: 'Baby Williams', bed: 'BED 04', medication: 'Caffeine Citrate', dose: '4.5 mg', time: '08:00', givenBy: 'RN Johnson', status: 'Given' },
  { id: 4, patient: 'Baby Thompson', bed: 'BED 01', medication: 'Vitamin D', dose: '400 IU', time: '09:00', givenBy: 'RN Davis', status: 'Given' },
  { id: 5, patient: 'Baby Chen', bed: 'BED 03', medication: 'Caffeine Citrate', dose: '14 mg', time: '08:00', givenBy: 'RN Wilson', status: 'Given' },
];

const dueMedications = [
  { id: 1, patient: 'Baby Martinez', bed: 'BED 02', medication: 'Ampicillin', dose: '60 mg', dueTime: '14:00', timeUntil: '2h 15m', priority: 'normal' },
  { id: 2, patient: 'Baby Brown', bed: 'BED 06', medication: 'Vancomycin', dose: '15 mg', dueTime: '12:00', timeUntil: '15m', priority: 'soon' },
  { id: 3, patient: 'Baby Johnson', bed: 'BED 05', medication: 'Vitamin K', dose: '1 mg', dueTime: '11:30', timeUntil: 'OVERDUE', priority: 'overdue' },
];

export default function MedicationsPage() {
  const [activeTab, setActiveTab] = useState('active');
  const [selectedPatient, setSelectedPatient] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);

  const filteredMedications = activeMedications.filter(med => {
    if (selectedPatient !== 'all' && med.patient !== selectedPatient) return false;
    if (selectedCategory !== 'all' && med.category !== selectedCategory) return false;
    return true;
  });

  const getCategoryColor = (category) => {
    const cat = medicationCategories.find(c => c.id === category);
    return cat?.color || 'text-slate-400';
  };

  const getCategoryIcon = (category) => {
    const cat = medicationCategories.find(c => c.id === category);
    return cat?.icon || '💊';
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'overdue': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'soon': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default: return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  const handleAdminister = (med) => {
    setSelectedMed(med);
    setShowAdminModal(true);
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Medication Administration</h1>
            <p className="text-slate-400 text-sm">Manage and track medication administration</p>
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
              New Order
            </button>
          </div>
        </div>

        {/* Due Medications Alert */}
        {dueMedications.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Medications Due
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {dueMedications.map((med) => (
                <div
                  key={med.id}
                  className={`flex-shrink-0 px-4 py-3 rounded-lg border ${getPriorityStyle(med.priority)}`}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">{med.medication}</div>
                      <div className="text-sm opacity-75">{med.patient} - {med.bed}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${med.priority === 'overdue' ? 'text-red-400' : ''}`}>
                        {med.timeUntil}
                      </div>
                      <div className="text-xs opacity-75">Due: {med.dueTime}</div>
                    </div>
                    <button
                      onClick={() => handleAdminister(med)}
                      className="ml-2 px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30"
                    >
                      Give
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <span className="text-xl">💊</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{activeMedications.length}</div>
                <div className="text-sm text-slate-400">Active Orders</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <span className="text-xl">✓</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{recentAdministrations.length}</div>
                <div className="text-sm text-slate-400">Given Today</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <span className="text-xl">⏰</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{dueMedications.filter(m => m.priority !== 'overdue').length}</div>
                <div className="text-sm text-slate-400">Due Soon</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{dueMedications.filter(m => m.priority === 'overdue').length}</div>
                <div className="text-sm text-slate-400">Overdue</div>
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
          {medicationCategories.map((cat) => (
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
          {['active', 'history', 'discontinued'].map((tab) => (
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
              {tab === 'active' && <span className="ml-2 px-1.5 py-0.5 bg-cyan-500/30 rounded text-xs">{activeMedications.length}</span>}
            </button>
          ))}
        </div>

        {/* Active Medications Table */}
        {activeTab === 'active' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                    <th className="p-4">Patient</th>
                    <th className="p-4">Medication</th>
                    <th className="p-4">Dose</th>
                    <th className="p-4">Route</th>
                    <th className="p-4">Frequency</th>
                    <th className="p-4">Next Due</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedications.map((med) => (
                    <tr key={med.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-4">
                        <div>
                          <div className="text-white font-medium">{med.patient}</div>
                          <div className="text-slate-400 text-sm">{med.bed}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span>{getCategoryIcon(med.category)}</span>
                          <span className={`font-medium ${getCategoryColor(med.category)}`}>{med.medication}</span>
                        </div>
                      </td>
                      <td className="p-4 text-white">{med.dose}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          med.route === 'IV' || med.route === 'IV Drip'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {med.route}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">{med.frequency}</td>
                      <td className="p-4">
                        <span className={`font-medium ${med.nextDue === 'Cont' ? 'text-cyan-400' : 'text-white'}`}>
                          {med.nextDue}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
                          {med.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {med.frequency !== 'Continuous' && (
                            <button
                              onClick={() => handleAdminister(med)}
                              className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30"
                            >
                              Administer
                            </button>
                          )}
                          <button className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Administration History */}
        {activeTab === 'history' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                    <th className="p-4">Time</th>
                    <th className="p-4">Patient</th>
                    <th className="p-4">Medication</th>
                    <th className="p-4">Dose</th>
                    <th className="p-4">Given By</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAdministrations.map((admin) => (
                    <tr key={admin.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-4 text-white font-medium">{admin.time}</td>
                      <td className="p-4">
                        <div>
                          <div className="text-white">{admin.patient}</div>
                          <div className="text-slate-400 text-sm">{admin.bed}</div>
                        </div>
                      </td>
                      <td className="p-4 text-white">{admin.medication}</td>
                      <td className="p-4 text-slate-300">{admin.dose}</td>
                      <td className="p-4 text-slate-400">{admin.givenBy}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
                          {admin.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Discontinued */}
        {activeTab === 'discontinued' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
            <div className="text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No discontinued medications to display</p>
            </div>
          </div>
        )}

        {/* Administration Modal */}
        {showAdminModal && selectedMed && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Administer Medication</h3>
                <button onClick={() => setShowAdminModal(false)} className="text-slate-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xl font-bold text-white mb-1">{selectedMed.medication}</div>
                  <div className="text-slate-400">{selectedMed.patient} - {selectedMed.bed}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Dose</label>
                    <input
                      type="text"
                      defaultValue={selectedMed.dose}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Route</label>
                    <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                      <option>IV</option>
                      <option>IV Push</option>
                      <option>IV Drip</option>
                      <option>PO</option>
                      <option>IM</option>
                      <option>SQ</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Time Administered</label>
                  <input
                    type="time"
                    defaultValue={new Date().toTimeString().slice(0, 5)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Notes</label>
                  <textarea
                    placeholder="Add any notes..."
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white h-20 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-yellow-400">Verify patient ID and medication before administration</span>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowAdminModal(false);
                    // Add to history
                  }}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm Administration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
