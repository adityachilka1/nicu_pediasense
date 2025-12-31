'use client';

import { useState, useRef, useEffect } from 'react';
import AppShell from '../../components/AppShell';
import { FENTON_PERCENTILES } from '../../lib/data';

const patients = [
  { id: 'NB-2024-0892', name: 'Baby Martinez', ga: '28+3', dob: '2024-12-15', currentWeight: 1180, birthWeight: 980 },
  { id: 'NB-2024-0891', name: 'Baby Thompson', ga: '32+1', dob: '2024-12-18', currentWeight: 1650, birthWeight: 1520 },
  { id: 'NB-2024-0890', name: 'Baby Williams', ga: '26+5', dob: '2024-12-10', currentWeight: 890, birthWeight: 720 },
];

const growthData = {
  'NB-2024-0892': {
    measurements: [
      { date: '2024-12-15', day: 0, weight: 980, length: 36.5, hc: 25.2, pca: '28+3' },
      { date: '2024-12-17', day: 2, weight: 935, length: 36.5, hc: 25.2, pca: '28+5' },
      { date: '2024-12-19', day: 4, weight: 960, length: 36.8, hc: 25.4, pca: '29+0' },
      { date: '2024-12-22', day: 7, weight: 1020, length: 37.2, hc: 25.8, pca: '29+3' },
      { date: '2024-12-25', day: 10, weight: 1085, length: 37.8, hc: 26.2, pca: '29+6' },
      { date: '2024-12-28', day: 13, weight: 1150, length: 38.5, hc: 26.7, pca: '30+2' },
      { date: '2024-12-29', day: 14, weight: 1180, length: 38.8, hc: 26.9, pca: '30+3' },
    ],
    percentiles: { weight: 35, length: 42, hc: 48 },
    velocities: { weight: 18.2, length: 1.1, hc: 0.85 }
  }
};

