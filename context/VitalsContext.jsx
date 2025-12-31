'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

/**
 * Real-time Vitals Context with Database Integration
 * Provides shared vital signs state across the application with:
 * - Real-time API data fetching from /api/patients and /api/vitals
 * - Fallback to simulation mode when API unavailable
 * - Configurable update intervals
 * - Trend tracking (previous values)
 * - Change detection for animations
 * - Physiologically realistic variance for simulation mode
 */

// Fallback data for when API is unavailable (e.g., not logged in)
const fallbackPatients = [
  { id: 1, bed: '01', name: 'THOMPSON, BABY', ga: '32+4', gaWeeks: 32, weight: 1.82, dol: 8, status: 'normal', basePR: 145, baseSPO2: 96, baseRR: 42, baseTemp: 36.8, baseBP: { systolic: 62, diastolic: 38, map: 46 }, fio2: 21, apnea: 0, brady: 0, alarmSilenced: 0, limits: { spo2: [88, 100], pr: [100, 180], rr: [25, 70] } },
  { id: 2, bed: '02', name: 'MARTINEZ, BABY', ga: '28+2', gaWeeks: 28, weight: 1.12, dol: 14, status: 'warning', basePR: 167, baseSPO2: 90, baseRR: 58, baseTemp: 37.2, baseBP: { systolic: 48, diastolic: 28, map: 35 }, fio2: 35, apnea: 3, brady: 2, alarmSilenced: 0, limits: { spo2: [85, 100], pr: [100, 180], rr: [25, 70] } },
  { id: 3, bed: '03', name: 'CHEN, BABY', ga: '34+0', gaWeeks: 34, weight: 2.15, dol: 5, status: 'normal', basePR: 138, baseSPO2: 98, baseRR: 38, baseTemp: 36.6, baseBP: { systolic: 58, diastolic: 35, map: 43 }, fio2: 21, apnea: 0, brady: 0, alarmSilenced: 0, limits: { spo2: [90, 100], pr: [100, 180], rr: [25, 70] } },
  { id: 4, bed: '04', name: 'WILLIAMS, BABY', ga: '26+5', gaWeeks: 26, weight: 0.89, dol: 21, status: 'critical', basePR: 185, baseSPO2: 84, baseRR: 72, baseTemp: 38.1, baseBP: { systolic: 42, diastolic: 24, map: 30 }, fio2: 55, apnea: 8, brady: 5, alarmSilenced: 0, limits: { spo2: [85, 100], pr: [100, 180], rr: [25, 70] } },
  { id: 5, bed: '05', name: 'JOHNSON, BABY', ga: '31+1', gaWeeks: 31, weight: 1.54, dol: 11, status: 'normal', basePR: 142, baseSPO2: 95, baseRR: 44, baseTemp: 36.7, baseBP: { systolic: 52, diastolic: 32, map: 39 }, fio2: 25, apnea: 1, brady: 0, alarmSilenced: 0, limits: { spo2: [88, 100], pr: [100, 180], rr: [25, 70] } },
  { id: 6, bed: '06', name: 'BROWN, BABY', ga: '29+6', gaWeeks: 29, weight: 1.28, dol: 9, status: 'warning', basePR: 158, baseSPO2: 89, baseRR: 56, baseTemp: 37.0, baseBP: { systolic: 50, diastolic: 30, map: 37 }, fio2: 40, apnea: 4, brady: 2, alarmSilenced: 90, limits: { spo2: [85, 100], pr: [100, 180], rr: [25, 70] } },
  { id: 7, bed: '07', name: 'DAVIS, BABY', ga: '35+2', gaWeeks: 35, weight: 2.34, dol: 3, status: 'normal', basePR: 134, baseSPO2: 97, baseRR: 36, baseTemp: 36.5, baseBP: { systolic: 60, diastolic: 36, map: 44 }, fio2: 21, apnea: 0, brady: 0, alarmSilenced: 0, limits: { spo2: [90, 100], pr: [100, 180], rr: [25, 70] } },
  { id: 8, bed: '08', name: 'GARCIA, BABY', ga: '30+3', gaWeeks: 30, weight: 1.45, dol: 7, status: 'normal', basePR: 148, baseSPO2: 94, baseRR: 46, baseTemp: 36.9, baseBP: { systolic: 54, diastolic: 32, map: 39 }, fio2: 28, apnea: 1, brady: 1, alarmSilenced: 0, limits: { spo2: [88, 100], pr: [100, 180], rr: [25, 70] } },
];

