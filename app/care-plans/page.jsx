'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';
import { useToast } from '@/components/Toast';

const carePlans = [
  {
    id: 1, patient: 'Baby Martinez', diagnosis: 'RDS, Prematurity 28w',
    plans: [
      { name: 'Respiratory Support Protocol', status: 'Active', progress: 75, phase: 'Weaning' },
      { name: 'Sepsis Workup', status: 'Active', progress: 50, phase: 'Antibiotics Day 3' },
      { name: 'Feeding Advancement', status: 'Active', progress: 40, phase: 'Trophic Feeds' },
    ]
  },
  {
    id: 2, patient: 'Baby Thompson', diagnosis: 'Hyperbilirubinemia',
    plans: [
      { name: 'Phototherapy Protocol', status: 'Active', progress: 80, phase: 'Monitoring' },
      { name: 'Feeding Support', status: 'Active', progress: 90, phase: 'Full Feeds' },
    ]
  },
];

const protocolTemplates = [
  { id: 'rds', name: 'RDS Management', category: 'Respiratory', steps: 8 },
  { id: 'sepsis', name: 'Late-Onset Sepsis', category: 'Infection', steps: 6 },
  { id: 'nec', name: 'NEC Prevention', category: 'GI', steps: 5 },
  { id: 'hyperbili', name: 'Hyperbilirubinemia', category: 'Metabolic', steps: 4 },
  { id: 'hypoglycemia', name: 'Hypoglycemia', category: 'Metabolic', steps: 5 },
  { id: 'feeding', name: 'Feeding Advancement', category: 'Nutrition', steps: 7 },
  { id: 'pain', name: 'Pain Management', category: 'Comfort', steps: 4 },
  { id: 'discharge', name: 'Discharge Readiness', category: 'Transition', steps: 10 },
];

const detailedPlan = {
  name: 'Respiratory Support Protocol',
  patient: 'Baby Martinez',
  startDate: '2024-12-15',
  currentPhase: 3,
  phases: [
    { id: 1, name: 'Initial Stabilization', status: 'completed', tasks: [
      { task: 'Surfactant administration', done: true },
      { task: 'Intubation if needed', done: true },
      { task: 'Initial ventilator settings', done: true },
    ]},
    { id: 2, name: 'Acute Management', status: 'completed', tasks: [
      { task: 'Optimize ventilator settings', done: true },
      { task: 'Daily chest X-ray', done: true },
      { task: 'Blood gas monitoring Q6H', done: true },
    ]},
    { id: 3, name: 'Weaning Phase', status: 'active', tasks: [
      { task: 'Reduce FiO2 to <30%', done: true },
      { task: 'Reduce PIP by 1-2 q12h', done: true },
      { task: 'Assess extubation readiness', done: false },
      { task: 'Caffeine therapy', done: true },
    ]},
    { id: 4, name: 'Post-Extubation', status: 'pending', tasks: [
      { task: 'CPAP/NIPPV support', done: false },
      { task: 'Monitor for reintubation criteria', done: false },
      { task: 'Transition to high-flow/room air', done: false },
    ]},
  ],
};

export default function CarePlansPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('active');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [planPhases, setPlanPhases] = useState(detailedPlan.phases);
  const [newPlanData, setNewPlanData] = useState({ patient: 'Baby Martinez', template: 'rds' });

  const handleToggleTask = (phaseId, taskIndex) => {
    setPlanPhases(planPhases.map(phase => {
      if (phase.id === phaseId) {
        const newTasks = [...phase.tasks];
        newTasks[taskIndex] = { ...newTasks[taskIndex], done: !newTasks[taskIndex].done };

        // Check if all tasks are done to update phase status
        const allDone = newTasks.every(t => t.done);
        const anyDone = newTasks.some(t => t.done);

        return {
          ...phase,
          tasks: newTasks,
          status: allDone ? 'completed' : anyDone ? 'active' : phase.status
        };
      }
      return phase;
    }));
  };

  const handleStartPlan = () => {
    const templateName = protocolTemplates.find(t => t.id === newPlanData.template)?.name;
    toast.success(`Started ${templateName} care plan for ${newPlanData.patient}`);
    setShowNewPlan(false);
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Care Plans & Protocols</h1>
            <p className="text-slate-400 text-sm">Standardized clinical pathways</p>
          </div>
          <button
            onClick={() => setShowNewPlan(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Care Plan
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 pb-2">
          {['active', 'completed', 'templates'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                activeTab === tab ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'active' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Active Plans List */}
            <div className="space-y-4">
              {carePlans.map((plan) => (
                <div key={plan.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{plan.patient}</h3>
                      <p className="text-sm text-slate-400">{plan.diagnosis}</p>
                    </div>
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
                  </div>
                  <div className="space-y-3">
                    {plan.plans.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPlan(p.name)}
                        className="w-full p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 text-left transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">{p.name}</span>
                          <span className="text-xs text-cyan-400">{p.phase}</span>
                        </div>
                        <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500" style={{ width: `${p.progress}%` }}></div>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{p.progress}% complete</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Plan Detail */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">{detailedPlan.name}</h3>
                  <p className="text-sm text-slate-400">{detailedPlan.patient} • Started {detailedPlan.startDate}</p>
                </div>
              </div>

              <div className="space-y-4">
                {planPhases.map((phase) => (
                  <div key={phase.id} className={`p-4 rounded-lg border ${
                    phase.status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                    phase.status === 'active' ? 'bg-cyan-500/10 border-cyan-500/30' :
                    'bg-slate-700/50 border-slate-600'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        phase.status === 'completed' ? 'bg-green-500 text-white' :
                        phase.status === 'active' ? 'bg-cyan-500 text-white' :
                        'bg-slate-600 text-slate-400'
                      }`}>
                        {phase.status === 'completed' ? '✓' : phase.id}
                      </div>
                      <span className={`font-medium ${
                        phase.status === 'completed' ? 'text-green-400' :
                        phase.status === 'active' ? 'text-cyan-400' :
                        'text-slate-400'
                      }`}>
                        {phase.name}
                      </span>
                      {phase.status === 'active' && (
                        <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">Current</span>
                      )}
                    </div>
                    <div className="ml-9 space-y-2">
                      {phase.tasks.map((task, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-700/30 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={() => handleToggleTask(phase.id, i)}
                            className="rounded border-slate-600 bg-slate-700 text-cyan-500 cursor-pointer"
                          />
                          <span className={task.done ? 'text-slate-400 line-through' : 'text-white'}>
                            {task.task}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="grid grid-cols-4 gap-4">
            {protocolTemplates.map((template) => (
              <div key={template.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer">
                <div className="text-xs text-cyan-400 mb-2">{template.category}</div>
                <h3 className="font-semibold text-white mb-2">{template.name}</h3>
                <p className="text-sm text-slate-400">{template.steps} steps</p>
                <button className="mt-3 w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white">
                  Use Template
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New Plan Modal */}
        {showNewPlan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Start New Care Plan</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Patient</label>
                  <select
                    value={newPlanData.patient}
                    onChange={(e) => setNewPlanData({ ...newPlanData, patient: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option>Baby Martinez</option>
                    <option>Baby Thompson</option>
                    <option>Baby Williams</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Protocol Template</label>
                  <select
                    value={newPlanData.template}
                    onChange={(e) => setNewPlanData({ ...newPlanData, template: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    {protocolTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowNewPlan(false)} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">Cancel</button>
                  <button onClick={handleStartPlan} className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">Start Plan</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
