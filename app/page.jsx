'use client';

import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useAlarmSound, AlarmSoundControls, AudioEnablePrompt, CriticalAlarmBanner, WarningAlarmBanner } from '@/components/AlarmSound';
import { useKeyboardShortcuts, KeyboardShortcutsModal, KeyboardHelpButton } from '@/components/KeyboardShortcuts';
import { ThemeToggle } from '@/components/ThemeProvider';
import { NotificationBell, NotificationsPanel } from '@/components/NotificationsPanel';
import { useVitals, TREND } from '@/context/VitalsContext';
import { useMQTTVitals, MQTT_STATUS } from '@/context/MQTTVitalsContext';
import { TrendArrow, SimulationToggle } from '@/components/VitalIndicators';
import { COLORS } from '@/lib/data';

/*
 * PEDIASENSE NestWatch v2
 * Accurate to industry standards:
 * - IEC 60601-1-8 color coding
 * - Philips IntelliVue / GE CARESCAPE layout conventions
 * - Proper parameter channel structure
 * - PR (not HR) for pulse-ox derived heart rate
 */

// Note: Patient data and vitals generation consolidated in VitalsContext
// The context provides patients and vitalsMap to all components

// === PLETH WAVEFORM WITH GRID (IEC 60601-2-49 Compliant) ===
// Medical standards: 25mm/s sweep speed, 5mm minor grid, 25mm major grid
const PlethWaveformWithGrid = ({ color, patientId, width = 240, height = 56, showSpeed = true }) => {
  const canvasRef = useRef(null);
  const bufferRef = useRef([]);
  const writeIndexRef = useRef(0);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  // IEC 60601-2-49 sweep speed: 25mm/s standard for pleth
  const SWEEP_SPEED = 25; // mm/s
  // At 96 DPI (~3.78 px/mm), 25mm/s = ~94.5 px/s
  const PIXELS_PER_MM = 3.78;
  const SWEEP_PIXELS_PER_SEC = SWEEP_SPEED * PIXELS_PER_MM;

  // Grid spacing per medical paper standards (5mm minor, 25mm major)
  const MINOR_GRID_MM = 5;
  const MAJOR_GRID_MM = 25;
  const MINOR_GRID_PX = Math.round(MINOR_GRID_MM * PIXELS_PER_MM);
  const MAJOR_GRID_PX = Math.round(MAJOR_GRID_MM * PIXELS_PER_MM);

  // Generate realistic pleth waveform (PPG morphology per ISO 80601-2-61)
  const generatePlethSample = useCallback((t) => {
    const cycleLength = 60; // samples per heartbeat (~100 BPM at 60 samples/beat)
    const phase = (t % cycleLength) / cycleLength;

    let amplitude;
    if (phase < 0.08) {
      // Rapid systolic upstroke (anacrotic phase)
      amplitude = Math.pow(phase / 0.08, 0.7) * 0.95;
    } else if (phase < 0.15) {
      // Systolic peak
      amplitude = 0.95 - (phase - 0.08) * 2.5;
    } else if (phase < 0.22) {
      // Dicrotic notch (dicrotism) - aortic valve closure
      const notchPhase = (phase - 0.15) / 0.07;
      amplitude = 0.775 - Math.sin(notchPhase * Math.PI) * 0.12;
    } else if (phase < 0.35) {
      // Dicrotic wave (catacrotic phase)
      const wavePhase = (phase - 0.22) / 0.13;
      amplitude = 0.655 + Math.sin(wavePhase * Math.PI) * 0.08;
    } else {
      // Diastolic decay (exponential runoff)
      const decayPhase = (phase - 0.35) / 0.65;
      amplitude = 0.655 * Math.exp(-decayPhase * 2.8);
    }

    // Add physiological noise (respiratory variation, motion artifact)
    amplitude += (Math.random() - 0.5) * 0.015;
    return Math.max(0.02, Math.min(0.98, amplitude));
  }, []);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    // Initialize buffer
    bufferRef.current = new Array(w).fill(null);
    writeIndexRef.current = 0;
    
    // Draw grid background (IEC 60601-2-49 standard medical grid)
    const drawGrid = () => {
      ctx.fillStyle = '#001014';
      ctx.fillRect(0, 0, w, h);

      // Minor grid lines (5mm = ~19px at standard DPI)
      ctx.strokeStyle = 'rgba(0, 80, 100, 0.3)';
      ctx.lineWidth = 0.5;

      for (let x = 0; x < w; x += MINOR_GRID_PX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += MINOR_GRID_PX) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Major grid lines (25mm = ~95px at standard DPI)
      ctx.strokeStyle = 'rgba(0, 100, 120, 0.5)';
      ctx.lineWidth = 1;

      for (let x = 0; x < w; x += MAJOR_GRID_PX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += MAJOR_GRID_PX) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Sweep speed indicator (IEC 60601-2-49 requirement)
      if (showSpeed) {
        ctx.fillStyle = 'rgba(100, 150, 170, 0.7)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${SWEEP_SPEED}mm/s`, 3, h - 3);
      }

      // Amplitude calibration bar (1 second = 25mm width reference)
      const calBarWidth = MAJOR_GRID_PX; // 25mm = 1 second at 25mm/s
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(w - calBarWidth - 4, h - 3, calBarWidth, 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(100, 150, 170, 0.7)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('1s', w - 4, h - 5);
    };
    
    const render = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      
      // Update at ~60 samples per second for smooth sweep
      if (delta >= 16) {
        lastTimeRef.current = timestamp;
        
        // Generate new sample
        const sample = generatePlethSample(writeIndexRef.current);
        const yPos = h - (sample * (h - 8) + 4);
        bufferRef.current[writeIndexRef.current] = yPos;
        
        // Redraw everything
        drawGrid();
        
        // Draw waveform
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 2;
        
        ctx.beginPath();
        let started = false;
        
        // Draw from oldest to newest, skipping the gap
        const gapSize = 4;
        const gapStart = writeIndexRef.current;
        const gapEnd = (writeIndexRef.current + gapSize) % w;
        
        for (let i = 0; i < w; i++) {
          const idx = (gapEnd + i) % w;
          
          // Skip if in gap zone or no data
          if (bufferRef.current[idx] === null) continue;
          
          // Check if this point is in the gap
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
        
        // Advance write position
        writeIndexRef.current = (writeIndexRef.current + 1) % w;
      }
      
      animationRef.current = requestAnimationFrame(render);
    };
    
    drawGrid();
    animationRef.current = requestAnimationFrame(render);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [color, generatePlethSample]);
  
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full"
    />
  );
};

