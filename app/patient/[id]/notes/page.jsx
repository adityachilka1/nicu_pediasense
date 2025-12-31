'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PatientHeader from '@/components/PatientHeader';
import PatientTabs from '@/components/PatientTabs';
import { initialPatients, formatTimeAgo } from '@/lib/data';

export default function PatientNotesPage() {
  const params = useParams();
  const patient = initialPatients.find(p => p.id === parseInt(params.id)) || initialPatients[0];
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('progress');
  const [filter, setFilter] = useState('all');
  
  const [notes, setNotes] = useState([
    { id: 1, type: 'progress', author: 'RN Jessica Moore', timestamp: '2024-12-29T18:30:00', content: 'Patient stable this shift. Tolerating feeds well, no residuals. Skin intact, no concerns. Parents visited and held baby for 2 hours.' },
    { id: 2, type: 'assessment', author: 'RN Jessica Moore', timestamp: '2024-12-29T16:00:00', content: 'Head to toe assessment completed. HEENT: Fontanelle soft and flat. Chest: Clear bilateral breath sounds. Abdomen: Soft, non-distended, positive bowel sounds. Extremities: Good perfusion, cap refill <2 sec.' },
    { id: 3, type: 'vital-signs', author: 'RN Jessica Moore', timestamp: '2024-12-29T14:00:00', content: 'Vital signs stable. HR 145, RR 42, SpO2 96%, Temp 36.8°C. No apnea or brady events this shift.' },
    { id: 4, type: 'feeding', author: 'RN Amanda Clark', timestamp: '2024-12-29T12:00:00', content: 'Fed 45mL breast milk via NGT over 30 minutes. No residual. Tolerated well, no spitting or emesis. Weight: 1.82 kg (+15g from yesterday).' },
    { id: 5, type: 'procedure', author: 'Dr. Sarah Chen', timestamp: '2024-12-29T10:00:00', content: 'PICC line dressing changed. Site clean, no signs of infection. Line flushing easily, good blood return.' },
    { id: 6, type: 'family', author: 'RN Jessica Moore', timestamp: '2024-12-29T08:00:00', content: 'Parents updated on plan of care. Mother expressed interest in transitioning to breastfeeding. Lactation consult scheduled for tomorrow.' },
    { id: 7, type: 'progress', author: 'RN David Park', timestamp: '2024-12-29T06:00:00', content: 'Night shift uneventful. Baby slept well between feeds. Two A/B events self-resolved within 10 seconds. Continue current plan.' },
  ]);
  
  const noteTypes = [
    { id: 'progress', name: 'Progress Note', color: 'bg-blue-500' },
    { id: 'assessment', name: 'Assessment', color: 'bg-purple-500' },
    { id: 'vital-signs', name: 'Vital Signs', color: 'bg-cyan-500' },
    { id: 'feeding', name: 'Feeding', color: 'bg-green-500' },
    { id: 'procedure', name: 'Procedure', color: 'bg-orange-500' },
    { id: 'family', name: 'Family Update', color: 'bg-pink-500' },
    { id: 'alert', name: 'Alert', color: 'bg-red-500' },
  ];
  
  const filteredNotes = filter === 'all' ? notes : notes.filter(n => n.type === filter);
  
  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    const note = {
      id: notes.length + 1,
      type: noteType,
      author: 'RN Jessica Moore',
      timestamp: new Date().toISOString(),
      content: newNote,
    };
    
    setNotes([note, ...notes]);
    setNewNote('');
  };
  
  return (
    <AppShell>
      <div className="p-6">
        <PatientHeader patient={patient} />
        <PatientTabs patientId={patient.id} />
        
        <div className="grid grid-cols-12 gap-6">
          {/* Add Note Form */}
          <div className="col-span-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 sticky top-4">
              <h2 className="text-lg font-bold text-white mb-4">Add New Note</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Note Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {noteTypes.map(type => (
                      <button
                        key={type.id}
                        onClick={() => setNoteType(type.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          noteType === type.id 
                            ? 'bg-slate-700 text-white border border-slate-600' 
                            : 'bg-slate-800/50 text-slate-400 border border-transparent hover:border-slate-700'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${type.color}`} />
                        {type.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Note Content</label>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Enter your nursing note..."
                    rows={6}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="Add Template">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="Voice Input">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    Save Note
                  </button>
                </div>
              </div>
              
              {/* Quick Templates */}
              <div className="mt-6 pt-4 border-t border-slate-800">
                <h3 className="text-sm font-medium text-slate-400 mb-3">Quick Templates</h3>
                <div className="space-y-2">
                  {['Head to toe assessment', 'Feeding tolerance', 'Vital signs stable', 'Parent visit'].map(template => (
                    <button
                      key={template}
                      onClick={() => setNewNote(prev => prev + (prev ? '\n\n' : '') + template + ': ')}
                      className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-lg text-sm text-slate-300 transition-colors"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Notes List */}
          <div className="col-span-8">
            {/* Filter */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-slate-400">Filter:</span>
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              {noteTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setFilter(type.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    filter === type.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${type.color}`} />
                  {type.name}
                </button>
              ))}
            </div>
            
            {/* Notes */}
            <div className="space-y-4">
              {filteredNotes.map(note => {
                const noteType = noteTypes.find(t => t.id === note.type);
                return (
                  <div key={note.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${noteType?.color}`} />
                        <span className="font-medium text-white">{noteType?.name}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-sm text-slate-400">{note.author}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">{formatTimeAgo(note.timestamp)}</span>
                        <button className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-300 whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800">
                      <button className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        Edit
                      </button>
                      <button className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        Add Addendum
                      </button>
                      <button className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        Link to Order
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
