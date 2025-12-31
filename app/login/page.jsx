'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

// Demo credentials - only shown in development mode
const isDemoMode = process.env.NODE_ENV === 'development';
const DEMO_EMAIL = 'nurse.moore@hospital.org';
const DEMO_PASSWORD = 'nurse123';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState('credentials');
  // Only pre-fill credentials in development mode
  const [email, setEmail] = useState(isDemoMode ? DEMO_EMAIL : '');
  const [password, setPassword] = useState(isDemoMode ? DEMO_PASSWORD : '');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setIsLoading(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex" style={{ background: '#000508' }}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-cyan-900/20 to-slate-900 flex-col justify-between p-12" aria-hidden="true">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-7 h-7 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">NICU Central</h1>
              <p className="text-sm text-slate-400">Monitoring Station</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              Real-time monitoring<br />for critical care
            </h2>
            <p className="text-lg text-slate-400 mt-4 max-w-md">
              Advanced vital signs monitoring and clinical decision support for neonatal intensive care units.
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-3xl font-bold text-cyan-400">8</div>
              <div className="text-sm text-slate-400">Bed Capacity</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-3xl font-bold text-cyan-400">24/7</div>
              <div className="text-sm text-slate-400">Monitoring</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-3xl font-bold text-cyan-400">99.9%</div>
              <div className="text-sm text-slate-400">Uptime</div>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-slate-500">
          © 2024 NICU Central. IEC 60601-1-8 Compliant.
        </div>
      </div>
      
      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center" aria-hidden="true">
              <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">NICU Central</h1>
          </div>
          
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
            {/* Demo mode banner - only shown in development */}
            {isDemoMode && (
              <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Demo Mode</span>
                </div>
                <p className="text-yellow-400/70 text-xs mt-1">
                  Pre-filled with demo credentials. Not for production use.
                </p>
              </div>
            )}

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-slate-400 mt-2">Sign in to access the monitoring station</p>
            </div>
            
            <div
              className="flex items-center gap-2 p-1 bg-slate-800 rounded-lg mb-6"
              role="tablist"
              aria-label="Login method"
            >
              <button
                onClick={() => setLoginMethod('credentials')}
                role="tab"
                aria-selected={loginMethod === 'credentials'}
                aria-controls="credentials-panel"
                id="credentials-tab"
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  loginMethod === 'credentials' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Email & Password
              </button>
              <button
                onClick={() => setLoginMethod('badge')}
                role="tab"
                aria-selected={loginMethod === 'badge'}
                aria-controls="badge-panel"
                id="badge-tab"
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  loginMethod === 'badge' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Badge Login
              </button>
            </div>
            
            {loginMethod === 'credentials' ? (
              <form
                onSubmit={handleLogin}
                className="space-y-4"
                id="credentials-panel"
                role="tabpanel"
                aria-labelledby="credentials-tab"
              >
                {error && (
                  <div
                    className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm"
                    role="alert"
                    aria-live="assertive"
                  >
                    {error}
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-2">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    placeholder="Enter your email"
                    required
                    aria-required="true"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-400 mb-2">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    placeholder="Enter your password"
                    required
                    aria-required="true"
                    autoComplete="current-password"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label htmlFor="remember-device" className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="remember-device"
                      type="checkbox"
                      className="rounded bg-slate-700 border-slate-600 text-cyan-500"
                    />
                    <span className="text-sm text-slate-400">Remember this device</span>
                  </label>
                  <a href="#" className="text-sm text-cyan-400 hover:text-cyan-300">Forgot password?</a>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  aria-disabled={isLoading}
                  aria-busy={isLoading}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Signing in...</span>
                    </>
                  ) : 'Sign In'}
                </button>
              </form>
            ) : (
              <div
                className="text-center py-8"
                id="badge-panel"
                role="tabpanel"
                aria-labelledby="badge-tab"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center">
                  <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                </div>
                <p className="text-slate-400 mb-4">Tap your badge on the reader</p>
                <div
                  className="flex items-center justify-center gap-2 text-sm text-slate-500"
                  role="status"
                  aria-live="polite"
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" aria-hidden="true" />
                  Waiting for badge...
                </div>
              </div>
            )}
            
            <div className="mt-6 pt-6 border-t border-slate-800 text-center text-sm text-slate-500">
              Having trouble? <a href="#" className="text-cyan-400 hover:text-cyan-300">Contact IT Support</a>
            </div>
          </div>
          
          <div
            className="mt-6 p-4 bg-slate-900/50 rounded-xl border border-slate-800"
            role="note"
            aria-label="Security notice"
          >
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-white">Security Notice</div>
                <p className="text-xs text-slate-400 mt-1">
                  This system contains protected health information. Unauthorized access is prohibited.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000508' }}>
        <div className="text-cyan-400">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
