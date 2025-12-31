'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { initialPatients, COLORS } from '@/lib/data';

// Real-time update interval in milliseconds
const REALTIME_INTERVAL = 2000;

// Large trend chart component (IEC 60601-2-49 compliant)
// Medical trend display standards: proper scaling, alarm limits, time axis
const LargeTrendChart = ({ data, color, label, unit, limits, height = 200 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const padding = { top: 25, right: 65, bottom: 35, left: 55 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Clear with medical-grade dark background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    // Draw chart border (medical standard - visible chart boundary)
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, chartW, chartH);
    
    // Find min/max
    const values = data.map(d => d.value);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const min = limits ? Math.min(limits[0] - 5, dataMin - 5) : dataMin - 5;
    const max = limits ? Math.max(limits[1] + 5, dataMax + 5) : dataMax + 5;
    const range = max - min;
    
    // Draw grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (i / ySteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      
      // Y-axis labels
      const value = max - (i / ySteps) * range;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(0), padding.left - 8, y + 4);
    }
    
    // Time labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const timeSteps = 6;
    for (let i = 0; i <= timeSteps; i++) {
      const x = padding.left + (i / timeSteps) * chartW;
      const dataIdx = Math.floor((i / timeSteps) * (data.length - 1));
      const time = new Date(data[dataIdx]?.time || Date.now());
      ctx.fillText(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), x, h - 8);
    }
    
    // Draw limit lines
    if (limits) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      
      // High limit
      const highY = padding.top + ((max - limits[1]) / range) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, highY);
      ctx.lineTo(w - padding.right, highY);
      ctx.stroke();
      
      // Low limit  
      const lowY = padding.top + ((max - limits[0]) / range) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, lowY);
      ctx.lineTo(w - padding.right, lowY);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // Limit labels
      ctx.fillStyle = '#ef4444';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`▲ ${limits[1]}`, w - padding.right + 5, highY + 4);
      ctx.fillText(`▼ ${limits[0]}`, w - padding.right + 5, lowY + 4);
    }
    
    // Draw data line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + ((max - point.value) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Fill under curve
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = color + '10';
    ctx.fill();
    
    // Current value
    const lastValue = data[data.length - 1]?.value;
    const lastY = padding.top + ((max - lastValue) / range) * chartH;
    
    // Dot at end
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(padding.left + chartW, lastY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Current value label
    ctx.fillStyle = color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${lastValue?.toFixed(1)} ${unit}`, w - padding.right + 5, lastY + 5);
    
  }, [data, color, limits, unit]);
  
  return (
    <div className="relative">
      <div className="absolute top-2 left-2 text-sm font-bold" style={{ color }}>{label}</div>
      <canvas ref={canvasRef} width={800} height={height} className="w-full" />
    </div>
  );
};

function TrendsContent() {
  const searchParams = useSearchParams();
  const patientIdFromUrl = searchParams.get('patient');
  const initialPatient = patientIdFromUrl
    ? initialPatients.find(p => p.id === parseInt(patientIdFromUrl)) || initialPatients[0]
    : initialPatients[0];

  const [selectedPatient, setSelectedPatient] = useState(initialPatient);
  const [timeRange, setTimeRange] = useState('1h');
  const [trendData, setTrendData] = useState({});
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  const lastValuesRef = useRef({ spo2: null, pr: null, rr: null, temp: null });

  const handleExportData = () => {
    // Prepare CSV data
    const headers = ['Time', 'SpO2 (%)', 'Pulse Rate (bpm)', 'Respiratory Rate (/min)', 'Temperature (°C)'];
    const rows = [];

    const spo2Data = trendData.spo2 || [];
    const prData = trendData.pr || [];
    const rrData = trendData.rr || [];
    const tempData = trendData.temp || [];

    const maxLength = Math.max(spo2Data.length, prData.length, rrData.length, tempData.length);

    for (let i = 0; i < maxLength; i++) {
      rows.push([
        spo2Data[i]?.time || '',
        spo2Data[i]?.value || '',
        prData[i]?.value || '',
        rrData[i]?.value || '',
        tempData[i]?.value || ''
      ].join(','));
    }

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trends_${selectedPatient.bed}_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate a new real-time data point with realistic variation
  const generateNewPoint = useCallback((type, base, variance, limits, lastValue) => {
    let current = lastValue ?? base;

    // Random walk with mean reversion
    const drift = (base - current) * 0.05;
    current += drift + (Math.random() - 0.5) * variance * 0.5;

    // Occasionally spike for critical/warning patients
    if (Math.random() < 0.03 && selectedPatient.status !== 'normal') {
      current = limits ? (Math.random() > 0.5 ? limits[1] + 2 : limits[0] - 2) : current + variance;
    }

    // Clamp to reasonable ranges
    if (type === 'spo2') current = Math.max(70, Math.min(100, current));
    if (type === 'pr') current = Math.max(60, Math.min(220, current));
    if (type === 'rr') current = Math.max(10, Math.min(100, current));
    if (type === 'temp') current = Math.max(35, Math.min(40, current));

    return {
      time: new Date().toISOString(),
      value: Math.round(current * 10) / 10,
    };
  }, [selectedPatient.status]);

  // Sync selectedPatient with URL parameter
  useEffect(() => {
    if (patientIdFromUrl) {
      const patient = initialPatients.find(p => p.id === parseInt(patientIdFromUrl));
      if (patient) setSelectedPatient(patient);
    }
  }, [patientIdFromUrl]);

  // Generate initial trend data
  useEffect(() => {
    const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 72;
    const points = hours * 30; // More granular for real-time feel

    const generateTrend = (base, variance, limits) => {
      const data = [];
      let current = base;

      for (let i = 0; i < points; i++) {
        const drift = (base - current) * 0.1;
        current += drift + (Math.random() - 0.5) * variance;

        if (Math.random() < 0.02 && selectedPatient.status !== 'normal') {
          current = limits ? (Math.random() > 0.5 ? limits[1] + 3 : limits[0] - 3) : current + variance * 2;
        }

        data.push({
          time: new Date(Date.now() - (points - i) * (hours * 60 * 1000 / points)).toISOString(),
          value: Math.round(current * 10) / 10,
        });
      }
      return { data, lastValue: current };
    };

    const spo2Result = generateTrend(selectedPatient.baseSPO2, 2, selectedPatient.limits.spo2);
    const prResult = generateTrend(selectedPatient.basePR, 5, selectedPatient.limits.pr);
    const rrResult = generateTrend(selectedPatient.baseRR, 3, selectedPatient.limits.rr);
    const tempResult = generateTrend(selectedPatient.baseTemp, 0.2, [36.0, 38.0]);

    lastValuesRef.current = {
      spo2: spo2Result.lastValue,
      pr: prResult.lastValue,
      rr: rrResult.lastValue,
      temp: tempResult.lastValue,
    };

    setTrendData({
      spo2: spo2Result.data,
      pr: prResult.data,
      rr: rrResult.data,
      temp: tempResult.data,
    });
    setUpdateCount(0);
  }, [selectedPatient, timeRange]);

  // Real-time update effect
  useEffect(() => {
    if (!isLive) return;

    setLastUpdate(new Date()); // Set initial time on client only

    const interval = setInterval(() => {
      const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 72;
      const maxPoints = hours * 30;

      setTrendData(prev => {
        const newSpo2Point = generateNewPoint('spo2', selectedPatient.baseSPO2, 2, selectedPatient.limits.spo2, lastValuesRef.current.spo2);
        const newPrPoint = generateNewPoint('pr', selectedPatient.basePR, 5, selectedPatient.limits.pr, lastValuesRef.current.pr);
        const newRrPoint = generateNewPoint('rr', selectedPatient.baseRR, 3, selectedPatient.limits.rr, lastValuesRef.current.rr);
        const newTempPoint = generateNewPoint('temp', selectedPatient.baseTemp, 0.2, [36.0, 38.0], lastValuesRef.current.temp);

        lastValuesRef.current = {
          spo2: newSpo2Point.value,
          pr: newPrPoint.value,
          rr: newRrPoint.value,
          temp: newTempPoint.value,
        };

        return {
          spo2: [...(prev.spo2 || []).slice(-maxPoints + 1), newSpo2Point],
          pr: [...(prev.pr || []).slice(-maxPoints + 1), newPrPoint],
          rr: [...(prev.rr || []).slice(-maxPoints + 1), newRrPoint],
          temp: [...(prev.temp || []).slice(-maxPoints + 1), newTempPoint],
        };
      });

      setLastUpdate(new Date());
      setUpdateCount(c => c + 1);
    }, REALTIME_INTERVAL);

    return () => clearInterval(interval);
  }, [isLive, timeRange, selectedPatient, generateNewPoint]);
  
  // Calculate stats
  const calcStats = (data) => {
    if (!data || !data.length) return { min: 0, max: 0, avg: 0 };
    const values = data.map(d => d.value);
    return {
      min: Math.min(...values).toFixed(1),
      max: Math.max(...values).toFixed(1),
      avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
    };
  };
  
  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Trend Analysis</h1>
              {/* Live Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                isLive
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-slate-700 text-slate-400 border border-slate-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
                {isLive ? 'LIVE' : 'PAUSED'}
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {isLive ? (
                <>Real-time vital signs • Updated {lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'} • {updateCount} updates</>
              ) : (
                'Paused - Click Play to resume real-time updates'
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Live/Pause Toggle */}
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isLive
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50'
              }`}
            >
              {isLive ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play
                </>
              )}
            </button>

            {/* Patient Selector */}
            <select
              value={selectedPatient.id}
              onChange={(e) => setSelectedPatient(initialPatients.find(p => p.id === parseInt(e.target.value)))}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              {initialPatients.map(p => (
                <option key={p.id} value={p.id}>BED {p.bed} - {p.name}</option>
              ))}
            </select>

            {/* Time Range */}
            <div className="flex items-center bg-slate-800 rounded-lg p-1">
              {['1h', '6h', '24h', '72h'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportData}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Export Data
            </button>

            <Link
              href={`/patient/${selectedPatient.id}`}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
            >
              View Patient
            </Link>
          </div>
        </div>
        
        {/* Patient Info Bar */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-slate-500">BED</div>
                <div className="font-mono font-bold text-xl text-white">{selectedPatient.bed}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">PATIENT</div>
                <div className="font-medium text-white">{selectedPatient.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">MRN</div>
                <div className="text-slate-300">{selectedPatient.mrn}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">GA</div>
                <div className="text-slate-300">{selectedPatient.ga}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">DOL</div>
                <div className="text-slate-300">Day {selectedPatient.dol}</div>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              selectedPatient.status === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
              selectedPatient.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' :
              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
            }`}>
              {selectedPatient.status.toUpperCase()}
            </div>
          </div>
        </div>
        
        {/* Trend Charts */}
        <div className="space-y-4">
          {/* SpO2 Chart */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-cyan-400">SpO₂</span>
                  {isLive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                </div>
                <div className={`text-2xl font-mono font-bold transition-all ${
                  trendData.spo2?.length && trendData.spo2[trendData.spo2.length - 1]?.value < selectedPatient.limits.spo2[0]
                    ? 'text-red-400'
                    : 'text-cyan-400'
                }`}>
                  {trendData.spo2?.length ? trendData.spo2[trendData.spo2.length - 1]?.value : '--'}%
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500">Min: <span className="text-white font-mono">{calcStats(trendData.spo2).min}%</span></span>
                  <span className="text-slate-500">Max: <span className="text-white font-mono">{calcStats(trendData.spo2).max}%</span></span>
                  <span className="text-slate-500">Avg: <span className="text-white font-mono">{calcStats(trendData.spo2).avg}%</span></span>
                </div>
              </div>
              <span className="text-xs text-slate-500">Limits: {selectedPatient.limits.spo2[0]}-{selectedPatient.limits.spo2[1]}%</span>
            </div>
            <div className="p-2">
              <LargeTrendChart 
                data={trendData.spo2 || []} 
                color="#00FFFF" 
                label="SpO₂" 
                unit="%" 
                limits={selectedPatient.limits.spo2}
              />
            </div>
          </div>
          
          {/* PR Chart */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-green-400">Pulse Rate</span>
                  {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                </div>
                <div className={`text-2xl font-mono font-bold transition-all ${
                  trendData.pr?.length && (trendData.pr[trendData.pr.length - 1]?.value < selectedPatient.limits.pr[0] ||
                  trendData.pr[trendData.pr.length - 1]?.value > selectedPatient.limits.pr[1])
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}>
                  {trendData.pr?.length ? trendData.pr[trendData.pr.length - 1]?.value : '--'} bpm
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500">Min: <span className="text-white font-mono">{calcStats(trendData.pr).min} bpm</span></span>
                  <span className="text-slate-500">Max: <span className="text-white font-mono">{calcStats(trendData.pr).max} bpm</span></span>
                  <span className="text-slate-500">Avg: <span className="text-white font-mono">{calcStats(trendData.pr).avg} bpm</span></span>
                </div>
              </div>
              <span className="text-xs text-slate-500">Limits: {selectedPatient.limits.pr[0]}-{selectedPatient.limits.pr[1]} bpm</span>
            </div>
            <div className="p-2">
              <LargeTrendChart
                data={trendData.pr || []}
                color="#00FF00" 
                label="PR" 
                unit="bpm" 
                limits={selectedPatient.limits.pr}
              />
            </div>
          </div>
          
          {/* RR & Temp side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-yellow-400">Respiratory Rate</span>
                    {isLive && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
                  </div>
                  <div className="text-xl font-mono font-bold text-yellow-400">
                    {trendData.rr?.length ? trendData.rr[trendData.rr.length - 1]?.value : '--'}/min
                  </div>
                </div>
                <span className="text-xs text-slate-500">{selectedPatient.limits.rr[0]}-{selectedPatient.limits.rr[1]}/min</span>
              </div>
              <div className="p-2">
                <LargeTrendChart
                  data={trendData.rr || []}
                  color="#FFFF00"
                  label="RR"
                  unit="/min"
                  limits={selectedPatient.limits.rr}
                  height={150}
                />
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-pink-400">Temperature</span>
                    {isLive && <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />}
                  </div>
                  <div className={`text-xl font-mono font-bold ${
                    trendData.temp?.length && trendData.temp[trendData.temp.length - 1]?.value > 38.0
                      ? 'text-red-400'
                      : 'text-pink-400'
                  }`}>
                    {trendData.temp?.length ? trendData.temp[trendData.temp.length - 1]?.value : '--'}°C
                  </div>
                </div>
                <span className="text-xs text-slate-500">36.0-38.0°C</span>
              </div>
              <div className="p-2">
                <LargeTrendChart
                  data={trendData.temp || []}
                  color="#FF99FF"
                  label="Temp"
                  unit="°C"
                  limits={[36.0, 38.0]}
                  height={150}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// Wrap in Suspense for useSearchParams
export default function TrendsPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="p-6 flex items-center justify-center h-64">
          <div className="text-slate-400">Loading trends...</div>
        </div>
      </AppShell>
    }>
      <TrendsContent />
    </Suspense>
  );
}
