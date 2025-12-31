'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from './Toast';
import { AlarmSoundProvider } from './AlarmSound';
import { ThemeProvider } from './ThemeProvider';
import { NotificationsProvider } from './NotificationsPanel';
import { VitalsProvider } from '@/context/VitalsContext';

export function Providers({ children }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <VitalsProvider updateInterval={2000}>
          <AlarmSoundProvider>
            <NotificationsProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </NotificationsProvider>
          </AlarmSoundProvider>
        </VitalsProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
