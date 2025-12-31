'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  
  const sections = [
    { id: 'getting-started', name: 'Getting Started', icon: '🚀' },
    { id: 'monitoring', name: 'Patient Monitoring', icon: '📊' },
    { id: 'alarms', name: 'Alarms & Alerts', icon: '🔔' },
    { id: 'documentation', name: 'Documentation', icon: '📝' },
    { id: 'devices', name: 'Devices', icon: '🖥️' },
    { id: 'troubleshooting', name: 'Troubleshooting', icon: '🔧' },
    { id: 'shortcuts', name: 'Keyboard Shortcuts', icon: '⌨️' },
    { id: 'contact', name: 'Contact Support', icon: '💬' },
  ];
  
  const faqs = [
    { 
      question: 'How do I acknowledge an alarm?', 
      answer: 'Click the "Acknowledge" button on the alarm panel or press the spacebar when the alarm tile is focused. This silences the audible alarm while keeping the visual indicator active until the condition resolves.' 
    },
    { 
      question: 'How long can I silence an alarm?', 
      answer: 'The default silence duration is 2 minutes. Administrators can configure this in Settings > Alarms. Critical alarms have a maximum silence duration of 5 minutes.' 
    },
    { 
      question: 'How do I change alarm limits for a patient?', 
      answer: 'Navigate to the patient\'s detail page, click on "Alarm Limits" in the patient header, or go to the Alarm Limits page from the main menu. You can set custom limits for SpO2, heart rate, respiratory rate, and temperature.' 
    },
    { 
      question: 'Can I export patient data?', 
      answer: 'Yes, go to Reports > Generate Report, select the patient and date range, choose your export format (PDF, CSV, or Excel), and click "Generate". You can also schedule automatic reports.' 
    },
    { 
      question: 'How do I add a clinical note?', 
      answer: 'Go to the patient detail page, click on the "Notes" tab, and use the text input area to add your note. You can use templates for common documentation or dictate using the voice input feature.' 
    },
    { 
      question: 'What do the different alarm colors mean?', 
      answer: 'Red indicates a critical alarm requiring immediate attention. Yellow indicates a warning that should be addressed soon. Blue indicates an informational alert. The system follows IEC 60601-1-8 medical alarm standards.' 
    },
  ];
  
  const shortcuts = [
    { key: 'Space', action: 'Acknowledge current alarm' },
    { key: 'Esc', action: 'Close modal / Cancel' },
    { key: 'Ctrl + F', action: 'Search patients' },
    { key: '1-8', action: 'Focus on bed 1-8' },
    { key: 'M', action: 'Toggle mute all alarms' },
    { key: 'R', action: 'Refresh data' },
    { key: 'N', action: 'Add new note' },
    { key: 'H', action: 'Open help' },
    { key: 'Ctrl + P', action: 'Print current view' },
    { key: 'Ctrl + E', action: 'Export data' },
  ];

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Help & Documentation</h1>
            <p className="text-sm text-slate-400 mt-1">NICU Central Monitor User Guide v4.2</p>
          </div>
        </div>
        
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-2xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles..."
              className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-3">
            <nav className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    activeSection === section.id 
                      ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-2 border-transparent'
                  }`}
                >
                  <span>{section.icon}</span>
                  <span className="font-medium">{section.name}</span>
                </button>
              ))}
            </nav>
            
            {/* Quick Links */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mt-4">
              <h3 className="text-white font-medium mb-3">Quick Links</h3>
              <div className="space-y-2">
                <a href="#" className="block text-sm text-cyan-400 hover:text-cyan-300">📄 User Manual (PDF)</a>
                <a href="#" className="block text-sm text-cyan-400 hover:text-cyan-300">🎥 Video Tutorials</a>
                <a href="#" className="block text-sm text-cyan-400 hover:text-cyan-300">📋 Release Notes</a>
                <a href="#" className="block text-sm text-cyan-400 hover:text-cyan-300">🔒 Privacy Policy</a>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="col-span-9">
            {/* Getting Started */}
            {activeSection === 'getting-started' && (
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <h2 className="text-xl font-bold text-white mb-4">Welcome to NICU Central Monitor</h2>
                  <p className="text-slate-300 mb-4">
                    This system provides real-time monitoring of vital signs for all patients in your unit. 
                    The central station displays SpO2, heart rate, respiratory rate, and temperature for up to 12 beds simultaneously.
                  </p>
                  
                  <h3 className="text-lg font-bold text-white mt-6 mb-3">Quick Start Guide</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="text-2xl mb-2">1️⃣</div>
                      <div className="text-white font-medium">Login</div>
                      <div className="text-sm text-slate-400 mt-1">Use your hospital credentials or badge to log in to the system.</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="text-2xl mb-2">2️⃣</div>
                      <div className="text-white font-medium">View Monitor</div>
                      <div className="text-sm text-slate-400 mt-1">The main dashboard shows all patients in your assigned unit.</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="text-2xl mb-2">3️⃣</div>
                      <div className="text-white font-medium">Respond to Alarms</div>
                      <div className="text-sm text-slate-400 mt-1">Critical alarms appear in red. Click to acknowledge and view details.</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="text-2xl mb-2">4️⃣</div>
                      <div className="text-white font-medium">Document Care</div>
                      <div className="text-sm text-slate-400 mt-1">Click any patient tile to access their chart and add documentation.</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <div className="text-cyan-400 font-medium">Pro Tip</div>
                      <div className="text-sm text-slate-300 mt-1">
                        Press <kbd className="px-2 py-0.5 bg-slate-800 rounded text-xs">H</kbd> at any time to open this help panel. 
                        Use keyboard shortcuts to quickly navigate and respond to alarms.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Patient Monitoring */}
            {activeSection === 'monitoring' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Patient Monitoring</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">Understanding the Display</h3>
                    <p className="text-slate-300 mb-4">Each patient tile shows real-time vital signs with color-coded indicators:</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full bg-cyan-400" />
                          <span className="text-white font-medium">SpO2 (Cyan)</span>
                        </div>
                        <p className="text-sm text-slate-400">Oxygen saturation percentage from pulse oximetry</p>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full bg-green-400" />
                          <span className="text-white font-medium">PR (Green)</span>
                        </div>
                        <p className="text-sm text-slate-400">Pulse rate in beats per minute</p>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full bg-yellow-400" />
                          <span className="text-white font-medium">RR (Yellow)</span>
                        </div>
                        <p className="text-sm text-slate-400">Respiratory rate in breaths per minute</p>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full bg-pink-400" />
                          <span className="text-white font-medium">Temp (Pink)</span>
                        </div>
                        <p className="text-sm text-slate-400">Core temperature in Celsius or Fahrenheit</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">Waveforms</h3>
                    <p className="text-slate-300">
                      The plethysmograph (pleth) waveform shows the pulse oximetry signal. A strong, regular waveform indicates 
                      good signal quality. Irregular or flat waveforms may indicate poor sensor placement or patient movement.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Alarms */}
            {activeSection === 'alarms' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Alarms & Alerts</h2>
                
                <div className="space-y-4">
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-red-400 font-bold">Critical Alarm</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      Requires immediate attention. Patient vital signs are outside safe limits. 
                      Audio alarm sounds until acknowledged. Cannot be silenced for more than 5 minutes.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-4 h-4 rounded-full bg-yellow-500" />
                      <span className="text-yellow-400 font-bold">Warning</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      Patient approaching alarm limits or technical issue detected. 
                      Should be addressed within 10 minutes.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500" />
                      <span className="text-blue-400 font-bold">Informational</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      Non-urgent notification such as scheduled tasks or system updates.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Keyboard Shortcuts */}
            {activeSection === 'shortcuts' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Keyboard Shortcuts</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  {shortcuts.map((shortcut, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <span className="text-slate-300">{shortcut.action}</span>
                      <kbd className="px-3 py-1 bg-slate-700 rounded text-white font-mono text-sm">{shortcut.key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Troubleshooting */}
            {activeSection === 'troubleshooting' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Frequently Asked Questions</h2>
                
                <div className="space-y-4">
                  {faqs.map((faq, i) => (
                    <details key={i} className="group">
                      <summary className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                        <span className="text-white font-medium">{faq.question}</span>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="p-4 text-slate-300">{faq.answer}</div>
                    </details>
                  ))}
                </div>
              </div>
            )}
            
            {/* Contact Support */}
            {activeSection === 'contact' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Contact Support</h2>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-800/50 rounded-xl">
                    <div className="text-3xl mb-3">📞</div>
                    <h3 className="text-white font-bold mb-2">IT Help Desk</h3>
                    <p className="text-slate-400 mb-4">For technical issues and system problems</p>
                    <div className="text-cyan-400 font-mono text-lg">(555) 123-4567</div>
                    <div className="text-sm text-slate-500 mt-1">Available 24/7</div>
                  </div>
                  
                  <div className="p-6 bg-slate-800/50 rounded-xl">
                    <div className="text-3xl mb-3">🏥</div>
                    <h3 className="text-white font-bold mb-2">Clinical Engineering</h3>
                    <p className="text-slate-400 mb-4">For device and equipment issues</p>
                    <div className="text-cyan-400 font-mono text-lg">Ext. 2847</div>
                    <div className="text-sm text-slate-500 mt-1">Mon-Fri 7am-6pm</div>
                  </div>
                  
                  <div className="p-6 bg-slate-800/50 rounded-xl">
                    <div className="text-3xl mb-3">✉️</div>
                    <h3 className="text-white font-bold mb-2">Email Support</h3>
                    <p className="text-slate-400 mb-4">For non-urgent requests and feedback</p>
                    <div className="text-cyan-400">support@hospital.org</div>
                    <div className="text-sm text-slate-500 mt-1">Response within 24 hours</div>
                  </div>
                  
                  <div className="p-6 bg-slate-800/50 rounded-xl">
                    <div className="text-3xl mb-3">🎓</div>
                    <h3 className="text-white font-bold mb-2">Training</h3>
                    <p className="text-slate-400 mb-4">Request additional training sessions</p>
                    <div className="text-cyan-400">training@hospital.org</div>
                    <div className="text-sm text-slate-500 mt-1">Schedule in-person or virtual</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Documentation */}
            {activeSection === 'documentation' && (
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <h2 className="text-xl font-bold text-white mb-4">Clinical Documentation</h2>
                  <p className="text-slate-300 mb-6">
                    The NICU Central Monitor integrates with your EMR system to streamline clinical documentation.
                    All vital signs, events, and interventions can be automatically captured and documented.
                  </p>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">Documentation Types</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">📋</span>
                          <span className="text-white font-medium">Flowsheet Entries</span>
                        </div>
                        <p className="text-sm text-slate-400">
                          Vital signs are automatically logged every 15 minutes. Manual entries can be added at any time.
                        </p>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">📝</span>
                          <span className="text-white font-medium">Progress Notes</span>
                        </div>
                        <p className="text-sm text-slate-400">
                          Free-text notes with templates for common assessments, procedures, and interventions.
                        </p>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">🔔</span>
                          <span className="text-white font-medium">Event Documentation</span>
                        </div>
                        <p className="text-sm text-slate-400">
                          Alarms, interventions, and critical events are timestamped and logged automatically.
                        </p>
                      </div>
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">📊</span>
                          <span className="text-white font-medium">Trend Reports</span>
                        </div>
                        <p className="text-sm text-slate-400">
                          Generate reports showing vital sign trends over customizable time periods.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Adding Clinical Notes</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">1</div>
                      <div>
                        <div className="text-white font-medium">Select Patient</div>
                        <div className="text-sm text-slate-400">Click on the patient tile or search by name/MRN</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">2</div>
                      <div>
                        <div className="text-white font-medium">Open Notes Tab</div>
                        <div className="text-sm text-slate-400">Navigate to the Notes section in the patient chart</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">3</div>
                      <div>
                        <div className="text-white font-medium">Choose Template or Free Text</div>
                        <div className="text-sm text-slate-400">Select from pre-built templates or enter custom notes</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">4</div>
                      <div>
                        <div className="text-white font-medium">Sign and Submit</div>
                        <div className="text-sm text-slate-400">Review, add your signature, and submit to the EMR</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <div className="text-emerald-400 font-medium">EMR Integration</div>
                      <div className="text-sm text-slate-300 mt-1">
                        All documentation syncs automatically with Epic MyChart. Changes appear in the patient's chart within 30 seconds.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Devices */}
            {activeSection === 'devices' && (
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <h2 className="text-xl font-bold text-white mb-4">Connected Devices</h2>
                  <p className="text-slate-300 mb-6">
                    The NICU Central Monitor connects to bedside monitors and medical devices throughout the unit.
                    Understanding device connectivity helps ensure reliable patient monitoring.
                  </p>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">Supported Devices</h3>

                    <div className="space-y-3">
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🩺</span>
                            <div>
                              <div className="text-white font-medium">Philips IntelliVue Series</div>
                              <div className="text-sm text-slate-400">MX800, MX700, MX500 patient monitors</div>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">Fully Supported</span>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">💓</span>
                            <div>
                              <div className="text-white font-medium">Masimo Pulse Oximeters</div>
                              <div className="text-sm text-slate-400">Radical-7, Root with Rainbow technology</div>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">Fully Supported</span>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🌡️</span>
                            <div>
                              <div className="text-white font-medium">Temperature Probes</div>
                              <div className="text-sm text-slate-400">Skin and core temperature monitoring</div>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">Fully Supported</span>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🫁</span>
                            <div>
                              <div className="text-white font-medium">Ventilators</div>
                              <div className="text-sm text-slate-400">Dräger Babylog VN500/VN600</div>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">Fully Supported</span>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">💉</span>
                            <div>
                              <div className="text-white font-medium">Infusion Pumps</div>
                              <div className="text-sm text-slate-400">BD Alaris, B. Braun Infusomat</div>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">Status Only</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Connection Status Indicators</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                      <div className="w-4 h-4 rounded-full bg-emerald-500 mx-auto mb-2 animate-pulse" />
                      <div className="text-white font-medium">Connected</div>
                      <div className="text-xs text-slate-400 mt-1">Real-time data streaming</div>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                      <div className="w-4 h-4 rounded-full bg-yellow-500 mx-auto mb-2" />
                      <div className="text-white font-medium">Intermittent</div>
                      <div className="text-xs text-slate-400 mt-1">Connection unstable</div>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                      <div className="w-4 h-4 rounded-full bg-red-500 mx-auto mb-2" />
                      <div className="text-white font-medium">Disconnected</div>
                      <div className="text-xs text-slate-400 mt-1">No data received</div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Troubleshooting Device Issues</h3>
                  <div className="space-y-3">
                    <details className="group">
                      <summary className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
                        <span className="text-white">Device shows "Disconnected"</span>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="p-3 text-sm text-slate-300">
                        1. Check the network cable connection at the bedside monitor<br/>
                        2. Verify the monitor is powered on and displaying data locally<br/>
                        3. Try restarting the bedside monitor<br/>
                        4. Contact Clinical Engineering if the issue persists
                      </div>
                    </details>
                    <details className="group">
                      <summary className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
                        <span className="text-white">Vital signs not updating</span>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="p-3 text-sm text-slate-300">
                        1. Check sensor placement on the patient<br/>
                        2. Verify the sensor cable is properly connected<br/>
                        3. Check for "Sensor Off" or "Searching" messages on the bedside monitor<br/>
                        4. Replace sensor if signal quality is poor
                      </div>
                    </details>
                    <details className="group">
                      <summary className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
                        <span className="text-white">Wrong patient data displayed</span>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="p-3 text-sm text-slate-300">
                        1. Verify patient assignment at the bedside monitor<br/>
                        2. Check the bed assignment in Settings {">"} Beds<br/>
                        3. Ensure ADT (Admit-Discharge-Transfer) data is current<br/>
                        4. Contact IT Help Desk for bed mapping issues
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
