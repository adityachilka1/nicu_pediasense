// Role-based access control configuration for NICU Dashboard
// Defines which roles can access which routes

export const ROLES = {
  ADMIN: 'Admin',
  PHYSICIAN: 'Physician',
  CHARGE_NURSE: 'Charge Nurse',
  STAFF_NURSE: 'Staff Nurse',
  ADMINISTRATIVE: 'Administrative',
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
  switch (role) {
    case ROLES.ADMIN:
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    case ROLES.PHYSICIAN:
      return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    case ROLES.CHARGE_NURSE:
      return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    case ROLES.STAFF_NURSE:
      return 'text-green-400 bg-green-500/10 border-green-500/30';
    case ROLES.ADMINISTRATIVE:
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    default:
      return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
}
