'use client';

import { useState, useMemo } from 'react';
import AppShell from '../../components/AppShell';
import { calculateNECRisk } from '@/lib/data';

const patients = [
  { id: 'NB-2024-0892', name: 'Baby Martinez', weight: 1180, birthWeight: 0.98, ga: '30+3', gaWeeks: 30, diagnosis: ['Prematurity', 'RDS'] },
  { id: 'NB-2024-0891', name: 'Baby Thompson', weight: 1650, birthWeight: 1.65, ga: '34+1', gaWeeks: 34, diagnosis: ['Late Preterm'] },
];

const feedingData = {
  summary: {
    totalIntake: 142,
    enteralIntake: 98,
    parenteralIntake: 44,
    totalCalories: 156,
    caloriesPerKg: 132,
    proteinGPerKg: 3.8,
    gir: 6.2,
    fluidTarget: 150,
    calorieTarget: 120,
  },
  feedLog: [
    { time: '06:00', type: 'Enteral', amount: 14, method: 'Gavage', milk: 'EBM+HMF', tolerated: true },
    { time: '09:00', type: 'Enteral', amount: 14, method: 'Gavage', milk: 'EBM+HMF', tolerated: true },
    { time: '12:00', type: 'Enteral', amount: 14, method: 'Gavage', milk: 'EBM+HMF', tolerated: true },
    { time: '15:00', type: 'Enteral', amount: 14, method: 'Gavage', milk: 'EBM+HMF', tolerated: false, note: 'Residual 3mL' },
    { time: '18:00', type: 'Enteral', amount: 14, method: 'Gavage', milk: 'EBM+HMF', tolerated: true },
    { time: '21:00', type: 'Enteral', amount: 14, method: 'Gavage', milk: 'EBM+HMF', tolerated: true },
  ],
  tpn: {
    rate: 4.5,
    dextrose: 12.5,
    aminoAcids: 3.5,
    lipids: 2.0,
    sodium: 3,
    potassium: 2,
    calcium: 2,
    phosphorus: 1.5,
  },
  breastMilk: {
    motherSupply: 85,
    stored: 240,
    lastPump: '2024-12-29 08:30',
    avgVolume: 45,
  }
};

