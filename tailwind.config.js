/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // NestWatch Brand Colors
        brand: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
          950: '#083344',
        },

        // Status Colors (Medical)
        critical: {
          light: '#FEF2F2',
          DEFAULT: '#DC2626',
          dark: '#450A0A',
        },
        warning: {
          light: '#FFFBEB',
          DEFAULT: '#F59E0B',
          dark: '#451A03',
        },
        stable: {
          light: '#ECFDF5',
          DEFAULT: '#10B981',
          dark: '#022C22',
        },
        info: {
          light: '#EFF6FF',
          DEFAULT: '#3B82F6',
          dark: '#172554',
        },

        // Vitals (IEC 60601-1-8 Color Coding)
        vitals: {
          spo2: '#00FFFF',    // Cyan - SpO2
          hr: '#00FF00',      // Green - Heart Rate
          rr: '#FFFF00',      // Yellow - Respiratory Rate
          temp: '#FF99FF',    // Pink/Magenta - Temperature
          fio2: '#FFFFFF',    // White - FiO2
          bp: '#FF0000',      // Red - Blood Pressure
        },

        // Alarm Priorities (IEC 60601-1-8)
        alarm: {
          critical: '#FF0000',  // Red - High Priority
          warning: '#FFFF00',   // Yellow - Medium Priority
          advisory: '#00FFFF',  // Cyan - Low Priority
        },

        // Legacy clinical colors (backward compatibility)
        vital: {
          critical: '#ef4444',
          warning: '#f59e0b',
          normal: '#22d3ee',
          stable: '#10b981',
        },
      },

      // Background Colors
      backgroundColor: {
        // Light mode surfaces
        'light-surface': '#F8FAFC',
        'light-elevated': '#F1F5F9',
        'light-sunken': '#E2E8F0',
        // Dark mode surfaces
        'dark-surface': '#1E293B',
        'dark-elevated': '#334155',
        'dark-sunken': '#020617',
      },

      animation: {
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'glow-critical': 'glow-critical 1s ease-in-out infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(239, 68, 68, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)' },
        },
        'glow-critical': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 0, 0, 0.4)' },
          '50%': { boxShadow: '0 0 25px rgba(255, 0, 0, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
