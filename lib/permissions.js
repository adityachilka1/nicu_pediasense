// Role-based access control configuration for NICU Dashboard
// Defines which roles can access which routes

// Role values must match database/session values (snake_case)
export const ROLES = {
  ADMIN: 'admin',
  PHYSICIAN: 'physician',
  CHARGE_NURSE: 'charge_nurse',
  STAFF_NURSE: 'staff_nurse',
  ADMINISTRATIVE: 'administrative',
};

// Display names for UI
export const ROLE_DISPLAY_NAMES = {
  admin: 'Admin',
  physician: 'Physician',
  charge_nurse: 'Charge Nurse',
  staff_nurse: 'Staff Nurse',
  administrative: 'Administrative',
};

// Define route permissions
// Routes not listed here are accessible to all authenticated users
export const routePermissions = {
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

// Routes that are accessible to all authenticated users (not in routePermissions)
// - / (Monitor/Dashboard)
// - /patients
// - /patient/[id]
// - /alarms
// - /beds
// - /trends
// - /profile
// - /help

/**
 * Check if a role has permission to access a route
 * @param {string} role - The user's role
 * @param {string} pathname - The route pathname
 * @returns {boolean} - Whether the role can access the route
 */
export function hasPermission(role, pathname) {
  // Check exact match first
  if (routePermissions[pathname]) {
    return routePermissions[pathname].includes(role);
  }

  // Check for dynamic routes (e.g., /patient/1 matches /patient/[id])
  // For now, dynamic patient routes are accessible to all
  if (pathname.startsWith('/patient/')) {
    return true;
  }

  // Routes not in the permissions list are accessible to all authenticated users
  return true;
}

/**
 * Get all routes accessible to a role
 * @param {string} role - The user's role
 * @returns {string[]} - Array of accessible route paths
 */
export function getAccessibleRoutes(role) {
  const restrictedRoutes = Object.entries(routePermissions)
    .filter(([_, roles]) => !roles.includes(role))
    .map(([route]) => route);

  return restrictedRoutes;
}

/**
 * Get role display color for UI
 * @param {string} role - The user's role
 * @returns {string} - Tailwind color class
 */
export function getRoleColor(role) {
  const roleColors = {
    [ROLES.ADMIN]: 'text-red-400 bg-red-500/10 border-red-500/30',
    [ROLES.PHYSICIAN]: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    [ROLES.CHARGE_NURSE]: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    [ROLES.STAFF_NURSE]: 'text-green-400 bg-green-500/10 border-green-500/30',
    [ROLES.ADMINISTRATIVE]: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  };
  return roleColors[role] || 'text-slate-400 bg-slate-500/10 border-slate-500/30';
}

/**
 * Get display name for a role
 * @param {string} role - The role value (snake_case)
 * @returns {string} - Human-readable role name
 */
export function getRoleDisplayName(role) {
  return ROLE_DISPLAY_NAMES[role] || role;
}
