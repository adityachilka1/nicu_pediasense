'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PatientHeader from '@/components/PatientHeader';
import PatientTabs from '@/components/PatientTabs';
import { initialPatients } from '@/lib/data';
import { useToast } from '@/components/Toast';

export default function PatientTimelinePage() {
  const params = useParams();
  const patient = initialPatients.find(p => p.id === parseInt(params.id)) || initialPatients[0];
  const [filter, setFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddendumModal, setShowAddendumModal] = useState(false);
  const [addendumText, setAddendumText] = useState('');
  const toast = useToast();
  
  const events = [
    { id: 1, type: 'vitals', time: '2024-12-29T18:30:00', title: 'Vital Signs Recorded', desc: 'HR 145, RR 42, SpO2 96%, Temp 36.8°C', user: 'RN J. Moore' },
    { id: 2, type: 'feeding', time: '2024-12-29T18:00:00', title: 'Feeding Completed', desc: '45mL breast milk via NGT, no residual', user: 'RN J. Moore' },
    { id: 3, type: 'note', time: '2024-12-29T17:30:00', title: 'Progress Note', desc: 'Patient stable this shift, tolerating feeds well', user: 'RN J. Moore' },
    { id: 4, type: 'med', time: '2024-12-29T17:00:00', title: 'Medication Given', desc: 'Caffeine Citrate 10mg IV', user: 'RN J. Moore' },
    { id: 5, type: 'lab', time: '2024-12-29T16:00:00', title: 'Lab Results', desc: 'CBC: WBC 12.5, Hgb 14.2, Plt 185', user: 'Lab' },
    { id: 6, type: 'alarm', time: '2024-12-29T15:45:00', title: 'Alarm Event', desc: 'SpO2 dropped to 88%, self-resolved in 15 sec', user: 'System' },
    { id: 7, type: 'assessment', time: '2024-12-29T15:00:00', title: 'Head to Toe Assessment', desc: 'Fontanelle soft/flat, lungs clear, abdomen soft', user: 'RN J. Moore' },
    { id: 8, type: 'family', time: '2024-12-29T14:00:00', title: 'Parent Visit', desc: 'Parents held baby for 2 hours, skin-to-skin', user: 'RN J. Moore' },
    { id: 9, type: 'feeding', time: '2024-12-29T12:00:00', title: 'Feeding Completed', desc: '45mL breast milk via NGT, no residual', user: 'RN A. Clark' },
    { id: 10, type: 'procedure', time: '2024-12-29T10:00:00', title: 'PICC Dressing Change', desc: 'Site clean, no redness, line flushing well', user: 'Dr. S. Chen' },
    { id: 11, type: 'order', time: '2024-12-29T09:00:00', title: 'Order Placed', desc: 'CBC with differential, increase feeds to 48mL', user: 'Dr. S. Chen' },
    { id: 12, type: 'vitals', time: '2024-12-29T08:00:00', title: 'Vital Signs Recorded', desc: 'HR 142, RR 40, SpO2 97%, Temp 36.7°C', user: 'RN D. Park' },
  ];
  
  const filters = [
    { id: 'all', name: 'All', color: 'bg-slate-500' },
    { id: 'vitals', name: 'Vitals', color: 'bg-cyan-500' },
    { id: 'feeding', name: 'Feeding', color: 'bg-green-500' },
    { id: 'med', name: 'Medications', color: 'bg-purple-500' },
    { id: 'lab', name: 'Labs', color: 'bg-blue-500' },
    { id: 'note', name: 'Notes', color: 'bg-slate-400' },
    { id: 'alarm', name: 'Alarms', color: 'bg-red-500' },
    { id: 'procedure', name: 'Procedures', color: 'bg-orange-500' },
    { id: 'family', name: 'Family', color: 'bg-pink-500' },
  ];
  
  const getEventColor = (type) => {
    const f = filters.find(fi => fi.id === type);
    return f ? f.color : 'bg-slate-500';
  };
  
  const filteredEvents = filter === 'all' ? events : events.filter(e => e.type === filter);
  
  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return {
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  };
  
  return (
    <AppShell>
      <div className="p-6">
        <PatientHeader patient={patient} />
        <PatientTabs patientId={patient.id} />
        
        {/* Page Actions */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Care Timeline</h2>
          <div className="flex items-center gap-3">
            <input
              type="date"
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => toast.success('Timeline exported to PDF')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              Export
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.id 
                  ? 'bg-slate-700 text-white' 
                  : 'bg-slate-800/50 text-slate-400 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${f.color}`} />
              {f.name}
            </button>
          ))}
        </div>
        
        {/* Timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-800" />
          
          <div className="space-y-4">
            {filteredEvents.map((event, i) => {
              const { time, date } = formatTime(event.time);
              return (
                <div key={event.id} className="relative pl-14">
                  {/* Dot */}
                  <div className={`absolute left-4 w-5 h-5 rounded-full ${getEventColor(event.type)} border-4 border-slate-900 z-10`} />
                  
                  {/* Card */}
                  <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-slate-700 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-white">{event.title}</h3>
                        <p className="text-sm text-slate-400">{event.desc}</p>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-mono text-white">{time}</div>
                        <div className="text-slate-500">{date}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-xs text-slate-500">{event.user}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          View Details
                        </button>
                        {event.type === 'note' && (
                          <button
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowAddendumModal(true);
                            }}
                            className="text-xs text-cyan-400 hover:text-cyan-300"
                          >
                            Add Addendum
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Load More */}
        <div className="text-center mt-8">
          <button
            onClick={() => toast.info('Loading more events...')}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Load More Events
          </button>
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && !showAddendumModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${getEventColor(selectedEvent.type)}`} />
                  <h3 className="text-lg font-semibold text-white">{selectedEvent.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-slate-300">{selectedEvent.desc}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Date & Time</div>
                    <div className="text-white font-medium">
                      {new Date(selectedEvent.time).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Documented By</div>
                    <div className="text-white font-medium">{selectedEvent.user}</div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Event Type</div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getEventColor(selectedEvent.type)}`} />
                    <span className="text-white font-medium capitalize">{selectedEvent.type}</span>
                  </div>
                </div>

                {selectedEvent.type === 'vitals' && (
                  <div className="bg-slate-900 rounded-lg p-4">
                    <div className="text-xs text-slate-500 mb-2">Vital Signs Breakdown</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Heart Rate:</span>
                        <span className="text-cyan-400 font-mono">145 bpm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Resp Rate:</span>
                        <span className="text-yellow-400 font-mono">42 /min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">SpO2:</span>
                        <span className="text-cyan-400 font-mono">96%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Temperature:</span>
                        <span className="text-pink-400 font-mono">36.8°C</span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedEvent.type === 'lab' && (
                  <div className="bg-slate-900 rounded-lg p-4">
                    <div className="text-xs text-slate-500 mb-2">Lab Results</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">WBC:</span>
                        <span className="text-white font-mono">12.5 K/uL</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Hemoglobin:</span>
                        <span className="text-white font-mono">14.2 g/dL</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Platelets:</span>
                        <span className="text-white font-mono">185 K/uL</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  Close
                </button>
                {selectedEvent.type === 'note' && (
                  <button
                    onClick={() => setShowAddendumModal(true)}
                    className="flex-1 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
                  >
                    Add Addendum
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Addendum Modal */}
        {showAddendumModal && selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Add Addendum</h3>
                <button
                  onClick={() => {
                    setShowAddendumModal(false);
                    setAddendumText('');
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Original Note</div>
                  <p className="text-slate-300 text-sm">{selectedEvent.desc}</p>
                  <div className="text-xs text-slate-500 mt-2">
                    {selectedEvent.user} • {new Date(selectedEvent.time).toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Addendum Text</label>
                  <textarea
                    value={addendumText}
                    onChange={(e) => setAddendumText(e.target.value)}
                    placeholder="Enter your addendum..."
                    rows={4}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white resize-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-yellow-400">Addendums are permanently added to the medical record</span>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowAddendumModal(false);
                    setAddendumText('');
                  }}
                  className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!addendumText.trim()) {
                      toast.error('Please enter addendum text');
                      return;
                    }
                    toast.success('Addendum added successfully');
                    setShowAddendumModal(false);
                    setSelectedEvent(null);
                    setAddendumText('');
                  }}
                  className="flex-1 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
                >
                  Save Addendum
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
