import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

// HTTPS enforcement configuration
const ENFORCE_HTTPS = process.env.NODE_ENV === 'production';
const HSTS_MAX_AGE = 31536000; // 1 year in seconds

// CSP nonce configuration
const CSP_NONCE_ENABLED = process.env.CSP_NONCE_ENABLED !== 'false';

/**
 * Generate a cryptographically secure nonce for CSP
 * Uses Web Crypto API available in Edge Runtime
 */
function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

/**
 * Build Content Security Policy with nonce support
 * @param {string} nonce - The generated nonce for this request
 * @returns {string} - The CSP header value
 */
function buildCSP(nonce) {
  const csp = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      // In development, we need unsafe-eval for React Fast Refresh
      process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : '',
      // Add nonce for inline scripts
      nonce ? `'nonce-${nonce}'` : '',
      // Fallback for browsers that don't support nonce
      "'strict-dynamic'",
    ].filter(Boolean),
    'style-src': [
      "'self'",
      // Tailwind and other CSS frameworks often need unsafe-inline
      "'unsafe-inline'",
    ],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      // WebSocket connections for real-time updates
      'ws:',
      'wss:',
    ],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
    'upgrade-insecure-requests': [],
  };

  // Build the CSP string
  return Object.entries(csp)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Security headers applied to all responses
 * These are also defined in next.config.js for static assets
 */
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

/**
 * Check if request is using HTTPS
 * Handles both direct HTTPS and proxied requests (via X-Forwarded-Proto)
 */
function isSecureRequest(request) {
  // Check the protocol directly
  if (request.nextUrl.protocol === 'https:') {
    return true;
  }

  // Check X-Forwarded-Proto header (for load balancers/proxies)
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto === 'https') {
    return true;
  }

  return false;
}

/**
 * Redirect HTTP to HTTPS in production
 */
function enforceHttps(request) {
  if (!ENFORCE_HTTPS) {
    return null;
  }

  if (isSecureRequest(request)) {
    return null;
  }

  // Build HTTPS URL
  const httpsUrl = new URL(request.url);
  httpsUrl.protocol = 'https:';

  // 308 Permanent Redirect preserves the request method
  return NextResponse.redirect(httpsUrl, 308);
}

/**
 * Apply security headers to response
 * @param {NextResponse} response - The response object
 * @param {boolean} isSecure - Whether the request is secure
 * @param {string} nonce - The CSP nonce for this request
 */
function applySecurityHeaders(response, isSecure, nonce) {
  // Apply standard security headers
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  // Apply HSTS only for secure connections in production
  if (ENFORCE_HTTPS && isSecure) {
    response.headers.set(
      'Strict-Transport-Security',
      `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`
    );
  }

  // Apply Content Security Policy with nonce
  if (CSP_NONCE_ENABLED && nonce) {
    response.headers.set('Content-Security-Policy', buildCSP(nonce));
    // Pass nonce to server components via custom header
    response.headers.set('x-nonce', nonce);
  }

  return response;
}

// Role-based route permissions (inlined for edge runtime compatibility)
const ROLES = {
  ADMIN: 'Admin',
  PHYSICIAN: 'Physician',
  CHARGE_NURSE: 'Charge Nurse',
  STAFF_NURSE: 'Staff Nurse',
  ADMINISTRATIVE: 'Administrative',
};

const routePermissions = {
  // Admin-only routes
  '/settings': [ROLES.ADMIN],
  '/audit': [ROLES.ADMIN, ROLES.CHARGE_NURSE],
  '/devices': [ROLES.ADMIN, ROLES.CHARGE_NURSE],
  '/alarm-limits': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE],

  // Clinical routes - restricted from administrative staff
  '/orders': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE],
  '/care-plans': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.STAFF_NURSE],
  '/flowsheet': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.STAFF_NURSE],
  '/feeding': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.STAFF_NURSE],
  '/growth': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.STAFF_NURSE],
  '/calculators': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.STAFF_NURSE],

  // Handoff - clinical staff only
  '/handoff': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.STAFF_NURSE],

  // Discharge planning - includes administrative
  '/discharge': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.ADMINISTRATIVE],

  // Reports - all staff can view
  '/reports': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.STAFF_NURSE, ROLES.ADMINISTRATIVE],

  // Family portal - all staff
  '/family': [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.STAFF_NURSE, ROLES.ADMINISTRATIVE],

  // Notifications management
  '/notifications': [ROLES.ADMIN, ROLES.CHARGE_NURSE],
};

function hasPermission(role, pathname) {
  // Check exact match first
  if (routePermissions[pathname]) {
    return routePermissions[pathname].includes(role);
  }

  // Dynamic patient routes are accessible to all authenticated users
  if (pathname.startsWith('/patient/')) {
    return true;
  }

  // Routes not in the permissions list are accessible to all authenticated users
  return true;
}

export default auth((req) => {
  const { nextUrl } = req;
  const isSecure = isSecureRequest(req);

  // Generate a unique nonce for this request (for CSP)
  const nonce = CSP_NONCE_ENABLED ? generateNonce() : null;

  // STEP 1: Enforce HTTPS in production (before any other logic)
  const httpsRedirect = enforceHttps(req);
  if (httpsRedirect) {
    return httpsRedirect;
  }

  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/unauthorized'];
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);

  // Auth API routes should always be accessible
  const isAuthRoute = nextUrl.pathname.startsWith('/api/auth');

  // Health check endpoint should be public (for load balancers, k8s probes)
  const isHealthRoute = nextUrl.pathname === '/api/health';

  if (isAuthRoute || isHealthRoute) {
    const response = NextResponse.next();
    return applySecurityHeaders(response, isSecure, nonce);
  }

  // Redirect logged-in users away from login page
  if (isLoggedIn && nextUrl.pathname === '/login') {
    const response = NextResponse.redirect(new URL('/', nextUrl));
    return applySecurityHeaders(response, isSecure, nonce);
  }

  // Redirect non-logged-in users to login page
  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    const response = NextResponse.redirect(loginUrl);
    return applySecurityHeaders(response, isSecure, nonce);
  }

  // Role-based access control for authenticated users
  if (isLoggedIn && userRole && !isPublicRoute) {
    if (!hasPermission(userRole, nextUrl.pathname)) {
      const response = NextResponse.redirect(new URL('/unauthorized', nextUrl));
      return applySecurityHeaders(response, isSecure, nonce);
    }
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response, isSecure, nonce);
});

export const config = {
  matcher: [
    // Match all routes except static files and _next
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