// Trend directions
export const TREND = {
  UP: 'up',
  DOWN: 'down',
  STABLE: 'stable',
};

// Calculate trend based on current and previous value
const calculateTrend = (current, previous, threshold = 2) => {
  if (previous === null || previous === undefined) return TREND.STABLE;
  const diff = current - previous;
  if (Math.abs(diff) < threshold) return TREND.STABLE;
  return diff > 0 ? TREND.UP : TREND.DOWN;
};

// Generate vitals with physiologically realistic variance
const generateVitals = (patient, previousVitals = null) => {
  // Variance depends on patient status
  const variance = patient.status === 'critical' ? 5 : patient.status === 'warning' ? 2.5 : 1;
  const bpVariance = patient.status === 'critical' ? 4 : patient.status === 'warning' ? 2 : 1;

  // Smooth transitions using previous value (70% previous + 30% random variation)
  const smoothValue = (base, prev, maxVariance) => {
    const target = base + (Math.random() - 0.5) * maxVariance * 2;
    if (prev !== null && prev !== undefined) {
      return prev * 0.7 + target * 0.3;
    }
    return target;
  };

  const pr = Math.round(smoothValue(patient.basePR, previousVitals?.pr, variance * 3));
  const spo2 = Math.min(100, Math.max(0, Math.round(smoothValue(patient.baseSPO2, previousVitals?.spo2, variance))));
  const rr = Math.round(smoothValue(patient.baseRR, previousVitals?.rr, variance * 2));
  const temp = parseFloat(smoothValue(patient.baseTemp, parseFloat(previousVitals?.temp) || patient.baseTemp, 0.1).toFixed(1));

  // Blood pressure generation
  const baseBP = patient.baseBP || { systolic: 55, diastolic: 32, map: 40 };
  const bp = {
    systolic: Math.round(smoothValue(baseBP.systolic, previousVitals?.bp?.systolic, bpVariance * 2)),
    diastolic: Math.round(smoothValue(baseBP.diastolic, previousVitals?.bp?.diastolic, bpVariance * 2)),
    map: Math.round(smoothValue(baseBP.map, previousVitals?.bp?.map, bpVariance)),
  };

  return {
    pr,
    spo2,
    rr,
    temp: temp.toFixed(1),
    fio2: patient.fio2,
    pi: (0.5 + Math.random() * 4).toFixed(1),
    bp,
    // Trend calculations
    prTrend: calculateTrend(pr, previousVitals?.pr, 3),
    spo2Trend: calculateTrend(spo2, previousVitals?.spo2, 1),
    rrTrend: calculateTrend(rr, previousVitals?.rr, 2),
    tempTrend: calculateTrend(temp, parseFloat(previousVitals?.temp), 0.2),
    // Track which values changed significantly for flash animation
    prChanged: previousVitals ? Math.abs(pr - previousVitals.pr) >= 3 : false,
    spo2Changed: previousVitals ? Math.abs(spo2 - previousVitals.spo2) >= 2 : false,
    rrChanged: previousVitals ? Math.abs(rr - previousVitals.rr) >= 3 : false,
    tempChanged: previousVitals ? Math.abs(temp - parseFloat(previousVitals.temp)) >= 0.2 : false,
    // Timestamp
    timestamp: Date.now(),
  };
};

