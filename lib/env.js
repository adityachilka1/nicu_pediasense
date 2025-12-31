// Environment variable validation
// Run at app startup to ensure all required config is present

const requiredEnvVars = {
  // Required in production
  production: [
    'NEXTAUTH_SECRET',
    'DATABASE_URL',
  ],
  // Required in development
  development: [
    'DATABASE_URL',
  ],
};

const optionalEnvVars = [
  'LOG_LEVEL',
  'ALLOWED_ORIGIN',
  'RATE_LIMIT_MAX',
];

export function validateEnv() {
  const env = process.env.NODE_ENV || 'development';
  const required = requiredEnvVars[env] || requiredEnvVars.development;
  const missing = [];

  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (env === 'production') {
      throw new Error(message);
    } else {
      console.warn(`[ENV WARNING] ${message}`);
    }
  }

  return true;
}

export function getEnvConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl: process.env.DATABASE_URL,
    allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  };
}

// Auto-validate on import in development
if (typeof window === 'undefined') {
  try {
    validateEnv();
  } catch (error) {
    console.error('[ENV ERROR]', error.message);
  }
}

export default { validateEnv, getEnvConfig };
