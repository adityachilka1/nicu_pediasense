'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useAlarmSound } from './AlarmSound';

// Notification types and their configurations
const NOTIFICATION_TYPES = {
  alarm: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    color: 'red',
    sound: 'critical',
  },
  medication: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    color: 'purple',
    sound: 'info',
  },
  lab: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    color: 'blue',
    sound: 'info',
  },
  vitals: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    color: 'cyan',
    sound: 'warning',
  },
  system: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'slate',
    sound: null,
  },
  feeding: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'green',
    sound: 'info',
  },
};

// Sample notifications data
const generateSampleNotifications = () => [
  {
    id: 1,
    type: 'alarm',
    title: 'Critical: SpO2 Low',
    message: 'BED 04 - Williams, Baby: SpO2 dropped to 82%',
    timestamp: new Date(Date.now() - 2 * 60000),
    read: false,
    priority: 'critical',
    patientId: 4,
  },
  {
    id: 2,
    type: 'medication',
    title: 'Medication Due',
    message: 'BED 02 - Martinez, Baby: Caffeine citrate due in 15 min',
    timestamp: new Date(Date.now() - 5 * 60000),
    read: false,
    priority: 'high',
    patientId: 2,
  },
  {
    id: 3,
    type: 'lab',
    title: 'Lab Results Ready',
    message: 'BED 04 - Williams, Baby: Blood culture results available',
    timestamp: new Date(Date.now() - 12 * 60000),
    read: false,
    priority: 'medium',
    patientId: 4,
  },
  {
    id: 4,
    type: 'vitals',
    title: 'Vitals Alert',
    message: 'BED 06 - Brown, Baby: Temperature elevated to 37.8°C',
    timestamp: new Date(Date.now() - 18 * 60000),
    read: true,
    priority: 'medium',
    patientId: 6,
  },
  {
    id: 5,
    type: 'feeding',
    title: 'Feeding Time',
    message: 'BED 01 - Thompson, Baby: Next feed due at 15:00',
    timestamp: new Date(Date.now() - 25 * 60000),
    read: true,
    priority: 'low',
    patientId: 1,
  },
  {
    id: 6,
    type: 'system',
    title: 'Shift Change',
    message: 'Day shift ending in 30 minutes. Please complete handoff notes.',
    timestamp: new Date(Date.now() - 30 * 60000),
    read: true,
    priority: 'low',
    patientId: null,
  },
];

// Notifications Context
const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const { playInfoSound, playWarningAlarm } = useAlarmSound();

  // Initialize with sample notifications
  useEffect(() => {
    setNotifications(generateSampleNotifications());
  }, []);

  // Add a new notification
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      read: false,
      ...notification,
    };
    setNotifications(prev => [newNotification, ...prev]);

    // Play sound based on type
    const type = NOTIFICATION_TYPES[notification.type];
    if (type?.sound === 'critical' || type?.sound === 'warning') {
      playWarningAlarm();
    } else if (type?.sound === 'info') {
      playInfoSound();
    }

    return newNotification.id;
  }, [playInfoSound, playWarningAlarm]);

  // Mark notification as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isOpen,
        setIsOpen,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}

// Time ago formatter
function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Notification Bell Button
export function NotificationBell({ className = '' }) {
  const { unreadCount, isOpen, setIsOpen } = useNotifications();

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={`relative p-2 rounded-lg transition-colors ${
        isOpen
          ? 'bg-cyan-500/20 text-cyan-400'
          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
      } ${className}`}
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse"
          aria-hidden="true"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

// Color classes for different notification types
const colorClasses = {
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    badge: 'bg-red-500',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    icon: 'text-purple-400',
    badge: 'bg-purple-500',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    badge: 'bg-blue-500',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    icon: 'text-cyan-400',
    badge: 'bg-cyan-500',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: 'text-green-400',
    badge: 'bg-green-500',
  },
  slate: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    icon: 'text-slate-400',
    badge: 'bg-slate-500',
  },
};

// Notifications Panel Component
export function NotificationsPanel() {
  const {
    notifications,
    unreadCount,
    isOpen,
    setIsOpen,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotifications();

  const [filter, setFilter] = useState('all');

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.type === filter;
  });

  return (
    <div
      className="fixed right-4 top-16 w-96 max-h-[calc(100vh-100px)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col animate-slide-in"
      role="dialog"
      aria-modal="false"
      aria-label="Notifications panel"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <h2 id="notifications-heading" className="font-semibold text-white">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full" aria-live="polite">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-cyan-400 hover:text-cyan-300"
              aria-label={`Mark all ${unreadCount} notifications as read`}
            >
              Mark all read
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            aria-label="Close notifications panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="flex items-center gap-1 p-2 border-b border-slate-800 overflow-x-auto"
        role="group"
        aria-label="Filter notifications"
      >
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread' },
          { id: 'alarm', label: 'Alarms' },
          { id: 'medication', label: 'Meds' },
          { id: 'lab', label: 'Labs' },
          { id: 'vitals', label: 'Vitals' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.id
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto" role="list" aria-label="Notifications list">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500" role="status">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p>No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredNotifications.map(notification => {
              const typeConfig = NOTIFICATION_TYPES[notification.type];
              const colors = colorClasses[typeConfig?.color || 'slate'];

              return (
                <article
                  key={notification.id}
                  role="listitem"
                  tabIndex={0}
                  onClick={() => markAsRead(notification.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      markAsRead(notification.id);
                    }
                  }}
                  className={`p-3 cursor-pointer transition-colors hover:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-inset ${
                    !notification.read ? 'bg-slate-800/30' : ''
                  }`}
                  aria-label={`${notification.title}${!notification.read ? ', unread' : ''}${notification.priority === 'critical' ? ', critical priority' : notification.priority === 'high' ? ', high priority' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${colors.bg} ${colors.icon}`} aria-hidden="true">
                      {typeConfig?.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-medium ${!notification.read ? 'text-white' : 'text-slate-300'}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-cyan-400 rounded-full" aria-hidden="true" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500">
                          {timeAgo(notification.timestamp)}
                        </span>
                        {notification.priority === 'critical' && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-medium rounded">
                            CRITICAL
                          </span>
                        )}
                        {notification.priority === 'high' && (
                          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-medium rounded">
                            HIGH
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      aria-label={`Delete notification: ${notification.title}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={clearAll}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
          <a
            href="/notifications"
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View all notifications
          </a>
        </div>
      )}
    </div>
  );
}
