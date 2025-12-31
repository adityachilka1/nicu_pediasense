'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [theme, setTheme] = useState('dark');
  const [systemTheme, setSystemTheme] = useState('dark');

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Get effective theme (resolves 'auto' to actual theme)
  const effectiveTheme = theme === 'auto' ? systemTheme : theme;
  
  const sections = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'display', name: 'Display', icon: '🖥️' },
    { id: 'alarms', name: 'Alarms', icon: '🔔' },
    { id: 'thresholds', name: 'Default Thresholds', icon: '📊' },
    { id: 'devices', name: 'Devices', icon: '🩺', href: '/devices' },
    { id: 'users', name: 'Users & Permissions', icon: '👥' },
    { id: 'integrations', name: 'Integrations', icon: '🔗' },
    { id: 'audit', name: 'Audit Log', icon: '📋', href: '/audit' },
    { id: 'backup', name: 'Backup & Export', icon: '💾' },
  ];
  
  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-slate-400 mt-1">Configure system preferences</p>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-3">
            <nav className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              {sections.map(section => (
                section.href ? (
                  <Link
                    key={section.id}
                    href={section.href}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-slate-400 hover:text-white hover:bg-slate-800 border-l-2 border-transparent"
                  >
                    <span>{section.icon}</span>
                    <span className="font-medium">{section.name}</span>
                    <svg className="w-4 h-4 ml-auto text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                ) : (
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
                )
              ))}
            </nav>
          </div>
          
          {/* Content */}
          <div className="col-span-9">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              {/* General Settings */}
              {activeSection === 'general' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white">General Settings</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Unit Name</label>
                      <input
                        type="text"
                        defaultValue="NICU Floor 3 West"
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Facility Name</label>
                      <input
                        type="text"
                        defaultValue="Memorial Hospital"
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Time Zone</label>
                        <select className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                          <option>America/New_York (EST)</option>
                          <option>America/Chicago (CST)</option>
                          <option>America/Denver (MST)</option>
                          <option>America/Los_Angeles (PST)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Date Format</label>
                        <select className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                          <option>MM/DD/YYYY</option>
                          <option>DD/MM/YYYY</option>
                          <option>YYYY-MM-DD</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Temperature Unit</label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="temp" defaultChecked className="text-cyan-500 focus:ring-cyan-500" />
                          <span className="text-white">Celsius (°C)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="temp" className="text-cyan-500 focus:ring-cyan-500" />
                          <span className="text-white">Fahrenheit (°F)</span>
                        </label>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Weight Unit</label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="weight" defaultChecked className="text-cyan-500 focus:ring-cyan-500" />
                          <span className="text-white">Kilograms (kg)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="weight" className="text-cyan-500 focus:ring-cyan-500" />
                          <span className="text-white">Pounds (lb)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Display Settings */}
              {activeSection === 'display' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white">Display Settings</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Theme</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={() => setTheme('dark')}
                          className={`p-4 rounded-lg text-center transition-all ${
                            theme === 'dark'
                              ? 'bg-slate-950 border-2 border-cyan-500'
                              : 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-2xl mb-2">🌙</div>
                          <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-400'}`}>Dark</div>
                          {theme === 'dark' && <div className="text-xs text-cyan-400 mt-1">Active</div>}
                        </button>
                        <button
                          onClick={() => setTheme('light')}
                          className={`p-4 rounded-lg text-center transition-all ${
                            theme === 'light'
                              ? 'bg-slate-950 border-2 border-cyan-500'
                              : 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-2xl mb-2">☀️</div>
                          <div className={`text-sm font-medium ${theme === 'light' ? 'text-white' : 'text-slate-400'}`}>Light</div>
                          {theme === 'light' && <div className="text-xs text-cyan-400 mt-1">Active</div>}
                        </button>
                        <button
                          onClick={() => setTheme('auto')}
                          className={`p-4 rounded-lg text-center transition-all ${
                            theme === 'auto'
                              ? 'bg-slate-950 border-2 border-cyan-500'
                              : 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-2xl mb-2">🌓</div>
                          <div className={`text-sm font-medium ${theme === 'auto' ? 'text-white' : 'text-slate-400'}`}>Auto</div>
                          {theme === 'auto' && (
                            <div className="text-xs text-cyan-400 mt-1">
                              {systemTheme === 'dark' ? '🌙 Dark' : '☀️ Light'}
                            </div>
                          )}
                        </button>
                      </div>
                      {theme !== 'dark' && (
                        <p className="text-xs text-slate-500 mt-3">
                          {theme === 'light'
                            ? 'Light theme optimizes display for brightly lit environments.'
                            : `Auto mode follows your system preference (currently ${systemTheme}).`}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Grid Layout</label>
                      <select className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                        <option>Auto (Responsive)</option>
                        <option>2 Columns</option>
                        <option>3 Columns</option>
                        <option>4 Columns</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Waveform Speed</label>
                      <select className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                        <option>12.5 mm/s</option>
                        <option>25 mm/s (Standard)</option>
                        <option>50 mm/s</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">Show Grid on Waveforms</div>
                        <div className="text-sm text-slate-500">Display background grid on pleth waveform</div>
                      </div>
                      <button className="w-12 h-7 rounded-full bg-cyan-600 transition-colors">
                        <div className="w-6 h-6 bg-white rounded-full translate-x-5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">High Contrast Mode</div>
                        <div className="text-sm text-slate-500">Increase contrast for better visibility</div>
                      </div>
                      <button className="w-12 h-7 rounded-full bg-slate-700 transition-colors">
                        <div className="w-6 h-6 bg-white rounded-full translate-x-0.5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">Animation Effects</div>
                        <div className="text-sm text-slate-500">Enable pulse and glow animations</div>
                      </div>
                      <button className="w-12 h-7 rounded-full bg-cyan-600 transition-colors">
                        <div className="w-6 h-6 bg-white rounded-full translate-x-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Alarm Settings */}
              {activeSection === 'alarms' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white">Alarm Settings</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">Audio Alarms</div>
                        <div className="text-sm text-slate-500">Play sounds for alarm events</div>
                      </div>
                      <button className="w-12 h-7 rounded-full bg-cyan-600 transition-colors">
                        <div className="w-6 h-6 bg-white rounded-full translate-x-5" />
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Alarm Volume</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        defaultValue="80"
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>Mute</span>
                        <span>Max</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Default Silence Duration</label>
                      <select className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                        <option>1 minute</option>
                        <option>2 minutes</option>
                        <option>5 minutes</option>
                        <option>10 minutes</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Alarm Escalation</label>
                      <div className="text-sm text-slate-300 bg-slate-800 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="w-3 h-3 rounded-full bg-yellow-500" />
                          <span>Warning → High Priority after 30 seconds unacknowledged</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full bg-red-500" />
                          <span>High Priority → Escalate to supervisor after 60 seconds</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">Repeat Alarm Sounds</div>
                        <div className="text-sm text-slate-500">Repeat audio for unacknowledged alarms</div>
                      </div>
                      <button className="w-12 h-7 rounded-full bg-cyan-600 transition-colors">
                        <div className="w-6 h-6 bg-white rounded-full translate-x-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Default Thresholds */}
              {activeSection === 'thresholds' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white">Default Alarm Thresholds</h2>
                  <p className="text-sm text-slate-400">Set default alarm limits for new patients. These can be overridden per-patient.</p>
                  
                  {/* GA-based Templates */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white">Gestational Age Templates</h3>
                    
                    {/* Extreme Preterm */}
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-white font-medium">Extreme Preterm (&lt;28 weeks)</div>
                          <div className="text-xs text-slate-500">High-risk, wider alarm ranges</div>
                        </div>
                        <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                          Edit
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">SpO₂</div>
                          <div className="font-mono text-cyan-400">85 - 95%</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">PR</div>
                          <div className="font-mono text-cyan-400">100 - 190 bpm</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">RR</div>
                          <div className="font-mono text-yellow-400">20 - 80 /min</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Temp</div>
                          <div className="font-mono text-pink-400">36.0 - 37.5°C</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Very Preterm */}
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-white font-medium">Very Preterm (28-32 weeks)</div>
                          <div className="text-xs text-slate-500">Moderate-risk patients</div>
                        </div>
                        <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                          Edit
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">SpO₂</div>
                          <div className="font-mono text-cyan-400">88 - 95%</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">PR</div>
                          <div className="font-mono text-cyan-400">100 - 180 bpm</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">RR</div>
                          <div className="font-mono text-yellow-400">25 - 70 /min</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Temp</div>
                          <div className="font-mono text-pink-400">36.3 - 37.5°C</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Late Preterm */}
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-white font-medium">Late Preterm (32-37 weeks)</div>
                          <div className="text-xs text-slate-500">Standard monitoring</div>
                        </div>
                        <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                          Edit
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">SpO₂</div>
                          <div className="font-mono text-cyan-400">90 - 100%</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">PR</div>
                          <div className="font-mono text-cyan-400">100 - 170 bpm</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">RR</div>
                          <div className="font-mono text-yellow-400">30 - 60 /min</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Temp</div>
                          <div className="font-mono text-pink-400">36.5 - 37.5°C</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Term */}
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-white font-medium">Term (&gt;37 weeks)</div>
                          <div className="text-xs text-slate-500">Normal newborn ranges</div>
                        </div>
                        <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                          Edit
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">SpO₂</div>
                          <div className="font-mono text-cyan-400">92 - 100%</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">PR</div>
                          <div className="font-mono text-cyan-400">100 - 160 bpm</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">RR</div>
                          <div className="font-mono text-yellow-400">30 - 60 /min</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Temp</div>
                          <div className="font-mono text-pink-400">36.5 - 37.5°C</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Auto-apply Setting */}
                  <div className="border-t border-slate-800 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">Auto-apply by GA</div>
                        <div className="text-sm text-slate-500">Automatically select template based on gestational age at admission</div>
                      </div>
                      <button className="w-12 h-7 rounded-full bg-cyan-600 transition-colors">
                        <div className="w-6 h-6 bg-white rounded-full translate-x-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Alarm Delay Settings */}
                  <div className="border-t border-slate-800 pt-4">
                    <h3 className="text-sm font-medium text-white mb-4">Alarm Delay Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">SpO₂ Alarm Delay</label>
                        <select className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500">
                          <option>0 seconds (immediate)</option>
                          <option>5 seconds</option>
                          <option>10 seconds</option>
                          <option>15 seconds</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">PR Alarm Delay</label>
                        <select className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500">
                          <option>0 seconds (immediate)</option>
                          <option>5 seconds</option>
                          <option>10 seconds</option>
                          <option>15 seconds</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">RR Alarm Delay</label>
                        <select className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500">
                          <option>0 seconds (immediate)</option>
                          <option>5 seconds</option>
                          <option>10 seconds</option>
                          <option>15 seconds</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Temp Alarm Delay</label>
                        <select className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500">
                          <option>0 seconds (immediate)</option>
                          <option>30 seconds</option>
                          <option>60 seconds</option>
                          <option>120 seconds</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Users Settings */}
              {activeSection === 'users' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Users & Permissions</h2>
                    <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors">
                      Add User
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {[
                      { name: 'Dr. Sarah Chen', role: 'Physician', access: 'Full Access' },
                      { name: 'RN Jessica Moore', role: 'Charge Nurse', access: 'Full Access' },
                      { name: 'RN Amanda Clark', role: 'Staff Nurse', access: 'Standard' },
                      { name: 'Unit Clerk', role: 'Administrative', access: 'View Only' },
                    ].map((user, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-medium">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="text-white font-medium">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.role}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-slate-700 rounded text-sm text-slate-300">{user.access}</span>
                          <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Integrations */}
              {activeSection === 'integrations' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white">Integrations</h2>
                  
                  <div className="space-y-4">
                    {[
                      { name: 'EMR System', desc: 'Epic MyChart Integration', status: 'connected' },
                      { name: 'Lab System', desc: 'LabCorp Results Feed', status: 'connected' },
                      { name: 'Pharmacy', desc: 'Medication Administration', status: 'connected' },
                      { name: 'Paging System', desc: 'Vocera Integration', status: 'disconnected' },
                      { name: 'PACS', desc: 'Radiology Images', status: 'pending' },
                    ].map((integration, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                        <div>
                          <div className="text-white font-medium">{integration.name}</div>
                          <div className="text-sm text-slate-500">{integration.desc}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded text-sm font-medium ${
                            integration.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' :
                            integration.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-700 text-slate-400'
                          }`}>
                            {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
                          </span>
                          <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                            Configure
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Backup Settings */}
              {activeSection === 'backup' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-white">Backup & Export</h2>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-white font-medium">Automatic Backups</div>
                          <div className="text-sm text-slate-500">Last backup: Today at 03:00</div>
                        </div>
                        <button className="w-12 h-7 rounded-full bg-cyan-600 transition-colors">
                          <div className="w-6 h-6 bg-white rounded-full translate-x-5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <select className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white">
                          <option>Every 6 hours</option>
                          <option>Every 12 hours</option>
                          <option>Daily</option>
                        </select>
                        <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                          Backup Now
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="text-white font-medium mb-3">Export Data</div>
                      <div className="grid grid-cols-3 gap-3">
                        <button className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-center transition-colors">
                          <div className="text-2xl mb-1">📊</div>
                          <div className="text-sm text-white">Patient Data</div>
                          <div className="text-xs text-slate-500">CSV/Excel</div>
                        </button>
                        <button className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-center transition-colors">
                          <div className="text-2xl mb-1">📈</div>
                          <div className="text-sm text-white">Trend Data</div>
                          <div className="text-xs text-slate-500">CSV/JSON</div>
                        </button>
                        <button className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-center transition-colors">
                          <div className="text-2xl mb-1">🔔</div>
                          <div className="text-sm text-white">Alarm Logs</div>
                          <div className="text-xs text-slate-500">CSV/PDF</div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Save Button */}
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-800">
                <button className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
                  Cancel
                </button>
                <button className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
