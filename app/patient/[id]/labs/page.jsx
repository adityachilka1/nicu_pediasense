'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PatientHeader from '@/components/PatientHeader';
import PatientTabs from '@/components/PatientTabs';
import { initialPatients } from '@/lib/data';

export default function PatientLabsPage() {
  const params = useParams();
  const patient = initialPatients.find(p => p.id === parseInt(params.id)) || initialPatients[0];
  const [selectedCategory, setSelectedCategory] = useState('all');
  
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
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
              View Trends
            </button>
            <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors">
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
                    <button className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-cyan-400 transition-colors">
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
      </div>
    </AppShell>
  );
}
