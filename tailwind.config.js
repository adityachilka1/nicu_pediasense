/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ==========================================
        // BRAND COLORS
        // ==========================================
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

        // ==========================================
        // DASHBOARD BACKGROUNDS (Dark Mode Default)
        // ==========================================
        dashboard: {
          bg: '#0F172A',        // Main background
          surface: '#1E293B',   // Cards, panels
          elevated: '#334155',  // Modals, dropdowns
          sunken: '#020617',    // Inset areas
        },

        // ==========================================
        // TEXT COLORS
        // ==========================================
        content: {
          primary: '#F8FAFC',
          secondary: '#CBD5E1',
          tertiary: '#94A3B8',
          disabled: '#475569',
          inverse: '#0F172A',
          brand: '#22D3EE',
        },

        // ==========================================
        // BORDER COLORS
        // ==========================================
        edge: {
          default: '#334155',
          strong: '#475569',
          focus: '#22D3EE',
        },

        // ==========================================
        // PATIENT STATUS
        // ==========================================
        status: {
          critical: {
            DEFAULT: '#EF4444',
            bg: '#450A0A',
            border: '#DC2626',
          },
          warning: {
            DEFAULT: '#FBBF24',
            bg: '#451A03',
            border: '#F59E0B',
          },
          stable: {
            DEFAULT: '#34D399',
            bg: '#022C22',
            border: '#10B981',
          },
          info: {
            DEFAULT: '#60A5FA',
            bg: '#172554',
            border: '#3B82F6',
          },
        },

        // ==========================================
        // VITALS (IEC 60601-1-8 Medical Standard)
        // ==========================================
        vital: {
          spo2: '#00FFFF',
          hr: '#00FF00',
          rr: '#FFFF00',
          temp: '#FF99FF',
          fio2: '#FFFFFF',
          bp: '#FF0000',
        },

        // ==========================================
        // ALARMS (IEC 60601-1-8 Medical Standard)
        // ==========================================
        alarm: {
          critical: '#FF0000',
          warning: '#FFFF00',
          advisory: '#00FFFF',
        },
      },

      // ==========================================
      // SHADOWS
      // ==========================================
      boxShadow: {
        'glow-critical': '0 0 20px 0 rgba(239, 68, 68, 0.4)',
        'glow-warning': '0 0 20px 0 rgba(251, 191, 36, 0.4)',
        'glow-stable': '0 0 20px 0 rgba(52, 211, 153, 0.3)',
        'glow-brand': '0 0 20px 0 rgba(34, 211, 238, 0.3)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 10px 20px -5px rgba(0, 0, 0, 0.4)',
      },

      // ==========================================
      // ANIMATIONS (for alarms/pulse)
      // ==========================================
      animation: {
        'pulse-critical': 'pulse-critical 1s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'glow-critical': 'glow-critical 1s ease-in-out infinite',
      },
      keyframes: {
        'pulse-critical': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
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

      // ==========================================
      // TYPOGRAPHY
      // ==========================================
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },

      // ==========================================
      // BORDER RADIUS
      // ==========================================
      borderRadius: {
        'card': '12px',
        'panel': '16px',
      },
    },
  },
  plugins: [],
};
