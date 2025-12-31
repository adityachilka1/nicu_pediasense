'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const user = {
    name: 'Jessica Moore',
    role: 'Charge Nurse, RN',
    email: 'jessica.moore@memorial.org',
    phone: '(555) 123-4567',
    employeeId: 'EMP-2847',
    department: 'NICU Floor 3 West',
    startDate: '2019-03-15',
    certifications: ['NRP', 'STABLE', 'PALS', 'BLS'],
    shift: 'Day Shift (7a-7p)',
    supervisor: 'Dr. Sarah Chen',
  };
  
  const recentActivity = [
    { action: 'Logged in', time: '2024-12-29 07:02:00', ip: '192.168.1.45' },
    { action: 'Viewed patient WILLIAMS, BABY', time: '2024-12-29 07:15:00', ip: '192.168.1.45' },
    { action: 'Acknowledged alarm BED 04', time: '2024-12-29 07:18:00', ip: '192.168.1.45' },
    { action: 'Updated vitals note', time: '2024-12-29 08:30:00', ip: '192.168.1.45' },
    { action: 'Generated shift report', time: '2024-12-29 18:45:00', ip: '192.168.1.45' },
    { action: 'Logged out', time: '2024-12-29 19:05:00', ip: '192.168.1.45' },
  ];
  
  const notifications = {
    email: { alarms: true, reports: true, system: false },
    sms: { alarms: true, reports: false, system: false },
    push: { alarms: true, reports: true, system: true },
  };

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white">
            JM
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{user.name}</h1>
            <p className="text-slate-400">{user.role}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                Active
              </span>
              <span className="text-sm text-slate-500">{user.department}</span>
            </div>
          </div>
          <button 
            onClick={() => setShowPasswordModal(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Change Password
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-slate-800">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'preferences', label: 'Preferences' },
            { id: 'activity', label: 'Activity Log' },
            { id: 'sessions', label: 'Active Sessions' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                  <input
                    type="text"
                    defaultValue={user.name}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                  <input
                    type="email"
                    defaultValue={user.email}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Phone</label>
                  <input
                    type="tel"
                    defaultValue={user.phone}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors">
                  Update Profile
                </button>
              </div>
            </div>
            
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Work Information</h2>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Employee ID</span>
                  <span className="text-white font-mono">{user.employeeId}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Department</span>
                  <span className="text-white">{user.department}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Shift</span>
                  <span className="text-white">{user.shift}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Supervisor</span>
                  <span className="text-white">{user.supervisor}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Start Date</span>
                  <span className="text-white">{new Date(user.startDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div className="col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Certifications</h2>
              <div className="flex flex-wrap gap-3">
                {user.certifications.map(cert => (
                  <div key={cert} className="px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
                    <div className="text-white font-medium">{cert}</div>
                    <div className="text-xs text-emerald-400">Valid</div>
                  </div>
                ))}
                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-white transition-colors">
                  + Add Certification
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Notification Preferences</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-3 text-slate-400 font-medium">Type</th>
                      <th className="text-center py-3 text-slate-400 font-medium">Email</th>
                      <th className="text-center py-3 text-slate-400 font-medium">SMS</th>
                      <th className="text-center py-3 text-slate-400 font-medium">Push</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: 'alarms', label: 'Critical Alarms' },
                      { id: 'reports', label: 'Shift Reports' },
                      { id: 'system', label: 'System Updates' },
                    ].map(row => (
                      <tr key={row.id} className="border-b border-slate-800">
                        <td className="py-3 text-white">{row.label}</td>
                        <td className="text-center py-3">
                          <input type="checkbox" defaultChecked={notifications.email[row.id]} className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500" />
                        </td>
                        <td className="text-center py-3">
                          <input type="checkbox" defaultChecked={notifications.sms[row.id]} className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500" />
                        </td>
                        <td className="text-center py-3">
                          <input type="checkbox" defaultChecked={notifications.push[row.id]} className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Display Preferences</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Default View</label>
                  <select className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                    <option>Monitor Dashboard</option>
                    <option>Patient List</option>
                    <option>Alarms</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Refresh Rate</label>
                  <select className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                    <option>1 second</option>
                    <option>2 seconds</option>
                    <option>5 seconds</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Recent Activity</h2>
              <button className="text-sm text-cyan-400 hover:text-cyan-300">Export Log</button>
            </div>
            <div className="space-y-2">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span className="text-white">{activity.action}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500 font-mono">{activity.ip}</span>
                    <span className="text-sm text-slate-400">{new Date(activity.time).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Active Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Active Sessions</h2>
              <button className="text-sm text-red-400 hover:text-red-300">Logout All Devices</button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-cyan-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium">Central Station - Workstation 3</div>
                    <div className="text-sm text-slate-500">Chrome on Windows • 192.168.1.45</div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded text-sm">Current</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium">iPhone 14 Pro</div>
                    <div className="text-sm text-slate-500">NICU App • Last active 2 hours ago</div>
                  </div>
                </div>
                <button className="text-sm text-red-400 hover:text-red-300">Logout</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 w-full max-w-md">
              <h2 className="text-lg font-bold text-white mb-4">Change Password</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Current Password</label>
                  <input type="password" className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">New Password</label>
                  <input type="password" className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Confirm New Password</label>
                  <input type="password" className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors">
                    Update Password
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
