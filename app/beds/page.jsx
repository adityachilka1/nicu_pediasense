'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { useVitals } from '@/context/VitalsContext';

// Static bed configuration (rooms, zones, equipment)
const bedConfig = [
  { id: '01', room: 'A', zone: 'High Acuity', equipment: ['Monitor', 'Oximeter'] },
  { id: '02', room: 'A', zone: 'High Acuity', equipment: ['Monitor', 'Oximeter', 'Incubator'] },
  { id: '03', room: 'B', zone: 'High Acuity', equipment: ['Monitor', 'Oximeter'] },
  { id: '04', room: 'B', zone: 'Critical', equipment: ['Monitor', 'Oximeter', 'Ventilator', 'IV Pump'] },
  { id: '05', room: 'C', zone: 'Standard', equipment: ['Monitor', 'Oximeter'] },
  { id: '06', room: 'C', zone: 'Standard', equipment: ['Monitor'] },
  { id: '07', room: 'D', zone: 'Step Down', equipment: ['Monitor'] },
  { id: '08', room: 'D', zone: 'Step Down', equipment: ['Monitor', 'Oximeter'] },
  { id: '09', room: 'E', zone: 'Standard', equipment: ['Monitor', 'Oximeter'] },
  { id: '10', room: 'E', zone: 'Standard', equipment: ['Monitor'] },
  { id: '11', room: 'F', zone: 'Isolation', equipment: ['Monitor', 'Oximeter', 'HEPA Filter'] },
  { id: '12', room: 'F', zone: 'Isolation', equipment: ['Monitor', 'Oximeter', 'HEPA Filter'] },
];