// Context
const VitalsContext = createContext(null);

// Provider component
export function VitalsProvider({ children, updateInterval = 2000 }) {
  const [patients, setPatients] = useState([]);
  const [vitalsMap, setVitalsMap] = useState({});
  const [isSimulating, setIsSimulating] = useState(false); // Start with API mode
  const [updateCount, setUpdateCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('api'); // 'api' or 'simulation'
  const [isTabVisible, setIsTabVisible] = useState(true); // Track tab visibility
  const previousVitalsRef = useRef({});

  // Visibility detection - pause polling when tab is hidden to save resources
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Fetch patients from API
  const fetchPatients = useCallback(async () => {
    try {
      const response = await fetch('/api/patients?includeVitals=true');

      // Check if redirected to login (URL contains /login)
      if (response.redirected && response.url.includes('/login')) {
        console.log('Session expired or not authenticated, using simulation mode');
        setDataSource('simulation');
        setPatients(fallbackPatients);
        setIsSimulating(true);
        return false;
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - use fallback data with simulation
          console.log('Not authenticated, using simulation mode');
          setDataSource('simulation');
          setPatients(fallbackPatients);
          setIsSimulating(true);
          return false;
        }
        throw new Error(`API error: ${response.status}`);
      }

      // Check content-type to ensure we're getting JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log('Non-JSON response, likely auth redirect. Using simulation mode');
        setDataSource('simulation');
        setPatients(fallbackPatients);
        setIsSimulating(true);
        return false;
      }

      const result = await response.json();
      const apiPatients = result.data || [];

      if (apiPatients.length === 0) {
        // No patients in database - use fallback
        console.log('No patients in database, using simulation mode');
        setDataSource('simulation');
        setPatients(fallbackPatients);
        setIsSimulating(true);
        return false;
      }

      // Transform API data to match expected format
      const transformedPatients = apiPatients.map(p => ({
        id: p.id,
        bed: p.bed || '--',
        name: p.name,
        mrn: p.mrn,
        ga: p.ga,
        gaWeeks: p.gaWeeks || parseInt(p.ga) || 32,
        weight: p.weight,
        dol: p.dol,
        status: p.status || 'normal',
        basePR: p.basePR || 140,
        baseSPO2: p.baseSPO2 || 95,
        baseRR: p.baseRR || 40,
        baseTemp: p.baseTemp || 36.7,
        baseBP: p.baseBP || { systolic: 55, diastolic: 32, map: p.gaWeeks || parseInt(p.ga) || 40 },
        fio2: p.fio2 || 21,
        apnea: p.apnea || 0,
        brady: p.brady || 0,
        alarmSilenced: 0,
        limits: p.limits || { spo2: [88, 100], pr: [100, 180], rr: [25, 70] },
        activeAlarms: p.activeAlarms || 0,
      }));

      setPatients(transformedPatients);
      setDataSource('api');
      setError(null);
      return true;
    } catch (err) {
      // Silently ignore aborted requests (happen during navigation)
      if (err.name === 'AbortError' || err.message?.includes('Failed to fetch')) {
        // Still fall back to simulation, but don't log as error
        setDataSource('simulation');
        setPatients(fallbackPatients);
        setIsSimulating(true);
        return false;
      }
      console.error('Failed to fetch patients:', err);
      setError(err.message);
      // Fall back to simulation mode
      setDataSource('simulation');
      setPatients(fallbackPatients);
      setIsSimulating(true);
      return false;
    }
  }, []);

  // Fetch vitals from API
  const fetchVitals = useCallback(async () => {
    if (dataSource !== 'api' || patients.length === 0) return;

    try {
      const response = await fetch('/api/vitals');

      // Check if redirected to login
      if (response.redirected && response.url.includes('/login')) {
        setDataSource('simulation');
        setIsSimulating(true);
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Switch to simulation if not authenticated
          setDataSource('simulation');
          setIsSimulating(true);
          return;
        }
        throw new Error(`Vitals API error: ${response.status}`);
      }

      // Check content-type to ensure we're getting JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setDataSource('simulation');
        setIsSimulating(true);
        return;
      }

      const result = await response.json();
      const apiVitals = result.data || {};

      // Update vitals map with API data
      setVitalsMap(prev => {
        const newVitals = {};
        patients.forEach(p => {
          const apiVital = apiVitals[p.id];
          const prevVital = prev[p.id];

          if (apiVital && apiVital.pr !== '--') {
            // Use real API data
            const pr = parseInt(apiVital.pr) || p.basePR;
            const spo2 = parseInt(apiVital.spo2) || p.baseSPO2;
            const rr = parseInt(apiVital.rr) || p.baseRR;
            const temp = parseFloat(apiVital.temp) || p.baseTemp;

            // Generate BP (API may not include it)
            const baseBP = p.baseBP || { systolic: 55, diastolic: 32, map: 40 };
            const bpVariance = p.status === 'critical' ? 4 : p.status === 'warning' ? 2 : 1;
            const bp = apiVital.bp || {
              systolic: Math.round(baseBP.systolic + (Math.random() - 0.5) * bpVariance * 2),
              diastolic: Math.round(baseBP.diastolic + (Math.random() - 0.5) * bpVariance * 2),
              map: Math.round(baseBP.map + (Math.random() - 0.5) * bpVariance),
            };

            newVitals[p.id] = {
              pr,
              spo2,
              rr,
              temp: temp.toFixed(1),
              fio2: apiVital.fio2 || p.fio2,
              pi: apiVital.pi || (0.5 + Math.random() * 4).toFixed(1),
              bp,
              prTrend: calculateTrend(pr, prevVital?.pr, 3),
              spo2Trend: calculateTrend(spo2, prevVital?.spo2, 1),
              rrTrend: calculateTrend(rr, prevVital?.rr, 2),
              tempTrend: calculateTrend(temp, parseFloat(prevVital?.temp), 0.2),
              prChanged: prevVital ? Math.abs(pr - prevVital.pr) >= 3 : false,
              spo2Changed: prevVital ? Math.abs(spo2 - prevVital.spo2) >= 2 : false,
              rrChanged: prevVital ? Math.abs(rr - prevVital.rr) >= 3 : false,
              tempChanged: prevVital ? Math.abs(temp - parseFloat(prevVital.temp)) >= 0.2 : false,
              timestamp: Date.now(),
              source: 'api',
            };
          } else {
            // No API data - generate simulated vitals
            newVitals[p.id] = generateVitals(p, prevVital);
            newVitals[p.id].source = 'simulated';
          }
        });
        previousVitalsRef.current = prev;
        return newVitals;
      });
      setUpdateCount(c => c + 1);
    } catch (err) {
      // Silently ignore aborted requests (happen during navigation)
      if (err.name === 'AbortError' || err.message?.includes('Failed to fetch')) {
        return; // Expected during page navigation
      }
      console.error('Failed to fetch vitals:', err);
      // Fall back to simulation for this cycle
    }
  }, [dataSource, patients]);

  // Initialize - fetch patients from API
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const success = await fetchPatients();

      // Initialize vitals
      if (success) {
        await fetchVitals();
      } else {
        // Initialize with simulated vitals for fallback patients
        const initial = {};
        fallbackPatients.forEach(p => {
          initial[p.id] = generateVitals(p, null);
        });
        setVitalsMap(initial);
        previousVitalsRef.current = initial;
      }

      setIsLoading(false);
    };
    init();
  }, []);

  // Refresh patients periodically (every 30 seconds)
  useEffect(() => {
    if (dataSource !== 'api') return;

    const interval = setInterval(() => {
      fetchPatients();
    }, 30000);

    return () => clearInterval(interval);
  }, [dataSource, fetchPatients]);

  // Real-time update loop - either API polling or simulation
  // Pauses when tab is hidden to save resources and reduce network traffic
  useEffect(() => {
    if (patients.length === 0) return;

    const interval = setInterval(() => {
      // Skip updates when tab is not visible
      if (!isTabVisible) return;

      if (dataSource === 'api' && !isSimulating) {
        // Poll API for real vitals
        fetchVitals();
      } else {
        // Simulation mode
        setVitalsMap(prev => {
          const newVitals = {};
          patients.forEach(p => {
            const previousVitals = prev[p.id] || null;
            newVitals[p.id] = generateVitals(p, previousVitals);
            newVitals[p.id].source = 'simulated';
          });
          previousVitalsRef.current = prev;
          return newVitals;
        });
        setUpdateCount(c => c + 1);
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [patients, isSimulating, updateInterval, dataSource, fetchVitals, isTabVisible]);

  // Get vitals for a specific patient
  const getPatientVitals = useCallback((patientId) => {
    return vitalsMap[patientId] || null;
  }, [vitalsMap]);

  // Get all patients with their vitals
  const getPatientsWithVitals = useCallback(() => {
    return patients.map(p => ({
      ...p,
      vitals: vitalsMap[p.id] || null,
    }));
  }, [patients, vitalsMap]);

  // Toggle simulation on/off
  const toggleSimulation = useCallback(() => {
    setIsSimulating(prev => !prev);
  }, []);

  // Manually trigger an update
  const forceUpdate = useCallback(() => {
    setVitalsMap(prev => {
      const newVitals = {};
      patients.forEach(p => {
        newVitals[p.id] = generateVitals(p, prev[p.id]);
      });
      return newVitals;
    });
  }, [patients]);

  // Update patient data (e.g., from edit modal)
  const updatePatient = useCallback((patientId, updates) => {
    setPatients(prev => prev.map(p =>
      p.id === patientId ? { ...p, ...updates } : p
    ));
  }, []);

  // Get alarm statistics
  const getAlarmStats = useCallback(() => {
    const critical = patients.filter(p => p.status === 'critical');
    const warning = patients.filter(p => p.status === 'warning');
    const totalAB = patients.reduce((sum, p) => sum + p.apnea + p.brady, 0);

    return {
      criticalCount: critical.length,
      warningCount: warning.length,
      totalAB,
      criticalBeds: critical.map(p => p.bed),
      warningBeds: warning.map(p => p.bed),
    };
  }, [patients]);

  // Refresh data from API
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await fetchPatients();
    await fetchVitals();
    setIsLoading(false);
  }, [fetchPatients, fetchVitals]);

  // Switch between API and simulation mode
  const setMode = useCallback((mode) => {
    if (mode === 'simulation') {
      setDataSource('simulation');
      setIsSimulating(true);
    } else {
      setDataSource('api');
      setIsSimulating(false);
      fetchPatients();
    }
  }, [fetchPatients]);

  const value = {
    // State
    patients,
    vitalsMap,
    isSimulating,
    updateCount,
    updateInterval,
    isLoading,
    error,
    dataSource,

    // Methods
    getPatientVitals,
    getPatientsWithVitals,
    toggleSimulation,
    forceUpdate,
    updatePatient,
    getAlarmStats,
    refreshData,
    setMode,

    // Constants
    TREND,
  };

  return (
    <VitalsContext.Provider value={value}>
      {children}
    </VitalsContext.Provider>
  );
}

// Hook to use vitals context
export function useVitals() {
  const context = useContext(VitalsContext);
  if (!context) {
    throw new Error('useVitals must be used within a VitalsProvider');
  }
  return context;
}

// Hook for a single patient's vitals
export function usePatientVitals(patientId) {
  const { getPatientVitals, updateCount } = useVitals();
  return getPatientVitals(patientId);
}

export default VitalsContext;
