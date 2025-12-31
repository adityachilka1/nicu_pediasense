'use client';

import Link from 'next/link';
import { getStatusColor } from '@/lib/data';

export default function PatientHeader({ patient }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Link href="/patients" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">BED {patient.bed}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(patient.status)}`}>
              {patient.status === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />}
              {patient.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-slate-400">{patient.name} • {patient.mrn}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors">
          Edit Limits
        </button>
        <button className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors">
          Silence Alarms
        </button>
        <Link href="/" className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors">
          Back to Monitor
        </Link>
      </div>
    </div>
  );
}
