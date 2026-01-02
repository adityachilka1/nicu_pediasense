'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';

// Validation helper functions
const validators = {
  // Validate numeric input within range
  numericRange: (value, min, max, fieldName) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseFloat(value);
    if (isNaN(num)) return `${fieldName} must be a valid number`;
    if (num < min) return `${fieldName} must be at least ${min}`;
    if (num > max) return `${fieldName} must be at most ${max}`;
    return null;
  },

  // Validate integer input
  integer: (value, min, max, fieldName) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseInt(value, 10);
    if (isNaN(num)) return `${fieldName} must be a whole number`;
    if (num < min) return `${fieldName} must be at least ${min}`;
    if (num > max) return `${fieldName} must be at most ${max}`;
    return null;
  },

  // Validate time format
  time: (value) => {
    if (!value) return 'Time is required';
    if (!/^\d{2}:\d{2}$/.test(value)) return 'Time must be in HH:MM format';
    return null;
  },
};

// Initial empty entry state
const getEmptyEntry = () => ({
  time: '',
  intake: { iv: '', tpn: '', lipids: '', bloodProducts: '', feeds: '', meds: '' },
  output: { urine: '', stool: '', gastric: '', emesis: '', ostomy: '', drain: '' },
  stoolCount: '',
  stoolType: '',
  urineCount: '',
  specificGravity: '',
  notes: '',
});

