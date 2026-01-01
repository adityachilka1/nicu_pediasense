'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PatientHeader from '@/components/PatientHeader';
import PatientTabs from '@/components/PatientTabs';
import { initialPatients, generateVitals, COLORS, getStatusColor } from '@/lib/data';
import { useMQTTVitals } from '@/hooks/useMQTTVitals';

// Real-time sweeping trend chart - like real medical monitors
const TrendChart = ({ color, height = 60, baseValue, variance, limits }) => {
  const canvasRef = useRef(null);
  const bufferRef = useRef([]);
  const writeIndexRef = useRef(0);
  const animationRef = useRef(null);
  const lastValueRef = useRef(baseValue);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const padding = 4;

    // Initialize buffer
    bufferRef.current = new Array(w).fill(null);
    writeIndexRef.current = 0;
    lastValueRef.current = baseValue;

    // Calculate Y position for a value
    const getY = (value) => {
      const min = (limits?.[0] || baseValue - variance * 3) - 2;
      const max = (limits?.[1] || baseValue + variance * 3) + 2;
      const range = max - min;
      return padding + (1 - (value - min) / range) * (h - padding * 2);
    };

    // Generate realistic value with random walk
    const generateValue = () => {
      const drift = (baseValue - lastValueRef.current) * 0.08;
      let newValue = lastValueRef.current + drift + (Math.random() - 0.5) * variance * 0.3;

      // Occasional larger variations
      if (Math.random() < 0.02) {
        newValue += (Math.random() - 0.5) * variance * 1.5;
      }

      // Clamp to reasonable range
      const min = limits?.[0] || baseValue - variance * 4;
      const max = limits?.[1] || baseValue + variance * 4;
      newValue = Math.max(min - 5, Math.min(max + 5, newValue));

      lastValueRef.current = newValue;
      return newValue;
    };

    // Draw the grid
    const drawGrid = () => {
      // Background gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, h);
      bgGradient.addColorStop(0, '#0a1015');
      bgGradient.addColorStop(0.5, '#0d1418');
      bgGradient.addColorStop(1, '#0a1015');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, w, h);

      // Minor grid
      ctx.strokeStyle = 'rgba(30, 58, 70, 0.3)';
      ctx.lineWidth = 0.5;
      for (let y = 0; y < h; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = 0; x < w; x += 15) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Major grid
      ctx.strokeStyle = 'rgba(40, 80, 95, 0.5)';
      ctx.lineWidth = 0.5;
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw limit lines if provided
      if (limits) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1;

        const highY = getY(limits[1]);
        const lowY = getY(limits[0]);

        ctx.beginPath();
        ctx.moveTo(0, highY);
        ctx.lineTo(w, highY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, lowY);
        ctx.lineTo(w, lowY);
        ctx.stroke();

        ctx.setLineDash([]);
      }
    };

    // Main render loop
    const render = () => {
      // Generate new value and store Y position
      const value = generateValue();
      const yPos = getY(value);
      bufferRef.current[writeIndexRef.current] = yPos;

      // Redraw everything
      drawGrid();

      // Draw the waveform with glow effect
      const gapSize = 6;
      const gapStart = writeIndexRef.current;
      const gapEnd = (writeIndexRef.current + gapSize) % w;

      // Create gradient for fill
      const fillGradient = ctx.createLinearGradient(0, 0, 0, h);
      fillGradient.addColorStop(0, color + '30');
      fillGradient.addColorStop(0.5, color + '15');
      fillGradient.addColorStop(1, color + '05');

      // Draw filled area
      ctx.beginPath();
      let started = false;
      let firstX = 0, firstY = h;

      for (let i = 0; i < w; i++) {
        const idx = (gapEnd + i) % w;
        if (bufferRef.current[idx] === null) continue;

        let inGap = false;
        if (gapStart < gapEnd) {
          inGap = idx >= gapStart && idx < gapEnd;
        } else {
          inGap = idx >= gapStart || idx < gapEnd;
        }
        if (inGap) continue;

        if (!started) {
          firstX = idx;
          firstY = bufferRef.current[idx];
          ctx.moveTo(idx, bufferRef.current[idx]);
          started = true;
        } else {
          ctx.lineTo(idx, bufferRef.current[idx]);
        }
      }

      if (started) {
        // Complete the fill path
        ctx.lineTo(writeIndexRef.current > 0 ? writeIndexRef.current - 1 : w - 1, h);
        ctx.lineTo(firstX, h);
        ctx.closePath();
        ctx.fillStyle = fillGradient;
        ctx.fill();
      }

      // Draw outer glow
      ctx.strokeStyle = color + '30';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      started = false;

      for (let i = 0; i < w; i++) {
        const idx = (gapEnd + i) % w;
        if (bufferRef.current[idx] === null) continue;

        let inGap = false;
        if (gapStart < gapEnd) {
          inGap = idx >= gapStart && idx < gapEnd;
        } else {
          inGap = idx >= gapStart || idx < gapEnd;
        }
        if (inGap) {
          started = false;
          continue;
        }

        if (!started) {
          ctx.moveTo(idx, bufferRef.current[idx]);
          started = true;
        } else {
          ctx.lineTo(idx, bufferRef.current[idx]);
        }
      }
      ctx.stroke();

      // Draw main line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      started = false;

      for (let i = 0; i < w; i++) {
        const idx = (gapEnd + i) % w;
        if (bufferRef.current[idx] === null) continue;

        let inGap = false;
        if (gapStart < gapEnd) {
          inGap = idx >= gapStart && idx < gapEnd;
        } else {
          inGap = idx >= gapStart || idx < gapEnd;
        }
        if (inGap) {
          started = false;
          continue;
        }

        if (!started) {
          ctx.moveTo(idx, bufferRef.current[idx]);
          started = true;
        } else {
          ctx.lineTo(idx, bufferRef.current[idx]);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw sweep cursor
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(writeIndexRef.current, 0, 2, h);
      ctx.globalAlpha = 1;

      // Draw current value dot
      const currentY = bufferRef.current[writeIndexRef.current > 0 ? writeIndexRef.current - 1 : w - 1];
      if (currentY !== null) {
        const dotX = writeIndexRef.current > 0 ? writeIndexRef.current - 1 : w - 1;

        // Outer glow
        ctx.beginPath();
        ctx.arc(dotX, currentY, 5, 0, Math.PI * 2);
        ctx.fillStyle = color + '40';
        ctx.fill();

        // Inner dot
        ctx.beginPath();
        ctx.arc(dotX, currentY, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // White center
        ctx.beginPath();
        ctx.arc(dotX, currentY, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // Advance write position
      writeIndexRef.current = (writeIndexRef.current + 1) % w;

      // Schedule next frame (slower for trend, ~30fps equivalent feel)
      animationRef.current = setTimeout(() => {
        requestAnimationFrame(render);
      }, 33);
    };

    // Start rendering
    drawGrid();
    animationRef.current = setTimeout(() => {
      requestAnimationFrame(render);
    }, 100);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [color, baseValue, variance, limits]);

  return <canvas ref={canvasRef} width={300} height={height} className="w-full h-full rounded" />;
};

// Pleth waveform component
const PlethWaveform = ({ color }) => {
  const canvasRef = useRef(null);
  const bufferRef = useRef([]);
  const posRef = useRef(0);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    bufferRef.current = new Array(w).fill(null);

    const genSample = (t) => {
      const phase = (t % 55) / 55;
      let amp;
      if (phase < 0.08) amp = Math.pow(phase / 0.08, 0.7) * 0.92;
      else if (phase < 0.15) amp = 0.92 - (phase - 0.08) * 2.2;
      else if (phase < 0.22) amp = 0.77 - Math.sin((phase - 0.15) / 0.07 * Math.PI) * 0.1;
      else if (phase < 0.35) amp = 0.67 + Math.sin((phase - 0.22) / 0.13 * Math.PI) * 0.07;
      else amp = 0.67 * Math.exp(-(phase - 0.35) / 0.65 * 2.5);
      return Math.max(0.02, Math.min(0.98, amp + (Math.random() - 0.5) * 0.012));
    };

    const drawGrid = () => {
      ctx.fillStyle = '#001216';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,70,90,0.35)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(0,90,110,0.5)';
      for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    };

    const render = () => {
      const sample = genSample(posRef.current);
      const yPos = h - (sample * (h - 8) + 4);
      bufferRef.current[posRef.current] = yPos;
      
      drawGrid();
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      
      let started = false;
      const gap = 4;
      
      for (let i = 0; i < w; i++) {
        const idx = (posRef.current + gap + i) % w;
        if (bufferRef.current[idx] === null) continue;
        let inGap = (idx >= posRef.current && idx < posRef.current + gap) || 
                    (posRef.current + gap > w && idx < (posRef.current + gap) % w);
        if (inGap) { started = false; continue; }
        if (!started) { ctx.moveTo(idx, bufferRef.current[idx]); started = true; }
        else ctx.lineTo(idx, bufferRef.current[idx]);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(posRef.current, 0, 2, h);
      ctx.globalAlpha = 1;
      
      posRef.current = (posRef.current + 1) % w;
      animRef.current = requestAnimationFrame(render);
    };
    
    animRef.current = requestAnimationFrame(render);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [color]);

  return <canvas ref={canvasRef} width={500} height={80} className="w-full" />;
};

// MQTT Connection Status Indicator
const MQTTStatusIndicator = ({ status }) => {
  const statusColors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-slate-500',
    reconnecting: 'bg-yellow-500 animate-pulse',
    error: 'bg-red-500',
  };

  const statusLabels = {
    connected: 'MQTT Live',
    connecting: 'Connecting...',
    disconnected: 'Simulated',
    reconnecting: 'Reconnecting...',
    error: 'Connection Error',
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${statusColors[status] || statusColors.disconnected}`} />
      <span className="text-slate-400">{statusLabels[status] || 'Unknown'}</span>
    </div>
  );
};

export default function PatientDetailPage() {
  const params = useParams();
  const patient = initialPatients.find(p => p.id === parseInt(params.id)) || initialPatients[0];
  const [vitals, setVitals] = useState(generateVitals(patient));
  const [trendData, setTrendData] = useState({});
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);
  const [editingLimits, setEditingLimits] = useState({
    spo2: { low: patient.limits.spo2[0], high: patient.limits.spo2[1] },
    pr: { low: patient.limits.pr[0], high: patient.limits.pr[1] },
    rr: { low: patient.limits.rr[0], high: patient.limits.rr[1] },
    temp: { low: 36.0, high: 38.0 },
  });

  // MQTT Vitals Hook - connects to real-time data stream
  const {
    vitals: mqttVitals,
    connectionStatus,
    isConnected: mqttConnected,
    lastUpdate
  } = useMQTTVitals(patient.id, {
    enabled: true,
    onAlarm: (alarm) => {
      console.log('Alarm received:', alarm);
      // Could trigger toast notification here
    },
  });

  // Use MQTT vitals when connected, fall back to simulated
  useEffect(() => {
    if (mqttConnected && mqttVitals.spo2 !== null) {
      setVitals(prev => ({
        ...prev,
        spo2: mqttVitals.spo2 || prev.spo2,
        pr: mqttVitals.heartRate || prev.pr,
        rr: mqttVitals.respiration || prev.rr,
        temp: mqttVitals.temperature || prev.temp,
        fio2: mqttVitals.fio2 || prev.fio2,
        pi: mqttVitals.pi || prev.pi,
      }));

      // Update trend data with MQTT values
      setTrendData(prev => ({
        spo2: [...(prev.spo2 || []).slice(-59), { time: new Date().toISOString(), value: mqttVitals.spo2 }],
        pr: [...(prev.pr || []).slice(-59), { time: new Date().toISOString(), value: mqttVitals.heartRate }],
        rr: [...(prev.rr || []).slice(-59), { time: new Date().toISOString(), value: mqttVitals.respiration }],
        temp: [...(prev.temp || []).slice(-59), { time: new Date().toISOString(), value: mqttVitals.temperature }],
      }));
    }
  }, [mqttVitals, mqttConnected]);

  useEffect(() => {
    // Generate initial trend data
    const generateTrend = (base, variance) => {
      return Array.from({ length: 60 }, (_, i) => ({
        time: new Date(Date.now() - (60 - i) * 2000).toISOString(),
        value: base + (Math.random() - 0.5) * variance * 2,
      }));
    };

    setTrendData({
      spo2: generateTrend(patient.baseSPO2, 3),
      pr: generateTrend(patient.basePR, 8),
      rr: generateTrend(patient.baseRR, 5),
      temp: generateTrend(patient.baseTemp, 0.3),
    });

    // Only use simulated data when MQTT is not connected
    if (!mqttConnected) {
      // Update vitals and trend data in real-time (fallback simulation)
      const interval = setInterval(() => {
        const newVitals = generateVitals(patient);
        setVitals(newVitals);

        // Add new point to each trend, keeping last 60 points
        setTrendData(prev => ({
          spo2: [...(prev.spo2 || []).slice(-59), { time: new Date().toISOString(), value: parseFloat(newVitals.spo2) || patient.baseSPO2 }],
          pr: [...(prev.pr || []).slice(-59), { time: new Date().toISOString(), value: parseFloat(newVitals.pr) || patient.basePR }],
          rr: [...(prev.rr || []).slice(-59), { time: new Date().toISOString(), value: parseFloat(newVitals.rr) || patient.baseRR }],
          temp: [...(prev.temp || []).slice(-59), { time: new Date().toISOString(), value: parseFloat(newVitals.temp) || patient.baseTemp }],
        }));
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [patient, mqttConnected]);
  
  return (
    <AppShell>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <PatientHeader patient={patient} />
          <MQTTStatusIndicator status={connectionStatus} />
        </div>
        <PatientTabs patientId={patient.id} />
        
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column - Main Vitals */}
          <div className="col-span-8 space-y-4">
            {/* SpO2 with Pleth */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-black/30 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-cyan-400">SpO₂</span>
                  <span className="text-xs text-slate-500">SpO₂-1</span>
                </div>
                <button 
                  onClick={() => setShowThresholdEditor(true)}
                  className="flex items-center gap-1 text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/30 px-2 py-1 rounded transition-colors"
                  title="Edit alarm thresholds"
                >
                  <span>▼{patient.limits.spo2[0]}</span>
                  <span className="text-slate-600">-</span>
                  <span>▲{patient.limits.spo2[1]}</span>
                  <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono font-bold text-7xl text-cyan-400" style={{ textShadow: '0 0 20px rgba(0,255,255,0.3)' }}>{vitals.spo2}</span>
                    <span className="text-xl text-slate-500">%</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">PI</div>
                    <div className="font-mono font-bold text-2xl text-cyan-400">{vitals.pi}</div>
                  </div>
                </div>
                <div className="bg-slate-950 rounded-lg overflow-hidden">
                  <PlethWaveform color="#00FFFF" />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-600">
                  <span>PLETH</span>
                  <span>25mm/s</span>
                </div>
              </div>
            </div>
            
            {/* Other Vitals Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* PR */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-black/30 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-cyan-400">PR</span>
                    <span className="text-xs text-slate-500">SpO₂-1</span>
                  </div>
                  <span className="text-xs font-mono text-cyan-400">▼{patient.limits.pr[0]} ▲{patient.limits.pr[1]}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-mono font-bold text-5xl text-cyan-400">{vitals.pr}</span>
                    <span className="text-lg text-slate-500">bpm</span>
                  </div>
                  <div className="h-16">
                    <TrendChart
                      color="#00FFFF"
                      baseValue={patient.basePR}
                      variance={8}
                      limits={patient.limits.pr}
                    />
                  </div>
                </div>
              </div>

              {/* RR */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-black/30 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-yellow-400">RR</span>
                    <span className="text-xs text-slate-500">RESP</span>
                  </div>
                  <span className="text-xs font-mono text-yellow-400">▼{patient.limits.rr[0]} ▲{patient.limits.rr[1]}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-mono font-bold text-5xl text-yellow-400">{vitals.rr}</span>
                    <span className="text-lg text-slate-500">/min</span>
                  </div>
                  <div className="h-16">
                    <TrendChart
                      color="#FFFF00"
                      baseValue={patient.baseRR}
                      variance={5}
                      limits={patient.limits.rr}
                    />
                  </div>
                </div>
              </div>

              {/* Temp */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-black/30 border-b border-slate-800">
                  <span className="text-sm font-bold text-pink-400">TEMP</span>
                  <span className="text-xs font-mono text-pink-400">▼36.0 ▲38.0</span>
                </div>
                <div className="p-4">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-mono font-bold text-5xl text-pink-400">{vitals.temp}</span>
                    <span className="text-lg text-slate-500">°C</span>
                  </div>
                  <div className="h-16">
                    <TrendChart
                      color="#FF99FF"
                      baseValue={patient.baseTemp}
                      variance={0.3}
                      limits={[36.0, 38.0]}
                    />
                  </div>
                </div>
              </div>
              
              {/* FiO2 */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-black/30 border-b border-slate-800">
                  <span className="text-sm font-bold text-white">FiO₂</span>
                  <span className="text-xs text-slate-500">O₂ Delivery</span>
                </div>
                <div className="p-4">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-mono font-bold text-5xl text-white">{vitals.fio2}</span>
                    <span className="text-lg text-slate-500">%</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    <div>{patient.ventilation}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* A/B Events */}
            {(patient.apnea > 0 || patient.brady > 0) && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-xs text-yellow-400 mb-1">APNEA EVENTS</div>
                      <div className="font-mono font-bold text-3xl text-yellow-400">{patient.apnea}</div>
                    </div>
                    <div className="w-px h-12 bg-yellow-500/30" />
                    <div>
                      <div className="text-xs text-yellow-400 mb-1">BRADY EVENTS</div>
                      <div className="font-mono font-bold text-3xl text-yellow-400">{patient.brady}</div>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors">
                    Reset Counters
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Right Column - Patient Info */}
          <div className="col-span-4 space-y-4">
            {/* Demographics */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">DEMOGRAPHICS</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">GA:</span><span className="text-white font-medium">{patient.ga} weeks</span></div>
                <div className="flex justify-between"><span className="text-slate-500">DOL:</span><span className="text-white font-medium">Day {patient.dol}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Birth Weight:</span><span className="text-white font-medium">{patient.birthWeight} kg</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Current Weight:</span><span className="text-white font-medium">{patient.weight} kg</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Gender:</span><span className="text-white font-medium">{patient.gender === 'M' ? 'Male' : 'Female'}</span></div>
              </div>
            </div>
            
            {/* Care Team */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">CARE TEAM</h3>
              <div className="space-y-2 text-sm">
                <div><span className="text-slate-500">Attending:</span><div className="text-white">{patient.attendingPhysician}</div></div>
                <div><span className="text-slate-500">Primary Nurse:</span><div className="text-white">{patient.primaryNurse}</div></div>
              </div>
            </div>
            
            {/* Diagnoses */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">DIAGNOSES</h3>
              <div className="flex flex-wrap gap-2">
                {patient.diagnosis.map((d, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">{d}</span>
                ))}
              </div>
            </div>
            
            {/* Feeding */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">FEEDING</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Type:</span><span className="text-white font-medium">{patient.feedingType}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Volume:</span><span className="text-white font-medium">{patient.feedingVolume} mL</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Frequency:</span><span className="text-white font-medium">{patient.feedingFrequency}</span></div>
              </div>
            </div>
            
            {/* Access */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">IV ACCESS</h3>
              <p className="text-sm text-white">{patient.ivAccess}</p>
            </div>
            
            {/* Notes */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">NOTES</h3>
              <p className="text-sm text-slate-300">{patient.notes}</p>
            </div>
          </div>
        </div>
        
        {/* Threshold Editor Modal */}
        {showThresholdEditor && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg mx-4 shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">Alarm Thresholds</h2>
                <button 
                  onClick={() => setShowThresholdEditor(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="text-sm text-slate-400 mb-4">
                  Set alarm limits for <span className="text-white font-medium">{patient.name}</span> (BED {patient.bed})
                </div>
                
                {/* SpO2 Limits */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-500" />
                    <span className="text-sm font-medium text-white">SpO₂ (%)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Low Limit</label>
                      <input
                        type="number"
                        value={editingLimits.spo2.low}
                        onChange={(e) => setEditingLimits(prev => ({
                          ...prev, spo2: { ...prev.spo2, low: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">High Limit</label>
                      <input
                        type="number"
                        value={editingLimits.spo2.high}
                        onChange={(e) => setEditingLimits(prev => ({
                          ...prev, spo2: { ...prev.spo2, high: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
                
                {/* PR Limits */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-500" />
                    <span className="text-sm font-medium text-white">Pulse Rate (bpm)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Low Limit</label>
                      <input
                        type="number"
                        value={editingLimits.pr.low}
                        onChange={(e) => setEditingLimits(prev => ({
                          ...prev, pr: { ...prev.pr, low: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">High Limit</label>
                      <input
                        type="number"
                        value={editingLimits.pr.high}
                        onChange={(e) => setEditingLimits(prev => ({
                          ...prev, pr: { ...prev.pr, high: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
                
                {/* RR Limits */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm font-medium text-white">Respiratory Rate (/min)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Low Limit</label>
                      <input
                        type="number"
                        value={editingLimits.rr.low}
                        onChange={(e) => setEditingLimits(prev => ({
                          ...prev, rr: { ...prev.rr, low: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">High Limit</label>
                      <input
                        type="number"
                        value={editingLimits.rr.high}
                        onChange={(e) => setEditingLimits(prev => ({
                          ...prev, rr: { ...prev.rr, high: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Temp Limits */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-pink-500" />
                    <span className="text-sm font-medium text-white">Temperature (°C)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Low Limit</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingLimits.temp.low}
                        onChange={(e) => setEditingLimits(prev => ({
                          ...prev, temp: { ...prev.temp, low: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">High Limit</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingLimits.temp.high}
                        onChange={(e) => setEditingLimits(prev => ({
                          ...prev, temp: { ...prev.temp, high: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Preset Templates */}
                <div className="border-t border-slate-800 pt-4">
                  <label className="block text-xs text-slate-500 mb-2">Load Preset Template</label>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => setEditingLimits({
                        spo2: { low: 85, high: 100 }, pr: { low: 100, high: 180 },
                        rr: { low: 25, high: 70 }, temp: { low: 36.0, high: 38.0 }
                      })}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      Preterm (&lt;32w)
                    </button>
                    <button 
                      onClick={() => setEditingLimits({
                        spo2: { low: 88, high: 100 }, pr: { low: 100, high: 180 },
                        rr: { low: 25, high: 60 }, temp: { low: 36.5, high: 37.5 }
                      })}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      Late Preterm (32-37w)
                    </button>
                    <button 
                      onClick={() => setEditingLimits({
                        spo2: { low: 90, high: 100 }, pr: { low: 100, high: 160 },
                        rr: { low: 30, high: 60 }, temp: { low: 36.5, high: 37.5 }
                      })}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      Term
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/50">
                <Link 
                  href="/alarm-limits"
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Advanced Settings →
                </Link>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowThresholdEditor(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      // In a real app, this would save to backend
                      setShowThresholdEditor(false);
                    }}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
                  >
                    Save Thresholds
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
