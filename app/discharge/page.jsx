'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/AppShell';
import { useToast } from '@/components/Toast';

export default function DischargePage() {
  const toast = useToast();

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [dischargePlan, setDischargePlan] = useState(null);
  const [readinessData, setReadinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState(null);
  const [updatingItem, setUpdatingItem] = useState(null);

  // Fetch patients
  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/patients?includeDischarged=false');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch patients');
      }

      const data = await response.json();

      const patientList = (data.data || []).map(patient => ({
        id: patient.id,
        name: patient.name,
        mrn: patient.mrn,
        bed: patient.bed,
        ga: patient.ga,
        dol: patient.dol,
        status: patient.status,
        readiness: 0, // Will be calculated
        eta: 'Unknown',
      }));

      setPatients(patientList);
      if (patientList.length > 0 && !selectedPatient) {
        setSelectedPatient(patientList[0]);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(err.message);
      toast.error('Failed to load patients: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedPatient, toast]);

  // Fetch discharge plan for selected patient
  const fetchDischargePlan = useCallback(async (patientId) => {
    if (!patientId) return;
    try {
      setLoadingPlan(true);
      const response = await fetch(`/api/discharge/${patientId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch discharge plan');
      }

      const data = await response.json();
      setDischargePlan(data.data);
    } catch (err) {
      console.error('Failed to fetch discharge plan:', err);
      toast.error('Failed to load discharge plan: ' + err.message);
      setDischargePlan(null);
    } finally {
      setLoadingPlan(false);
    }
  }, [toast]);

  // Fetch readiness data
  const fetchReadiness = useCallback(async (patientId) => {
    if (!patientId) return;
    try {
      const response = await fetch(`/api/discharge/${patientId}/readiness`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch readiness');
      }

      const data = await response.json();
      setReadinessData(data.data);

      // Update patient readiness in list
      setPatients(prev => prev.map(p =>
        p.id === patientId
          ? {
            ...p,
            readiness: data.data.readinessScore,
            eta: data.data.estimatedDaysToReady === 0
              ? 'Ready'
              : data.data.estimatedDaysToReady
                ? `${data.data.estimatedDaysToReady} days`
                : 'Unknown'
          }
          : p
      ));
    } catch (err) {
      console.error('Failed to fetch readiness:', err);
      // Don't show toast for readiness errors to avoid noise
    }
  }, []);

  // Update checklist item
  const handleToggleItem = async (category, itemId, currentStatus) => {
    if (!selectedPatient) return;

    // Determine new status
    let newStatus;
    if (currentStatus === 'not_applicable') return; // Can't change N/A items
    if (currentStatus === 'completed') newStatus = 'pending';
    else if (currentStatus === 'pending') newStatus = 'in_progress';
    else if (currentStatus === 'in_progress') newStatus = 'completed';
    else newStatus = 'pending';

    setUpdatingItem(itemId);
    try {
      const response = await fetch(`/api/discharge/${selectedPatient.id}/item/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update item');
      }

      const data = await response.json();

      // Show success notification
      const statusLabel = newStatus === 'completed' ? 'completed' :
                         newStatus === 'in_progress' ? 'in progress' : 'pending';
      toast.success(`Checklist item marked as ${statusLabel}`);

      // Refresh discharge plan and readiness
      await Promise.all([
        fetchDischargePlan(selectedPatient.id),
        fetchReadiness(selectedPatient.id)
      ]);

      // Update readiness score notification if completed
      if (newStatus === 'completed' && data.meta?.readinessScore === 100) {
        toast.success('Patient is ready for discharge!');
      }
    } catch (err) {
      console.error('Failed to update item:', err);
      toast.error('Failed to update checklist item: ' + err.message);
    } finally {
      setUpdatingItem(null);
    }
  };

  // Handle complete discharge
  const handleCompleteDischarge = async () => {
    if (!selectedPatient || !dischargePlan) return;

    if (readinessData?.readinessScore < 100) {
      toast.error('Patient must complete all required items before discharge');
      return;
    }

    try {
      const response = await fetch(`/api/discharge/${selectedPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'discharged',
          actualDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to complete discharge');
      }

      toast.success(`${selectedPatient.name} has been discharged successfully!`);

      // Refresh patient list and clear selection
      await fetchPatients();
      setSelectedPatient(null);
      setDischargePlan(null);
      setReadinessData(null);
    } catch (err) {
      console.error('Failed to complete discharge:', err);
      toast.error('Failed to complete discharge: ' + err.message);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Load discharge plan when patient changes
  useEffect(() => {
    if (selectedPatient?.id) {
      fetchDischargePlan(selectedPatient.id);
      fetchReadiness(selectedPatient.id);
    }
  }, [selectedPatient, fetchDischargePlan, fetchReadiness]);

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <span className="text-green-400">&#10003;</span>;
      case 'in_progress': return <span className="text-yellow-400">&#9679;</span>;
      case 'pending': return <span className="text-slate-500">&#9675;</span>;
      case 'not_applicable': return <span className="text-slate-500">&mdash;</span>;
      default: return null;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 border-green-500/50';
      case 'in_progress': return 'bg-yellow-500/20 border-yellow-500/50';
      case 'pending': return 'bg-slate-700/50 border-slate-600';
      case 'not_applicable': return 'bg-slate-700/30 border-slate-700';
      default: return '';
    }
  };

  // Calculate category progress from dischargePlan
  const getCategoryProgress = (categoryKey) => {
    if (!dischargePlan?.groupedItems?.[categoryKey]) return 0;
    const items = dischargePlan.groupedItems[categoryKey];
    const applicable = items.filter(i => i.status !== 'not_applicable');
    const complete = applicable.filter(i => i.status === 'completed');
    return applicable.length > 0 ? Math.round((complete.length / applicable.length) * 100) : 0;
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading discharge planning...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (patients.length === 0) {
    return (
      <AppShell>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white mb-6">Discharge Planning</h1>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
            <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">No Active Patients</h3>
            <p className="text-slate-400">There are currently no patients eligible for discharge planning.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Discharge Planning</h1>
            <p className="text-slate-400 text-sm">Track discharge readiness and requirements</p>
          </div>
          <button
            onClick={handleCompleteDischarge}
            disabled={!readinessData || readinessData.readinessScore < 100}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Complete Discharge
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

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
                      selectedPatient?.id === patient.id
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
                    <div className="text-xs text-slate-400">
                      Bed {patient.bed} | DOL {patient.dol || 0}
                    </div>
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
            {loadingPlan ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400">Loading discharge plan...</p>
                </div>
              </div>
            ) : !dischargePlan ? (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-white mb-2">No Discharge Plan</h3>
                <p className="text-slate-400">Unable to load discharge plan for this patient.</p>
              </div>
            ) : (
              <>
                {/* Overview Cards */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { title: 'Medical', key: 'medical', color: 'cyan' },
                    { title: 'Education', key: 'education', color: 'purple' },
                    { title: 'Safety', key: 'safety', color: 'green' },
                    { title: 'Follow-up', key: 'followup', color: 'yellow' },
                  ].map((category) => (
                    <div key={category.title} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-2">{category.title}</div>
                      <div className={`text-2xl font-bold text-${category.color}-400`}>
                        {getCategoryProgress(category.key)}%
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full bg-${category.color}-500`}
                          style={{ width: `${getCategoryProgress(category.key)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overall Readiness */}
                {readinessData && (
                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Overall Readiness</h3>
                        <p className="text-sm text-slate-400">
                          {readinessData.summary?.completedRequired || 0} of {readinessData.summary?.requiredItems || 0} required items completed
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-4xl font-bold ${
                          readinessData.readinessScore >= 80 ? 'text-green-400' :
                            readinessData.readinessScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {readinessData.readinessScore}%
                        </div>
                        <div className="text-sm text-slate-400">{readinessData.overallStatus}</div>
                      </div>
                    </div>
                    {readinessData.blockers?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <h4 className="text-sm font-medium text-red-400 mb-2">
                          Blockers ({readinessData.blockers.length})
                        </h4>
                        <div className="space-y-1">
                          {readinessData.blockers.slice(0, 3).map((blocker) => (
                            <div key={blocker.id} className="text-sm text-slate-300">
                              - {blocker.description}
                            </div>
                          ))}
                          {readinessData.blockers.length > 3 && (
                            <div className="text-sm text-slate-500">
                              +{readinessData.blockers.length - 3} more...
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detailed Checklist */}
                <div className="grid grid-cols-2 gap-4">
                  {dischargePlan?.groupedItems && Object.entries(dischargePlan.groupedItems).map(([category, items]) => (
                    <div key={category} className="bg-slate-800 rounded-xl border border-slate-700">
                      <div className="p-4 border-b border-slate-700">
                        <h3 className="font-semibold text-white capitalize">{category} Criteria</h3>
                      </div>
                      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                        {items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleToggleItem(category, item.id, item.status)}
                            disabled={item.status === 'not_applicable' || updatingItem === item.id}
                            className={`w-full p-3 rounded-lg border text-left transition-colors ${getStatusColor(item.status)} ${
                              item.status !== 'not_applicable' ? 'hover:opacity-80 cursor-pointer' : 'cursor-not-allowed'
                            } ${updatingItem === item.id ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">{getStatusIcon(item.status)}</div>
                              <div className="flex-1">
                                <div className={`text-sm ${item.status === 'completed' ? 'text-slate-300' : 'text-white'}`}>
                                  {item.description}
                                </div>
                                {item.required && (
                                  <div className="text-xs text-cyan-400 mt-1">Required</div>
                                )}
                                {item.notes && (
                                  <div className="text-xs text-yellow-400 mt-1">{item.notes}</div>
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
                      {[
                        { provider: 'Primary Care', timing: '2-3 days post-discharge', scheduled: false },
                        { provider: 'Neonatology', timing: '2 weeks post-discharge', scheduled: false },
                        { provider: 'Ophthalmology (ROP)', timing: '2 weeks post-discharge', scheduled: true, date: '2025-01-15' },
                        { provider: 'Early Intervention', timing: 'Within 1 month', scheduled: false },
                      ].map((appt, i) => (
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
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
