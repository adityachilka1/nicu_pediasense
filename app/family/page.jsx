'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';

const families = [
  { id: 1, patient: 'Baby Martinez', parents: 'Maria & Jose Martinez', phone: '(555) 123-4567', email: 'martinez@email.com', lastContact: '2024-12-29 09:30', unread: 2 },
  { id: 2, patient: 'Baby Thompson', parents: 'Sarah Thompson', phone: '(555) 234-5678', email: 'sthompson@email.com', lastContact: '2024-12-28 14:00', unread: 0 },
  { id: 3, patient: 'Baby Williams', parents: 'James & Lisa Williams', phone: '(555) 345-6789', email: 'williams.family@email.com', lastContact: '2024-12-29 08:00', unread: 1 },
];

const messages = [
  { id: 1, from: 'RN J. Moore', to: 'Martinez Family', type: 'update', message: 'Good morning! Baby had a restful night. Weight this morning: 1180g (+15g). Feeds are going well.', time: '2024-12-29 07:00', read: true },
  { id: 2, from: 'Martinez Family', to: 'NICU Team', type: 'question', message: 'Thank you for the update! When will the next head ultrasound be?', time: '2024-12-29 08:15', read: true },
  { id: 3, from: 'Dr. Chen', to: 'Martinez Family', type: 'response', message: 'Head ultrasound is scheduled for tomorrow morning. I\'ll review results with you during rounds.', time: '2024-12-29 09:30', read: false },
];

const milestones = [
  { id: 1, patient: 'Baby Martinez', event: 'First kangaroo care session', date: '2024-12-20', shared: true },
  { id: 2, patient: 'Baby Martinez', event: 'Off supplemental oxygen', date: '2024-12-25', shared: true },
  { id: 3, patient: 'Baby Martinez', event: 'First bottle feed attempted', date: '2024-12-28', shared: false },
  { id: 4, patient: 'Baby Thompson', event: 'Phototherapy completed', date: '2024-12-27', shared: true },
];

const education = [
  { id: 1, title: 'Kangaroo Care Guide', type: 'PDF', category: 'Bonding', completed: true },
  { id: 2, title: 'Understanding Your Baby\'s Monitor', type: 'Video', category: 'Equipment', completed: true },
  { id: 3, title: 'Feeding Your Preterm Baby', type: 'PDF', category: 'Nutrition', completed: false },
  { id: 4, title: 'Car Seat Safety Test', type: 'PDF', category: 'Discharge', completed: false },
  { id: 5, title: 'CPR for Infants', type: 'Video', category: 'Safety', completed: false },
];

export default function FamilyPortalPage() {
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedFamily, setSelectedFamily] = useState(families[0]);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [messageHistory, setMessageHistory] = useState(messages);
  const [newMessageText, setNewMessageText] = useState('');

  const handleSendMessage = () => {
    if (newMessageText.trim()) {
      const newMessage = {
        id: messageHistory.length + 1,
        from: 'NICU Team',
        to: `${selectedFamily.parents}`,
        type: 'update',
        message: newMessageText,
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        read: true
      };
      setMessageHistory([...messageHistory, newMessage]);
      setNewMessageText('');
    }
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Family Portal</h1>
            <p className="text-slate-400 text-sm">Parent communication and education</p>
          </div>
          <button
            onClick={() => setShowNewMessage(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            New Message
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Family Sidebar */}
          <div className="col-span-3 bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Families</h3>
            <div className="space-y-2">
              {families.map((family) => (
                <button
                  key={family.id}
                  onClick={() => setSelectedFamily(family)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedFamily.id === family.id
                      ? 'bg-cyan-500/20 border border-cyan-500/50'
                      : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">{family.patient}</span>
                    {family.unread > 0 && (
                      <span className="w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                        {family.unread}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{family.parents}</div>
                </button>
              ))}
            </div>

            {/* Selected Family Info */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <h4 className="text-sm font-medium text-white mb-3">{selectedFamily.parents}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {selectedFamily.phone}
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {selectedFamily.email}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30">
                  Call
                </button>
                <button className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600">
                  Email
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9 space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {['messages', 'milestones', 'education', 'photos'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                    activeTab === tab ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'messages' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="font-semibold text-white">Message History - {selectedFamily.patient}</h3>
                </div>
                <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                  {messageHistory.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.from.includes('Family') ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md p-3 rounded-lg ${
                        msg.from.includes('Family')
                          ? 'bg-cyan-500/20 text-cyan-100'
                          : 'bg-slate-700 text-white'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-400">{msg.from}</span>
                          <span className="text-xs text-slate-500">{msg.time.split(' ')[1]}</span>
                        </div>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-slate-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    />
                    <button
                      onClick={handleSendMessage}
                      className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'milestones' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Milestones</h3>
                  <button className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm">Add Milestone</button>
                </div>
                <div className="space-y-3">
                  {milestones.filter(m => m.patient === selectedFamily.patient).map((milestone) => (
                    <div key={milestone.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <span className="text-green-400 text-lg">⭐</span>
                        </div>
                        <div>
                          <div className="text-white font-medium">{milestone.event}</div>
                          <div className="text-sm text-slate-400">{milestone.date}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        milestone.shared ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'
                      }`}>
                        {milestone.shared ? 'Shared with family' : 'Not shared'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'education' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <h3 className="font-semibold text-white mb-4">Parent Education</h3>
                <div className="space-y-3">
                  {education.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          item.type === 'Video' ? 'bg-red-500/20' : 'bg-blue-500/20'
                        }`}>
                          <span className={item.type === 'Video' ? 'text-red-400' : 'text-blue-400'}>
                            {item.type === 'Video' ? '▶' : '📄'}
                          </span>
                        </div>
                        <div>
                          <div className="text-white font-medium">{item.title}</div>
                          <div className="text-xs text-slate-400">{item.category} • {item.type}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.completed ? (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Completed</span>
                        ) : (
                          <button className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm hover:bg-cyan-500/30">
                            Assign
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Photo Gallery</h3>
                  <button className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm">Upload Photo</button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="aspect-square bg-slate-700 rounded-lg flex items-center justify-center text-slate-500">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
