import {
  ROLES,
  routePermissions,
  hasPermission,
  getAccessibleRoutes,
  getRoleColor,
} from '@/lib/permissions';

describe('ROLES', () => {
  it('should define all expected roles', () => {
    expect(ROLES.ADMIN).toBe('Admin');
    expect(ROLES.PHYSICIAN).toBe('Physician');
    expect(ROLES.CHARGE_NURSE).toBe('Charge Nurse');
    expect(ROLES.STAFF_NURSE).toBe('Staff Nurse');
    expect(ROLES.ADMINISTRATIVE).toBe('Administrative');
  });

  it('should have 5 roles defined', () => {
    expect(Object.keys(ROLES)).toHaveLength(5);
  });
});

describe('routePermissions', () => {
  it('should define settings as admin-only', () => {
    expect(routePermissions['/settings']).toEqual([ROLES.ADMIN]);
  });

  it('should define audit for admin and charge nurse', () => {
    expect(routePermissions['/audit']).toContain(ROLES.ADMIN);
    expect(routePermissions['/audit']).toContain(ROLES.CHARGE_NURSE);
    expect(routePermissions['/audit']).not.toContain(ROLES.STAFF_NURSE);
  });

  it('should define clinical routes excluding administrative', () => {
    expect(routePermissions['/flowsheet']).not.toContain(ROLES.ADMINISTRATIVE);
    expect(routePermissions['/orders']).not.toContain(ROLES.ADMINISTRATIVE);
    expect(routePermissions['/handoff']).not.toContain(ROLES.ADMINISTRATIVE);
  });

  it('should allow administrative access to discharge', () => {
    expect(routePermissions['/discharge']).toContain(ROLES.ADMINISTRATIVE);
  });
});

describe('hasPermission', () => {
  describe('Admin role', () => {
    it('should have access to all restricted routes', () => {
      expect(hasPermission(ROLES.ADMIN, '/settings')).toBe(true);
      expect(hasPermission(ROLES.ADMIN, '/audit')).toBe(true);
      expect(hasPermission(ROLES.ADMIN, '/orders')).toBe(true);
      expect(hasPermission(ROLES.ADMIN, '/flowsheet')).toBe(true);
    });

    it('should have access to unrestricted routes', () => {
      expect(hasPermission(ROLES.ADMIN, '/')).toBe(true);
      expect(hasPermission(ROLES.ADMIN, '/patients')).toBe(true);
      expect(hasPermission(ROLES.ADMIN, '/alarms')).toBe(true);
    });
  });

  describe('Physician role', () => {
    it('should not have access to settings', () => {
      expect(hasPermission(ROLES.PHYSICIAN, '/settings')).toBe(false);
    });

    it('should have access to clinical routes', () => {
      expect(hasPermission(ROLES.PHYSICIAN, '/orders')).toBe(true);
      expect(hasPermission(ROLES.PHYSICIAN, '/flowsheet')).toBe(true);
      expect(hasPermission(ROLES.PHYSICIAN, '/alarm-limits')).toBe(true);
    });

    it('should not have access to audit', () => {
      expect(hasPermission(ROLES.PHYSICIAN, '/audit')).toBe(false);
    });
  });

  describe('Charge Nurse role', () => {
    it('should have access to audit', () => {
      expect(hasPermission(ROLES.CHARGE_NURSE, '/audit')).toBe(true);
    });

    it('should have access to devices', () => {
      expect(hasPermission(ROLES.CHARGE_NURSE, '/devices')).toBe(true);
    });

    it('should not have access to settings', () => {
      expect(hasPermission(ROLES.CHARGE_NURSE, '/settings')).toBe(false);
    });
  });

  describe('Staff Nurse role', () => {
    it('should have access to clinical documentation', () => {
      expect(hasPermission(ROLES.STAFF_NURSE, '/flowsheet')).toBe(true);
      expect(hasPermission(ROLES.STAFF_NURSE, '/care-plans')).toBe(true);
      expect(hasPermission(ROLES.STAFF_NURSE, '/feeding')).toBe(true);
    });

    it('should not have access to orders', () => {
      expect(hasPermission(ROLES.STAFF_NURSE, '/orders')).toBe(false);
    });

    it('should not have access to configuration', () => {
      expect(hasPermission(ROLES.STAFF_NURSE, '/settings')).toBe(false);
      expect(hasPermission(ROLES.STAFF_NURSE, '/devices')).toBe(false);
      expect(hasPermission(ROLES.STAFF_NURSE, '/alarm-limits')).toBe(false);
    });
  });

  describe('Administrative role', () => {
    it('should not have access to clinical routes', () => {
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/flowsheet')).toBe(false);
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/orders')).toBe(false);
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/handoff')).toBe(false);
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/care-plans')).toBe(false);
    });

    it('should have access to discharge and family', () => {
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/discharge')).toBe(true);
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/family')).toBe(true);
    });

    it('should have access to reports', () => {
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/reports')).toBe(true);
    });

    it('should have access to unrestricted routes', () => {
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/')).toBe(true);
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/patients')).toBe(true);
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/beds')).toBe(true);
    });
  });

  describe('Dynamic routes', () => {
    it('should allow access to patient detail pages for all roles', () => {
      expect(hasPermission(ROLES.ADMIN, '/patient/1')).toBe(true);
      expect(hasPermission(ROLES.PHYSICIAN, '/patient/123')).toBe(true);
      expect(hasPermission(ROLES.STAFF_NURSE, '/patient/456')).toBe(true);
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/patient/789')).toBe(true);
    });
  });

  describe('Undefined routes', () => {
    it('should allow access to routes not in permissions list', () => {
      expect(hasPermission(ROLES.ADMINISTRATIVE, '/some-new-route')).toBe(true);
      expect(hasPermission(ROLES.STAFF_NURSE, '/unknown')).toBe(true);
    });
  });
});

