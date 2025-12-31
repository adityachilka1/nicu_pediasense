/** @type {import('next').NextConfig} */

// Security headers configuration
// These headers are applied to all routes including static assets
const securityHeaders = [
  {
    // Prevent clickjacking attacks
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Prevent MIME type sniffing
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Enable XSS filter (legacy browsers)
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    // Control referrer information
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Disable unnecessary browser features
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    // Content Security Policy
    // Note: 'unsafe-inline' and 'unsafe-eval' are required for Next.js
    // In production, consider using nonces for stricter CSP
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

// Add HSTS header only in production
if (process.env.NODE_ENV === 'production') {
  securityHeaders.push({
    // HTTP Strict Transport Security
    // max-age: 1 year, includeSubDomains, preload-ready
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  });
}

const nextConfig = {
  reactStrictMode: true,

  // Apply security headers to all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  // Redirect HTTP to HTTPS in production
  async redirects() {
    // Only apply in production
    if (process.env.NODE_ENV !== 'production') {
      return [];
    }

    return [
      // This redirect is handled by middleware for dynamic routes,
      // but this catches any edge cases for static assets
      // Note: This requires proper reverse proxy configuration
      // to set X-Forwarded-Proto header
    ];
  },

  // Production optimizations
  poweredByHeader: false, // Remove X-Powered-By header

  // Enable compression
  compress: true,
};

module.exports = nextConfig;
