/**
 * Security Module Tests
 * Tests for authentication, authorization, CORS, sanitization, and security headers
 */

// Mock next/server before importing
jest.mock('next/server', () => ({
  NextResponse: jest.fn((body, options) => ({
    body,
    status: options?.status || 200,
    headers: new Map(),
  })),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    exception: jest.fn(),
  },
}));

// Mock rate limiter
jest.mock('@/lib/rate-limiter', () => ({
  rateLimit: jest.fn(() => ({ remaining: 99, limit: 100 })),
  rateLimitAsync: jest.fn(() => Promise.resolve({ remaining: 99, limit: 100 })),
  getRateLimitInfo: jest.fn(),
  resetRateLimit: jest.fn(),
  getRateLimitHeaders: jest.fn(),
  getRateLimitConfig: jest.fn(),
  getRateLimiterStatus: jest.fn(),
}));

import {
  sanitizeString,
  sanitizeInput,
  requireAuth,
  requireRole,
  ROLES,
  ROLE_GROUPS,
  getClientIP,
  securityHeaders,
  getCorsHeaders,
  isOriginAllowed,
  handleCORS,
} from '@/lib/security';

import { AuthenticationError, AuthorizationError } from '@/lib/errors';

// ============================================================
// Input Sanitization Tests
// ============================================================

