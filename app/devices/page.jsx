'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';

export default function DevicesPage() {
  const toast = useToast();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [deviceToRestart, setDeviceToRestart] = useState(null);

  const handleScanDevices = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      toast.info('Scan complete. No new devices found.');
    }, 2000);
  };

  const handleViewLogs = (device) => {
    toast.info(`Viewing logs for ${device.name}: 47 connection events, 3 parameter updates, 0 errors`);
  };

  const handleRestartDevice = (device) => {
    setDeviceToRestart(device);
    setShowRestartConfirm(true);
  };

  const confirmRestart = () => {
    if (deviceToRestart) {
      toast.success(`Restart command sent to ${deviceToRestart.name}. Device will reconnect automatically.`);
      setShowRestartConfirm(false);
      setDeviceToRestart(null);
    }
  };

  const handleConfigureDevice = (device) => {
    toast.info(`Opening configuration panel for ${device.name}...`);
  };

  const devices = [
    { 
      id: 1, 
      name: 'Philips IntelliVue MX800', 
      type: 'Patient Monitor',
      bed: '01',
      serial: 'PHI-MX800-2847',
      ip: '192.168.1.101',
      status: 'online',
      firmware: 'v4.2.1',
      lastMaintenance: '2024-11-15',
      nextMaintenance: '2025-05-15',
      battery: 100,
      alerts: 0
    },
    { 
      id: 2, 
      name: 'Philips IntelliVue MX800', 
      type: 'Patient Monitor',
      bed: '02',
      serial: 'PHI-MX800-2848',
      ip: '192.168.1.102',
      status: 'online',
      firmware: 'v4.2.1',
      lastMaintenance: '2024-11-15',
      nextMaintenance: '2025-05-15',
      battery: 85,
      alerts: 1
    },
    { 
      id: 3, 
      name: 'Philips IntelliVue MX800', 
      type: 'Patient Monitor',
      bed: '03',
      serial: 'PHI-MX800-2849',
      ip: '192.168.1.103',
      status: 'online',
      firmware: 'v4.2.0',
      lastMaintenance: '2024-10-20',
      nextMaintenance: '2025-04-20',
      battery: 100,
      alerts: 0
    },
    { 
      id: 4, 
      name: 'Philips IntelliVue MX800', 
      type: 'Patient Monitor',
      bed: '04',
      serial: 'PHI-MX800-2850',
      ip: '192.168.1.104',
      status: 'warning',
      firmware: 'v4.1.8',
      lastMaintenance: '2024-08-10',
      nextMaintenance: '2025-02-10',
      battery: 45,
      alerts: 2
    },
    { 
      id: 5, 
      name: 'Masimo Radical-7', 
      type: 'Pulse Oximeter',
      bed: '01',
      serial: 'MAS-R7-1024',
      ip: '192.168.1.201',
      status: 'online',
      firmware: 'v2.8.4',
      lastMaintenance: '2024-12-01',
      nextMaintenance: '2025-06-01',
      battery: 100,
      alerts: 0
    },
    { 
      id: 6, 
      name: 'Dräger Babylog VN500', 
      type: 'Ventilator',
      bed: '04',
      serial: 'DRG-VN500-445',
      ip: '192.168.1.301',
      status: 'online',
      firmware: 'v3.1.0',
      lastMaintenance: '2024-11-28',
      nextMaintenance: '2025-05-28',
      battery: null,
      alerts: 0
    },
    { 
      id: 7, 
      name: 'Giraffe OmniBed', 
      type: 'Incubator',
      bed: '02',
      serial: 'GE-OMN-892',
      ip: '192.168.1.401',
      status: 'online',
      firmware: 'v5.0.2',
      lastMaintenance: '2024-10-15',
      nextMaintenance: '2025-04-15',
      battery: null,
      alerts: 0
    },
    { 
      id: 8, 
      name: 'Alaris Infusion Pump', 
      type: 'IV Pump',
      bed: '03',
      serial: 'BD-ALA-2201',
      ip: '192.168.1.501',
      status: 'offline',
      firmware: 'v1.4.2',
      lastMaintenance: '2024-09-20',
      nextMaintenance: '2025-03-20',
      battery: 0,
      alerts: 1
    },
  ];

  const deviceTypes = [...new Set(devices.map(d => d.type))];
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredDevices = devices.filter(d => {
    if (filterType !== 'all' && d.type !== filterType) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    warning: devices.filter(d => d.status === 'warning').length,
    offline: devices.filter(d => d.status === 'offline').length,
    alerts: devices.reduce((sum, d) => sum + d.alerts, 0),
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Device Management</h1>
            <p className="text-sm text-slate-400 mt-1">Monitor and configure connected medical devices</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleScanDevices}
              disabled={isScanning}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 disabled:cursor-wait text-white rounded-lg font-medium transition-colors"
            >
              {isScanning ? 'Scanning...' : 'Scan for Devices'}
            </button>
            <button
              onClick={() => setShowAddDevice(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
            >
              Add Device
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Total Devices</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Online</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.online}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Warning</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">{stats.warning}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Offline</div>
            <div className="text-2xl font-bold text-red-400 mt-1">{stats.offline}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Active Alerts</div>
            <div className="text-2xl font-bold text-orange-400 mt-1">{stats.alerts}</div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Types</option>
            {deviceTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="warning">Warning</option>
            <option value="offline">Offline</option>
          </select>
        </div>
        
        {/* Device Grid */}
        <div className="grid grid-cols-2 gap-4">
          {filteredDevices.map(device => (
            <div 
              key={device.id}
              onClick={() => setSelectedDevice(device)}
              className={`bg-slate-900 rounded-xl border p-4 cursor-pointer transition-colors ${
                selectedDevice?.id === device.id 
                  ? 'border-cyan-500' 
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    device.type === 'Patient Monitor' ? 'bg-cyan-500/20 text-cyan-400' :
                    device.type === 'Pulse Oximeter' ? 'bg-blue-500/20 text-blue-400' :
                    device.type === 'Ventilator' ? 'bg-purple-500/20 text-purple-400' :
                    device.type === 'Incubator' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {device.type === 'Patient Monitor' && (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                    {device.type === 'Pulse Oximeter' && (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                    {device.type === 'Ventilator' && (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    )}
                    {device.type === 'Incubator' && (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    )}
                    {device.type === 'IV Pump' && (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="text-white font-medium">{device.name}</div>
                    <div className="text-xs text-slate-500">{device.type} • BED {device.bed}</div>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  device.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' :
                  device.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {device.status.toUpperCase()}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-slate-500">Serial</div>
                  <div className="text-slate-300 font-mono text-xs">{device.serial}</div>
                </div>
                <div>
                  <div className="text-slate-500">IP Address</div>
                  <div className="text-slate-300 font-mono text-xs">{device.ip}</div>
                </div>
                <div>
                  <div className="text-slate-500">Firmware</div>
                  <div className="text-slate-300 font-mono text-xs">{device.firmware}</div>
                </div>
              </div>
              
              {device.alerts > 0 && (
                <div className="mt-3 flex items-center gap-2 text-orange-400 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{device.alerts} alert{device.alerts > 1 ? 's' : ''} require attention</span>
                </div>
              )}
              
              {device.battery !== null && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">Battery</span>
                    <span className={device.battery < 20 ? 'text-red-400' : device.battery < 50 ? 'text-yellow-400' : 'text-emerald-400'}>
                      {device.battery}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        device.battery < 20 ? 'bg-red-500' : device.battery < 50 ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${device.battery}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Device Detail Modal */}
        {selectedDevice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedDevice(null)}>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    selectedDevice.status === 'online' ? 'bg-emerald-500/20' :
                    selectedDevice.status === 'warning' ? 'bg-yellow-500/20' :
                    'bg-red-500/20'
                  }`}>
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedDevice.name}</h2>
                    <p className="text-sm text-slate-400">{selectedDevice.type} • BED {selectedDevice.bed}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDevice(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-white font-medium">Device Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Serial Number</span>
                      <span className="text-white font-mono">{selectedDevice.serial}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">IP Address</span>
                      <span className="text-white font-mono">{selectedDevice.ip}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Firmware</span>
                      <span className="text-white font-mono">{selectedDevice.firmware}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Status</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selectedDevice.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' :
                        selectedDevice.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {selectedDevice.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-white font-medium">Maintenance</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Last Maintenance</span>
                      <span className="text-white">{new Date(selectedDevice.lastMaintenance).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Next Maintenance</span>
                      <span className="text-white">{new Date(selectedDevice.nextMaintenance).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
                <button
                  onClick={() => handleViewLogs(selectedDevice)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                >
                  View Logs
                </button>
                <button
                  onClick={() => handleRestartDevice(selectedDevice)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                >
                  Restart Device
                </button>
                <button
                  onClick={() => handleConfigureDevice(selectedDevice)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
                >
                  Configure
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restart Confirmation Modal */}
        <ConfirmModal
          isOpen={showRestartConfirm}
          onClose={() => { setShowRestartConfirm(false); setDeviceToRestart(null); }}
          onConfirm={confirmRestart}
          title="Restart Device"
          message={deviceToRestart ? `Are you sure you want to restart ${deviceToRestart.name}? This will temporarily disconnect the device from monitoring.` : ''}
          confirmText="Restart"
          variant="danger"
        />

        {/* Add Device Modal */}
        {showAddDevice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddDevice(false)}>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Add New Device</h2>
                <button onClick={() => setShowAddDevice(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Device Type</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
                    <option>Patient Monitor</option>
                    <option>Pulse Oximeter</option>
                    <option>Ventilator</option>
                    <option>Incubator</option>
                    <option>IV Pump</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Device Name/Model</label>
                  <input type="text" placeholder="e.g. Philips IntelliVue MX800" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Serial Number</label>
                  <input type="text" placeholder="e.g. PHI-MX800-XXXX" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">IP Address</label>
                  <input type="text" placeholder="e.g. 192.168.1.XXX" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Assign to Bed</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
                    <option>BED 01</option>
                    <option>BED 02</option>
                    <option>BED 03</option>
                    <option>BED 04</option>
                    <option>BED 05</option>
                    <option>BED 06</option>
                    <option>BED 07</option>
                    <option>BED 08</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <button onClick={() => setShowAddDevice(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Cancel</button>
                <button onClick={() => { toast.success('Device added successfully!'); setShowAddDevice(false); }} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg">Add Device</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