export default function BedsPage() {
  const toast = useToast();
  const { patients, isLoading, dataSource } = useVitals();
  const [view, setView] = useState('grid');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState('');
  const [bedEquipment, setBedEquipment] = useState({});

  // Merge patient data with bed config
  const beds = useMemo(() => {
    return bedConfig.map(bed => {
      const patient = patients.find(p => p.bed === bed.id);
      const customEquipment = bedEquipment[bed.id] || bed.equipment;
      return {
        ...bed,
        equipment: customEquipment,
        patient: patient || null,
        status: patient ? 'occupied' : (bed.id === '10' ? 'cleaning' : bed.id === '12' ? 'maintenance' : 'available'),
      };
    });
  }, [patients, bedEquipment]);

  // Update selectedBed when beds change
  useEffect(() => {
    if (selectedBed) {
      const updatedBed = beds.find(b => b.id === selectedBed.id);
      if (updatedBed) {
        setSelectedBed(updatedBed);
      }
    }
  }, [beds, selectedBed?.id]);

  const zones = [...new Set(beds.map(b => b.zone))];
  const rooms = [...new Set(beds.map(b => b.room))];

  const handleSaveChanges = (updatedBed) => {
    // Save custom equipment for this bed
    setBedEquipment(prev => ({
      ...prev,
      [updatedBed.id]: updatedBed.equipment
    }));
    setShowAssignModal(false);
    toast.success('Bed settings saved successfully!');
  };

  const handleRemoveEquipment = (equipmentName) => {
    setSelectedBed(prev => ({
      ...prev,
      equipment: prev.equipment.filter(eq => eq !== equipmentName)
    }));
  };

  const handleAddEquipment = () => {
    if (newEquipment.trim()) {
      setSelectedBed(prev => ({
        ...prev,
        equipment: [...prev.equipment, newEquipment.trim()]
      }));
      setNewEquipment('');
      setShowAddEquipment(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading bed data...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const stats = {
    total: beds.length,
    occupied: beds.filter(b => b.status === 'occupied').length,
    available: beds.filter(b => b.status === 'available').length,
    cleaning: beds.filter(b => b.status === 'cleaning').length,
    maintenance: beds.filter(b => b.status === 'maintenance').length,
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'occupied': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'available': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'cleaning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'maintenance': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-700 text-slate-400';
    }
  };

  const getZoneColor = (zone) => {
    switch (zone) {
      case 'Critical': return 'bg-red-500/10 border-red-500/30';
      case 'High Acuity': return 'bg-orange-500/10 border-orange-500/30';
      case 'Standard': return 'bg-blue-500/10 border-blue-500/30';
      case 'Step Down': return 'bg-emerald-500/10 border-emerald-500/30';
      case 'Isolation': return 'bg-purple-500/10 border-purple-500/30';
      default: return 'bg-slate-800 border-slate-700';
    }
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Bed Management</h1>
            <p className="text-sm text-slate-400 mt-1">Floor 3 West • Unit A</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setView('grid')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'list' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setView('floor')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'floor' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                }`}
              >
                Floor Plan
              </button>
            </div>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Total Beds</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Occupied</div>
            <div className="text-2xl font-bold text-cyan-400 mt-1">{stats.occupied}</div>
            <div className="text-xs text-slate-500 mt-1">{Math.round(stats.occupied / stats.total * 100)}% capacity</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Available</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.available}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Cleaning</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">{stats.cleaning}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-sm text-slate-400">Maintenance</div>
            <div className="text-2xl font-bold text-red-400 mt-1">{stats.maintenance}</div>
          </div>
        </div>
        
        {/* Grid View */}
        {view === 'grid' && (
          <div className="grid grid-cols-4 gap-4">
            {beds.map(bed => (
              <div
                key={bed.id}
                onClick={() => { setSelectedBed(bed); setShowAssignModal(true); }}
                className={`rounded-xl border p-4 cursor-pointer transition-all hover:scale-[1.02] ${getZoneColor(bed.zone)}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">BED {bed.id}</span>
                    <span className="text-xs text-slate-500">Room {bed.room}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(bed.status)}`}>
                    {bed.status.toUpperCase()}
                  </span>
                </div>
                
                <div className="mb-3">
                  <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">{bed.zone}</span>
                </div>
                
                {bed.patient ? (
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-sm text-white font-medium truncate">{bed.patient.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      GA {bed.patient.ga} • DOL {bed.patient.dol}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`w-2 h-2 rounded-full ${
                        bed.patient.status === 'critical' ? 'bg-red-500' :
                        bed.patient.status === 'warning' ? 'bg-yellow-500' :
                        'bg-emerald-500'
                      }`} />
                      <span className="text-xs text-slate-400 capitalize">{bed.patient.status}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-sm text-slate-500">No patient assigned</div>
                  </div>
                )}
                
                <div className="mt-3 flex flex-wrap gap-1">
                  {bed.equipment.map((eq, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">{eq}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* List View */}
        {view === 'list' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Bed</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Room</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Zone</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Patient</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Equipment</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {beds.map(bed => (
                  <tr key={bed.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-lg font-bold text-white">BED {bed.id}</td>
                    <td className="py-3 px-4 text-slate-300">{bed.room}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">{bed.zone}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(bed.status)}`}>
                        {bed.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {bed.patient ? (
                        <Link href={`/patient/${bed.patient.id}`} className="text-cyan-400 hover:text-cyan-300">
                          {bed.patient.name}
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {bed.equipment.slice(0, 2).map((eq, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">{eq}</span>
                        ))}
                        {bed.equipment.length > 2 && (
                          <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">+{bed.equipment.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button 
                        onClick={() => { setSelectedBed(bed); setShowAssignModal(true); }}
                        className="text-sm text-cyan-400 hover:text-cyan-300"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Floor Plan View */}
        {view === 'floor' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="grid grid-cols-6 gap-4">
              {rooms.map(room => (
                <div key={room} className="col-span-2">
                  <div className="text-center text-slate-400 text-sm mb-2">Room {room}</div>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="grid grid-cols-2 gap-3">
                      {beds.filter(b => b.room === room).map(bed => (
                        <div
                          key={bed.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                            bed.status === 'occupied' ? 'bg-cyan-500/20 border-cyan-500/30' :
                            bed.status === 'available' ? 'bg-emerald-500/20 border-emerald-500/30' :
                            bed.status === 'cleaning' ? 'bg-yellow-500/20 border-yellow-500/30' :
                            'bg-red-500/20 border-red-500/30'
                          }`}
                          onClick={() => { setSelectedBed(bed); setShowAssignModal(true); }}
                        >
                          <div className="text-center">
                            <div className="text-lg font-bold text-white">{bed.id}</div>
                            <div className="text-xs text-slate-400 mt-1">
                              {bed.patient ? bed.patient.name.split(',')[0] : bed.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-center gap-6 mt-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-cyan-500/50" />
                <span className="text-sm text-slate-400">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-500/50" />
                <span className="text-sm text-slate-400">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500/50" />
                <span className="text-sm text-slate-400">Cleaning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500/50" />
                <span className="text-sm text-slate-400">Maintenance</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Assign/Manage Modal */}
        {showAssignModal && selectedBed && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(false)}>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Manage BED {selectedBed.id}</h2>
                <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Status</label>
                  <select 
                    defaultValue={selectedBed.status}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="occupied">Occupied</option>
                    <option value="available">Available</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Zone</label>
                  <select 
                    defaultValue={selectedBed.zone}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    {zones.map(zone => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Current Patient</label>
                  {selectedBed.patient ? (
                    <div className="p-3 bg-slate-800 rounded-lg">
                      <div className="text-white font-medium">{selectedBed.patient.name}</div>
                      <div className="text-sm text-slate-400">GA {selectedBed.patient.ga} • DOL {selectedBed.patient.dol}</div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-800 rounded-lg text-slate-500">No patient assigned</div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Equipment</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedBed.equipment.map((eq, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-800 rounded-lg text-sm text-slate-300 flex items-center gap-2">
                        {eq}
                        <button
                          onClick={() => handleRemoveEquipment(eq)}
                          className="text-slate-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {showAddEquipment ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newEquipment}
                          onChange={(e) => setNewEquipment(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddEquipment()}
                          placeholder="Equipment name"
                          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white w-32"
                          autoFocus
                        />
                        <button
                          onClick={handleAddEquipment}
                          className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 rounded text-sm text-white"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setShowAddEquipment(false); setNewEquipment(''); }}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddEquipment(true)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-400 border border-dashed border-slate-600"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveChanges(selectedBed)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
