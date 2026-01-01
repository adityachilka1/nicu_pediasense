'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from './Toast';
import { AlarmSoundProvider } from './AlarmSound';
import { ThemeProvider } from './ThemeProvider';
import { NotificationsProvider } from './NotificationsPanel';
import { VitalsProvider } from '@/context/VitalsContext';
import { MQTTVitalsProvider, useMQTTVitals, MQTT_STATUS } from '@/context/MQTTVitalsContext';
import { ErrorBoundary } from './ErrorBoundary';
import { SessionTimeoutMonitor } from './SessionTimeoutMonitor';
import { useEffect, useRef } from 'react';
import { useToast } from './Toast';
import { initialPatients } from '@/lib/data';

// MQTT Alarm Notifier - Shows toast notifications for MQTT alarms
// Only shows critical alarms to avoid toast flooding
function MQTTAlarmNotifier() {
  const { alarmsQueue, connectionStatus } = useMQTTVitals();
  const toast = useToast();
  const lastAlarmRef = useRef(null);
  const connectionNotifiedRef = useRef(false);
  const lastToastTimeRef = useRef(0);

  // Throttle time between alarm toasts (ms) - only show 1 toast every 10 seconds
  const ALARM_TOAST_THROTTLE = 10000;

  // Show toast only for CRITICAL alarms and with throttling
  useEffect(() => {
    if (alarmsQueue.length === 0) return;

    const latestAlarm = alarmsQueue[0];
    if (lastAlarmRef.current === latestAlarm.id) return;

    lastAlarmRef.current = latestAlarm.id;

    // Only show toasts for critical alarms
    const severity = latestAlarm.severity || 'warning';
    if (severity !== 'critical') return;

    // Throttle: don't show more than 1 alarm toast per ALARM_TOAST_THROTTLE ms
    const now = Date.now();
    if (now - lastToastTimeRef.current < ALARM_TOAST_THROTTLE) return;
    lastToastTimeRef.current = now;

    const patient = initialPatients.find(p => p.id === latestAlarm.patientId);
    const bedLabel = patient ? `Bed ${patient.bed}` : `Patient ${latestAlarm.patientId}`;
    const message = `${bedLabel}: ${latestAlarm.parameter || 'Critical Alarm'}`;

    toast.error(message, 5000);
  }, [alarmsQueue, toast]);

  // Notify when MQTT connection status changes
  useEffect(() => {
    if (connectionStatus === MQTT_STATUS.CONNECTED && !connectionNotifiedRef.current) {
      toast.success('MQTT real-time connection established', 3000);
      connectionNotifiedRef.current = true;
    } else if (connectionStatus === MQTT_STATUS.ERROR) {
      toast.error('MQTT connection error - falling back to simulation', 5000);
      connectionNotifiedRef.current = false;
    } else if (connectionStatus === MQTT_STATUS.DISCONNECTED && connectionNotifiedRef.current) {
      toast.info('MQTT disconnected - using simulated data', 3000);
      connectionNotifiedRef.current = false;
    }
  }, [connectionStatus, toast]);

  return null;
}

// Critical error fallback for healthcare application
function CriticalErrorFallback({ error, resetError }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000508] p-6">
      <div className="max-w-lg text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500/50">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">System Error</h1>
        <p className="text-slate-400 mb-2">
          The monitoring system encountered an unexpected error.
        </p>
        <p className="text-red-400 text-sm mb-6">
          Please verify patient status using backup monitoring equipment.
        </p>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-slate-500 mb-1">Error Details:</p>
            <code className="text-xs text-red-400 break-all">{error.message}</code>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={resetError}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Reload System
          </button>
        </div>

        <p className="text-xs text-slate-600 mt-6">
          If this error persists, contact IT Support immediately.
        </p>
      </div>
    </div>
  );
}

export function Providers({ children }) {
  return (
    <ErrorBoundary
      fallback={<CriticalErrorFallback error={null} resetError={() => window.location.reload()} />}
    >
      <SessionProvider>
        <ThemeProvider>
          <MQTTVitalsProvider unitId="unit-a">
            <VitalsProvider updateInterval={2000}>
              <ErrorBoundary title="Vitals display error">
                <AlarmSoundProvider>
                  <NotificationsProvider>
                    <ToastProvider>
                      <MQTTAlarmNotifier />
                      <SessionTimeoutMonitor />
                      {children}
                    </ToastProvider>
                  </NotificationsProvider>
                </AlarmSoundProvider>
              </ErrorBoundary>
            </VitalsProvider>
          </MQTTVitalsProvider>
        </ThemeProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
