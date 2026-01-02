'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import AppShell from '../../components/AppShell';
import { calculateNECRisk } from '@/lib/data';

// Loading skeleton component
function LoadingSkeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-slate-700 rounded ${className}`}></div>
  );
}

// Error display component
function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-center">
      <p className="text-red-400 mb-2">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default function FeedingPage() {
  // State management
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [feedingData, setFeedingData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showNECDetails, setShowNECDetails] = useState(false);
  const [showTPNEdit, setShowTPNEdit] = useState(false);
  const [showPumpSession, setShowPumpSession] = useState(false);

  // Loading and error states
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingFeedingData, setLoadingFeedingData] = useState(false);
  const [error, setError] = useState(null);
  const [savingFeed, setSavingFeed] = useState(false);
  const [savingTPN, setSavingTPN] = useState(false);

  // Form states
  const [newFeed, setNewFeed] = useState({
    time: '',
    amount: '',
    method: 'Gavage',
    milk: 'EBM+HMF',
    tolerated: true,
    note: ''
  });

  const [tpnSettings, setTPNSettings] = useState({
    rate: 0,
    dextrose: 12.5,
    aminoAcids: 3.5,
    lipids: 2.0,
    sodium: 3,
    potassium: 2,
    calcium: 2,
    phosphorus: 1.5,
  });

  const [pumpSession, setPumpSession] = useState({
    volume: '',
    duration: '',
    storageLocation: 'refrigerator',
    notes: ''
  });

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Fetch feeding data when patient changes
  useEffect(() => {
    if (selectedPatient?.id) {
      fetchFeedingData(selectedPatient.id);
    }
  }, [selectedPatient?.id]);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    setError(null);
    try {
      const response = await fetch('/api/patients?includeDischarged=false');
      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }
      const result = await response.json();
      const patientList = result.data || [];

      // Transform patient data to match expected format
      const transformedPatients = patientList.map(p => ({
        id: p.id,
        name: p.name,
        weight: p.weight ? p.weight * 1000 : 0, // Convert kg to g
        birthWeight: p.birthWeight || 0,
        ga: p.ga || '--',
        gaWeeks: parseGAWeeks(p.ga),
        diagnosis: [], // Would come from patient details
        mrn: p.mrn,
        dol: p.dol,
        status: p.status,
      }));

      setPatients(transformedPatients);

      if (transformedPatients.length > 0) {
        setSelectedPatient(transformedPatients[0]);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Failed to load patients. Please try again.');
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchFeedingData = async (patientId) => {
    setLoadingFeedingData(true);
    setError(null);
    try {
      // Fetch feeding data, TPN, and breast milk in parallel
      const [feedingResponse, tpnResponse, breastMilkResponse] = await Promise.all([
        fetch(`/api/feeding/${patientId}`),
        fetch(`/api/feeding/tpn/${patientId}`),
        fetch(`/api/feeding/breastmilk/${patientId}`),
      ]);

      if (!feedingResponse.ok) {
        throw new Error('Failed to fetch feeding data');
      }

      const feedingResult = await feedingResponse.json();
      const tpnResult = tpnResponse.ok ? await tpnResponse.json() : null;
      const breastMilkResult = breastMilkResponse.ok ? await breastMilkResponse.json() : null;

      // Combine all data
      const combinedData = {
        summary: feedingResult.data?.summary || getDefaultSummary(),
        feedLog: feedingResult.data?.feedLog || [],
        tpn: tpnResult?.data || getDefaultTPN(),
        breastMilk: breastMilkResult?.data?.inventory || getDefaultBreastMilk(),
        necRiskData: feedingResult.data?.necRiskData || {},
      };

      setFeedingData(combinedData);

      // Update TPN settings for edit form
      if (tpnResult?.data) {
        setTPNSettings({
          rate: tpnResult.data.rate || 0,
          dextrose: tpnResult.data.dextrose || 12.5,
          aminoAcids: tpnResult.data.aminoAcids || 3.5,
          lipids: tpnResult.data.lipids || 2.0,
          sodium: tpnResult.data.sodium || 3,
          potassium: tpnResult.data.potassium || 2,
          calcium: tpnResult.data.calcium || 2,
          phosphorus: tpnResult.data.phosphorus || 1.5,
        });
      }
    } catch (err) {
      console.error('Error fetching feeding data:', err);
      setError('Failed to load feeding data. Please try again.');
    } finally {
      setLoadingFeedingData(false);
    }
  };

  // Calculate NEC risk for selected patient
  const necRisk = useMemo(() => {
    if (!selectedPatient || !feedingData) {
      return {
        score: 0,
        maxScore: 18,
        riskLevel: 'LOW',
        riskFactors: [],
        recommendation: 'Loading...',
        suggestedAdvancement: 20,
      };
    }

    const feedingInfo = {
      milkType: feedingData.necRiskData?.milkType || 'EBM',
      advancementRate: feedingData.necRiskData?.advancementRate || 20,
      feedingIntolerance: feedingData.necRiskData?.hasFeedingIntolerance || false,
      recentTransfusion: feedingData.necRiskData?.hasRecentTransfusion || false,
    };

    return calculateNECRisk(selectedPatient, feedingInfo);
  }, [selectedPatient, feedingData]);

  const handleSaveFeed = async () => {
    if (!newFeed.time || !newFeed.amount || !selectedPatient) {
      return;
    }

    setSavingFeed(true);
    try {
      const response = await fetch('/api/feeding/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          time: newFeed.time,
          volumeGiven: parseInt(newFeed.amount),
          method: newFeed.method,
          milk: newFeed.milk,
          tolerated: newFeed.tolerated,
          notes: newFeed.note || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save feed');
      }

      const result = await response.json();

      // Optimistic update - add the new feed to the log
      setFeedingData(prev => ({
        ...prev,
        feedLog: [result.data, ...(prev?.feedLog || [])],
      }));

      // Reset form and close modal
      setNewFeed({ time: '', amount: '', method: 'Gavage', milk: 'EBM+HMF', tolerated: true, note: '' });
      setShowAddFeed(false);

      // Refresh data to get updated summary
      fetchFeedingData(selectedPatient.id);
    } catch (err) {
      console.error('Error saving feed:', err);
      alert('Failed to save feed: ' + err.message);
    } finally {
      setSavingFeed(false);
    }
  };

  const handleSaveTPN = async () => {
    if (!selectedPatient) return;

    setSavingTPN(true);
    try {
      const response = await fetch(`/api/feeding/tpn/${selectedPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tpnSettings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save TPN settings');
      }

      const result = await response.json();

      // Update local state
      setFeedingData(prev => ({
        ...prev,
        tpn: { ...prev?.tpn, ...tpnSettings },
      }));

      setShowTPNEdit(false);

      // Show warnings if any
      if (result.meta?.warnings?.length > 0) {
        const warningMessages = result.meta.warnings.map(w => `${w.parameter}: ${w.message}`).join('\n');
        alert('TPN saved with warnings:\n' + warningMessages);
      }
    } catch (err) {
      console.error('Error saving TPN:', err);
      alert('Failed to save TPN settings: ' + err.message);
    } finally {
      setSavingTPN(false);
    }
  };

  const handleSavePumpSession = async () => {
    if (!pumpSession.volume || !selectedPatient) return;

    try {
      const response = await fetch('/api/feeding/breastmilk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          volume: parseInt(pumpSession.volume),
          duration: pumpSession.duration ? parseInt(pumpSession.duration) : undefined,
          storageLocation: pumpSession.storageLocation,
          notes: pumpSession.notes || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to log pump session');
      }

      setPumpSession({ volume: '', duration: '', storageLocation: 'refrigerator', notes: '' });
      setShowPumpSession(false);

      // Refresh breast milk data
      fetchFeedingData(selectedPatient.id);
    } catch (err) {
      console.error('Error logging pump session:', err);
      alert('Failed to log pump session: ' + err.message);
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

  // Get data with defaults
  const summary = feedingData?.summary || getDefaultSummary();
  const feedLog = feedingData?.feedLog || [];
  const tpn = feedingData?.tpn || getDefaultTPN();
  const breastMilk = feedingData?.breastMilk || getDefaultBreastMilk();

  // Loading state
  if (loadingPatients) {
    return (
      <AppShell>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Feeding & Nutrition</h1>
              <p className="text-slate-400 text-sm">Loading patients...</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <LoadingSkeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  // Error state with no patients
  if (error && patients.length === 0) {
    return (
      <AppShell>
        <div className="p-6">
          <ErrorMessage message={error} onRetry={fetchPatients} />
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
            <h1 className="text-2xl font-bold text-white">Feeding & Nutrition</h1>
            <p className="text-slate-400 text-sm">Track enteral/parenteral nutrition and caloric intake</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPatient?.id || ''}
              onChange={(e) => {
                const patient = patients.find(p => p.id === parseInt(e.target.value));
                setSelectedPatient(patient);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
              disabled={patients.length === 0}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowAddFeed(true)}
              disabled={!selectedPatient}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 disabled:opacity-50"
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
          {loadingFeedingData ? (
            <LoadingSkeleton className="h-12 w-full" />
          ) : selectedPatient ? (
            <>
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
                  summary.caloriesPerKg >= 120 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {summary.caloriesPerKg >= 120 ? 'Goal Met' : 'Below Goal'}
                </span>
              </div>
            </>
          ) : (
            <p className="text-slate-400">No patient selected</p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

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

        {loadingFeedingData ? (
          <div className="space-y-4">
            <LoadingSkeleton className="h-32" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <LoadingSkeleton key={i} className="h-24" />
              ))}
            </div>
          </div>
        ) : (
          <>
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
                          Score: {necRisk.score}/{necRisk.maxScore} - Suggested advancement: {necRisk.suggestedAdvancement} mL/kg/day
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
                      <span className="text-xs text-slate-500">{summary.fluidTarget} target</span>
                    </div>
                    <div className="text-2xl font-bold text-white mb-2">
                      {summary.totalIntake} <span className="text-sm font-normal text-slate-400">mL/kg/day</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(summary.totalIntake, summary.fluidTarget)}`}
                        style={{ width: `${Math.min((summary.totalIntake / summary.fluidTarget) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Calories</span>
                      <span className="text-xs text-slate-500">{summary.calorieTarget} target</span>
                    </div>
                    <div className="text-2xl font-bold text-cyan-400 mb-2">
                      {summary.caloriesPerKg} <span className="text-sm font-normal text-slate-400">kcal/kg/day</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(summary.caloriesPerKg, summary.calorieTarget)}`}
                        style={{ width: `${Math.min((summary.caloriesPerKg / summary.calorieTarget) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="text-sm text-slate-400 mb-2">Protein Intake</div>
                    <div className="text-2xl font-bold text-green-400 mb-2">
                      {summary.proteinGPerKg} <span className="text-sm font-normal text-slate-400">g/kg/day</span>
                    </div>
                    <div className="text-xs text-slate-500">Target: 3.5-4.0 g/kg/day</div>
                  </div>

                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="text-sm text-slate-400 mb-2">GIR</div>
                    <div className="text-2xl font-bold text-purple-400 mb-2">
                      {summary.gir} <span className="text-sm font-normal text-slate-400">mg/kg/min</span>
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
                        <span className="text-white font-medium">{summary.enteralIntake} mL/kg/day</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="text-slate-300">Parenteral</span>
                        </div>
                        <span className="text-white font-medium">{summary.parenteralIntake} mL/kg/day</span>
                      </div>
                    </div>
                    {summary.totalIntake > 0 && (
                      <>
                        <div className="mt-4 h-4 bg-slate-700 rounded-full overflow-hidden flex">
                          <div
                            className="bg-green-500"
                            style={{ width: `${(summary.enteralIntake / summary.totalIntake) * 100}%` }}
                          ></div>
                          <div
                            className="bg-blue-500"
                            style={{ width: `${(summary.parenteralIntake / summary.totalIntake) * 100}%` }}
                          ></div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400 text-center">
                          {Math.round((summary.enteralIntake / summary.totalIntake) * 100)}% Enteral
                        </div>
                      </>
                    )}
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
                        <span className="text-green-400 font-medium">
                          {feedLog.filter(f => f.emesis).length > 0 ? feedLog.filter(f => f.emesis).length + ' episodes' : 'None'}
                        </span>
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
                        {feedLog.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              No feeds recorded today
                            </td>
                          </tr>
                        ) : (
                          feedLog.map((feed, i) => (
                            <tr key={feed.id || i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
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
                          ))
                        )}
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
                      <div className="text-xl font-bold text-white">
                        {feedLog.length > 0 ? feedLog[0].amount : '--'} mL
                      </div>
                      <div className="text-xs text-slate-500">q3h</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="text-sm text-slate-400">Milk Type</div>
                      <div className="text-xl font-bold text-white">
                        {feedLog.length > 0 ? feedLog[0].milk : 'EBM+HMF'}
                      </div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="text-sm text-slate-400">Calories</div>
                      <div className="text-xl font-bold text-green-400">24 kcal/oz</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="text-sm text-slate-400">Method</div>
                      <div className="text-xl font-bold text-white">
                        {feedLog.length > 0 ? feedLog[0].method : 'Gavage'}
                      </div>
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
                        {feedLog.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              No feeds recorded
                            </td>
                          </tr>
                        ) : (
                          feedLog.map((feed, i) => (
                            <tr key={feed.id || i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
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
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'parenteral' && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Current TPN Order</h3>
                  <button
                    onClick={() => setShowTPNEdit(true)}
                    className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 text-sm"
                  >
                    Edit TPN
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Rate</div>
                    <div className="text-xl font-bold text-white">{tpn.rate} mL/hr</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Dextrose</div>
                    <div className="text-xl font-bold text-white">{tpn.dextrose}%</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Amino Acids</div>
                    <div className="text-xl font-bold text-white">{tpn.aminoAcids} g/kg</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Lipids</div>
                    <div className="text-xl font-bold text-white">{tpn.lipids} g/kg</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Sodium</div>
                    <div className="text-lg font-bold text-white">{tpn.sodium} mEq/kg</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Potassium</div>
                    <div className="text-lg font-bold text-white">{tpn.potassium} mEq/kg</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Calcium</div>
                    <div className="text-lg font-bold text-white">{tpn.calcium} mEq/kg</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Phosphorus</div>
                    <div className="text-lg font-bold text-white">{tpn.phosphorus} mmol/kg</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'breastmilk' && (
              <div className="space-y-4">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white">Breast Milk Tracking</h3>
                    <button
                      onClick={() => setShowPumpSession(true)}
                      className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 text-sm"
                    >
                      Log Pump Session
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="text-sm text-slate-400">Mother's Supply</div>
                      <div className="text-xl font-bold text-green-400">{breastMilk.motherSupply || 0}%</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="text-sm text-slate-400">Stored Volume</div>
                      <div className="text-xl font-bold text-white">{breastMilk.currentVolume || breastMilk.stored || 0} mL</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="text-sm text-slate-400">Days Supply</div>
                      <div className="text-xl font-bold text-white">{breastMilk.daysSupply || 0} days</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="text-sm text-slate-400">Avg Daily Usage</div>
                      <div className="text-xl font-bold text-white">{breastMilk.avgDailyUsage || 0} mL</div>
                    </div>
                  </div>
                  {breastMilk.lowInventoryAlert && (
                    <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm">
                      Low inventory alert: Less than 2 days supply remaining
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
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
                      min="0"
                      max="500"
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
                  <button
                    onClick={() => setShowAddFeed(false)}
                    disabled={savingFeed}
                    className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveFeed}
                    disabled={savingFeed || !newFeed.time || !newFeed.amount}
                    className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                  >
                    {savingFeed ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TPN Edit Modal */}
        {showTPNEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-white mb-4">Edit TPN Settings</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Rate (mL/hr)</label>
                    <input
                      type="number"
                      value={tpnSettings.rate}
                      onChange={(e) => setTPNSettings({ ...tpnSettings, rate: parseFloat(e.target.value) || 0 })}
                      step="0.1"
                      min="0"
                      max="50"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Dextrose (%)</label>
                    <input
                      type="number"
                      value={tpnSettings.dextrose}
                      onChange={(e) => setTPNSettings({ ...tpnSettings, dextrose: parseFloat(e.target.value) || 0 })}
                      step="0.5"
                      min="5"
                      max="25"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Amino Acids (g/kg)</label>
                    <input
                      type="number"
                      value={tpnSettings.aminoAcids}
                      onChange={(e) => setTPNSettings({ ...tpnSettings, aminoAcids: parseFloat(e.target.value) || 0 })}
                      step="0.1"
                      min="0"
                      max="5"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Lipids (g/kg)</label>
                    <input
                      type="number"
                      value={tpnSettings.lipids}
                      onChange={(e) => setTPNSettings({ ...tpnSettings, lipids: parseFloat(e.target.value) || 0 })}
                      step="0.1"
                      min="0"
                      max="4"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Sodium (mEq/kg)</label>
                    <input
                      type="number"
                      value={tpnSettings.sodium}
                      onChange={(e) => setTPNSettings({ ...tpnSettings, sodium: parseFloat(e.target.value) || 0 })}
                      step="0.5"
                      min="0"
                      max="10"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Potassium (mEq/kg)</label>
                    <input
                      type="number"
                      value={tpnSettings.potassium}
                      onChange={(e) => setTPNSettings({ ...tpnSettings, potassium: parseFloat(e.target.value) || 0 })}
                      step="0.5"
                      min="0"
                      max="10"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Calcium (mEq/kg)</label>
                    <input
                      type="number"
                      value={tpnSettings.calcium}
                      onChange={(e) => setTPNSettings({ ...tpnSettings, calcium: parseFloat(e.target.value) || 0 })}
                      step="0.5"
                      min="0"
                      max="10"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Phosphorus (mmol/kg)</label>
                    <input
                      type="number"
                      value={tpnSettings.phosphorus}
                      onChange={(e) => setTPNSettings({ ...tpnSettings, phosphorus: parseFloat(e.target.value) || 0 })}
                      step="0.25"
                      min="0"
                      max="5"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowTPNEdit(false)}
                    disabled={savingTPN}
                    className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTPN}
                    disabled={savingTPN}
                    className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                  >
                    {savingTPN ? 'Saving...' : 'Save TPN'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pump Session Modal */}
        {showPumpSession && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Log Pump Session</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Volume (mL)</label>
                    <input
                      type="number"
                      value={pumpSession.volume}
                      onChange={(e) => setPumpSession({ ...pumpSession, volume: e.target.value })}
                      placeholder="45"
                      min="0"
                      max="500"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Duration (min)</label>
                    <input
                      type="number"
                      value={pumpSession.duration}
                      onChange={(e) => setPumpSession({ ...pumpSession, duration: e.target.value })}
                      placeholder="20"
                      min="1"
                      max="120"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Storage Location</label>
                  <select
                    value={pumpSession.storageLocation}
                    onChange={(e) => setPumpSession({ ...pumpSession, storageLocation: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="refrigerator">Refrigerator</option>
                    <option value="patient_freezer">Patient Freezer</option>
                    <option value="unit_freezer">Unit Freezer</option>
                    <option value="bedside">Bedside (Immediate Use)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Notes</label>
                  <input
                    type="text"
                    value={pumpSession.notes}
                    onChange={(e) => setPumpSession({ ...pumpSession, notes: e.target.value })}
                    placeholder="Optional notes"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowPumpSession(false)}
                    className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePumpSession}
                    disabled={!pumpSession.volume}
                    className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                  >
                    Save
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

// Helper functions
function parseGAWeeks(ga) {
  if (!ga || ga === '--') return 34;
  const match = ga.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 34;
}

function getDefaultSummary() {
  return {
    totalIntake: 0,
    enteralIntake: 0,
    parenteralIntake: 0,
    totalCalories: 0,
    caloriesPerKg: 0,
    proteinGPerKg: 0,
    gir: 0,
    fluidTarget: 150,
    calorieTarget: 120,
  };
}

function getDefaultTPN() {
  return {
    rate: 0,
    dextrose: 10,
    aminoAcids: 2.5,
    lipids: 1.5,
    sodium: 3,
    potassium: 2,
    calcium: 2,
    phosphorus: 1.5,
  };
}

function getDefaultBreastMilk() {
  return {
    motherSupply: 0,
    stored: 0,
    currentVolume: 0,
    daysSupply: 0,
    avgDailyUsage: 0,
    lastPump: null,
    avgVolume: 0,
  };
}
