'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { initialPatients } from '@/lib/data';
import { useToast } from '@/components/Toast';

export default function ReportsPage() {
  const toast = useToast();
  const [reportType, setReportType] = useState('shift');
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showPreview, setShowPreview] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduledReports, setScheduledReports] = useState([
    { id: 1, name: 'Daily Report', schedule: 'Every day at 23:59', enabled: true },
    { id: 2, name: 'Shift Report', schedule: 'Every 12 hours', enabled: true },
    { id: 3, name: 'Weekly Summary', schedule: 'Every Sunday at 00:00', enabled: false },
  ]);

  const handleGenerateReport = () => {
    if (selectedPatients.length === 0) {
      toast.warning('Please select at least one patient');
      return;
    }
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast.success('Report generated successfully!');
    }, 1500);
  };

  const handlePreview = () => {
    if (selectedPatients.length === 0) {
      toast.warning('Please select at least one patient');
      return;
    }
    setShowPreview(true);
  };

  const handleViewReport = (reportId) => {
    toast.info(`Opening report #${reportId}...`);
  };

  const handleDownloadPDF = (reportId) => {
    toast.success(`Downloading PDF for report #${reportId}...`);
  };

  const handlePrint = (reportId) => {
    toast.info(`Sending report #${reportId} to printer...`);
  };

  const toggleScheduledReport = (reportId) => {
    setScheduledReports(prev => prev.map(r =>
      r.id === reportId ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const reportTypes = [
    { id: 'shift', name: 'Shift Summary', desc: 'End of shift vital signs summary' },
    { id: 'daily', name: 'Daily Report', desc: '24-hour patient status report' },
    { id: 'weekly', name: 'Weekly Summary', desc: 'Week-over-week trends and events' },
    { id: 'discharge', name: 'Discharge Summary', desc: 'Complete patient stay summary' },
    { id: 'alarm', name: 'Alarm Report', desc: 'Alarm frequency and patterns' },
    { id: 'custom', name: 'Custom Report', desc: 'Build your own report' },
  ];
  
  const recentReports = [
    { id: 1, name: 'Shift Report - Day Shift 12/29', type: 'shift', date: '2024-12-29 19:00', status: 'completed' },
    { id: 2, name: 'Daily Report - 12/28', type: 'daily', date: '2024-12-28 23:59', status: 'completed' },
    { id: 3, name: 'Weekly Summary - Week 52', type: 'weekly', date: '2024-12-28', status: 'completed' },
    { id: 4, name: 'Alarm Report - December', type: 'alarm', date: '2024-12-29', status: 'processing' },
  ];
  
  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Reports</h1>
            <p className="text-sm text-slate-400 mt-1">Generate and view clinical reports</p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors flex items-center gap-2 screen-only"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>

        {/* Print Header */}
        <div className="print-only print-header mb-6">
          <h1 className="text-xl font-bold">NICU Clinical Report</h1>
          <p className="subtitle">Floor 3 West • Unit A • {new Date().toLocaleDateString()}</p>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          {/* Report Type Selection */}
          <div className="col-span-8">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Generate New Report</h2>
              
              {/* Report Type Grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {reportTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setReportType(type.id)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      reportType === type.id 
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' 
                        : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium mb-1">{type.name}</div>
                    <div className="text-xs text-slate-500">{type.desc}</div>
                  </button>
                ))}
              </div>
              
              {/* Report Options */}
              <div className="space-y-4">
                {/* Patient Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Select Patients</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedPatients(selectedPatients.length === initialPatients.length ? [] : initialPatients.map(p => p.id))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedPatients.length === initialPatients.length 
                          ? 'bg-cyan-600 text-white' 
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      All Patients
                    </button>
                    {initialPatients.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPatients(prev => 
                            prev.includes(p.id) 
                              ? prev.filter(id => id !== p.id)
                              : [...prev, p.id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedPatients.includes(p.id)
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        BED {p.bed}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Start Date/Time</label>
                    <input
                      type="datetime-local"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">End Date/Time</label>
                    <input
                      type="datetime-local"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                
                {/* Report Contents */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Include in Report</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      'Vital Signs Summary',
                      'Trend Charts',
                      'Alarm Events',
                      'A/B Events',
                      'Medication List',
                      'Feeding Log',
                      'Lab Results',
                      'Nursing Notes',
                      'Care Timeline',
                    ].map(item => (
                      <label key={item} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
                        <input type="checkbox" defaultChecked className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500" />
                        <span className="text-sm text-slate-300">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Generate Button */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={handleGenerateReport}
                    disabled={isGenerating}
                    className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:cursor-wait text-white rounded-lg font-medium transition-colors"
                  >
                    {isGenerating ? 'Generating...' : 'Generate Report'}
                  </button>
                  <button
                    onClick={handlePreview}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Recent Reports */}
          <div className="col-span-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Recent Reports</h2>
              
              <div className="space-y-3">
                {recentReports.map(report => (
                  <div key={report.id} className="p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-white text-sm">{report.name}</div>
                        <div className="text-xs text-slate-500 mt-1">{report.date}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        report.status === 'completed' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {report.status === 'completed' ? 'Ready' : 'Processing'}
                      </span>
                    </div>
                    {report.status === 'completed' && (
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => handleViewReport(report.id)} className="text-xs text-cyan-400 hover:text-cyan-300">View</button>
                        <span className="text-slate-600">•</span>
                        <button onClick={() => handleDownloadPDF(report.id)} className="text-xs text-cyan-400 hover:text-cyan-300">Download PDF</button>
                        <span className="text-slate-600">•</span>
                        <button onClick={() => handlePrint(report.id)} className="text-xs text-cyan-400 hover:text-cyan-300">Print</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <button className="w-full mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                View All Reports
              </button>
            </div>
            
            {/* Scheduled Reports */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mt-4">
              <h2 className="text-lg font-bold text-white mb-4">Scheduled Reports</h2>

              <div className="space-y-3">
                {scheduledReports.map(report => (
                  <div key={report.id} className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white text-sm">{report.name}</div>
                        <div className="text-xs text-slate-500">{report.schedule}</div>
                      </div>
                      <button
                        onClick={() => toggleScheduledReport(report.id)}
                        className={`w-10 h-6 rounded-full transition-colors ${report.enabled ? 'bg-cyan-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${report.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 w-full max-w-4xl max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Report Preview</h2>
                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-white text-black p-8 rounded-lg">
                <div className="text-center border-b pb-4 mb-4">
                  <h1 className="text-xl font-bold">NICU {reportTypes.find(r => r.id === reportType)?.name || 'Report'}</h1>
                  <p className="text-sm text-gray-500">Generated: {new Date().toLocaleString()}</p>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Selected Patients: {selectedPatients.length > 0 ? selectedPatients.map(id => `BED ${initialPatients.find(p => p.id === id)?.bed}`).join(', ') : 'None'}</p>
                  <p className="text-sm text-gray-600">Date Range: {dateRange.start || 'Not set'} - {dateRange.end || 'Not set'}</p>
                  <div className="border-t pt-4">
                    <p className="text-gray-400 text-center italic">Preview content would appear here...</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Close</button>
                <button onClick={() => { handleGenerateReport(); setShowPreview(false); }} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg">Generate Full Report</button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowScheduleModal(false)}>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Schedule Report</h2>
                <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Report Name</label>
                  <input type="text" placeholder="My Scheduled Report" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Frequency</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
                    <option>Daily</option>
                    <option>Every 12 hours</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Time</label>
                  <input type="time" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email Recipients</label>
                  <input type="text" placeholder="email@example.com" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Cancel</button>
                <button onClick={() => { toast.success('Report scheduled!'); setShowScheduleModal(false); }} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg">Schedule</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
