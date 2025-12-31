'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PatientTabs({ patientId }) {
  const pathname = usePathname();
  
  const tabs = [
    { href: `/patient/${patientId}`, label: 'Overview', exact: true },
    { href: `/patient/${patientId}/labs`, label: 'Labs' },
    { href: `/patient/${patientId}/meds`, label: 'Medications' },
    { href: `/patient/${patientId}/notes`, label: 'Notes' },
    { href: `/patient/${patientId}/timeline`, label: 'Timeline' },
    { href: `/trends?patient=${patientId}`, label: 'Trends' },
  ];
  
  return (
    <div className="flex items-center gap-1 mb-4 border-b border-slate-800 pb-2">
      {tabs.map(tab => {
        const isActive = tab.exact 
          ? pathname === tab.href 
          : pathname.startsWith(tab.href.split('?')[0]);
        
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive 
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
