'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/AppShell';
import { useToast } from '@/components/Toast';

/**
 * Care Plans & Protocols Page
 *
 * API Integrations:
 * - GET /api/patients?includeDischarged=false - Fetch active patients
 * - GET /api/care-plans?patientId={id}&status={status}&includeItems=true - List care plans
 * - GET /api/care-plans/{patientId}/{id} - Get specific care plan details
 * - GET /api/care-plans/templates - Get protocol templates
 * - POST /api/care-plans/templates - Create care plan from template
 * - PUT /api/care-plans/{patientId}/{id} - Update care plan status
 * - PUT /api/care-plans/{patientId}/{id}/task/{taskId} - Update task status
 */

// Status enums
const CARE_PLAN_STATUS = {
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  DISCONTINUED: 'discontinued',
};

const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
};

const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export default function CarePlansPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('active');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showNewPlan, setShowNewPlan] = useState(false);

  // Data state
  const [patients, setPatients] = useState([]);
  const [carePlans, setCarePlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingTask, setUpdatingTask] = useState(null);
  const [error, setError] = useState(null);

  // New plan form state
  const [newPlanData, setNewPlanData] = useState({
    patient: null,
    template: null,
    priority: PRIORITY.MEDIUM,
  });

  // Fetch patients
  const fetchPatients = useCallback(async () => {
    try {
      const response = await fetch('/api/patients?includeDischarged=false');
      if (!response.ok) throw new Error('Failed to fetch patients');
      const result = await response.json();
      setPatients(result.data || []);
      if (result.data?.length > 0 && !selectedPatient) {
        setSelectedPatient(result.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      toast.error('Failed to load patients');
    }
  }, [selectedPatient, toast]);

  // Fetch care plans
  const fetchCarePlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedPatient?.id) {
        params.append('patientId', selectedPatient.id);
      }
      if (activeTab !== 'templates') {
        params.append('status', activeTab);
      }
      params.append('includeItems', 'true');

      const response = await fetch(`/api/care-plans?${params}`);
      if (!response.ok) throw new Error('Failed to fetch care plans');

      const result = await response.json();

      // Add progress calculation for each care plan
      const plansWithProgress = (result.data || []).map(plan => {
        const stats = plan.itemStats || { total: 0, completed: 0, skipped: 0 };
        const completedCount = stats.completed + stats.skipped;
        const progress = stats.total > 0 ? Math.round((completedCount / stats.total) * 100) : 0;

        return {
          ...plan,
          progress,
        };
      });

      setCarePlans(plansWithProgress);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load care plans');
    } finally {
      setLoading(false);
    }
  }, [selectedPatient, activeTab, toast]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch('/api/care-plans/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const result = await response.json();
      setTemplates(result.data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      toast.error('Failed to load care plan templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, [toast]);

  // Fetch care plan details
  const fetchPlanDetails = useCallback(async (patientId, planId) => {
    try {
      const response = await fetch(`/api/care-plans/${patientId}/${planId}`);
      if (!response.ok) throw new Error('Failed to fetch care plan details');
      const result = await response.json();

      // The API already returns progress, but ensure it's set
      const plan = result.data;
      if (!plan.progress && plan.items) {
        const completedCount = plan.items.filter(
          i => i.status === 'completed' || i.status === 'skipped'
        ).length;
        plan.progress = plan.items.length > 0
          ? Math.round((completedCount / plan.items.length) * 100)
          : 0;
      }

      setSelectedPlan(plan);
    } catch (err) {
      toast.error('Failed to load care plan details');
    }
  }, [toast]);

  useEffect(() => {
    fetchPatients();
    fetchTemplates();
  }, [fetchPatients, fetchTemplates]);

  useEffect(() => {
    if (activeTab !== 'templates') {
      fetchCarePlans();
    }
  }, [activeTab, selectedPatient, fetchCarePlans]);

  // Handle task status update
  const handleToggleTask = async (phaseIndex, taskIndex, task) => {
    if (!selectedPlan) return;

    const newStatus = task.status === TASK_STATUS.COMPLETED
      ? TASK_STATUS.PENDING
      : TASK_STATUS.COMPLETED;

    setUpdatingTask(`${phaseIndex}-${taskIndex}`);
    try {
      const response = await fetch(
        `/api/care-plans/${selectedPlan.patientId}/${selectedPlan.id}/task/${task.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update task');
      }

      const result = await response.json();

      // Update local state with recalculated progress
      setSelectedPlan(prev => {
        const updatedItems = prev.items.map(item =>
          item.id === task.id ? result.data : item
        );

        // Recalculate progress
        const completedCount = updatedItems.filter(
          i => i.status === TASK_STATUS.COMPLETED || i.status === TASK_STATUS.SKIPPED
        ).length;
        const progress = updatedItems.length > 0
          ? Math.round((completedCount / updatedItems.length) * 100)
          : 0;

        return {
          ...prev,
          items: updatedItems,
          progress,
          status: result.meta?.carePlanCompleted ? CARE_PLAN_STATUS.COMPLETED : prev.status,
        };
      });

      if (result.meta?.carePlanCompleted) {
        toast.success('Care plan completed!');
        fetchCarePlans();
      } else {
        toast.success(`Task ${newStatus === TASK_STATUS.COMPLETED ? 'completed' : 'reopened'}`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingTask(null);
    }
  };

  // Handle creating care plan from template
  const handleStartPlan = async () => {
    if (!newPlanData.patient || !newPlanData.template) {
      toast.error('Please select a patient and template');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/care-plans/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: newPlanData.patient.id,
          templateId: newPlanData.template.id,
          priority: newPlanData.priority,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create care plan');
      }

      const result = await response.json();

      // Calculate initial progress for the new plan
      const plan = result.data;
      if (plan.items) {
        const completedCount = plan.items.filter(
          i => i.status === 'completed' || i.status === 'skipped'
        ).length;
        plan.progress = plan.items.length > 0
          ? Math.round((completedCount / plan.items.length) * 100)
          : 0;
      }

      toast.success(`Started ${newPlanData.template.name} care plan for ${newPlanData.patient.name}`);
      setShowNewPlan(false);
      setNewPlanData({ patient: null, template: null, priority: PRIORITY.MEDIUM });
      setSelectedPatient(newPlanData.patient);
      setActiveTab('active');
      await fetchCarePlans();
      setSelectedPlan(plan);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle updating care plan status
  const handleUpdatePlanStatus = async (planId, patientId, newStatus) => {
    try {
      const response = await fetch(`/api/care-plans/${patientId}/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update care plan');
      }

      toast.success(`Care plan ${newStatus}`);
      fetchCarePlans();
      if (selectedPlan?.id === planId) {
        setSelectedPlan(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Group items by phase (based on description prefix)
  const groupItemsByPhase = (items) => {
    const phases = {};
    items?.forEach(item => {
      const match = item.description.match(/^\[([^\]]+)\]\s*(.+)/);
      const phaseName = match ? match[1] : 'Tasks';
      const taskDescription = match ? match[2] : item.description;

      if (!phases[phaseName]) {
        phases[phaseName] = [];
      }
      phases[phaseName].push({ ...item, displayDescription: taskDescription });
    });
    return Object.entries(phases).map(([name, tasks]) => ({ name, tasks }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case CARE_PLAN_STATUS.ACTIVE: return 'bg-green-500/20 text-green-400';
      case CARE_PLAN_STATUS.ON_HOLD: return 'bg-yellow-500/20 text-yellow-400';
      case CARE_PLAN_STATUS.COMPLETED: return 'bg-blue-500/20 text-blue-400';
      case CARE_PLAN_STATUS.DISCONTINUED: return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case PRIORITY.HIGH: return 'text-red-400';
      case PRIORITY.MEDIUM: return 'text-yellow-400';
      case PRIORITY.LOW: return 'text-green-400';
      default: return 'text-slate-400';
    }
  };

  const getPhaseStatus = (tasks) => {
    const completed = tasks.filter(t => t.status === TASK_STATUS.COMPLETED || t.status === TASK_STATUS.SKIPPED).length;
    const total = tasks.length;
    if (completed === 0) return 'pending';
    if (completed === total) return 'completed';
    return 'active';
  };

  // Group care plans by patient for display
  const plansByPatient = carePlans.reduce((acc, plan) => {
    const patientId = plan.patient?.id || plan.patientId || 'unknown';
    const patientName = plan.patient?.name || 'Unknown Patient';
    const patientKey = `${patientId}-${patientName}`;

    if (!acc[patientKey]) {
      acc[patientKey] = {
        patient: plan.patient || { id: plan.patientId, name: patientName },
        diagnosis: plan.patient?.gestationalAge ? `GA: ${plan.patient.gestationalAge}` : '',
        plans: [],
      };
    }
    acc[patientKey].plans.push(plan);
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Care Plans & Protocols</h1>
            <p className="text-slate-400 text-sm">Standardized clinical pathways</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPatient?.id || ''}
              onChange={(e) => {
                const patient = patients.find(p => p.id === parseInt(e.target.value));
                setSelectedPatient(patient || null);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white min-w-[200px]"
            >
              <option value="">All Patients</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewPlan(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Care Plan
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 pb-2">
          {['active', 'completed', 'templates'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSelectedPlan(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                activeTab === tab ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
            {error}
            <button onClick={fetchCarePlans} className="ml-4 underline">Retry</button>
          </div>
        )}

        {/* Loading State */}
        {loading && activeTab !== 'templates' && (
          <div className="bg-slate-800 rounded-xl p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Loading care plans...</p>
          </div>
        )}

        {/* Active/Completed Tab Content */}
        {!loading && activeTab !== 'templates' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Care Plans List */}
            <div className="space-y-4">
              {Object.keys(plansByPatient).length === 0 ? (
                <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-500">
                  No care plans found
                </div>
              ) : (
                Object.values(plansByPatient).map((group) => (
                  <div key={group.patient?.id || 'unknown'} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{group.patient?.name}</h3>
                        <p className="text-sm text-slate-400">{group.diagnosis}</p>
                      </div>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                        {group.plans.length} Active
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.plans.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => {
                            setSelectedPlan(plan);
                            if (!plan.items || plan.items.length === 0) {
                              fetchPlanDetails(plan.patientId, plan.id);
                            }
                          }}
                          className={`w-full p-3 rounded-lg text-left transition-colors ${
                            selectedPlan?.id === plan.id
                              ? 'bg-cyan-500/20 border border-cyan-500/50'
                              : 'bg-slate-700/50 hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white">{plan.title}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${getPriorityColor(plan.priority)}`}>
                                {plan.priority}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(plan.status)}`}>
                                {plan.status}
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 transition-all duration-300"
                              style={{ width: `${plan.progress || 0}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {plan.progress || 0}% complete
                            {plan.itemStats && ` - ${plan.itemStats.completed}/${plan.itemStats.total} tasks`}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Plan Detail */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              {selectedPlan ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{selectedPlan.title}</h3>
                      <p className="text-sm text-slate-400">
                        {selectedPlan.patient?.name} - Started {new Date(selectedPlan.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPlan.status === CARE_PLAN_STATUS.ACTIVE && (
                        <>
                          <button
                            onClick={() => handleUpdatePlanStatus(selectedPlan.id, selectedPlan.patientId, CARE_PLAN_STATUS.ON_HOLD)}
                            className="px-3 py-1 text-sm bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors"
                          >
                            Hold
                          </button>
                          <button
                            onClick={() => handleUpdatePlanStatus(selectedPlan.id, selectedPlan.patientId, CARE_PLAN_STATUS.COMPLETED)}
                            className="px-3 py-1 text-sm bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                          >
                            Complete
                          </button>
                        </>
                      )}
                      {selectedPlan.status === CARE_PLAN_STATUS.ON_HOLD && (
                        <button
                          onClick={() => handleUpdatePlanStatus(selectedPlan.id, selectedPlan.patientId, CARE_PLAN_STATUS.ACTIVE)}
                          className="px-3 py-1 text-sm bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                        >
                          Resume
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {groupItemsByPhase(selectedPlan.items).map((phase, phaseIndex) => {
                      const phaseStatus = getPhaseStatus(phase.tasks);
                      const completedCount = phase.tasks.filter(
                        t => t.status === TASK_STATUS.COMPLETED || t.status === TASK_STATUS.SKIPPED
                      ).length;

                      return (
                        <div
                          key={phase.name}
                          className={`p-4 rounded-lg border ${
                            phaseStatus === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                            phaseStatus === 'active' ? 'bg-cyan-500/10 border-cyan-500/30' :
                            'bg-slate-700/50 border-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                              phaseStatus === 'completed' ? 'bg-green-500 text-white' :
                              phaseStatus === 'active' ? 'bg-cyan-500 text-white' :
                              'bg-slate-600 text-slate-400'
                            }`}>
                              {phaseStatus === 'completed' ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                phaseIndex + 1
                              )}
                            </div>
                            <span className={`font-medium ${
                              phaseStatus === 'completed' ? 'text-green-400' :
                              phaseStatus === 'active' ? 'text-cyan-400' :
                              'text-slate-400'
                            }`}>
                              {phase.name}
                            </span>
                            <span className="text-xs text-slate-500 ml-auto">
                              {completedCount}/{phase.tasks.length}
                            </span>
                            {phaseStatus === 'active' && (
                              <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">Current</span>
                            )}
                          </div>
                          <div className="ml-9 space-y-2">
                            {phase.tasks.map((task, taskIndex) => {
                              const isUpdating = updatingTask === `${phaseIndex}-${taskIndex}`;
                              const isCompleted = task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.SKIPPED;

                              return (
                                <label
                                  key={task.id}
                                  className={`flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-700/30 p-1 rounded ${
                                    isUpdating ? 'opacity-50' : ''
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isCompleted}
                                    onChange={() => handleToggleTask(phaseIndex, taskIndex, task)}
                                    disabled={isUpdating || selectedPlan.status !== CARE_PLAN_STATUS.ACTIVE}
                                    className="rounded border-slate-600 bg-slate-700 text-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <span className={isCompleted ? 'text-slate-400 line-through' : 'text-white'}>
                                    {task.displayDescription || task.description}
                                  </span>
                                  {isUpdating && (
                                    <div className="animate-spin w-3 h-3 border border-cyan-500 border-t-transparent rounded-full ml-auto"></div>
                                  )}
                                  {task.itemType && task.itemType !== 'task' && (
                                    <span className="ml-auto text-xs text-slate-500 capitalize">
                                      {task.itemType}
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-500 py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Select a care plan to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <>
            {loadingTemplates ? (
              <div className="bg-slate-800 rounded-xl p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Loading templates...</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-cyan-500/50 transition-colors"
                  >
                    <div className="text-xs text-cyan-400 mb-2 capitalize">{template.category}</div>
                    <h3 className="font-semibold text-white mb-2">{template.name}</h3>
                    <p className="text-sm text-slate-400 mb-1">{template.description}</p>
                    <p className="text-sm text-slate-500">{template.totalTasks || template.steps} tasks</p>
                    <button
                      onClick={() => {
                        setNewPlanData(prev => ({ ...prev, template }));
                        setShowNewPlan(true);
                      }}
                      className="mt-3 w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
                    >
                      Use Template
                    </button>
                  </div>
                ))}
                {templates.length === 0 && !loadingTemplates && (
                  <div className="col-span-4 bg-slate-800 rounded-xl p-8 text-center text-slate-500">
                    No templates available
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* New Plan Modal */}
        {showNewPlan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Start New Care Plan</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Patient *</label>
                  <select
                    value={newPlanData.patient?.id || ''}
                    onChange={(e) => {
                      const patient = patients.find(p => p.id === parseInt(e.target.value));
                      setNewPlanData({ ...newPlanData, patient });
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Select a patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} (MRN: {patient.mrn})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Protocol Template *</label>
                  <select
                    value={newPlanData.template?.id || ''}
                    onChange={(e) => {
                      const template = templates.find(t => t.id === e.target.value);
                      setNewPlanData({ ...newPlanData, template });
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Select a template</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.totalTasks || t.steps} tasks)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Priority</label>
                  <div className="flex gap-3">
                    {Object.values(PRIORITY).map((priority) => (
                      <label key={priority} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="priority"
                          checked={newPlanData.priority === priority}
                          onChange={() => setNewPlanData({ ...newPlanData, priority })}
                          className="text-cyan-500"
                        />
                        <span className={`capitalize ${getPriorityColor(priority)}`}>
                          {priority}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowNewPlan(false);
                      setNewPlanData({ patient: null, template: null, priority: PRIORITY.MEDIUM });
                    }}
                    className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartPlan}
                    disabled={!newPlanData.patient || !newPlanData.template || submitting}
                    className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      newPlanData.patient && newPlanData.template && !submitting
                        ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                        : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {submitting && (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    )}
                    Start Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
