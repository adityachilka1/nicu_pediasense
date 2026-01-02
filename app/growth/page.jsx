'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import AppShell from '../../components/AppShell';
import { FENTON_PERCENTILES } from '../../lib/data';

const fentonPercentiles = [3, 10, 50, 90, 97];

// Loading skeleton component
const LoadingSkeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-700 rounded ${className}`} />
);

// Error display component
const ErrorDisplay = ({ message, onRetry }) => (
  <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-center">
    <svg className="w-8 h-8 text-red-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <p className="text-red-400 text-sm mb-2">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 text-sm"
      >
        Retry
      </button>
    )}
  </div>
);

// === FENTON CHART COMPONENT (Medical Standard: Fenton 2013) ===
// Renders actual Fenton percentile curves for preterm growth tracking
const FentonChart = ({ chartType, measurements, selectedPatient, fentonPercentiles }) => {
  const canvasRef = useRef(null);

  // Chart configuration - medical standard display
  const GA_MIN = 22;
  const GA_MAX = 40;
  const CHART_PADDING = { top: 20, right: 20, bottom: 40, left: 60 };

  // Get range based on chart type
  const getRange = (type) => {
    switch (type) {
      case 'weight': return { min: 300, max: 4500, unit: 'g', dataKey: 'weight' };
      case 'length': return { min: 25, max: 55, unit: 'cm', dataKey: 'length' };
      case 'hc': return { min: 18, max: 40, unit: 'cm', dataKey: 'headCircumference' };
      default: return { min: 300, max: 4500, unit: 'g', dataKey: 'weight' };
    }
  };

  // Parse PCA to decimal GA
  const pcaToGA = (pca) => {
    if (!pca) return null;
    const [weeks, days] = pca.split('+').map(Number);
    return weeks + (days / 7);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const chartW = width - CHART_PADDING.left - CHART_PADDING.right;
    const chartH = height - CHART_PADDING.top - CHART_PADDING.bottom;

    const range = getRange(chartType);

    // Clear canvas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Helper functions
    const gaToX = (ga) => CHART_PADDING.left + ((ga - GA_MIN) / (GA_MAX - GA_MIN)) * chartW;
    const valToY = (val) => CHART_PADDING.top + chartH - ((val - range.min) / (range.max - range.min)) * chartH;

    // Draw grid
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
    ctx.lineWidth = 1;

    // Vertical grid (every 2 weeks)
    for (let ga = GA_MIN; ga <= GA_MAX; ga += 2) {
      const x = gaToX(ga);
      ctx.beginPath();
      ctx.moveTo(x, CHART_PADDING.top);
      ctx.lineTo(x, height - CHART_PADDING.bottom);
      ctx.stroke();
    }

    // Horizontal grid
    const ySteps = chartType === 'weight' ? 500 : 5;
    for (let v = range.min; v <= range.max; v += ySteps) {
      const y = valToY(v);
      ctx.beginPath();
      ctx.moveTo(CHART_PADDING.left, y);
      ctx.lineTo(width - CHART_PADDING.right, y);
      ctx.stroke();
    }

    // Chart border
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
    ctx.strokeRect(CHART_PADDING.left, CHART_PADDING.top, chartW, chartH);

    // Determine gender (default male, can be enhanced with patient data)
    const gender = selectedPatient?.gender === 'F' ? 'female' : 'male';
    const fentonData = FENTON_PERCENTILES?.[gender]?.[range.dataKey];

    // Draw Fenton percentile curves
    if (fentonData) {
      const percentileColors = {
        3: 'rgba(239, 68, 68, 0.6)',   // Red - low
        10: 'rgba(251, 191, 36, 0.6)', // Yellow
        50: 'rgba(255, 255, 255, 0.8)', // White - median
        90: 'rgba(251, 191, 36, 0.6)', // Yellow
        97: 'rgba(239, 68, 68, 0.6)'   // Red - high
      };

      const percentileLineWidths = { 3: 1, 10: 1.5, 50: 2, 90: 1.5, 97: 1 };

      fentonPercentiles.forEach((p) => {
        const pKey = `p${p}`;
        ctx.strokeStyle = percentileColors[p] || 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = percentileLineWidths[p] || 1;
        ctx.beginPath();

        let firstPoint = true;
        for (let ga = GA_MIN; ga <= GA_MAX; ga++) {
          const value = fentonData[ga]?.[pKey];
          if (value !== undefined) {
            const x = gaToX(ga);
            const y = valToY(value);
            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();

        // Label percentile at end
        const lastGA = GA_MAX;
        const lastVal = fentonData[lastGA]?.[pKey];
        if (lastVal !== undefined) {
          ctx.fillStyle = percentileColors[p];
          ctx.font = '10px sans-serif';
          ctx.fillText(`${p}th`, gaToX(lastGA) + 3, valToY(lastVal) + 3);
        }
      });
    }

    // Draw patient data points
    if (measurements && measurements.length > 0) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const dataKey = chartType === 'hc' ? 'hc' : chartType;

      const validMeasurements = measurements.filter(m => {
        const ga = pcaToGA(m.pca);
        const value = m[dataKey];
        return ga !== null && ga >= GA_MIN && ga <= GA_MAX && value !== undefined && value !== null;
      });

      validMeasurements.forEach((m, i) => {
        const ga = pcaToGA(m.pca);
        const value = m[dataKey];
        const x = gaToX(ga);
        const y = valToY(value);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw data points
      validMeasurements.forEach((m) => {
        const ga = pcaToGA(m.pca);
        const value = m[dataKey];
        const x = gaToX(ga);
        const y = valToY(value);

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.fill();
        ctx.strokeStyle = '#0e7490';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Draw axes labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';

    // X-axis labels (GA weeks)
    for (let ga = GA_MIN; ga <= GA_MAX; ga += 2) {
      const x = gaToX(ga);
      ctx.fillText(`${ga}w`, x - 8, height - 10);
    }

    // Y-axis labels
    const yStepsLabel = chartType === 'weight' ? 500 : 5;
    for (let v = range.min; v <= range.max; v += yStepsLabel) {
      const y = valToY(v);
      ctx.fillText(`${v}${range.unit}`, 5, y + 4);
    }

    // Axis titles
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText('Gestational Age (weeks)', width / 2 - 60, height - 2);

    // Y-axis title (rotated)
    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(chartType === 'weight' ? 'Weight (g)' : chartType === 'length' ? 'Length (cm)' : 'Head Circ. (cm)', -40, 0);
    ctx.restore();

  }, [chartType, measurements, selectedPatient, fentonPercentiles]);

  const chartTypes = [
    { id: 'weight', label: 'Weight', unit: 'g' },
    { id: 'length', label: 'Length', unit: 'cm' },
    { id: 'hc', label: 'Head Circ.', unit: 'cm' },
  ];

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          {chartTypes.find(t => t.id === chartType)?.label} vs. Gestational Age
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-red-400/60"></div>
            <span className="text-slate-400">3rd/97th</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-yellow-400/60"></div>
            <span className="text-slate-400">10th/90th</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-1 bg-white/80"></div>
            <span className="text-slate-400">50th</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
            <span className="text-slate-400">Patient</span>
          </div>
        </div>
      </div>
      <div className="text-xs text-slate-500 mb-2">
        Fenton 2013 Preterm Growth Standards ({selectedPatient?.gender === 'F' ? 'Female' : 'Male'})
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-80 rounded-lg"
        style={{ background: 'rgba(15, 23, 42, 0.5)' }}
      />
    </div>
  );
};

export default function GrowthChartsPage() {
  // State for patients and growth data
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [chartType, setChartType] = useState('weight');
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [measurements, setMeasurements] = useState([]);
  const [percentiles, setPercentiles] = useState({ weight: null, length: null, hc: null });
  const [velocities, setVelocities] = useState({ weight: null, length: null, hc: null });

  // Loading and error states
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingGrowth, setLoadingGrowth] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [patientError, setPatientError] = useState(null);
  const [growthError, setGrowthError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const [newMeasurement, setNewMeasurement] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    length: '',
    hc: ''
  });

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Fetch growth data when patient changes
  useEffect(() => {
    if (selectedPatient?.id) {
      fetchGrowthData(selectedPatient.id);
    }
  }, [selectedPatient?.id]);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    setPatientError(null);

    try {
      const response = await fetch('/api/patients?includeDischarged=false&limit=50');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to fetch patients (${response.status})`);
      }

      const result = await response.json();
      const patientData = result.data || [];

      // Transform patient data for growth charts
      const transformed = patientData.map(p => ({
        id: p.id,
        mrn: p.mrn,
        name: p.name,
        ga: p.ga || '--',
        gender: p.gender,
        dob: p.admitDate?.split('T')[0] || '--',
        currentWeight: p.weight ? Math.round(p.weight * 1000) : null, // Convert kg to g
        birthWeight: p.birthWeight ? Math.round(p.birthWeight * 1000) : null,
        dayOfLife: p.dol || 1,
      }));

      setPatients(transformed);

      // Select first patient if available
      if (transformed.length > 0 && !selectedPatient) {
        setSelectedPatient(transformed[0]);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setPatientError(err.message);
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchGrowthData = async (patientId) => {
    setLoadingGrowth(true);
    setGrowthError(null);

    try {
      const response = await fetch(`/api/growth/${patientId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to fetch growth data (${response.status})`);
      }

      const result = await response.json();

      setMeasurements(result.data?.measurements || []);
      setPercentiles(result.data?.percentiles || { weight: null, length: null, hc: null });
      setVelocities(result.data?.velocities || { weight: null, length: null, hc: null });
    } catch (err) {
      console.error('Error fetching growth data:', err);
      setGrowthError(err.message);
      setMeasurements([]);
      setPercentiles({ weight: null, length: null, hc: null });
      setVelocities({ weight: null, length: null, hc: null });
    } finally {
      setLoadingGrowth(false);
    }
  };

  const handleSaveMeasurement = async () => {
    if (!selectedPatient) return;

    // Validate at least one measurement is provided
    const hasWeight = newMeasurement.weight !== '';
    const hasLength = newMeasurement.length !== '';
    const hasHC = newMeasurement.hc !== '';

    if (!hasWeight && !hasLength && !hasHC) {
      setSaveError('At least one measurement is required');
      return;
    }

    setSavingMeasurement(true);
    setSaveError(null);

    try {
      // Convert weight from grams to kg for API
      const weightKg = hasWeight ? parseFloat(newMeasurement.weight) / 1000 : null;
      const lengthCm = hasLength ? parseFloat(newMeasurement.length) : null;
      const hcCm = hasHC ? parseFloat(newMeasurement.hc) : null;

      // Calculate percentiles for the new measurement if we have patient GA info
      let calculatedPercentiles = {};
      if (selectedPatient.ga && selectedPatient.ga !== '--') {
        const [gaWeeks, gaDays] = selectedPatient.ga.split('+').map(Number);

        // Calculate days since measurement date
        const birthDate = new Date(selectedPatient.dob);
        const measurementDate = new Date(newMeasurement.date);
        const daysSinceBirth = Math.floor((measurementDate - birthDate) / (1000 * 60 * 60 * 24));
        const totalDays = gaWeeks * 7 + (gaDays || 0) + daysSinceBirth;
        const pcaWeeks = Math.floor(totalDays / 7);
        const pcaDays = totalDays % 7;

        try {
          const percentileResponse = await fetch(
            `/api/growth/percentiles?gender=${selectedPatient.gender || 'M'}&gaWeeks=${pcaWeeks}&gaDays=${pcaDays}` +
            `${weightKg ? `&weight=${weightKg * 1000}` : ''}` + // Send weight in grams for percentile calc
            `${lengthCm ? `&length=${lengthCm}` : ''}` +
            `${hcCm ? `&headCirc=${hcCm}` : ''}`
          );

          if (percentileResponse.ok) {
            const percentileResult = await percentileResponse.json();
            calculatedPercentiles = percentileResult.data?.percentiles || {};
          }
        } catch (percentileErr) {
          console.warn('Could not calculate percentiles:', percentileErr);
        }
      }

      const response = await fetch('/api/growth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          weight: weightKg,
          length: lengthCm,
          headCirc: hcCm,
          weightPercentile: calculatedPercentiles.weight || null,
          lengthPercentile: calculatedPercentiles.length || null,
          headCircPercentile: calculatedPercentiles.headCirc || null,
          measuredAt: new Date(newMeasurement.date).toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to save measurement (${response.status})`);
      }

      // Refresh growth data
      await fetchGrowthData(selectedPatient.id);

      // Reset form and close modal
      setNewMeasurement({
        date: new Date().toISOString().split('T')[0],
        weight: '',
        length: '',
        hc: ''
      });
      setShowAddMeasurement(false);
    } catch (err) {
      console.error('Error saving measurement:', err);
      setSaveError(err.message);
    } finally {
      setSavingMeasurement(false);
    }
  };

  const chartTypes = [
    { id: 'weight', label: 'Weight', unit: 'g', color: 'cyan' },
    { id: 'length', label: 'Length', unit: 'cm', color: 'green' },
    { id: 'hc', label: 'Head Circ.', unit: 'cm', color: 'purple' },
  ];

  const getPercentileColor = (p) => {
    if (p === null || p === undefined) return 'text-slate-500';
    if (p < 10) return 'text-red-400';
    if (p < 25) return 'text-yellow-400';
    if (p <= 75) return 'text-green-400';
    if (p <= 90) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatPercentile = (p) => {
    if (p === null || p === undefined) return '--';
    return `${Math.round(p)}th %ile`;
  };

  const formatVelocity = (v, unit) => {
    if (v === null || v === undefined) return '--';
    return `${v} ${unit}`;
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Growth Charts</h1>
            <p className="text-slate-400 text-sm">Fenton 2013 preterm growth tracking</p>
          </div>
          <button
            onClick={() => setShowAddMeasurement(true)}
            disabled={!selectedPatient}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Measurement
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Patient Selector */}
          <div className="col-span-3 bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Select Patient</h3>

            {loadingPatients ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <LoadingSkeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : patientError ? (
              <ErrorDisplay message={patientError} onRetry={fetchPatients} />
            ) : patients.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No patients found</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
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
                    <div className="font-medium text-white text-sm">{patient.name}</div>
                    <div className="text-xs text-slate-400">
                      GA: {patient.ga} | {patient.currentWeight ? `${patient.currentWeight}g` : '--'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Current Stats */}
            {selectedPatient && (
              <>
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Current Percentiles</h3>
                  {loadingGrowth ? (
                    <div className="space-y-2">
                      <LoadingSkeleton className="h-6 w-full" />
                      <LoadingSkeleton className="h-6 w-full" />
                      <LoadingSkeleton className="h-6 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Weight</span>
                        <span className={`text-sm font-medium ${getPercentileColor(percentiles.weight)}`}>
                          {formatPercentile(percentiles.weight)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Length</span>
                        <span className={`text-sm font-medium ${getPercentileColor(percentiles.length)}`}>
                          {formatPercentile(percentiles.length)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Head Circ.</span>
                        <span className={`text-sm font-medium ${getPercentileColor(percentiles.hc)}`}>
                          {formatPercentile(percentiles.hc)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Growth Velocity */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Growth Velocity</h3>
                  {loadingGrowth ? (
                    <div className="space-y-2">
                      <LoadingSkeleton className="h-6 w-full" />
                      <LoadingSkeleton className="h-6 w-full" />
                      <LoadingSkeleton className="h-6 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Weight</span>
                        <span className="text-sm font-medium text-green-400">
                          {formatVelocity(velocities.weight, 'g/kg/day')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Length</span>
                        <span className="text-sm font-medium text-green-400">
                          {formatVelocity(velocities.length, 'cm/wk')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Head Circ.</span>
                        <span className="text-sm font-medium text-green-400">
                          {formatVelocity(velocities.hc, 'cm/wk')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Chart Area */}
          <div className="col-span-9 space-y-4">
            {/* Chart Type Tabs */}
            <div className="flex gap-2">
              {chartTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setChartType(type.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    chartType === type.id
                      ? `bg-${type.color}-500/20 text-${type.color}-400 border border-${type.color}-500/50`
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Chart - Fenton 2013 Percentile Chart */}
            {growthError ? (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <ErrorDisplay message={growthError} onRetry={() => fetchGrowthData(selectedPatient?.id)} />
              </div>
            ) : loadingGrowth ? (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <LoadingSkeleton className="h-80 w-full" />
              </div>
            ) : (
              <FentonChart
                chartType={chartType}
                measurements={measurements}
                selectedPatient={selectedPatient}
                fentonPercentiles={fentonPercentiles}
              />
            )}

            {/* Measurements Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold text-white">Measurement History</h3>
              </div>
              {loadingGrowth ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map(i => (
                    <LoadingSkeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : measurements.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p>No measurements recorded</p>
                  <button
                    onClick={() => setShowAddMeasurement(true)}
                    className="mt-2 text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    Add first measurement
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                        <th className="p-3">Date</th>
                        <th className="p-3">DOL</th>
                        <th className="p-3">PCA</th>
                        <th className="p-3">Weight (g)</th>
                        <th className="p-3">Change</th>
                        <th className="p-3">Length (cm)</th>
                        <th className="p-3">HC (cm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measurements.map((m, i) => (
                        <tr key={m.id || i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3 text-sm text-white">{m.date}</td>
                          <td className="p-3 text-sm text-slate-300">{m.day}</td>
                          <td className="p-3 text-sm text-slate-300">{m.pca || '--'}</td>
                          <td className="p-3 text-sm text-cyan-400 font-medium">
                            {m.weight !== null ? m.weight : '--'}
                          </td>
                          <td className="p-3 text-sm">
                            {i > 0 && m.weight !== null && measurements[i-1]?.weight !== null && (
                              <span className={m.weight > measurements[i-1].weight ? 'text-green-400' : 'text-red-400'}>
                                {m.weight > measurements[i-1].weight ? '+' : ''}
                                {m.weight - measurements[i-1].weight}g
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-slate-300">
                            {m.length !== null ? m.length : '--'}
                          </td>
                          <td className="p-3 text-sm text-slate-300">
                            {m.hc !== null ? m.hc : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Measurement Modal */}
        {showAddMeasurement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Add Measurement</h3>

              {saveError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {saveError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Patient</label>
                  <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    {selectedPatient?.name || 'No patient selected'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={newMeasurement.date}
                    onChange={(e) => setNewMeasurement({ ...newMeasurement, date: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Weight (g)</label>
                    <input
                      type="number"
                      value={newMeasurement.weight}
                      onChange={(e) => setNewMeasurement({ ...newMeasurement, weight: e.target.value })}
                      placeholder="1200"
                      min="100"
                      max="15000"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Length (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newMeasurement.length}
                      onChange={(e) => setNewMeasurement({ ...newMeasurement, length: e.target.value })}
                      placeholder="38.5"
                      min="20"
                      max="80"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">HC (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newMeasurement.hc}
                      onChange={(e) => setNewMeasurement({ ...newMeasurement, hc: e.target.value })}
                      placeholder="27.0"
                      min="15"
                      max="50"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  At least one measurement is required. Percentiles will be calculated automatically.
                </p>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAddMeasurement(false);
                      setSaveError(null);
                      setNewMeasurement({
                        date: new Date().toISOString().split('T')[0],
                        weight: '',
                        length: '',
                        hc: ''
                      });
                    }}
                    disabled={savingMeasurement}
                    className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveMeasurement}
                    disabled={savingMeasurement}
                    className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingMeasurement ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save'
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
