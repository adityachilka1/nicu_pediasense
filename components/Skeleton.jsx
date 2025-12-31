'use client';

// Base skeleton animation
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse bg-slate-700/50 rounded ${className}`}
      {...props}
    />
  );
}

// Patient monitor skeleton
export function PatientMonitorSkeleton() {
  return (
    <div className="bg-slate-900/80 rounded-lg border border-slate-700 p-3 h-full min-h-[280px]">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <Skeleton className="h-6 w-16 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Waveform placeholder */}
      <Skeleton className="h-16 w-full mb-3 rounded-lg" />

      {/* Vital signs grid */}
      <div className="grid grid-cols-2 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-2">
            <Skeleton className="h-3 w-12 mb-1" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Dashboard grid skeleton
export function DashboardSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 p-2">
      {[...Array(count)].map((_, i) => (
        <PatientMonitorSkeleton key={i} />
      ))}
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 5 }) {
  return (
    <tr className="border-b border-slate-700">
      {[...Array(columns)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            {[...Array(columns)].map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Card skeleton
export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
      <Skeleton className="h-5 w-1/3 mb-3" />
      {[...Array(lines)].map((_, i) => (
        <Skeleton
          key={i}
          className="h-3 mb-2"
          style={{ width: `${Math.random() * 30 + 70}%` }}
        />
      ))}
    </div>
  );
}

// Stats card skeleton
export function StatsCardSkeleton() {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}

// Navigation skeleton
export function NavSkeleton() {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 p-4">
      <Skeleton className="h-8 w-32 mb-6" />
      {[...Array(8)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-full mb-2 rounded-lg" />
      ))}
    </div>
  );
}

// Form skeleton
export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="space-y-4">
      {[...Array(fields)].map((_, i) => (
        <div key={i}>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-lg mt-6" />
    </div>
  );
}

// Chart skeleton
export function ChartSkeleton({ height = 200 }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <Skeleton className={`w-full rounded-lg`} style={{ height }} />
    </div>
  );
}

// Patient detail skeleton
export function PatientDetailSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>

      {/* Vitals chart */}
      <ChartSkeleton height={300} />

      {/* Notes section */}
      <CardSkeleton lines={5} />
    </div>
  );
}

// Loading spinner
export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`${sizes[size]} ${className}`}>
      <svg
        className="animate-spin text-cyan-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

// Full page loading
export function PageLoading({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-4" />
        <p className="text-slate-400">{message}</p>
      </div>
    </div>
  );
}

// Inline loading
export function InlineLoading({ text = 'Loading...' }) {
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Spinner size="sm" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export default Skeleton;
