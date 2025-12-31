'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const [notificationList, setNotificationList] = useState([
    {
      id: 1,
      type: 'alarm',
      title: 'Critical Alarm - BED 04',
      message: 'SpO2 dropped below 85% for WILLIAMS, BABY. Immediate attention required.',
      timestamp: '2024-12-29T19:45:00',
      read: false,
      priority: 'critical',
    },
    {
      id: 2,
      type: 'system',
      title: 'Shift Handoff Reminder',
      message: 'Your shift ends in 30 minutes. Please complete handoff documentation.',
      timestamp: '2024-12-29T18:30:00',
      read: false,
      priority: 'medium',
    },
    {
      id: 3,
      type: 'lab',
      title: 'Lab Results Available',
      message: 'CBC results are ready for CHEN, BABY (BED 03). Review recommended.',
      timestamp: '2024-12-29T17:15:00',
      read: true,
      priority: 'low',
    },
    {
      id: 4,
      type: 'device',
      title: 'Device Alert',
      message: 'IV Pump on BED 03 reports low battery (15%). Please replace or charge.',
      timestamp: '2024-12-29T16:45:00',
      read: true,
      priority: 'medium',
    },
    {
      id: 5,
      type: 'order',
      title: 'New Order',
      message: 'Dr. Chen has ordered a new medication for MARTINEZ, BABY. Please verify.',
      timestamp: '2024-12-29T15:30:00',
      read: true,
      priority: 'medium',
    },
    {
      id: 6,
      type: 'system',
      title: 'System Maintenance',
      message: 'Scheduled system maintenance tonight at 02:00. Expected downtime: 15 minutes.',
      timestamp: '2024-12-29T14:00:00',
      read: true,
      priority: 'low',
    },
    {
      id: 7,
      type: 'alarm',
      title: 'Alarm Resolved - BED 02',
      message: 'Bradycardia alarm for MARTINEZ, BABY has been resolved. HR normalized.',
      timestamp: '2024-12-29T13:45:00',
      read: true,
      priority: 'low',
    },
  ]);

  const [channelPrefs, setChannelPrefs] = useState({
    email: { enabled: true, address: 'jessica.moore@memorial.org' },
    sms: { enabled: true, phone: '(555) 123-4567' },
    push: { enabled: true },
    pager: { enabled: false, number: '' },
  });

  const [quietHours, setQuietHours] = useState({
    enabled: false,
    start: '22:00',
    end: '06:00',
    allowCritical: true,
  });

  const handleMarkAllRead = () => {
    setNotificationList(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleMarkAsRead = (id) => {
    setNotificationList(prev => prev.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const handleDismiss = (id) => {
    setNotificationList(prev => prev.filter(n => n.id !== id));
  };

  const toggleChannel = (channel) => {
    setChannelPrefs(prev => ({
      ...prev,
      [channel]: { ...prev[channel], enabled: !prev[channel].enabled }
    }));
  };

  const preferences = {
    channels: {
      email: { enabled: true, address: 'jessica.moore@memorial.org' },
      sms: { enabled: true, phone: '(555) 123-4567' },
      push: { enabled: true },
      pager: { enabled: false, number: '' },
    },
    types: {
      critical_alarms: { email: true, sms: true, push: true, pager: true },
      warning_alarms: { email: true, sms: false, push: true, pager: false },
      lab_results: { email: true, sms: false, push: true, pager: false },
      orders: { email: true, sms: false, push: true, pager: false },
      system: { email: false, sms: false, push: true, pager: false },
      device: { email: true, sms: false, push: true, pager: false },
    },
    quiet_hours: {
      enabled: false,
      start: '22:00',
      end: '06:00',
      allow_critical: true,
    },
  };

  const unreadCount = notificationList.filter(n => !n.read).length;

  const filteredNotifications = notificationList.filter(n => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'critical') return n.priority === 'critical';
    return true;
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case 'alarm': return '🔔';
      case 'lab': return '🧪';
      case 'device': return '🖥️';
      case 'order': return '📋';
      case 'system': return '⚙️';
      default: return '📬';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-500/5';
      case 'medium': return 'border-l-yellow-500 bg-yellow-500/5';
      default: return 'border-l-slate-600 bg-slate-800/50';
    }
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-sm text-slate-400 mt-1">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Mark All Read
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
            >
              Settings
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          {/* Notifications List */}
          <div className="col-span-8">
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 bg-slate-900 rounded-lg p-1 w-fit">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: `Unread (${unreadCount})` },
                { id: 'critical', label: 'Critical' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Notification List */}
            <div className="space-y-3">
              {filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`rounded-lg border-l-4 p-4 ${getPriorityColor(notification.priority)} ${
                    !notification.read ? 'bg-slate-900' : 'bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-medium ${!notification.read ? 'text-white' : 'text-slate-300'}`}>
                          {notification.title}
                        </h3>
                        <span className="text-xs text-slate-500">
                          {new Date(notification.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{notification.message}</p>
                      <div className="flex items-center gap-3 mt-3">
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-xs text-cyan-400 hover:text-cyan-300"
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          onClick={() => handleDismiss(notification.id)}
                          className="text-xs text-slate-500 hover:text-slate-300"
                        >
                          Dismiss
                        </button>
                        {notification.type === 'alarm' && (
                          <Link href="/patient/4" className="text-xs text-cyan-400 hover:text-cyan-300">View Patient</Link>
                        )}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-cyan-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Settings Panel */}
          <div className="col-span-4 space-y-6">
            {/* Channels */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
              <h2 className="text-white font-bold mb-4">Notification Channels</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Email</div>
                    <div className="text-xs text-slate-500">{channelPrefs.email.address}</div>
                  </div>
                  <button
                    onClick={() => toggleChannel('email')}
                    className={`w-12 h-7 rounded-full transition-colors ${
                      channelPrefs.email.enabled ? 'bg-cyan-600' : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
                      channelPrefs.email.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">SMS</div>
                    <div className="text-xs text-slate-500">{channelPrefs.sms.phone}</div>
                  </div>
                  <button
                    onClick={() => toggleChannel('sms')}
                    className={`w-12 h-7 rounded-full transition-colors ${
                      channelPrefs.sms.enabled ? 'bg-cyan-600' : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
                      channelPrefs.sms.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Push Notifications</div>
                    <div className="text-xs text-slate-500">Browser & Mobile</div>
                  </div>
                  <button
                    onClick={() => toggleChannel('push')}
                    className={`w-12 h-7 rounded-full transition-colors ${
                      channelPrefs.push.enabled ? 'bg-cyan-600' : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
                      channelPrefs.push.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Pager</div>
                    <div className="text-xs text-slate-500">Not configured</div>
                  </div>
                  <button
                    onClick={() => toggleChannel('pager')}
                    className={`w-12 h-7 rounded-full transition-colors ${
                      channelPrefs.pager.enabled ? 'bg-cyan-600' : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
                      channelPrefs.pager.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Quiet Hours */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold">Quiet Hours</h2>
                <button
                  onClick={() => setQuietHours(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-7 rounded-full transition-colors ${quietHours.enabled ? 'bg-cyan-600' : 'bg-slate-700'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full transition-transform ${quietHours.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Silence non-critical notifications during specified hours.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Start</label>
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => setQuietHours(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">End</label>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => setQuietHours(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quietHours.allowCritical}
                  onChange={(e) => setQuietHours(prev => ({ ...prev, allowCritical: e.target.checked }))}
                  className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-sm text-slate-300">Always allow critical alarms</span>
              </label>
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
              <h2 className="text-white font-bold mb-4">Today's Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Notifications</span>
                  <span className="text-white font-bold">{notificationList.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Critical Alarms</span>
                  <span className="text-red-400 font-bold">
                    {notificationList.filter(n => n.priority === 'critical').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Unread</span>
                  <span className="text-cyan-400 font-bold">{unreadCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