export default function FeedingPage() {
  const [selectedPatient, setSelectedPatient] = useState(patients[0]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedLog, setFeedLog] = useState(feedingData.feedLog);
  const [showNECDetails, setShowNECDetails] = useState(false);
  const [newFeed, setNewFeed] = useState({
    time: '',
    amount: '',
    method: 'Gavage',
    milk: 'EBM+HMF',
    tolerated: true,
    note: ''
  });

  // Calculate NEC risk for selected patient
  const necRisk = useMemo(() => {
    const feedingInfo = {
      milkType: newFeed.milk.includes('Formula') ? 'Formula' : newFeed.milk.includes('Donor') ? 'Donor' : 'EBM',
      advancementRate: 20, // Default rate, would be calculated from actual data
      feedingIntolerance: feedLog.some(f => !f.tolerated),
      recentTransfusion: false, // Would come from patient data
    };
    return calculateNECRisk(selectedPatient, feedingInfo);
  }, [selectedPatient, feedLog, newFeed.milk]);

  const handleSaveFeed = () => {
    if (newFeed.time && newFeed.amount) {
      const feed = {
        time: newFeed.time,
        type: 'Enteral',
        amount: parseInt(newFeed.amount),
        method: newFeed.method,
        milk: newFeed.milk,
        tolerated: newFeed.tolerated,
        note: newFeed.note || undefined
      };
      setFeedLog([...feedLog, feed]);
      setNewFeed({ time: '', amount: '', method: 'Gavage', milk: 'EBM+HMF', tolerated: true, note: '' });
      setShowAddFeed(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'enteral', label: 'Enteral Feeds' },
    { id: 'parenteral', label: 'TPN/Fluids' },
    { id: 'breastmilk', label: 'Breast Milk' },
  ];

  const getProgressColor = (current, target) => {
    const pct = (current / target) * 100;
    if (pct < 80) return 'bg-yellow-500';
    if (pct <= 110) return 'bg-green-500';
    return 'bg-red-500';
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Feeding & Nutrition</h1>
            <p className="text-slate-400 text-sm">Track enteral/parenteral nutrition and caloric intake</p>
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
            <button
              onClick={() => setShowAddFeed(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Feed
            </button>
          </div>
        </div>

        {/* Patient Info Bar */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-8">
          <div>
            <span className="text-sm text-slate-400">Patient</span>
            <p className="text-white font-medium">{selectedPatient.name}</p>
          </div>
          <div>
            <span className="text-sm text-slate-400">Current Weight</span>
            <p className="text-white font-medium">{selectedPatient.weight}g</p>
          </div>
          <div>
            <span className="text-sm text-slate-400">PCA</span>
            <p className="text-white font-medium">{selectedPatient.ga}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs ${
              feedingData.summary.caloriesPerKg >= 120 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {feedingData.summary.caloriesPerKg >= 120 ? 'Goal Met' : 'Below Goal'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* NEC Risk Assessment Card */}
            <div className={`rounded-xl border p-4 ${
              necRisk.riskLevel === 'HIGH' ? 'bg-red-900/20 border-red-500/50' :
              necRisk.riskLevel === 'MODERATE' ? 'bg-yellow-900/20 border-yellow-500/50' :
              necRisk.riskLevel === 'LOW-MODERATE' ? 'bg-amber-900/20 border-amber-500/50' :
              'bg-emerald-900/20 border-emerald-500/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    necRisk.riskLevel === 'HIGH' ? 'bg-red-500/20' :
                    necRisk.riskLevel === 'MODERATE' ? 'bg-yellow-500/20' :
                    necRisk.riskLevel === 'LOW-MODERATE' ? 'bg-amber-500/20' :
                    'bg-emerald-500/20'
                  }`}>
                    <svg className={`w-6 h-6 ${
                      necRisk.riskLevel === 'HIGH' ? 'text-red-400' :
                      necRisk.riskLevel === 'MODERATE' ? 'text-yellow-400' :
                      necRisk.riskLevel === 'LOW-MODERATE' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-bold">NEC Risk Assessment</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        necRisk.riskLevel === 'HIGH' ? 'bg-red-500/30 text-red-400' :
                        necRisk.riskLevel === 'MODERATE' ? 'bg-yellow-500/30 text-yellow-400' :
                        necRisk.riskLevel === 'LOW-MODERATE' ? 'bg-amber-500/30 text-amber-400' :
                        'bg-emerald-500/30 text-emerald-400'
                      }`}>
                        {necRisk.riskLevel}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      Score: {necRisk.score}/{necRisk.maxScore} • Suggested advancement: {necRisk.suggestedAdvancement} mL/kg/day
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNECDetails(!showNECDetails)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  {showNECDetails ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              {showNECDetails && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-400 mb-2">Risk Factors</h4>
                      <ul className="space-y-1">
                        {necRisk.riskFactors.length > 0 ? necRisk.riskFactors.map((rf, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              rf.weight >= 3 ? 'bg-red-500/30 text-red-400' :
                              rf.weight >= 2 ? 'bg-yellow-500/30 text-yellow-400' :
                              'bg-slate-600 text-slate-300'
                            }`}>
                              +{rf.weight}
                            </span>
                            <span className="text-slate-300">{rf.factor}</span>
                          </li>
                        )) : (
                          <li className="text-sm text-slate-400">No significant risk factors identified</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-400 mb-2">Recommendation</h4>
                      <p className={`text-sm p-3 rounded-lg ${
                        necRisk.riskLevel === 'HIGH' ? 'bg-red-900/30 text-red-300' :
                        necRisk.riskLevel === 'MODERATE' ? 'bg-yellow-900/30 text-yellow-300' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {necRisk.recommendation}
                      </p>
                      <div className="mt-3 p-3 bg-slate-800 rounded-lg">
                        <div className="text-xs text-slate-400 mb-1">Feed Advancement Guidance</div>
                        <div className="flex items-center gap-3">
                          <div className="text-2xl font-bold text-cyan-400">{necRisk.suggestedAdvancement}</div>
                          <div className="text-sm text-slate-400">mL/kg/day<br/>recommended</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Daily Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Total Fluids</span>
                  <span className="text-xs text-slate-500">{feedingData.summary.fluidTarget} target</span>
                </div>
                <div className="text-2xl font-bold text-white mb-2">
                  {feedingData.summary.totalIntake} <span className="text-sm font-normal text-slate-400">mL/kg/day</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(feedingData.summary.totalIntake, feedingData.summary.fluidTarget)}`}
                    style={{ width: `${Math.min((feedingData.summary.totalIntake / feedingData.summary.fluidTarget) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Calories</span>
                  <span className="text-xs text-slate-500">{feedingData.summary.calorieTarget} target</span>
                </div>
                <div className="text-2xl font-bold text-cyan-400 mb-2">
                  {feedingData.summary.caloriesPerKg} <span className="text-sm font-normal text-slate-400">kcal/kg/day</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(feedingData.summary.caloriesPerKg, feedingData.summary.calorieTarget)}`}
                    style={{ width: `${Math.min((feedingData.summary.caloriesPerKg / feedingData.summary.calorieTarget) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Protein Intake</div>
                <div className="text-2xl font-bold text-green-400 mb-2">
                  {feedingData.summary.proteinGPerKg} <span className="text-sm font-normal text-slate-400">g/kg/day</span>
                </div>
                <div className="text-xs text-slate-500">Target: 3.5-4.0 g/kg/day</div>
              </div>

              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">GIR</div>
                <div className="text-2xl font-bold text-purple-400 mb-2">
                  {feedingData.summary.gir} <span className="text-sm font-normal text-slate-400">mg/kg/min</span>
                </div>
                <div className="text-xs text-slate-500">Target: 4-8 mg/kg/min</div>
              </div>
            </div>

            {/* Intake Breakdown */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <h3 className="font-semibold text-white mb-4">Intake Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-slate-300">Enteral</span>
                    </div>
                    <span className="text-white font-medium">{feedingData.summary.enteralIntake} mL/kg/day</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-slate-300">Parenteral</span>
                    </div>
                    <span className="text-white font-medium">{feedingData.summary.parenteralIntake} mL/kg/day</span>
                  </div>
                </div>
                <div className="mt-4 h-4 bg-slate-700 rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500"
                    style={{ width: `${(feedingData.summary.enteralIntake / feedingData.summary.totalIntake) * 100}%` }}
                  ></div>
                  <div
                    className="bg-blue-500"
                    style={{ width: `${(feedingData.summary.parenteralIntake / feedingData.summary.totalIntake) * 100}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-xs text-slate-400 text-center">
                  {Math.round((feedingData.summary.enteralIntake / feedingData.summary.totalIntake) * 100)}% Enteral
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <h3 className="font-semibold text-white mb-4">Feeding Tolerance</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Feeds Today</span>
                    <span className="text-white font-medium">{feedLog.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Tolerated</span>
                    <span className="text-green-400 font-medium">
                      {feedLog.filter(f => f.tolerated).length}/{feedLog.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Residuals</span>
                    <span className="text-yellow-400 font-medium">
                      {feedLog.filter(f => !f.tolerated).length} episodes
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Emesis</span>
                    <span className="text-green-400 font-medium">None</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Feeds */}
            <div className="bg-slate-800 rounded-xl border border-slate-700">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-white">Today's Feed Log</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                      <th className="p-3">Time</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Milk Type</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedLog.map((feed, i) => (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="p-3 text-sm text-white font-medium">{feed.time}</td>
                        <td className="p-3 text-sm text-slate-300">{feed.type}</td>
                        <td className="p-3 text-sm text-cyan-400">{feed.amount} mL</td>
                        <td className="p-3 text-sm text-slate-300">{feed.method}</td>
                        <td className="p-3 text-sm text-slate-300">{feed.milk}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            feed.tolerated ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {feed.tolerated ? 'Tolerated' : 'Residual'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-slate-400">{feed.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'enteral' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h3 className="font-semibold text-white mb-4">Current Enteral Feed Order</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Volume</div>
                  <div className="text-xl font-bold text-white">14 mL</div>
                  <div className="text-xs text-slate-500">q3h</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Milk Type</div>
                  <div className="text-xl font-bold text-white">EBM+HMF</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Calories</div>
                  <div className="text-xl font-bold text-green-400">24 kcal/oz</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-slate-400">Method</div>
                  <div className="text-xl font-bold text-white">Gavage</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold text-white">Feed Log</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                      <th className="p-3">Time</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Milk</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedLog.map((feed, i) => (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="p-3 text-sm text-white font-medium">{feed.time}</td>
                        <td className="p-3 text-sm text-cyan-400">{feed.amount} mL</td>
                        <td className="p-3 text-sm text-slate-300">{feed.method}</td>
                        <td className="p-3 text-sm text-slate-300">{feed.milk}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            feed.tolerated ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {feed.tolerated ? 'Tolerated' : 'Residual'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-slate-400">{feed.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'parenteral' && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="font-semibold text-white mb-4">Current TPN Order</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400">Rate</div>
                <div className="text-xl font-bold text-white">{feedingData.tpn.rate} mL/hr</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400">Dextrose</div>
                <div className="text-xl font-bold text-white">{feedingData.tpn.dextrose}%</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400">Amino Acids</div>
                <div className="text-xl font-bold text-white">{feedingData.tpn.aminoAcids} g/kg</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400">Lipids</div>
                <div className="text-xl font-bold text-white">{feedingData.tpn.lipids} g/kg</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'breastmilk' && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="font-semibold text-white mb-4">Breast Milk Tracking</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400">Mother's Supply</div>
                <div className="text-xl font-bold text-green-400">{feedingData.breastMilk.motherSupply}%</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400">Stored Volume</div>
                <div className="text-xl font-bold text-white">{feedingData.breastMilk.stored} mL</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400">Last Pump</div>
                <div className="text-lg font-bold text-white">{feedingData.breastMilk.lastPump.split(' ')[1]}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400">Avg Volume/Pump</div>
                <div className="text-xl font-bold text-white">{feedingData.breastMilk.avgVolume} mL</div>
              </div>
            </div>
          </div>
        )}

        {/* Add Feed Modal */}
        {showAddFeed && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Log Feed</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Time</label>
                    <input
                      type="time"
                      value={newFeed.time}
                      onChange={(e) => setNewFeed({ ...newFeed, time: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Amount (mL)</label>
                    <input
                      type="number"
                      value={newFeed.amount}
                      onChange={(e) => setNewFeed({ ...newFeed, amount: e.target.value })}
                      placeholder="14"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Method</label>
                    <select
                      value={newFeed.method}
                      onChange={(e) => setNewFeed({ ...newFeed, method: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="Gavage">Gavage (OG/NG)</option>
                      <option value="Bottle">Bottle</option>
                      <option value="Breast">Breast</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Milk Type</label>
                    <select
                      value={newFeed.milk}
                      onChange={(e) => setNewFeed({ ...newFeed, milk: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="EBM">EBM</option>
                      <option value="EBM+HMF">EBM + HMF</option>
                      <option value="Donor">Donor Milk</option>
                      <option value="Formula">Formula</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tolerance</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tolerance"
                        checked={newFeed.tolerated}
                        onChange={() => setNewFeed({ ...newFeed, tolerated: true, note: '' })}
                        className="text-cyan-500"
                      />
                      <span className="text-white">Tolerated</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tolerance"
                        checked={!newFeed.tolerated}
                        onChange={() => setNewFeed({ ...newFeed, tolerated: false })}
                        className="text-cyan-500"
                      />
                      <span className="text-white">Residual</span>
                    </label>
                  </div>
                </div>
                {!newFeed.tolerated && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Residual Note</label>
                    <input
                      type="text"
                      value={newFeed.note}
                      onChange={(e) => setNewFeed({ ...newFeed, note: e.target.value })}
                      placeholder="e.g., Residual 3mL"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowAddFeed(false)} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">Cancel</button>
                  <button onClick={handleSaveFeed} className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