describe('getAccessibleRoutes', () => {
  it('should return restricted routes for administrative role', () => {
    const restricted = getAccessibleRoutes(ROLES.ADMINISTRATIVE);
    expect(restricted).toContain('/settings');
    expect(restricted).toContain('/flowsheet');
    expect(restricted).toContain('/orders');
    expect(restricted).not.toContain('/discharge');
    expect(restricted).not.toContain('/reports');
  });

  it('should return fewer restricted routes for admin', () => {
    const adminRestricted = getAccessibleRoutes(ROLES.ADMIN);
    const staffRestricted = getAccessibleRoutes(ROLES.STAFF_NURSE);
    expect(adminRestricted.length).toBeLessThan(staffRestricted.length);
  });
});

describe('getRoleColor', () => {
  it('should return red color for admin', () => {
    const color = getRoleColor(ROLES.ADMIN);
    expect(color).toContain('red');
  });

  it('should return purple color for physician', () => {
    const color = getRoleColor(ROLES.PHYSICIAN);
    expect(color).toContain('purple');
  });

  it('should return cyan color for charge nurse', () => {
    const color = getRoleColor(ROLES.CHARGE_NURSE);
    expect(color).toContain('cyan');
  });

  it('should return green color for staff nurse', () => {
    const color = getRoleColor(ROLES.STAFF_NURSE);
    expect(color).toContain('green');
  });

  it('should return yellow color for administrative', () => {
    const color = getRoleColor(ROLES.ADMINISTRATIVE);
    expect(color).toContain('yellow');
  });

  it('should return slate color for unknown role', () => {
    const color = getRoleColor('Unknown');
    expect(color).toContain('slate');
  });

  it('should return valid Tailwind classes', () => {
    const color = getRoleColor(ROLES.ADMIN);
    expect(color).toMatch(/text-\w+-\d+/);
    expect(color).toMatch(/bg-\w+-\d+\/\d+/);
    expect(color).toMatch(/border-\w+-\d+\/\d+/);
  });
});
