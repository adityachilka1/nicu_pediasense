/**
 * Environment Configuration Validation
 *
 * This module validates critical environment variables at startup.
 * It ensures security-sensitive configurations are properly set
 * before the application starts.
 */

// List of insecure default secrets that should never be used in production
const INSECURE_SECRETS = [
  'nicu-dashboard-secret-key-change-in-production-2024',
  'CHANGE_ME_GENERATE_WITH_openssl_rand_base64_32',
  'your-secret-here',
  'secret',
  'changeme',
  'development-secret',
  'test-secret',
];

/**
 * Validate environment configuration
 * @throws {Error} If critical configuration is missing or insecure
 */
export function validateEnvironment() {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // =====================================================
  // CRITICAL CHECKS (will throw in production)
  // =====================================================

  // Check NEXTAUTH_SECRET
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    errors.push(
      'NEXTAUTH_SECRET is not set. Generate one with: node scripts/generate-secret.js'
    );
  } else if (INSECURE_SECRETS.includes(secret)) {
    if (isProduction) {
      errors.push(
        'NEXTAUTH_SECRET contains an insecure default value. ' +
        'Generate a secure secret with: node scripts/generate-secret.js'
      );
    } else {
      warnings.push(
        'NEXTAUTH_SECRET contains a default value. This is OK for development, ' +
        'but must be changed for production.'
      );
    }
  } else if (secret.length < 32) {
    errors.push(
      'NEXTAUTH_SECRET is too short. It should be at least 32 characters. ' +
      'Generate a secure secret with: node scripts/generate-secret.js'
    );
  }

  // Check DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    errors.push('DATABASE_URL is not set');
  }

  // =====================================================
  // PRODUCTION-ONLY CHECKS
  // =====================================================

  if (isProduction) {
    // Check for HTTPS in NEXTAUTH_URL
    const authUrl = process.env.NEXTAUTH_URL;
    if (authUrl && !authUrl.startsWith('https://')) {
      errors.push(
        'NEXTAUTH_URL must use HTTPS in production. ' +
        'Current value: ' + authUrl
      );
    }

    // Check ALLOWED_ORIGIN
    const allowedOrigin = process.env.ALLOWED_ORIGIN;
    if (!allowedOrigin || allowedOrigin === '*') {
      errors.push(
        'ALLOWED_ORIGIN must be set to a specific domain in production. ' +
        'Never use "*" in production.'
      );
    }

    // Check for SQLite in production
    if (dbUrl && dbUrl.includes('file:')) {
      warnings.push(
        'Using SQLite in production is not recommended. ' +
        'Consider migrating to PostgreSQL for better performance and scalability.'
      );
    }
  }

  // =====================================================
  // OUTPUT RESULTS
  // =====================================================

  // Log warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Configuration Warnings:');
    warnings.forEach((warning, i) => {
      console.warn(`   ${i + 1}. ${warning}`);
    });
    console.warn('');
  }

  // Throw on errors in production, warn in development
  if (errors.length > 0) {
    const errorMessage = [
      '\n❌ Environment Configuration Errors:',
      ...errors.map((error, i) => `   ${i + 1}. ${error}`),
      '',
      'Please fix these issues before starting the application.',
      'See .env.example for configuration reference.',
      ''
    ].join('\n');

    if (isProduction) {
      throw new Error(errorMessage);
    } else {
      console.error(errorMessage);
      console.warn('⚠️  Running in development mode - continuing despite errors.\n');
    }
  }

  // Success message
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Environment configuration validated successfully.\n');
  }
}

/**
 * Check if running in development mode
 * @returns {boolean}
 */
export function isDevelopment() {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Check if running in production mode
 * @returns {boolean}
 */
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Get current environment name
 * @returns {string}
 */
export function getEnvironment() {
  return process.env.NODE_ENV || 'development';
}

// Auto-validate on import in server context
if (typeof window === 'undefined') {
  validateEnvironment();
}