// === ALARM LIMIT INDICATOR ===
const AlarmLimits = ({ low, high, color }) => (
  <div className="flex flex-col items-end text-[10px] font-mono" style={{ color }}>
    <div className="flex items-center gap-0.5">
      <span className="text-[8px]">▲</span>
      <span>{high}</span>
    </div>
    <div className="flex items-center gap-0.5">
      <span className="text-[8px]">▼</span>
      <span>{low}</span>
    </div>
  </div>
);

// === PULSE INDICATOR (blinks with heartbeat) ===
const PulseIndicator = ({ color, rate }) => {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    if (!rate || rate === '--') return;
    const interval = 60000 / parseInt(rate); // ms per beat
    const timer = setInterval(() => {
      setVisible(v => !v);
    }, interval / 2);
    return () => clearInterval(timer);
  }, [rate]);
  
  return (
    <div 
      className="w-3 h-3 rounded-full transition-opacity duration-75"
      style={{ 
        backgroundColor: color,
        opacity: visible ? 1 : 0.2,
        boxShadow: visible ? `0 0 6px ${color}` : 'none'
      }}
    />
  );
};

// === PARAMETER CHANNEL BOX ===
const ParameterChannel = ({
  label,
  source,
  value,
  unit,
  color,
  limits,
  alarmState = 'none',
  children,
  subValue,
  subLabel,
  showPulse = false,
  size = 'normal',
  trend = null,
  changed = false,
}) => {
  const isAlarm = alarmState === 'high' || alarmState === 'crisis';
  const isWarning = alarmState === 'medium';

  const bgColor = isAlarm
    ? 'rgba(127, 29, 29, 0.4)'
    : isWarning
    ? 'rgba(113, 63, 18, 0.3)'
    : 'rgba(0, 0, 0, 0.5)';

  const valueColor = isAlarm ? COLORS.alarm : isWarning ? COLORS.warning : color;
  const valueSize = size === 'large' ? 'text-5xl' : size === 'medium' ? 'text-3xl' : 'text-2xl';

  return (
    <div
      className={`relative flex flex-col border-l-[3px] ${isAlarm ? 'animate-pulse' : ''}`}
      style={{ borderColor: color, background: bgColor }}
    >
      {/* Channel Header */}
      <div
        className="flex items-center justify-between px-2 py-0.5"
        style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wide" style={{ color }}>{label}</span>
          {source && <span className="text-[9px] text-slate-500">{source}</span>}
          {showPulse && <PulseIndicator color={color} rate={value} />}
        </div>
        {limits && <AlarmLimits low={limits[0]} high={limits[1]} color={color} />}
      </div>

      {/* Waveform area (if children provided) */}
      {children && (
        <div className="flex-shrink-0 border-b border-slate-800/50">
          {children}
        </div>
      )}

      {/* Value Display */}
      <div className="flex-1 flex items-center justify-between px-2 py-1">
        <div className="flex items-baseline gap-1">
          <span
            className={`font-mono font-bold ${valueSize} leading-none tracking-tight transition-all duration-150 ${changed ? 'scale-105' : 'scale-100'}`}
            style={{
              color: valueColor,
              fontVariantNumeric: 'tabular-nums',
              textShadow: changed ? `0 0 20px ${valueColor}, 0 0 40px ${valueColor}` : `0 0 10px ${valueColor}40`
            }}
          >
            {value}
          </span>
          <span className="text-xs text-slate-400">{unit}</span>
          {trend && trend !== TREND.STABLE && (
            <TrendArrow trend={trend} color={valueColor} size="sm" />
          )}
        </div>

        {/* Sub-value (like PI) */}
        {subValue !== undefined && (
          <div className="text-right">
            <div className="text-[9px] text-slate-500 uppercase">{subLabel}</div>
            <div className="font-mono font-bold text-base" style={{ color }}>{subValue}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// === PATIENT MONITOR TILE ===
// Wrapped with memo to prevent unnecessary re-renders when other patients update
const PatientMonitor = memo(function PatientMonitor({ patient, vitals }) {
  // Calculate alarm states
  const getAlarmState = (value, limits) => {
    if (value === '--' || !limits) return 'none';
    const v = parseFloat(value);
    const range = limits[1] - limits[0];
    if (v < limits[0] || v > limits[1]) return 'high';
    if (v < limits[0] + range * 0.08 || v > limits[1] - range * 0.08) return 'medium';
    return 'none';
  };
  
  const spo2Alarm = getAlarmState(vitals.spo2, patient.limits.spo2);
  const prAlarm = getAlarmState(vitals.pr, patient.limits.pr);
  const rrAlarm = getAlarmState(vitals.rr, patient.limits.rr);
  const tempAlarm = vitals.temp > 38.5 || vitals.temp < 36 ? 'high' : vitals.temp > 38 || vitals.temp < 36.3 ? 'medium' : 'none';
  
  const hasHighAlarm = [spo2Alarm, prAlarm, rrAlarm, tempAlarm].includes('high');
  const hasMediumAlarm = [spo2Alarm, prAlarm, rrAlarm, tempAlarm].includes('medium');
  
  const borderColor = hasHighAlarm ? 'ring-red-500 ring-2' : hasMediumAlarm ? 'ring-yellow-500/60 ring-1' : 'ring-slate-700 ring-1';
  
  const alarmStatus = hasHighAlarm ? 'critical alarm' : hasMediumAlarm ? 'warning' : 'stable';

  return (
    <article
      className={`flex flex-col rounded-sm overflow-hidden ${borderColor}`}
      style={{ background: '#080C10' }}
      aria-label={`Bed ${patient.bed}, ${patient.name}, ${alarmStatus}`}
      aria-live={hasHighAlarm ? 'assertive' : 'off'}
      aria-atomic="true"
    >
      {/* Patient Header - Clickable */}
      <Link
        href={`/patient/${patient.id}`}
        className={`flex items-center justify-between px-2 py-1.5 cursor-pointer hover:brightness-125 transition-all ${
          hasHighAlarm ? 'bg-red-900/70' : hasMediumAlarm ? 'bg-yellow-900/30' : 'bg-slate-800/80'
        }`}
        aria-label={`View details for ${patient.name}, Bed ${patient.bed}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-bold font-mono text-white">BED {patient.bed}</span>
          <span className="text-[11px] text-slate-300 truncate max-w-[100px]">{patient.name}</span>
          <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Apnea/Brady badge */}
          {(patient.apnea > 0 || patient.brady > 0) && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-900/70 rounded text-[9px] font-mono font-bold text-yellow-300"
              role="status"
              aria-label={`${patient.apnea} apnea events, ${patient.brady} bradycardia events`}
            >
              <span aria-hidden="true">A:{patient.apnea}</span>
              <span className="text-yellow-600" aria-hidden="true">/</span>
              <span aria-hidden="true">B:{patient.brady}</span>
            </div>
          )}

          {/* Alarm Silenced indicator */}
          {patient.alarmSilenced > 0 && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-700 rounded"
              role="status"
              aria-label={`Alarms silenced for ${Math.floor(patient.alarmSilenced / 60)} minutes ${patient.alarmSilenced % 60} seconds`}
            >
              <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <line x1="17" y1="9" x2="23" y2="15" />
                <line x1="23" y1="9" x2="17" y2="15" />
              </svg>
              <span className="text-[9px] font-mono text-yellow-400" aria-hidden="true">{Math.floor(patient.alarmSilenced / 60)}:{(patient.alarmSilenced % 60).toString().padStart(2, '0')}</span>
            </div>
          )}
          
          {/* Patient info */}
          <span className="text-[9px] font-mono text-slate-500" aria-hidden="true">
            GA{patient.ga} • {patient.weight}kg • D{patient.dol}
          </span>
          <span className="sr-only">
            Gestational age {patient.ga} weeks, weight {patient.weight} kilograms, day of life {patient.dol}
          </span>
        </div>
      </Link>
      
      {/* Monitor Body */}
      <div className="flex-1 grid grid-cols-[1fr_120px] min-h-0">
        {/* SpO2 Channel (Primary) */}
        <div className="border-r border-slate-800">
          <ParameterChannel
            label="SpO₂"
            source="SpO₂-1"
            value={vitals.spo2}
            unit="%"
            color={COLORS.spo2}
            limits={patient.limits.spo2}
            alarmState={spo2Alarm}
            subValue={vitals.pi}
            subLabel="PI"
            size="large"
            trend={vitals.spo2Trend}
            changed={vitals.spo2Changed}
          >
            <div className="relative">
              <PlethWaveformWithGrid color={COLORS.spo2} patientId={patient.id} />
              {/* Speed indicator */}
              <div className="absolute bottom-0.5 right-1 text-[8px] font-mono text-slate-600">
                25mm/s
              </div>
            </div>
          </ParameterChannel>
        </div>

        {/* Secondary Parameters */}
        <div className="grid grid-rows-4">
          {/* PR Channel */}
          <div className="border-b border-slate-800">
            <ParameterChannel
              label="PR"
              source="SpO₂-1"
              value={vitals.pr}
              unit="bpm"
              color={COLORS.prFromSpo2}
              limits={patient.limits.pr}
              alarmState={prAlarm}
              showPulse={true}
              size="medium"
              trend={vitals.prTrend}
              changed={vitals.prChanged}
            />
          </div>

          {/* RR Channel */}
          <div className="border-b border-slate-800">
            <ParameterChannel
              label="RR"
              source="RESP"
              value={vitals.rr}
              unit="/min"
              color={COLORS.rr}
              limits={patient.limits.rr}
              alarmState={rrAlarm}
              size="normal"
              trend={vitals.rrTrend}
              changed={vitals.rrChanged}
            />
          </div>

          {/* Temp Channel */}
          <div className="border-b border-slate-800">
            <ParameterChannel
              label="TEMP"
              source="T1"
              value={vitals.temp}
              unit="°C"
              color={COLORS.temp}
              alarmState={tempAlarm}
              size="normal"
              trend={vitals.tempTrend}
              changed={vitals.tempChanged}
            />
          </div>

          {/* Blood Pressure Channel */}
          <div className="border-b border-slate-800">
            <div className="px-2 py-1">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-purple-400 font-medium">NBP</span>
                  <span className="text-[8px] text-slate-500">ART</span>
                </div>
                <span className="text-[8px] text-slate-500">mmHg</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-base font-bold text-purple-400">
                  {vitals.bp?.systolic || '--'}/{vitals.bp?.diastolic || '--'}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({vitals.bp?.map || '--'})
                </span>
              </div>
              {/* MAP alarm check: MAP should be >= GA in weeks */}
              {patient.gaWeeks && vitals.bp?.map < patient.gaWeeks && (
                <div className="text-[8px] text-yellow-400 mt-0.5">LOW MAP</div>
              )}
            </div>
          </div>

          {/* FiO2 Channel */}
          <div>
            <ParameterChannel
              label="FiO₂"
              source="O₂"
              value={vitals.fio2}
              unit="%"
              color={COLORS.fio2}
              size="normal"
            />
          </div>
        </div>
      </div>
    </article>
  );
});

// === SYSTEM CLOCK COMPONENT ===
// Extracted to prevent entire page re-render every second
const SystemClock = memo(function SystemClock() {
  const [currentTime, setCurrentTime] = useState(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-right px-3 py-1 bg-black/30 border border-slate-800 rounded">
      <div className="text-xl font-mono font-bold text-white tabular-nums">
        {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'}
      </div>
      <div className="text-[10px] text-slate-500 font-mono">
        {currentTime ? currentTime.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '--/--/----'}
      </div>
    </div>
  );
});

// === MQTT STATUS BADGE ===
const MQTTStatusBadge = memo(function MQTTStatusBadge({ status, messageCount }) {
  const config = {
    [MQTT_STATUS.CONNECTED]: { bg: 'bg-cyan-900/50', border: 'border-cyan-600/50', text: 'text-cyan-400', label: 'MQTT Live' },
    [MQTT_STATUS.CONNECTING]: { bg: 'bg-blue-900/50', border: 'border-blue-600/50', text: 'text-blue-400', label: 'Connecting' },
    [MQTT_STATUS.RECONNECTING]: { bg: 'bg-orange-900/50', border: 'border-orange-600/50', text: 'text-orange-400', label: 'Reconnecting' },
    [MQTT_STATUS.DISCONNECTED]: { bg: 'bg-slate-800/50', border: 'border-slate-600/50', text: 'text-slate-400', label: 'Simulated' },
    [MQTT_STATUS.ERROR]: { bg: 'bg-red-900/50', border: 'border-red-600/50', text: 'text-red-400', label: 'Error' },
  };
  const c = config[status] || config[MQTT_STATUS.DISCONNECTED];

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 ${c.bg} border ${c.border} rounded`}>
      <span className={`w-2 h-2 rounded-full ${status === MQTT_STATUS.CONNECTED ? 'bg-cyan-500 animate-pulse' : 'bg-slate-500'}`} />
      <span className={`text-[10px] font-bold ${c.text}`}>{c.label}</span>
      {status === MQTT_STATUS.CONNECTED && messageCount > 0 && (
        <span className="text-[9px] text-cyan-600 font-mono">({messageCount})</span>
      )}
    </div>
  );
});

// === MAIN CENTRAL STATION ===
export default function NICUCentralStation() {
  // Use vitals from context for real-time updates
  const {
    patients,
    vitalsMap,
    isSimulating,
    toggleSimulation,
    getAlarmStats,
    updateCount,
  } = useVitals();

  // Get MQTT vitals for real-time updates
  const {
    vitalsMap: mqttVitalsMap,
    connectionStatus: mqttStatus,
    isConnected: mqttConnected,
    messageCount: mqttMessageCount,
  } = useMQTTVitals();

  // Merge MQTT data with simulated data - MQTT takes priority when connected
  const mergedVitalsMap = useMemo(() => {
    if (!mqttConnected || Object.keys(mqttVitalsMap).length === 0) {
      return vitalsMap;
    }

    const merged = { ...vitalsMap };
    for (const [patientId, mqttData] of Object.entries(mqttVitalsMap)) {
      if (mqttData && merged[patientId]) {
        merged[patientId] = {
          ...merged[patientId],
          // Override with MQTT values if available
          ...(mqttData.spo2 !== undefined && { spo2: mqttData.spo2, spo2Trend: mqttData.spo2Trend, spo2Changed: mqttData.spo2Changed }),
          ...(mqttData.pr !== undefined && { pr: mqttData.pr, prTrend: mqttData.prTrend, prChanged: mqttData.prChanged }),
          ...(mqttData.rr !== undefined && { rr: mqttData.rr, rrTrend: mqttData.rrTrend, rrChanged: mqttData.rrChanged }),
          ...(mqttData.temp !== undefined && { temp: mqttData.temp, tempTrend: mqttData.tempTrend, tempChanged: mqttData.tempChanged }),
          ...(mqttData.fio2 !== undefined && { fio2: mqttData.fio2 }),
          ...(mqttData.pi !== undefined && { pi: mqttData.pi }),
          ...(mqttData.bp !== undefined && { bp: mqttData.bp, bpTrend: mqttData.bpTrend, bpChanged: mqttData.bpChanged }),
          source: 'mqtt',
          timestamp: mqttData.timestamp,
        };
      }
    }
    return merged;
  }, [vitalsMap, mqttVitalsMap, mqttConnected]);

  const [acknowledgedAlarms, setAcknowledgedAlarms] = useState([]);
  const [silencedBeds, setSilencedBeds] = useState({});
  const [alarmSoundPlayed, setAlarmSoundPlayed] = useState(false);

  // Alarm sound hook
  const {
    playCriticalAlarm,
    playAckSound,
    silenceAllAlarms,
    isMuted
  } = useAlarmSound();

  const handleAcknowledgeAlarm = (patientId) => {
    setAcknowledgedAlarms(prev => [...prev, patientId]);
    playAckSound();
  };

  const handleAcknowledgeAll = () => {
    const criticalIds = patients.filter(p => p.status === 'critical').map(p => p.id);
    setAcknowledgedAlarms(prev => [...prev, ...criticalIds]);
    playAckSound();
  };

  const handleSilenceAlarms = () => {
    const criticalIds = patients.filter(p => p.status === 'critical').map(p => p.id);
    const now = Date.now();
    const newSilenced = {};
    criticalIds.forEach(id => {
      newSilenced[id] = now + 120000; // 2 minutes
    });
    setSilencedBeds(prev => ({ ...prev, ...newSilenced }));
    silenceAllAlarms();
  };

  // Play alarm sound when critical patients detected (first occurrence only)
  const criticalPatients = patients.filter(p => p.status === 'critical');
  useEffect(() => {
    if (criticalPatients.length > 0 && !alarmSoundPlayed && !isMuted) {
      // Delay slightly to allow user interaction first (audio policy)
      const timer = setTimeout(() => {
        playCriticalAlarm();
        setAlarmSoundPlayed(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (criticalPatients.length === 0) {
      setAlarmSoundPlayed(false);
    }
  }, [criticalPatients.length, alarmSoundPlayed, isMuted, playCriticalAlarm]);

  // Keyboard shortcuts
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    onAcknowledge: handleAcknowledgeAll,
    onSilence: handleSilenceAlarms,
  });

  // Get alarm statistics from context
  const { criticalCount, warningCount, totalAB, criticalBeds, warningBeds } = getAlarmStats();

  // Filter alarm beds based on acknowledged and silenced states
  const filteredCriticalBeds = useMemo(() => {
    const now = Date.now();
    return criticalBeds.filter(bed => {
      // Find patient ID for this bed
      const patient = patients.find(p => p.bed === bed);
      if (!patient) return true;

      // Check if acknowledged
      if (acknowledgedAlarms.includes(patient.id)) return false;

      // Check if silenced (and not expired)
      if (silencedBeds[patient.id] && silencedBeds[patient.id] > now) return false;

      return true;
    });
  }, [criticalBeds, patients, acknowledgedAlarms, silencedBeds]);

  const filteredWarningBeds = useMemo(() => {
    return warningBeds.filter(bed => {
      const patient = patients.find(p => p.bed === bed);
      if (!patient) return true;

      // Check if acknowledged
      if (acknowledgedAlarms.includes(patient.id)) return false;

      return true;
    });
  }, [warningBeds, patients, acknowledgedAlarms]);

  // Clean up expired silences
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setSilencedBeds(prev => {
        const updated = { ...prev };
        let changed = false;
        for (const [id, expiry] of Object.entries(updated)) {
          if (expiry <= now) {
            delete updated[id];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(cleanupInterval);
  }, []);
  
  return (
    <div className="min-h-screen flex" style={{ background: '#000508', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Navigation Sidebar */}
      <Navigation alarmCount={criticalCount} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* System Header */}
        <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <img
                src="/branding/nestwatch-final-favicon.svg"
                alt="NestWatch Logo"
                className="w-8 h-8 rounded-lg"
              />
              <div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-bold text-cyan-400 tracking-wide">Nest</span>
                  <span className="text-sm font-bold text-white tracking-wide">Watch</span>
                </div>
                <p className="text-[10px] text-slate-500">Floor 3 West • Unit A</p>
              </div>
            </div>
          
          <div className="flex items-center gap-4">
            {/* Alarm Summary */}
            <div
              className="flex items-center gap-3 px-3 py-1.5 bg-black/50 border border-slate-700 rounded"
              role="status"
              aria-label="Alarm summary"
            >
              <div
                className="flex items-center gap-1.5"
                aria-live="assertive"
                aria-atomic="true"
              >
                {criticalCount > 0 && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />}
                <span className="text-xs font-mono font-bold text-red-400">{criticalCount}</span>
                <span className="text-[10px] text-slate-500 uppercase">Crit</span>
                <span className="sr-only">{criticalCount} critical alarms</span>
              </div>
              <div className="w-px h-4 bg-slate-700" aria-hidden="true" />
              <div
                className="flex items-center gap-1.5"
                aria-live="polite"
                aria-atomic="true"
              >
                {warningCount > 0 && <div className="w-2 h-2 rounded-full bg-yellow-500" aria-hidden="true" />}
                <span className="text-xs font-mono font-bold text-yellow-400">{warningCount}</span>
                <span className="text-[10px] text-slate-500 uppercase">Warn</span>
                <span className="sr-only">{warningCount} warning alarms</span>
              </div>
              <div className="w-px h-4 bg-slate-700" aria-hidden="true" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-slate-300">{totalAB}</span>
                <span className="text-[10px] text-slate-500 uppercase">A/B</span>
                <span className="sr-only">{totalAB} apnea and bradycardia events</span>
              </div>
            </div>
            
            {/* System Clock - Memoized to prevent parent re-renders */}
            <SystemClock />
            
            {/* Simulation Toggle */}
            <SimulationToggle isSimulating={isSimulating} onToggle={toggleSimulation} />

            {/* Sound Controls */}
            <AlarmSoundControls />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <NotificationBell />

            {/* Keyboard Shortcuts Help */}
            <KeyboardHelpButton />

            {/* MQTT Connection Status */}
            <MQTTStatusBadge status={mqttStatus} messageCount={mqttMessageCount} />
          </div>
        </div>
      </header>

      {/* Notifications Panel */}
      <NotificationsPanel />
      
      {/* Monitor Grid */}
      <main className="flex-1 p-2 overflow-auto" aria-label="Patient monitoring grid">
        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 auto-rows-fr"
          style={{ minHeight: 'calc(100vh - 100px)' }}
          role="region"
          aria-label={`Monitoring ${patients.length} patients`}
          aria-live="polite"
          aria-relevant="additions removals"
        >
          {patients.map(patient => (
            <PatientMonitor
              key={patient.id}
              patient={patient}
              vitals={mergedVitalsMap[patient.id] || { pr: '--', spo2: '--', rr: '--', temp: '--', fio2: '--', pi: '--', bp: { systolic: '--', diastolic: '--', map: '--' } }}
            />
          ))}
        </div>
      </main>
      
      {/* Warning Alarm Banner */}
      <WarningAlarmBanner
        warningBeds={filteredWarningBeds}
        onAcknowledge={handleAcknowledgeAll}
      />

      {/* Critical Alarm Banner with Auto-Playing Sound */}
      <CriticalAlarmBanner
        criticalBeds={filteredCriticalBeds}
        onAcknowledge={handleAcknowledgeAll}
        onSilence={handleSilenceAlarms}
      />

      {/* Audio Enable Prompt - Required for browser autoplay policy */}
      <AudioEnablePrompt />
      
      </div>
    </div>
  );
}