const fentonPercentiles = [3, 10, 50, 90, 97];

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

    // Determine gender (default male, could be enhanced)
    const gender = 'male';
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

      measurements.forEach((m, i) => {
        const ga = pcaToGA(m.pca);
        const value = m[dataKey];
        if (ga >= GA_MIN && ga <= GA_MAX && value !== undefined) {
          const x = gaToX(ga);
          const y = valToY(value);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.stroke();

      // Draw data points
      measurements.forEach((m) => {
        const ga = pcaToGA(m.pca);
        const value = m[dataKey];
        if (ga >= GA_MIN && ga <= GA_MAX && value !== undefined) {
          const x = gaToX(ga);
          const y = valToY(value);

          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#22d3ee';
          ctx.fill();
          ctx.strokeStyle = '#0e7490';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
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
      <div className="text-xs text-slate-500 mb-2">Fenton 2013 Preterm Growth Standards (Male)</div>
      <canvas
        ref={canvasRef}
        className="w-full h-80 rounded-lg"
        style={{ background: 'rgba(15, 23, 42, 0.5)' }}
      />
    </div>
  );
};

export default function GrowthChartsPage() {
  const [selectedPatient, setSelectedPatient] = useState(patients[0]);
  const [chartType, setChartType] = useState('weight');
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [measurements, setMeasurements] = useState(growthData['NB-2024-0892'].measurements);
  const [newMeasurement, setNewMeasurement] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    length: '',
    hc: ''
  });

  const baseData = growthData[selectedPatient.id] || growthData['NB-2024-0892'];
  const data = { ...baseData, measurements };

  const handleSaveMeasurement = () => {
    if (newMeasurement.weight && newMeasurement.length && newMeasurement.hc) {
      const lastMeasurement = measurements[measurements.length - 1];
      const newDay = lastMeasurement ? lastMeasurement.day + 1 : 0;
      const gaWeeks = parseInt(selectedPatient.ga.split('+')[0]);
      const gaDays = parseInt(selectedPatient.ga.split('+')[1]);
      const pcaWeeks = gaWeeks + Math.floor((gaDays + newDay) / 7);
      const pcaDays = (gaDays + newDay) % 7;

      const measurement = {
        date: newMeasurement.date,
        day: newDay,
        weight: parseInt(newMeasurement.weight),
        length: parseFloat(newMeasurement.length),
        hc: parseFloat(newMeasurement.hc),
        pca: `${pcaWeeks}+${pcaDays}`
      };

      setMeasurements([...measurements, measurement]);
      setNewMeasurement({ date: new Date().toISOString().split('T')[0], weight: '', length: '', hc: '' });
      setShowAddMeasurement(false);
    }
  };

  const chartTypes = [
    { id: 'weight', label: 'Weight', unit: 'g', color: 'cyan' },
    { id: 'length', label: 'Length', unit: 'cm', color: 'green' },
    { id: 'hc', label: 'Head Circ.', unit: 'cm', color: 'purple' },
  ];

  const getPercentileColor = (p) => {
    if (p < 10) return 'text-red-400';
    if (p < 25) return 'text-yellow-400';
    if (p <= 75) return 'text-green-400';
    if (p <= 90) return 'text-yellow-400';
    return 'text-red-400';
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
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30"
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
            <div className="space-y-2">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedPatient.id === patient.id
                      ? 'bg-cyan-500/20 border border-cyan-500/50'
                      : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  <div className="font-medium text-white text-sm">{patient.name}</div>
                  <div className="text-xs text-slate-400">GA: {patient.ga} • {patient.currentWeight}g</div>
                </button>
              ))}
            </div>

            {/* Current Stats */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Current Percentiles</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Weight</span>
                  <span className={`text-sm font-medium ${getPercentileColor(data.percentiles.weight)}`}>
                    {data.percentiles.weight}th %ile
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Length</span>
                  <span className={`text-sm font-medium ${getPercentileColor(data.percentiles.length)}`}>
                    {data.percentiles.length}th %ile
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Head Circ.</span>
                  <span className={`text-sm font-medium ${getPercentileColor(data.percentiles.hc)}`}>
                    {data.percentiles.hc}th %ile
                  </span>
                </div>
              </div>
            </div>

            {/* Growth Velocity */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Growth Velocity</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Weight</span>
                  <span className="text-sm font-medium text-green-400">{data.velocities.weight} g/kg/day</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Length</span>
                  <span className="text-sm font-medium text-green-400">{data.velocities.length} cm/wk</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Head Circ.</span>
                  <span className="text-sm font-medium text-green-400">{data.velocities.hc} cm/wk</span>
                </div>
              </div>
            </div>
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
            <FentonChart
              chartType={chartType}
              measurements={data.measurements}
              selectedPatient={selectedPatient}
              fentonPercentiles={fentonPercentiles}
            />

            {/* Measurements Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold text-white">Measurement History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                      <th className="p-3">Date</th>
                      <th className="p-3">DOL</th>
                      <th className="p-3">PCA</th>
                      <th className="p-3">Weight (g)</th>
                      <th className="p-3">Δ Weight</th>
                      <th className="p-3">Length (cm)</th>
                      <th className="p-3">HC (cm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.measurements.map((m, i) => (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="p-3 text-sm text-white">{m.date}</td>
                        <td className="p-3 text-sm text-slate-300">{m.day}</td>
                        <td className="p-3 text-sm text-slate-300">{m.pca}</td>
                        <td className="p-3 text-sm text-cyan-400 font-medium">{m.weight}</td>
                        <td className="p-3 text-sm">
                          {i > 0 && (
                            <span className={m.weight > data.measurements[i-1].weight ? 'text-green-400' : 'text-red-400'}>
                              {m.weight > data.measurements[i-1].weight ? '+' : ''}
                              {m.weight - data.measurements[i-1].weight}g
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-slate-300">{m.length}</td>
                        <td className="p-3 text-sm text-slate-300">{m.hc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Add Measurement Modal */}
        {showAddMeasurement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Add Measurement</h3>
              <div className="space-y-4">
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
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowAddMeasurement(false)}
                    className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveMeasurement}
                    className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
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