describe('sanitizeString', () => {
  describe('XSS prevention', () => {
    test('removes angle brackets', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    test('removes javascript: protocol', () => {
      expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
    });

    test('removes JavaScript: protocol (case insensitive)', () => {
      expect(sanitizeString('JAVASCRIPT:malicious()')).toBe('malicious()');
    });

    test('removes event handlers', () => {
      expect(sanitizeString('onclick=alert(1)')).toBe('alert(1)');
      expect(sanitizeString('onerror=malicious()')).toBe('malicious()');
      expect(sanitizeString('onload=hack()')).toBe('hack()');
    });

    test('removes multiple event handlers', () => {
      const input = 'onclick=a() onmouseover=b()';
      const result = sanitizeString(input);
      expect(result).not.toContain('onclick=');
      expect(result).not.toContain('onmouseover=');
    });

    test('removes nested malicious content', () => {
      const input = '<img src="x" onerror=alert(1)>';
      const result = sanitizeString(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('onerror=');
    });
  });

  describe('edge cases', () => {
    test('preserves normal text', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
    });

    test('preserves numbers', () => {
      expect(sanitizeString('12345')).toBe('12345');
    });

    test('preserves special characters except angle brackets', () => {
      expect(sanitizeString('Hello! @#$%^&*()_+-={}[]|:";\',.?/')).toBe('Hello! @#$%^&*()_+-={}[]|:";\',.?/');
    });

    test('trims whitespace', () => {
      expect(sanitizeString('  Hello  ')).toBe('Hello');
    });

    test('returns non-strings unchanged', () => {
      expect(sanitizeString(123)).toBe(123);
      expect(sanitizeString(null)).toBe(null);
      expect(sanitizeString(undefined)).toBe(undefined);
    });

    test('handles empty string', () => {
      expect(sanitizeString('')).toBe('');
    });
  });
});

describe('sanitizeInput (recursive)', () => {
  test('sanitizes string values', () => {
    expect(sanitizeInput('<script>evil</script>')).toBe('scriptevil/script');
  });

  test('sanitizes arrays', () => {
    const input = ['<script>a</script>', '<img onerror=b>'];
    const result = sanitizeInput(input);
    expect(result[0]).not.toContain('<');
    expect(result[1]).not.toContain('onerror=');
  });

  test('sanitizes nested objects', () => {
    const input = {
      name: '<script>evil</script>',
      details: {
        description: 'onclick=hack()',
      },
    };
    const result = sanitizeInput(input);
    expect(result.name).not.toContain('<');
    expect(result.details.description).not.toContain('onclick=');
  });

  test('sanitizes object keys', () => {
    const input = { '<script>': 'value' };
    const result = sanitizeInput(input);
    expect(Object.keys(result)[0]).not.toContain('<');
  });

  test('handles mixed nested structures', () => {
    const input = {
      users: [
        { name: '<b>John</b>', email: 'javascript:alert(1)' },
        { name: 'Jane', email: 'jane@example.com' },
      ],
    };
    const result = sanitizeInput(input);
    expect(result.users[0].name).not.toContain('<');
    expect(result.users[0].email).not.toContain('javascript:');
    expect(result.users[1].email).toBe('jane@example.com');
  });

  test('returns primitives unchanged', () => {
    expect(sanitizeInput(42)).toBe(42);
    expect(sanitizeInput(true)).toBe(true);
    expect(sanitizeInput(null)).toBe(null);
  });
});

// ============================================================
// Authentication Tests
// ============================================================

describe('requireAuth', () => {
  test('returns session when authenticated', () => {
    const session = { user: { id: 1, email: 'test@example.com' } };
    expect(requireAuth(session)).toBe(session);
  });

  test('throws AuthenticationError when session is null', () => {
    expect(() => requireAuth(null)).toThrow(AuthenticationError);
  });

  test('throws AuthenticationError when session is undefined', () => {
    expect(() => requireAuth(undefined)).toThrow(AuthenticationError);
  });

  test('throws AuthenticationError when session has no user', () => {
    expect(() => requireAuth({})).toThrow(AuthenticationError);
    expect(() => requireAuth({ user: null })).toThrow(AuthenticationError);
  });

  test('error message is "Authentication required"', () => {
    try {
      requireAuth(null);
    } catch (error) {
      expect(error.message).toBe('Authentication required');
    }
  });
});

// ============================================================
// Authorization Tests
// ============================================================

describe('requireRole', () => {
  describe('valid authorization', () => {
    test('allows admin for ADMIN_ONLY', () => {
      const session = { user: { id: 1, role: 'admin' } };
      expect(requireRole(session, ROLE_GROUPS.ADMIN_ONLY)).toBe(session);
    });

    test('allows admin for LEADERSHIP', () => {
      const session = { user: { id: 1, role: 'admin' } };
      expect(requireRole(session, ROLE_GROUPS.LEADERSHIP)).toBe(session);
    });

    test('allows physician for LEADERSHIP', () => {
      const session = { user: { id: 1, role: 'physician' } };
      expect(requireRole(session, ROLE_GROUPS.LEADERSHIP)).toBe(session);
    });

    test('allows charge_nurse for LEADERSHIP', () => {
      const session = { user: { id: 1, role: 'charge_nurse' } };
      expect(requireRole(session, ROLE_GROUPS.LEADERSHIP)).toBe(session);
    });

    test('allows staff_nurse for ALL_CLINICAL', () => {
      const session = { user: { id: 1, role: 'staff_nurse' } };
      expect(requireRole(session, ROLE_GROUPS.ALL_CLINICAL)).toBe(session);
    });
  });

  describe('role normalization', () => {
    test('handles uppercase roles', () => {
      const session = { user: { id: 1, role: 'ADMIN' } };
      expect(requireRole(session, ROLE_GROUPS.ADMIN_ONLY)).toBe(session);
    });

    test('handles mixed case roles', () => {
      const session = { user: { id: 1, role: 'Charge_Nurse' } };
      expect(requireRole(session, ROLE_GROUPS.LEADERSHIP)).toBe(session);
    });

    test('handles roles with spaces', () => {
      const session = { user: { id: 1, role: 'charge nurse' } };
      expect(requireRole(session, ROLE_GROUPS.LEADERSHIP)).toBe(session);
    });

    test('handles roles with multiple spaces', () => {
      const session = { user: { id: 1, role: 'staff  nurse' } };
      expect(requireRole(session, ROLE_GROUPS.ALL_CLINICAL)).toBe(session);
    });
  });

  describe('unauthorized access', () => {
    test('denies staff_nurse for ADMIN_ONLY', () => {
      const session = { user: { id: 1, role: 'staff_nurse' } };
      expect(() => requireRole(session, ROLE_GROUPS.ADMIN_ONLY)).toThrow(AuthorizationError);
    });

    test('denies staff_nurse for LEADERSHIP', () => {
      const session = { user: { id: 1, role: 'staff_nurse' } };
      expect(() => requireRole(session, ROLE_GROUPS.LEADERSHIP)).toThrow(AuthorizationError);
    });

    test('denies administrative for LEADERSHIP', () => {
      const session = { user: { id: 1, role: 'administrative' } };
      expect(() => requireRole(session, ROLE_GROUPS.LEADERSHIP)).toThrow(AuthorizationError);
    });

    test('denies unknown role', () => {
      const session = { user: { id: 1, role: 'guest' } };
      expect(() => requireRole(session, ROLE_GROUPS.ALL_CLINICAL)).toThrow(AuthorizationError);
    });

    test('denies empty role', () => {
      const session = { user: { id: 1, role: '' } };
      expect(() => requireRole(session, ROLE_GROUPS.ALL_CLINICAL)).toThrow(AuthorizationError);
    });
  });

  test('throws AuthenticationError for unauthenticated session', () => {
    expect(() => requireRole(null, ROLE_GROUPS.ALL_CLINICAL)).toThrow(AuthenticationError);
  });
});

describe('ROLES constants', () => {
  test('defines all expected roles', () => {
    expect(ROLES.ADMIN).toBe('admin');
    expect(ROLES.PHYSICIAN).toBe('physician');
    expect(ROLES.CHARGE_NURSE).toBe('charge_nurse');
    expect(ROLES.STAFF_NURSE).toBe('staff_nurse');
    expect(ROLES.ADMINISTRATIVE).toBe('administrative');
  });
});

describe('ROLE_GROUPS constants', () => {
  test('ALL_CLINICAL includes clinical staff', () => {
    expect(ROLE_GROUPS.ALL_CLINICAL).toContain(ROLES.ADMIN);
    expect(ROLE_GROUPS.ALL_CLINICAL).toContain(ROLES.PHYSICIAN);
    expect(ROLE_GROUPS.ALL_CLINICAL).toContain(ROLES.CHARGE_NURSE);
    expect(ROLE_GROUPS.ALL_CLINICAL).toContain(ROLES.STAFF_NURSE);
    expect(ROLE_GROUPS.ALL_CLINICAL).not.toContain(ROLES.ADMINISTRATIVE);
  });

  test('LEADERSHIP includes management roles', () => {
    expect(ROLE_GROUPS.LEADERSHIP).toContain(ROLES.ADMIN);
    expect(ROLE_GROUPS.LEADERSHIP).toContain(ROLES.PHYSICIAN);
    expect(ROLE_GROUPS.LEADERSHIP).toContain(ROLES.CHARGE_NURSE);
    expect(ROLE_GROUPS.LEADERSHIP).not.toContain(ROLES.STAFF_NURSE);
  });

  test('ADMIN_ONLY includes only admin', () => {
    expect(ROLE_GROUPS.ADMIN_ONLY).toEqual([ROLES.ADMIN]);
  });
});

// ============================================================
// Client IP Extraction Tests
// ============================================================

describe('getClientIP', () => {
  test('extracts IP from x-forwarded-for header', () => {
    const request = {
      headers: {
        get: jest.fn((header) => {
          if (header === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
          return null;
        }),
      },
    };
    expect(getClientIP(request)).toBe('192.168.1.1');
  });

  test('extracts single IP from x-forwarded-for', () => {
    const request = {
      headers: {
        get: jest.fn((header) => {
          if (header === 'x-forwarded-for') return '192.168.1.100';
          return null;
        }),
      },
    };
    expect(getClientIP(request)).toBe('192.168.1.100');
  });

  test('falls back to x-real-ip header', () => {
    const request = {
      headers: {
        get: jest.fn((header) => {
          if (header === 'x-real-ip') return '10.0.0.50';
          return null;
        }),
      },
    };
    expect(getClientIP(request)).toBe('10.0.0.50');
  });

  test('returns "unknown" when no IP headers present', () => {
    const request = {
      headers: {
        get: jest.fn(() => null),
      },
    };
    expect(getClientIP(request)).toBe('unknown');
  });

  test('trims whitespace from forwarded IP', () => {
    const request = {
      headers: {
        get: jest.fn((header) => {
          if (header === 'x-forwarded-for') return '  192.168.1.1  ';
          return null;
        }),
      },
    };
    expect(getClientIP(request)).toBe('192.168.1.1');
  });
});

// ============================================================
// Security Headers Tests
// ============================================================

describe('securityHeaders', () => {
  test('includes X-Frame-Options', () => {
    expect(securityHeaders['X-Frame-Options']).toBe('DENY');
  });

  test('includes X-Content-Type-Options', () => {
    expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
  });

  test('includes X-XSS-Protection', () => {
    expect(securityHeaders['X-XSS-Protection']).toBe('1; mode=block');
  });

  test('includes Referrer-Policy', () => {
    expect(securityHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  test('includes Permissions-Policy', () => {
    expect(securityHeaders['Permissions-Policy']).toContain('camera=()');
    expect(securityHeaders['Permissions-Policy']).toContain('microphone=()');
  });

  test('includes Content-Security-Policy', () => {
    expect(securityHeaders['Content-Security-Policy']).toContain("default-src 'self'");
    expect(securityHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });
});

// ============================================================
// CORS Tests
// ============================================================

describe('getCorsHeaders', () => {
  test('returns CORS headers with valid methods', () => {
    const headers = getCorsHeaders('http://localhost:3000');
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Access-Control-Allow-Methods']).toContain('PATCH');
    expect(headers['Access-Control-Allow-Methods']).toContain('DELETE');
  });

  test('allows credentials', () => {
    const headers = getCorsHeaders('http://localhost:3000');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  test('includes Vary header for caching', () => {
    const headers = getCorsHeaders('http://localhost:3000');
    expect(headers['Vary']).toBe('Origin');
  });

  test('includes required request headers', () => {
    const headers = getCorsHeaders('http://localhost:3000');
    expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });
});

describe('isOriginAllowed', () => {
  test('allows localhost:3000 in development', () => {
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
  });

  test('allows 127.0.0.1:3000 in development', () => {
    expect(isOriginAllowed('http://127.0.0.1:3000')).toBe(true);
  });
});

describe('handleCORS', () => {
  test('returns 204 for OPTIONS preflight', () => {
    const request = {
      method: 'OPTIONS',
      headers: {
        get: jest.fn((header) => {
          if (header === 'origin') return 'http://localhost:3000';
          return null;
        }),
      },
    };
    const response = handleCORS(request);
    expect(response).not.toBeNull();
    expect(response.status).toBe(204);
  });

  test('returns null for non-preflight requests from allowed origin', () => {
    const request = {
      method: 'GET',
      headers: {
        get: jest.fn((header) => {
          if (header === 'origin') return 'http://localhost:3000';
          return null;
        }),
      },
    };
    const response = handleCORS(request);
    expect(response).toBeNull();
  });

  test('returns null for requests without origin header', () => {
    const request = {
      method: 'GET',
      headers: {
        get: jest.fn(() => null),
      },
    };
    const response = handleCORS(request);
    expect(response).toBeNull();
  });
});