export default function FlowsheetPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // State for patient selection
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // State for flowsheet data
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState(null);
  const [lastVoidHoursAgo, setLastVoidHoursAgo] = useState(null);

  // Loading and error states
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Modal states
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [newEntry, setNewEntry] = useState(getEmptyEntry());
  const [validationErrors, setValidationErrors] = useState({});

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [sessionStatus, router]);

  // Fetch patients on mount
  useEffect(() => {
    const fetchPatients = async () => {
      if (sessionStatus !== 'authenticated') return;

      try {
        setIsLoadingPatients(true);
        const response = await fetch('/api/patients?includeDischarged=false');

        if (!response.ok) {
          throw new Error('Failed to fetch patients');
        }

        const result = await response.json();
        const patientList = result.data || [];

        setPatients(patientList);

        // Select first patient if available
        if (patientList.length > 0 && !selectedPatient) {
          setSelectedPatient(patientList[0]);
        }
      } catch (err) {
        console.error('Error fetching patients:', err);
        setError('Failed to load patients. Please try again.');
      } finally {
        setIsLoadingPatients(false);
      }
    };

    fetchPatients();
  }, [sessionStatus]);

  // Fetch flowsheet entries when patient or date changes
  const fetchEntries = useCallback(async () => {
    if (!selectedPatient?.id || !selectedDate) return;

    try {
      setIsLoadingEntries(true);
      setError(null);

      const response = await fetch(
        `/api/flowsheet/${selectedPatient.id}?date=${selectedDate}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch flowsheet entries');
      }

      const result = await response.json();

      setEntries(result.data || []);
      setTotals(result.meta?.totals || null);
      setLastVoidHoursAgo(result.meta?.lastVoidHoursAgo);
    } catch (err) {
      console.error('Error fetching entries:', err);
      setError('Failed to load flowsheet data. Please try again.');
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [selectedPatient?.id, selectedDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Validate entry before saving
  const validateEntry = (entry) => {
    const errors = {};

    // Validate time
    const timeError = validators.time(entry.time);
    if (timeError) errors.time = timeError;

    // Validate intake fields
    const intakeFields = [
      { key: 'iv', name: 'IV Fluids', max: 500 },
      { key: 'tpn', name: 'TPN', max: 500 },
      { key: 'lipids', name: 'Lipids', max: 200 },
      { key: 'bloodProducts', name: 'Blood Products', max: 200 },
      { key: 'feeds', name: 'Feeds', max: 200 },
      { key: 'meds', name: 'Medications', max: 100 },
    ];

    for (const field of intakeFields) {
      const err = validators.numericRange(entry.intake[field.key], 0, field.max, field.name);
      if (err) errors[`intake.${field.key}`] = err;
    }

    // Validate output fields
    const outputFields = [
      { key: 'urine', name: 'Urine', max: 500 },
      { key: 'stool', name: 'Stool', max: 200 },
      { key: 'gastric', name: 'Gastric', max: 200 },
      { key: 'emesis', name: 'Emesis', max: 200 },
      { key: 'ostomy', name: 'Ostomy', max: 200 },
      { key: 'drain', name: 'Drain', max: 200 },
    ];

    for (const field of outputFields) {
      const err = validators.numericRange(entry.output[field.key], 0, field.max, field.name);
      if (err) errors[`output.${field.key}`] = err;
    }

    // Validate counts
    const stoolCountErr = validators.integer(entry.stoolCount, 0, 20, 'Stool count');
    if (stoolCountErr) errors.stoolCount = stoolCountErr;

    const urineCountErr = validators.integer(entry.urineCount, 0, 20, 'Urine count');
    if (urineCountErr) errors.urineCount = urineCountErr;

    // Validate specific gravity
    if (entry.specificGravity) {
      const sgErr = validators.numericRange(entry.specificGravity, 1.0, 1.04, 'Specific gravity');
      if (sgErr) errors.specificGravity = sgErr;
    }

    return errors;
  };

  // Save new entry
  const handleSaveEntry = async () => {
    if (!selectedPatient?.id) return;

    // Validate entry
    const errors = validateEntry(newEntry);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      // Parse hour from time
      const hour = parseInt(newEntry.time.split(':')[0], 10);

      // Build request body
      const requestBody = {
        patientId: selectedPatient.id,
        shiftDate: selectedDate,
        hour,
        // Intake
        ivFluids: parseFloat(newEntry.intake.iv) || null,
        tpn: parseFloat(newEntry.intake.tpn) || null,
        lipids: parseFloat(newEntry.intake.lipids) || null,
        bloodProducts: parseFloat(newEntry.intake.bloodProducts) || null,
        enteral: parseFloat(newEntry.intake.feeds) || null,
        medications: parseFloat(newEntry.intake.meds) || null,
        // Output
        urine: parseFloat(newEntry.output.urine) || null,
        stool: parseFloat(newEntry.output.stool) || null,
        gastricOutput: parseFloat(newEntry.output.gastric) || null,
        emesis: parseFloat(newEntry.output.emesis) || null,
        ostomyOutput: parseFloat(newEntry.output.ostomy) || null,
        drainOutput: parseFloat(newEntry.output.drain) || null,
        // Characteristics
        stoolCount: parseInt(newEntry.stoolCount, 10) || null,
        stoolType: newEntry.stoolType || null,
        urineCount: parseInt(newEntry.urineCount, 10) || null,
        specificGravity: parseFloat(newEntry.specificGravity) || null,
        notes: newEntry.notes || null,
      };

      const response = await fetch('/api/flowsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save entry');
      }

      // Reset form and close modal
      setNewEntry(getEmptyEntry());
      setShowAddEntry(false);
      setValidationErrors({});

      // Refresh entries
      await fetchEntries();
    } catch (err) {
      console.error('Error saving entry:', err);
      setSaveError(err.message || 'Failed to save entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Update existing entry
  const handleUpdateEntry = async () => {
    if (!editingEntry?.id) return;

    // Validate entry
    const errors = validateEntry(newEntry);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      // Build request body for update
      const requestBody = {
        // Intake
        ivFluids: parseFloat(newEntry.intake.iv) || null,
        tpn: parseFloat(newEntry.intake.tpn) || null,
        lipids: parseFloat(newEntry.intake.lipids) || null,
        bloodProducts: parseFloat(newEntry.intake.bloodProducts) || null,
        enteral: parseFloat(newEntry.intake.feeds) || null,
        medications: parseFloat(newEntry.intake.meds) || null,
        // Output
        urine: parseFloat(newEntry.output.urine) || null,
        stool: parseFloat(newEntry.output.stool) || null,
        gastricOutput: parseFloat(newEntry.output.gastric) || null,
        emesis: parseFloat(newEntry.output.emesis) || null,
        ostomyOutput: parseFloat(newEntry.output.ostomy) || null,
        drainOutput: parseFloat(newEntry.output.drain) || null,
        // Characteristics
        stoolCount: parseInt(newEntry.stoolCount, 10) || null,
        stoolType: newEntry.stoolType || null,
        urineCount: parseInt(newEntry.urineCount, 10) || null,
        specificGravity: parseFloat(newEntry.specificGravity) || null,
        notes: newEntry.notes || null,
      };

      const response = await fetch(`/api/flowsheet/entry/${editingEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update entry');
      }

      // Reset form and close modal
      setNewEntry(getEmptyEntry());
      setEditingEntry(null);
      setShowAddEntry(false);
      setValidationErrors({});

      // Refresh entries
      await fetchEntries();
    } catch (err) {
      console.error('Error updating entry:', err);
      setSaveError(err.message || 'Failed to update entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit modal for an entry
  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setNewEntry({
      time: entry.hourFormatted,
      intake: {
        iv: entry.intake?.iv?.toString() || '',
        tpn: entry.intake?.tpn?.toString() || '',
        lipids: entry.intake?.lipids?.toString() || '',
        bloodProducts: entry.intake?.bloodProducts?.toString() || '',
        feeds: entry.intake?.feeds?.toString() || '',
        meds: entry.intake?.meds?.toString() || '',
      },
      output: {
        urine: entry.output?.urine?.toString() || '',
        stool: entry.output?.stool?.toString() || '',
        gastric: entry.output?.gastric?.toString() || '',
        emesis: entry.output?.emesis?.toString() || '',
        ostomy: entry.output?.ostomy?.toString() || '',
        drain: entry.output?.drain?.toString() || '',
      },
      stoolCount: entry.stoolCount?.toString() || '',
      stoolType: entry.stoolType || '',
      urineCount: entry.urineCount?.toString() || '',
      specificGravity: entry.specificGravity?.toString() || '',
      notes: entry.notes || '',
    });
    setShowAddEntry(true);
    setValidationErrors({});
    setSaveError(null);
  };

  // Close modal
  const handleCloseModal = () => {
    setShowAddEntry(false);
    setEditingEntry(null);
    setNewEntry(getEmptyEntry());
    setValidationErrors({});
    setSaveError(null);
  };

  // Calculate display values
  const displayTotals = useMemo(() => {
    if (!totals) {
      return {
        intake: { iv: 0, tpn: 0, lipids: 0, bloodProducts: 0, meds: 0, feeds: 0, total: 0 },
        output: { urine: 0, stool: 0, gastric: 0, emesis: 0, ostomy: 0, drain: 0, total: 0 },
        balance: 0,
        urineOutputMlPerKgPerHr: 0,
        intakeMlPerKgPerDay: 0,
        outputMlPerKgPerDay: 0,
      };
    }
    return totals;
  }, [totals]);

  // Get urine output color based on rate
  const getUrineColor = (rate) => {
    if (rate === null || rate === undefined) return 'text-slate-400';
    if (rate < 0.5) return 'text-red-400';
    if (rate < 1) return 'text-yellow-400';
    if (rate <= 3) return 'text-green-400';
    return 'text-blue-400';
  };

  // Loading state
  if (sessionStatus === 'loading' || isLoadingPatients) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  // No patients state
  if (patients.length === 0 && !isLoadingPatients) {
    return (
      <AppShell>
        <div className="p-6">
          <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-2">No Patients Found</h2>
            <p className="text-slate-400">There are no active patients to display flowsheet data for.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  // Get patient weight for display
  const patientWeight = selectedPatient?.weight || selectedPatient?.currentWeight || selectedPatient?.birthWeight || 0;
  const patientWeightGrams = patientWeight > 10 ? patientWeight : patientWeight * 1000;

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
              value={selectedPatient?.id || ''}
              onChange={(e) => {
                const patient = patients.find(p => p.id === parseInt(e.target.value, 10));
                setSelectedPatient(patient || null);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              disabled={isLoadingPatients}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.mrn})
                </option>
              ))}
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            <button
              onClick={() => {
                setEditingEntry(null);
                setNewEntry(getEmptyEntry());
                setShowAddEntry(true);
                setValidationErrors({});
                setSaveError(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Entry
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-400">{error}</span>
            <button
              onClick={fetchEntries}
              className="ml-auto px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Total Intake</div>
            <div className="text-2xl font-bold text-cyan-400">
              {isLoadingEntries ? '...' : `${displayTotals.intake?.total?.toFixed(1) || 0} mL`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {patientWeight > 0
                ? `${displayTotals.intakeMlPerKgPerDay?.toFixed(1) || 0} mL/kg/day`
                : 'No weight recorded'}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Total Output</div>
            <div className="text-2xl font-bold text-purple-400">
              {isLoadingEntries ? '...' : `${displayTotals.output?.total?.toFixed(1) || 0} mL`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {patientWeight > 0
                ? `${displayTotals.outputMlPerKgPerDay?.toFixed(1) || 0} mL/kg/day`
                : 'No weight recorded'}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Net Balance</div>
            <div className={`text-2xl font-bold ${(displayTotals.balance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {isLoadingEntries ? '...' : `${(displayTotals.balance || 0) >= 0 ? '+' : ''}${displayTotals.balance?.toFixed(1) || 0} mL`}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Urine Output</div>
            <div className={`text-2xl font-bold ${getUrineColor(displayTotals.urineOutputMlPerKgPerHr)}`}>
              {isLoadingEntries
                ? '...'
                : patientWeight > 0
                  ? `${displayTotals.urineOutputMlPerKgPerHr?.toFixed(2) || 0} mL/kg/hr`
                  : 'N/A'}
            </div>
            <div className="text-xs text-slate-500 mt-1">Target: 1-3 mL/kg/hr</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Last Void</div>
            <div className="text-2xl font-bold text-white">
              {isLoadingEntries
                ? '...'
                : lastVoidHoursAgo !== null
                  ? `${lastVoidHoursAgo.toFixed(1)} hr`
                  : 'N/A'}
            </div>
            <div className={`text-xs mt-1 ${lastVoidHoursAgo > 6 ? 'text-red-400' : 'text-green-400'}`}>
              {lastVoidHoursAgo !== null ? 'ago' : 'No record'}
            </div>
          </div>
        </div>

        {/* Intake/Output Breakdown */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-semibold text-white mb-3">Intake Breakdown</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">IV Fluids</span>
                <span className="text-cyan-400 font-medium">{displayTotals.intake?.iv?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">TPN</span>
                <span className="text-cyan-400 font-medium">{displayTotals.intake?.tpn?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Enteral Feeds</span>
                <span className="text-green-400 font-medium">{displayTotals.intake?.feeds?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Medications</span>
                <span className="text-yellow-400 font-medium">{displayTotals.intake?.meds?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Lipids</span>
                <span className="text-orange-400 font-medium">{displayTotals.intake?.lipids?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Blood Products</span>
                <span className="text-red-400 font-medium">{displayTotals.intake?.bloodProducts?.toFixed(1) || 0} mL</span>
              </div>
              <div className="border-t border-slate-700 pt-2 mt-2 flex items-center justify-between font-medium">
                <span className="text-white">Total</span>
                <span className="text-white">{displayTotals.intake?.total?.toFixed(1) || 0} mL</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-semibold text-white mb-3">Output Breakdown</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Urine</span>
                <span className="text-purple-400 font-medium">{displayTotals.output?.urine?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Stool</span>
                <span className="text-amber-400 font-medium">{displayTotals.output?.stool?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Gastric/Residuals</span>
                <span className="text-red-400 font-medium">{displayTotals.output?.gastric?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Emesis</span>
                <span className="text-pink-400 font-medium">{displayTotals.output?.emesis?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Ostomy</span>
                <span className="text-orange-400 font-medium">{displayTotals.output?.ostomy?.toFixed(1) || 0} mL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Drain</span>
                <span className="text-blue-400 font-medium">{displayTotals.output?.drain?.toFixed(1) || 0} mL</span>
              </div>
              <div className="border-t border-slate-700 pt-2 mt-2 flex items-center justify-between font-medium">
                <span className="text-white">Total</span>
                <span className="text-white">{displayTotals.output?.total?.toFixed(1) || 0} mL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Flowsheet Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-white">Hourly Flowsheet</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {isLoadingEntries && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading...</span>
                </div>
              )}
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded">
                {entries.length} entries
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-700 bg-slate-800/50">
                  <th className="p-3 sticky left-0 bg-slate-800">Time</th>
                  <th className="p-3 text-center border-l border-slate-700" colSpan={6}>
                    <span className="text-cyan-400">INTAKE (mL)</span>
                  </th>
                  <th className="p-3 text-center border-l border-slate-700" colSpan={6}>
                    <span className="text-purple-400">OUTPUT (mL)</span>
                  </th>
                  <th className="p-3 text-center border-l border-slate-700">Actions</th>
                </tr>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                  <th className="p-2 sticky left-0 bg-slate-800"></th>
                  <th className="p-2 border-l border-slate-700">IV</th>
                  <th className="p-2">TPN</th>
                  <th className="p-2">Feeds</th>
                  <th className="p-2">Meds</th>
                  <th className="p-2">Lipids</th>
                  <th className="p-2">Blood</th>
                  <th className="p-2 border-l border-slate-700">Urine</th>
                  <th className="p-2">Stool</th>
                  <th className="p-2">Gastric</th>
                  <th className="p-2">Emesis</th>
                  <th className="p-2">Ostomy</th>
                  <th className="p-2">Drain</th>
                  <th className="p-2 border-l border-slate-700"></th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && !isLoadingEntries ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-slate-400">
                      No entries recorded for this date. Click "Add Entry" to start documenting.
                    </td>
                  </tr>
                ) : (
                  entries.map((row) => (
                    <tr key={row.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-2 font-medium text-white sticky left-0 bg-slate-800">{row.hourFormatted}</td>
                      <td className="p-2 text-cyan-400 border-l border-slate-700">{row.intake?.iv || '-'}</td>
                      <td className="p-2 text-cyan-400">{row.intake?.tpn || '-'}</td>
                      <td className="p-2 text-green-400">{row.intake?.feeds || '-'}</td>
                      <td className="p-2 text-yellow-400">{row.intake?.meds || '-'}</td>
                      <td className="p-2 text-orange-400">{row.intake?.lipids || '-'}</td>
                      <td className="p-2 text-red-400">{row.intake?.bloodProducts || '-'}</td>
                      <td className="p-2 text-purple-400 border-l border-slate-700">{row.output?.urine || '-'}</td>
                      <td className="p-2 text-amber-400">{row.output?.stool || '-'}</td>
                      <td className="p-2 text-red-400">{row.output?.gastric || '-'}</td>
                      <td className="p-2 text-pink-400">{row.output?.emesis || '-'}</td>
                      <td className="p-2 text-orange-400">{row.output?.ostomy || '-'}</td>
                      <td className="p-2 text-blue-400">{row.output?.drain || '-'}</td>
                      <td className="p-2 border-l border-slate-700">
                        <button
                          onClick={() => handleEditEntry(row)}
                          className="text-slate-400 hover:text-cyan-400 transition-colors"
                          title="Edit entry"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {/* Totals Row */}
                {entries.length > 0 && (
                  <tr className="bg-slate-700/50 font-medium">
                    <td className="p-2 text-white sticky left-0 bg-slate-700">TOTAL</td>
                    <td className="p-2 text-cyan-400 border-l border-slate-700">{displayTotals.intake?.iv?.toFixed(1) || 0}</td>
                    <td className="p-2 text-cyan-400">{displayTotals.intake?.tpn?.toFixed(1) || 0}</td>
                    <td className="p-2 text-green-400">{displayTotals.intake?.feeds?.toFixed(1) || 0}</td>
                    <td className="p-2 text-yellow-400">{displayTotals.intake?.meds?.toFixed(1) || 0}</td>
                    <td className="p-2 text-orange-400">{displayTotals.intake?.lipids?.toFixed(1) || 0}</td>
                    <td className="p-2 text-red-400">{displayTotals.intake?.bloodProducts?.toFixed(1) || 0}</td>
                    <td className="p-2 text-purple-400 border-l border-slate-700">{displayTotals.output?.urine?.toFixed(1) || 0}</td>
                    <td className="p-2 text-amber-400">{displayTotals.output?.stool?.toFixed(1) || 0}</td>
                    <td className="p-2 text-red-400">{displayTotals.output?.gastric?.toFixed(1) || 0}</td>
                    <td className="p-2 text-pink-400">{displayTotals.output?.emesis?.toFixed(1) || 0}</td>
                    <td className="p-2 text-orange-400">{displayTotals.output?.ostomy?.toFixed(1) || 0}</td>
                    <td className="p-2 text-blue-400">{displayTotals.output?.drain?.toFixed(1) || 0}</td>
                    <td className="p-2 border-l border-slate-700">-</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Entry Modal */}
        {showAddEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {editingEntry ? 'Edit I/O Entry' : 'Add I/O Entry'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Save error */}
              {saveError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-400 text-sm">{saveError}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Time input */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Time *</label>
                  <input
                    type="time"
                    value={newEntry.time}
                    onChange={(e) => setNewEntry({ ...newEntry, time: e.target.value })}
                    disabled={!!editingEntry}
                    className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white disabled:opacity-50 ${
                      validationErrors.time ? 'border-red-500' : 'border-slate-600'
                    } focus:ring-2 focus:ring-cyan-500 focus:border-transparent`}
                  />
                  {validationErrors.time && (
                    <p className="text-red-400 text-xs mt-1">{validationErrors.time}</p>
                  )}
                </div>

                {/* Intake section */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Intake (mL)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'iv', label: 'IV Fluids', placeholder: '0' },
                      { key: 'tpn', label: 'TPN', placeholder: '0' },
                      { key: 'feeds', label: 'Enteral Feeds', placeholder: '0' },
                      { key: 'meds', label: 'Medications', placeholder: '0' },
                      { key: 'lipids', label: 'Lipids', placeholder: '0' },
                      { key: 'bloodProducts', label: 'Blood Products', placeholder: '0' },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={newEntry.intake[field.key]}
                          onChange={(e) =>
                            setNewEntry({
                              ...newEntry,
                              intake: { ...newEntry.intake, [field.key]: e.target.value },
                            })
                          }
                          placeholder={field.placeholder}
                          className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white ${
                            validationErrors[`intake.${field.key}`] ? 'border-red-500' : 'border-slate-600'
                          } focus:ring-2 focus:ring-cyan-500 focus:border-transparent`}
                        />
                        {validationErrors[`intake.${field.key}`] && (
                          <p className="text-red-400 text-xs mt-1">{validationErrors[`intake.${field.key}`]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Output section */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Output (mL)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'urine', label: 'Urine', placeholder: '0' },
                      { key: 'stool', label: 'Stool', placeholder: '0' },
                      { key: 'gastric', label: 'Gastric/Residuals', placeholder: '0' },
                      { key: 'emesis', label: 'Emesis', placeholder: '0' },
                      { key: 'ostomy', label: 'Ostomy', placeholder: '0' },
                      { key: 'drain', label: 'Drain', placeholder: '0' },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={newEntry.output[field.key]}
                          onChange={(e) =>
                            setNewEntry({
                              ...newEntry,
                              output: { ...newEntry.output, [field.key]: e.target.value },
                            })
                          }
                          placeholder={field.placeholder}
                          className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white ${
                            validationErrors[`output.${field.key}`] ? 'border-red-500' : 'border-slate-600'
                          } focus:ring-2 focus:ring-cyan-500 focus:border-transparent`}
                        />
                        {validationErrors[`output.${field.key}`] && (
                          <p className="text-red-400 text-xs mt-1">{validationErrors[`output.${field.key}`]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Characteristics section */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Stool Characteristics</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Count</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={newEntry.stoolCount}
                          onChange={(e) => setNewEntry({ ...newEntry, stoolCount: e.target.value })}
                          placeholder="0"
                          className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white ${
                            validationErrors.stoolCount ? 'border-red-500' : 'border-slate-600'
                          } focus:ring-2 focus:ring-cyan-500 focus:border-transparent`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Type</label>
                        <select
                          value={newEntry.stoolType}
                          onChange={(e) => setNewEntry({ ...newEntry, stoolType: e.target.value })}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        >
                          <option value="">Select...</option>
                          <option value="meconium">Meconium</option>
                          <option value="transitional">Transitional</option>
                          <option value="normal">Normal</option>
                          <option value="loose">Loose</option>
                          <option value="watery">Watery</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Urine Characteristics</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Count (diapers)</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={newEntry.urineCount}
                          onChange={(e) => setNewEntry({ ...newEntry, urineCount: e.target.value })}
                          placeholder="0"
                          className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white ${
                            validationErrors.urineCount ? 'border-red-500' : 'border-slate-600'
                          } focus:ring-2 focus:ring-cyan-500 focus:border-transparent`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Specific Gravity</label>
                        <input
                          type="number"
                          step="0.001"
                          min="1.0"
                          max="1.04"
                          value={newEntry.specificGravity}
                          onChange={(e) => setNewEntry({ ...newEntry, specificGravity: e.target.value })}
                          placeholder="1.010"
                          className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white ${
                            validationErrors.specificGravity ? 'border-red-500' : 'border-slate-600'
                          } focus:ring-2 focus:ring-cyan-500 focus:border-transparent`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Notes</label>
                  <textarea
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                    placeholder="Optional notes..."
                    rows={2}
                    maxLength={500}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">{newEntry.notes.length}/500 characters</p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCloseModal}
                    disabled={isSaving}
                    className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingEntry ? handleUpdateEntry : handleSaveEntry}
                    disabled={isSaving}
                    className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : editingEntry ? (
                      'Update Entry'
                    ) : (
                      'Save Entry'
                    )}
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
