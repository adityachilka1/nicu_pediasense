'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PatientHeader from '@/components/PatientHeader';
import PatientTabs from '@/components/PatientTabs';
import { initialPatients } from '@/lib/data';
import { useToast } from '@/components/Toast';

export default function PatientLabsPage() {
  const params = useParams();
  const patient = initialPatients.find(p => p.id === parseInt(params.id)) || initialPatients[0];
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showTrendsModal, setShowTrendsModal] = useState(false);
  const [selectedLabTrend, setSelectedLabTrend] = useState(null);
  const [orderForm, setOrderForm] = useState({
    tests: [],
    priority: 'routine',
    notes: ''
  });
  const toast = useToast();
  
  const labResults = [
    { id: 1, category: 'cbc', name: 'Hemoglobin', value: '14.2', unit: 'g/dL', range: '13.5-19.5', status: 'normal', timestamp: '2024-12-29T08:00:00' },
    { id: 2, category: 'cbc', name: 'Hematocrit', value: '42', unit: '%', range: '42-65', status: 'normal', timestamp: '2024-12-29T08:00:00' },
    { id: 3, category: 'cbc', name: 'WBC', value: '12.5', unit: 'K/uL', range: '9.0-30.0', status: 'normal', timestamp: '2024-12-29T08:00:00' },
    { id: 4, category: 'cbc', name: 'Platelets', value: '185', unit: 'K/uL', range: '150-400', status: 'normal', timestamp: '2024-12-29T08:00:00' },
    { id: 5, category: 'chem', name: 'Glucose', value: '68', unit: 'mg/dL', range: '50-110', status: 'normal', timestamp: '2024-12-29T06:00:00' },
    { id: 6, category: 'chem', name: 'Sodium', value: '138', unit: 'mEq/L', range: '135-145', status: 'normal', timestamp: '2024-12-29T06:00:00' },
    { id: 7, category: 'chem', name: 'Potassium', value: '4.8', unit: 'mEq/L', range: '3.5-5.5', status: 'normal', timestamp: '2024-12-29T06:00:00' },
    { id: 8, category: 'chem', name: 'Calcium', value: '9.2', unit: 'mg/dL', range: '8.5-10.5', status: 'normal', timestamp: '2024-12-29T06:00:00' },
    { id: 9, category: 'bili', name: 'Total Bilirubin', value: '8.5', unit: 'mg/dL', range: '<12', status: 'normal', timestamp: '2024-12-29T04:00:00' },
    { id: 10, category: 'bili', name: 'Direct Bilirubin', value: '0.4', unit: 'mg/dL', range: '<0.5', status: 'normal', timestamp: '2024-12-29T04:00:00' },
    { id: 11, category: 'gas', name: 'pH', value: '7.32', unit: '', range: '7.35-7.45', status: 'low', timestamp: '2024-12-29T02:00:00' },
    { id: 12, category: 'gas', name: 'pCO2', value: '48', unit: 'mmHg', range: '35-45', status: 'high', timestamp: '2024-12-29T02:00:00' },
    { id: 13, category: 'gas', name: 'pO2', value: '72', unit: 'mmHg', range: '60-80', status: 'normal', timestamp: '2024-12-29T02:00:00' },
    { id: 14, category: 'gas', name: 'HCO3', value: '22', unit: 'mEq/L', range: '22-26', status: 'normal', timestamp: '2024-12-29T02:00:00' },
    { id: 15, category: 'gas', name: 'Base Excess', value: '-3', unit: 'mEq/L', range: '-2 to +2', status: 'low', timestamp: '2024-12-29T02:00:00' },
    { id: 16, category: 'culture', name: 'Blood Culture', value: 'No growth', unit: '', range: 'Negative', status: 'normal', timestamp: '2024-12-28T12:00:00' },
  ];
  
  const categories = [
    { id: 'all', name: 'All Results' },
    { id: 'cbc', name: 'CBC' },
    { id: 'chem', name: 'Chemistry' },
    { id: 'bili', name: 'Bilirubin' },
    { id: 'gas', name: 'Blood Gas' },
    { id: 'culture', name: 'Cultures' },
  ];
  
  const filteredResults = selectedCategory === 'all' 
    ? labResults 
    : labResults.filter(r => r.category === selectedCategory);
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'high': return 'text-red-400 bg-red-500/10';
      case 'low': return 'text-yellow-400 bg-yellow-500/10';
      case 'critical': return 'text-red-500 bg-red-500/20 font-bold';
      default: return 'text-emerald-400 bg-emerald-500/10';
    }
  };
  
  return (
    <AppShell>
      <div className="p-6">
        <PatientHeader patient={patient} />
        <PatientTabs patientId={patient.id} />
        
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Laboratory Results</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTrendsModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Trends
            </button>
            <button
              onClick={() => setShowOrderModal(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Order Labs
            </button>
          </div>
        </div>
        
        {/* Category Tabs */}
        <div className="flex items-center gap-2 mb-6">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === cat.id 
                  ? 'bg-cyan-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        
        {/* Results Table */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Test</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Result</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Unit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Reference Range</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Collected</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredResults.map(result => (
                <tr key={result.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{result.name}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono font-bold ${result.status !== 'normal' ? 'text-lg' : ''} ${
                      result.status === 'high' ? 'text-red-400' : 
                      result.status === 'low' ? 'text-yellow-400' : 
                      'text-white'
                    }`}>
                      {result.value}
                      {result.status === 'high' && ' ↑'}
                      {result.status === 'low' && ' ↓'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{result.unit}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{result.range}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.status)}`}>
                      {result.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {new Date(result.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedLabTrend(result)}
                      className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-cyan-400 transition-colors"
                      title={`View ${result.name} trend`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pending Labs */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-white mb-4">Pending Orders</h2>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="space-y-3">
              {[
                { name: 'CBC with Differential', ordered: '2024-12-29T14:00:00', status: 'collecting' },
                { name: 'Blood Culture x2', ordered: '2024-12-29T12:00:00', status: 'pending' },
                { name: 'Metabolic Panel', ordered: '2024-12-29T14:00:00', status: 'in-lab' },
              ].map((order, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div>
                    <div className="font-medium text-white">{order.name}</div>
                    <div className="text-xs text-slate-500">
                      Ordered: {new Date(order.ordered).toLocaleString()}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.status === 'collecting' ? 'bg-yellow-500/20 text-yellow-400' :
                    order.status === 'in-lab' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {order.status === 'collecting' ? 'Collecting' :
                     order.status === 'in-lab' ? 'In Lab' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Labs Modal */}
        {showOrderModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Order Laboratory Tests</h3>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Select Tests</label>
                  <div className="space-y-2 bg-slate-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {[
                      { id: 'cbc', name: 'CBC with Differential' },
                      { id: 'bmp', name: 'Basic Metabolic Panel' },
                      { id: 'cmp', name: 'Comprehensive Metabolic Panel' },
                      { id: 'bili', name: 'Bilirubin (Total & Direct)' },
                      { id: 'abg', name: 'Arterial Blood Gas' },
                      { id: 'vbg', name: 'Venous Blood Gas' },
                      { id: 'culture', name: 'Blood Culture x2' },
                      { id: 'ua', name: 'Urinalysis' },
                      { id: 'crp', name: 'C-Reactive Protein' },
                      { id: 'procal', name: 'Procalcitonin' },
                      { id: 'coag', name: 'Coagulation Panel (PT/PTT)' },
                      { id: 'type', name: 'Type & Screen' },
                    ].map(test => (
                      <label key={test.id} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={orderForm.tests.includes(test.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setOrderForm({...orderForm, tests: [...orderForm.tests, test.id]});
                            } else {
                              setOrderForm({...orderForm, tests: orderForm.tests.filter(t => t !== test.id)});
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className="text-white">{test.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Priority</label>
                  <select
                    value={orderForm.priority}
                    onChange={(e) => setOrderForm({...orderForm, priority: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="stat">STAT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Clinical Notes</label>
                  <textarea
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm({...orderForm, notes: e.target.value})}
                    placeholder="Reason for test, clinical indication..."
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white resize-none"
                  />
                </div>

                {orderForm.tests.length > 0 && (
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-2">Selected Tests ({orderForm.tests.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {orderForm.tests.map(t => (
                        <span key={t} className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">
                          {t.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowOrderModal(false);
                    setOrderForm({ tests: [], priority: 'routine', notes: '' });
                  }}
                  className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (orderForm.tests.length === 0) {
                      toast.error('Please select at least one test');
                      return;
                    }
                    toast.success(`${orderForm.tests.length} lab test(s) ordered successfully`);
                    setShowOrderModal(false);
                    setOrderForm({ tests: [], priority: 'routine', notes: '' });
                  }}
                  className="flex-1 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
                >
                  Submit Order
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View All Trends Modal */}
        {showTrendsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-4xl border border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Laboratory Trends</h3>
                <button
                  onClick={() => setShowTrendsModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Hemoglobin Trend */}
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-white">Hemoglobin</span>
                    <span className="text-xs text-slate-500">g/dL</span>
                  </div>
                  <div className="h-24 flex items-end gap-1">
                    {[14.8, 14.5, 14.2, 14.0, 14.2].map((v, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-cyan-500 rounded-t"
                          style={{ height: `${(v / 20) * 100}%` }}
                        />
                        <span className="text-xs text-slate-500">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-600">
                    <span>Dec 25</span>
                    <span>Dec 29</span>
                  </div>
                </div>

                {/* WBC Trend */}
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-white">WBC</span>
                    <span className="text-xs text-slate-500">K/uL</span>
                  </div>
                  <div className="h-24 flex items-end gap-1">
                    {[15.2, 14.0, 13.5, 12.8, 12.5].map((v, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-emerald-500 rounded-t"
                          style={{ height: `${(v / 20) * 100}%` }}
                        />
                        <span className="text-xs text-slate-500">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-600">
                    <span>Dec 25</span>
                    <span>Dec 29</span>
                  </div>
                </div>

                {/* Bilirubin Trend */}
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-white">Total Bilirubin</span>
                    <span className="text-xs text-slate-500">mg/dL</span>
                  </div>
                  <div className="h-24 flex items-end gap-1">
                    {[10.2, 9.8, 9.2, 8.8, 8.5].map((v, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-yellow-500 rounded-t"
                          style={{ height: `${(v / 15) * 100}%` }}
                        />
                        <span className="text-xs text-slate-500">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-600">
                    <span>Dec 25</span>
                    <span>Dec 29</span>
                  </div>
                </div>

                {/* Glucose Trend */}
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-white">Glucose</span>
                    <span className="text-xs text-slate-500">mg/dL</span>
                  </div>
                  <div className="h-24 flex items-end gap-1">
                    {[72, 65, 70, 68, 68].map((v, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-purple-500 rounded-t"
                          style={{ height: `${(v / 120) * 100}%` }}
                        />
                        <span className="text-xs text-slate-500">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-600">
                    <span>Dec 25</span>
                    <span>Dec 29</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setShowTrendsModal(false)}
                  className="w-full py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Individual Lab Trend Modal */}
        {selectedLabTrend && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{selectedLabTrend.name} Trend</h3>
                <button
                  onClick={() => setSelectedLabTrend(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-slate-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400">Current Value</span>
                  <span className={`text-2xl font-bold ${
                    selectedLabTrend.status === 'high' ? 'text-red-400' :
                    selectedLabTrend.status === 'low' ? 'text-yellow-400' :
                    'text-emerald-400'
                  }`}>
                    {selectedLabTrend.value} {selectedLabTrend.unit}
                  </span>
                </div>
                <div className="text-sm text-slate-500">
                  Reference: {selectedLabTrend.range} {selectedLabTrend.unit}
                </div>
              </div>

              <div className="bg-slate-900 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-3">Historical Values</div>
                <div className="h-32 flex items-end gap-2">
                  {[0.85, 0.9, 0.95, 0.92, 1.0].map((factor, i) => {
                    const baseValue = parseFloat(selectedLabTrend.value);
                    const value = (baseValue * factor).toFixed(1);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t ${
                            selectedLabTrend.status === 'high' ? 'bg-red-500' :
                            selectedLabTrend.status === 'low' ? 'bg-yellow-500' :
                            'bg-cyan-500'
                          }`}
                          style={{ height: `${factor * 100}%` }}
                        />
                        <span className="text-xs text-slate-500">{value}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-600">
                  <span>5 days ago</span>
                  <span>Today</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setSelectedLabTrend(null)}
                  className="w-full py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
