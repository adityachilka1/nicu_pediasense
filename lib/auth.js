import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Session configuration constants
const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours (shift-based)
const SESSION_INACTIVITY_TIMEOUT = parseInt(process.env.SESSION_INACTIVITY_TIMEOUT || '900', 10); // 15 minutes default

// Password policy configuration
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_REQUIRES_UPPERCASE = true;
const PASSWORD_REQUIRES_LOWERCASE = true;
const PASSWORD_REQUIRES_NUMBER = true;
const PASSWORD_REQUIRES_SPECIAL = true;

/**
 * Validate password strength
 * @param {string} password - The password to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }

  if (PASSWORD_REQUIRES_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_REQUIRES_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_REQUIRES_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_REQUIRES_SPECIAL && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common weak passwords
  const commonPasswords = [
    'password', 'admin123', 'doctor123', 'nurse123', 'hospital',
    'qwerty', '123456', 'letmein', 'welcome', 'password1'
  ];

  if (commonPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password contains a commonly used pattern');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
  const saltRounds = 12; // Higher cost factor for better security
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Get Prisma client (dynamic import for Edge runtime compatibility)
 */
async function getPrisma() {
  const { prisma } = await import('./prisma');
  return prisma;
}

/**
 * Create audit log (dynamic import for Edge runtime compatibility)
 */
async function createAuditLogEntry(data) {
  try {
    const prisma = await getPrisma();
    await prisma.auditLog.create({ data });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

export const authConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Dynamic import of Prisma for Node.js runtime
          const prisma = await getPrisma();

          // Find user in database
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email.toLowerCase(),
            },
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              passwordHash: true,
              active: true,
              lastLogin: true,
            }
          });

          const ipAddress = request?.headers?.get?.('x-forwarded-for') || 'unknown';

          if (!user) {
            // Log failed login attempt (user not found)
            await createAuditLogEntry({
              action: 'login_failed',
              resource: 'auth',
              details: JSON.stringify({
                reason: 'user_not_found',
                email: credentials.email.substring(0, 3) + '***'
              }),
              ipAddress,
            });
            return null;
          }

          // Check if user account is active
          if (!user.active) {
            await createAuditLogEntry({
              userId: user.id,
              action: 'login_failed',
              resource: 'auth',
              details: JSON.stringify({ reason: 'account_disabled' }),
              ipAddress,
            });
            return null;
          }

          // Verify password
          const isPasswordValid = await verifyPassword(
            credentials.password,
            user.passwordHash
          );

          if (!isPasswordValid) {
            // Log failed login attempt (wrong password)
            await createAuditLogEntry({
              userId: user.id,
              action: 'login_failed',
              resource: 'auth',
              details: JSON.stringify({ reason: 'invalid_password' }),
              ipAddress,
            });
            return null;
          }

          // Update last login timestamp
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
          });

          // Log successful login
          await createAuditLogEntry({
            userId: user.id,
            action: 'login_success',
            resource: 'auth',
            details: JSON.stringify({ method: 'credentials' }),
            ipAddress,
          });

          return {
            id: String(user.id),
            email: user.email,
            name: user.fullName,
            role: user.role,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.lastActivity = Date.now();
      }

      // Check for session inactivity on each token refresh
      if (trigger === 'update' || !user) {
        const lastActivity = token.lastActivity || Date.now();
        const inactiveTime = (Date.now() - lastActivity) / 1000;

        if (inactiveTime > SESSION_INACTIVITY_TIMEOUT) {
          // Session expired due to inactivity
          return null;
        }

        // Update last activity timestamp
        token.lastActivity = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (!token) {
        return null;
      }

      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.lastActivity = token.lastActivity;
        session.expiresAt = token.lastActivity + (SESSION_INACTIVITY_TIMEOUT * 1000);
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.id) {
        await createAuditLogEntry({
          userId: parseInt(token.id),
          action: 'logout',
          resource: 'auth',
          details: JSON.stringify({ method: 'user_initiated' }),
        });
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
    updateAge: 60, // Update session every minute to track activity
  },
  // Ensure secure cookies in production
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
