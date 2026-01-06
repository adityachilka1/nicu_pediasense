# Integration Tests for Authentication and Authorization

This directory contains comprehensive integration tests for the authentication and authorization system of the NICU Dashboard application.

## Test Files Created

### 1. `auth.test.js` (553 lines, 39 tests)
Tests authentication flows, password validation, and security features.

**Test Coverage:**
- Password Hashing and Verification (6 tests)
  - Secure bcrypt hashing with appropriate cost factor
  - Password verification correctness
  - Salt uniqueness and case sensitivity
  - Special character handling

- Password Validation Rules (11 tests)
  - Minimum length enforcement (12 characters)
  - Character type requirements (uppercase, lowercase, numbers, special characters)
  - Common weak password detection
  - Edge case handling

- Login Schema Validation (10 tests)
  - Email format validation
  - Email normalization (lowercase, trimming)
  - Password length limits
  - Required field validation

- User Authentication Flow (7 tests)
  - User lookup by email
  - Active status verification
  - Last login timestamp updates
  - Audit logging for success and failure

- Security Best Practices (5 tests)
  - Bcrypt cost factor validation
  - Timing attack mitigation
  - Long password handling
  - Password reuse protection

### 2. `rbac.test.js` (620 lines, 107 tests)
Tests role-based access control (RBAC) for all user roles and routes.

**Test Coverage:**
- Admin Role Permissions (17 tests)
  - Full access to all routes
  - Administrative functions

- Physician Role Permissions (13 tests)
  - Clinical route access
  - Restricted from administrative functions

- Charge Nurse Role Permissions (16 tests)
  - Supervisory access
  - Clinical and limited administrative access

- Staff Nurse Role Permissions (17 tests)
  - Bedside care routes
  - Restricted from orders and administrative functions

- Administrative Role Permissions (17 tests)
  - Non-clinical administrative access
  - Restricted from all clinical routes

- Dynamic Patient Routes (2 tests)
  - All authenticated users can access patient-specific routes

- Unrestricted Routes (7 tests)
  - Dashboard, patients, alarms, beds, trends, profile, help

- Route Permission Edge Cases (6 tests)
  - Undefined/null/invalid role handling
  - Query parameters and trailing slashes

- Role Hierarchy Validation (4 tests)
  - Admin > Charge Nurse > Staff Nurse
  - Physician and Charge Nurse similar clinical access

- Security Validation (3 tests)
  - Settings restricted to admin only
  - Order creation restricted appropriately
  - Reports accessible to all, settings not modifiable

### 3. `session.test.js` (746 lines, 39 tests)
Tests session management, timeout, refresh, and validation.

**Test Coverage:**
- Session Timeout After 15 Minutes of Inactivity (6 tests)
  - Expiration after 15 minutes
  - Active session maintenance
  - Threshold testing

- Session Refresh on Activity (5 tests)
  - LastActivity timestamp updates
  - Inactivity timer reset
  - Rapid consecutive updates

- Logout Clears Session (4 tests)
  - Session invalidation
  - Audit logging
  - Graceful handling without active session

- Invalid Session Token Rejected (6 tests)
  - Null/undefined token rejection
  - Missing required fields
  - Expired and malformed tokens

- Session Configuration (7 tests)
  - JWT strategy
  - Max age (8 hours)
  - Update age (1 minute)
  - Secure cookie configuration

- Session Data Integrity (5 tests)
  - User ID and role inclusion
  - LastActivity and expiresAt calculation
  - Data preservation across refreshes

- Concurrent Session Handling (2 tests)
  - Independent session management
  - Individual expiration

- Edge Cases and Error Handling (4 tests)
  - Negative, zero, future, and very large timestamps

## Test Statistics

- **Total Test Files:** 3
- **Total Lines of Code:** 1,919
- **Total Test Cases:** 185
- **All Tests Passing:** YES

## Running the Tests

### Run all integration tests:
```bash
npm test -- __tests__/integration
```

### Run specific test file:
```bash
npm test -- __tests__/integration/auth.test.js
npm test -- __tests__/integration/rbac.test.js
npm test -- __tests__/integration/session.test.js
```

### Run with coverage:
```bash
npm test -- __tests__/integration --coverage
```

### Run in watch mode:
```bash
npm test -- __tests__/integration --watch
```

## Test Approach

These tests follow integration testing best practices:

1. **Mocking Strategy:**
   - Next-auth modules are mocked to avoid ES module import issues
   - Prisma client is mocked for database operations
   - Tests focus on business logic without actual HTTP requests

2. **Test Structure:**
   - Descriptive test names following "should..." pattern
   - Organized into logical describe blocks
   - Comprehensive edge case coverage

3. **Security Focus:**
   - Password strength validation
   - Timing attack mitigation
   - Session expiration and refresh
   - Role-based access control

4. **Real-World Scenarios:**
   - Invalid credentials
   - Inactive user accounts
   - Concurrent sessions
   - Edge cases and error handling

## Key Features Tested

### Authentication
- Secure password hashing with bcrypt (cost factor 12)
- Password strength validation (12+ chars, complexity requirements)
- Login attempt audit logging
- Email case-insensitivity
- Failed login handling

### Authorization (RBAC)
- 5 user roles: Admin, Physician, Charge Nurse, Staff Nurse, Administrative
- 15+ restricted routes with role-based access
- Dynamic patient route access
- Unrestricted public routes
- Role hierarchy validation

### Session Management
- 15-minute inactivity timeout
- Session refresh on activity
- Secure cookie configuration
- JWT token validation
- Session expiration and cleanup
- Concurrent session handling

## Dependencies

These tests use:
- **Jest**: Test framework
- **bcryptjs**: Password hashing
- **zod**: Schema validation
- Mocked versions of:
  - next-auth
  - @prisma/client

## Notes

- Tests are designed to work with the existing authentication implementation
- No actual database or HTTP calls are made (all mocked)
- For full end-to-end testing with actual HTTP requests, use Playwright E2E tests
- Session tests use fake timers for time-dependent behavior
- All tests maintain isolation and can run in parallel

## Future Enhancements

Consider adding:
- Multi-factor authentication tests
- Password reset flow tests
- Account lockout after failed attempts
- IP-based rate limiting tests
- OAuth provider integration tests
- Session migration tests
- Cross-device session management
