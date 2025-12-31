'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { useToast } from '@/components/Toast';

export default function AuditPage() {
  const toast = useToast();
  const [filterType, setFilterType] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Type', 'User', 'Action', 'Details', 'Severity'];
    const rows = auditLogs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.type,
      log.user,
      log.action,
      log.details,
      log.severity
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    toast.info('Generating PDF report with audit log entries, filter criteria, and summary statistics...');
  };

  const auditLogs = [
    { id: 1, timestamp: '2024-12-29T19:45:00', user: 'RN J. Moore', action: 'Patient Discharge', details: 'Discharged SMITH, BABY from BED 06', type: 'patient', severity: 'info' },
    { id: 2, timestamp: '2024-12-29T19:30:00', user: 'System', action: 'Alarm Escalation', details: 'Critical alarm escalated to supervisor for BED 04', type: 'alarm', severity: 'warning' },
    { id: 3, timestamp: '2024-12-29T19:15:00', user: 'Dr. S. Chen', action: 'Order Modified', details: 'Updated medication order for WILLIAMS, BABY', type: 'order', severity: 'info' },
    { id: 4, timestamp: '2024-12-29T19:00:00', user: 'RN A. Clark', action: 'Alarm Acknowledged', details: 'Acknowledged SpO2 low alarm for BED 02', type: 'alarm', severity: 'info' },
    { id: 5, timestamp: '2024-12-29T18:45:00', user: 'RN J. Moore', action: 'Shift Handoff', details: 'Completed shift handoff report', type: 'system', severity: 'info' },
    { id: 6, timestamp: '2024-12-29T18:30:00', user: 'Admin', action: 'Settings Changed', details: 'Modified alarm escalation rules', type: 'settings', severity: 'warning' },
    { id: 7, timestamp: '2024-12-29T18:15:00', user: 'System', action: 'Device Offline', details: 'IV Pump BD-ALA-2201 lost connection', type: 'device', severity: 'error' },
    { id: 8, timestamp: '2024-12-29T18:00:00', user: 'RN J. Moore', action: 'Vital Signs Documented', details: 'Documented vitals for MARTINEZ, BABY', type: 'patient', severity: 'info' },
    { id: 9, timestamp: '2024-12-29T17:45:00', user: 'Dr. M. Johnson', action: 'Lab Results Reviewed', details: 'Reviewed CBC results for CHEN, BABY', type: 'patient', severity: 'info' },
    { id: 10, timestamp: '2024-12-29T17:30:00', user: 'System', action: 'Backup Completed', details: 'Automatic system backup completed successfully', type: 'system', severity: 'info' },
    { id: 11, timestamp: '2024-12-29T17:15:00', user: 'RN A. Clark', action: 'Medication Administered', details: 'Administered Caffeine Citrate to THOMPSON, BABY', type: 'patient', severity: 'info' },
    { id: 12, timestamp: '2024-12-29T17:00:00', user: 'System', action: 'Login Failed', details: 'Failed login attempt for user unknown@hospital.org', type: 'security', severity: 'error' },
    { id: 13, timestamp: '2024-12-29T16:45:00', user: 'RN J. Moore', action: 'Alarm Limits Changed', details: 'Updated SpO2 limits for WILLIAMS, BABY', type: 'settings', severity: 'warning' },
    { id: 14, timestamp: '2024-12-29T16:30:00', user: 'Dr. S. Chen', action: 'Note Added', details: 'Added clinical note for GARCIA, BABY', type: 'patient', severity: 'info' },
    { id: 15, timestamp: '2024-12-29T16:15:00', user: 'System', action: 'User Login', details: 'RN J. Moore logged in from Workstation 3', type: 'security', severity: 'info' },
  ];

  const users = [...new Set(auditLogs.map(log => log.user))];
  const types = [...new Set(auditLogs.map(log => log.type))];

  const filteredLogs = auditLogs.filter(log => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (filterUser !== 'all' && log.user !== filterUser) return false;
    return true;
  });

  const stats = {
    total: auditLogs.length,
    today: auditLogs.filter(log => new Date(log.timestamp).toDateString() === new Date().toDateString()).length,
    warnings: auditLogs.filter(log => log.severity === 'warning').length,
    errors: auditLogs.filter(log => log.severity === 'error').length,
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'patient': return '👤';
      case 'alarm': return '🔔';
      case 'order': return '📋';
      case 'settings': return '⚙️';
      case 'device': return '🖥️';
      case 'security': return '🔒';
      case 'system': return '💻';
      default: return '📝';
    }
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Log</h1>
            <p className="text-sm text-slate-400 mt-1">System activity and access history</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Total Events</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Today</div>
            <div className="text-2xl font-bold text-cyan-400 mt-1">{stats.today}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Warnings</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">{stats.warnings}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Errors</div>
            <div className="text-2xl font-bold text-red-400 mt-1">{stats.errors}</div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm text-slate-400 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search events..."
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Types</option>
                {types.map(type => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">User</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Users</option>
                {users.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">From</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">To</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>
        
        {/* Audit Log Table */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Timestamp</th>
                <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Type</th>
                <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">User</th>
                <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Action</th>
                <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Details</th>
                <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Severity</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-3 px-4">
                    <div className="text-sm text-white font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-slate-800 rounded text-sm">
                      {getTypeIcon(log.type)} {log.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-white">{log.user}</td>
                  <td className="py-3 px-4 text-sm text-white font-medium">{log.action}</td>
                  <td className="py-3 px-4 text-sm text-slate-400 max-w-xs truncate">{log.details}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(log.severity)}`}>
                      {log.severity.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-slate-800">
            <div className="text-sm text-slate-400">
              Showing {filteredLogs.length} of {auditLogs.length} events
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-colors">
                Previous
              </button>
              <button className="px-3 py-1.5 bg-cyan-600 text-white rounded text-sm">1</button>
              <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-colors">2</button>
              <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-colors">3</button>
              <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-colors">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
