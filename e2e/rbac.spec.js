// @ts-check
const { test, expect } = require('@playwright/test');

// Test users
const users = {
  admin: {
    email: 'admin@hospital.org',
    password: 'admin123',
    role: 'Admin',
  },
  physician: {
    email: 'dr.chen@hospital.org',
    password: 'doctor123',
    role: 'Physician',
  },
  chargeNurse: {
    email: 'nurse.moore@hospital.org',
    password: 'nurse123',
    role: 'Charge Nurse',
  },
  staffNurse: {
    email: 'staff.clark@hospital.org',
    password: 'staff123',
    role: 'Staff Nurse',
  },
  administrative: {
    email: 'clerk@hospital.org',
    password: 'clerk123',
    role: 'Administrative',
  },
};

// Helper function to login
async function login(page, user) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/');
}

test.describe('Unauthorized Page', () => {
  test('should display access denied page with user role', async ({ page }) => {
    await login(page, users.administrative);

    // Try to access restricted route
    await page.goto('/settings');

    // Should show unauthorized page
    await expect(page).toHaveURL('/unauthorized');
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission")).toBeVisible();
    await expect(page.getByText('Administrative')).toBeVisible();
  });

  test('should have navigation buttons on unauthorized page', async ({ page }) => {
    await login(page, users.administrative);
    await page.goto('/settings');

    await expect(page.getByRole('link', { name: 'Go to Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Help' })).toBeVisible();
  });

  test('should navigate back to dashboard from unauthorized page', async ({ page }) => {
    await login(page, users.administrative);
    await page.goto('/settings');

    await page.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('Admin Role Access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, users.admin);
  });

  test('should access settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should access audit page', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should access all clinical routes', async ({ page }) => {
    const routes = ['/orders', '/flowsheet', '/care-plans', '/handoff'];
    for (const route of routes) {
      await page.goto(route);
      await expect(page).not.toHaveURL('/unauthorized');
    }
  });

  test('should see all navigation items', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible();
  });
});

test.describe('Administrative Role Access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, users.administrative);
  });

  test('should be denied access to settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/unauthorized');
  });

  test('should be denied access to clinical routes', async ({ page }) => {
    const restrictedRoutes = ['/flowsheet', '/orders', '/handoff', '/care-plans'];
    for (const route of restrictedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL('/unauthorized');
    }
  });

  test('should access discharge page', async ({ page }) => {
    await page.goto('/discharge');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should access family page', async ({ page }) => {
    await page.goto('/family');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should access reports page', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should not see restricted navigation items', async ({ page }) => {
    // Settings should not be visible
    await expect(page.getByRole('link', { name: 'Settings' })).not.toBeVisible();

    // Flowsheet should not be visible
    await expect(page.getByRole('link', { name: 'Flowsheet' })).not.toBeVisible();

    // But Family should be visible
    await expect(page.getByRole('link', { name: 'Family' })).toBeVisible();
  });
});

test.describe('Staff Nurse Role Access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, users.staffNurse);
  });

  test('should access flowsheet', async ({ page }) => {
    await page.goto('/flowsheet');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should access care plans', async ({ page }) => {
    await page.goto('/care-plans');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should be denied access to orders', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL('/unauthorized');
  });

  test('should be denied access to settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/unauthorized');
  });

  test('should be denied access to discharge', async ({ page }) => {
    await page.goto('/discharge');
    await expect(page).toHaveURL('/unauthorized');
  });
});

test.describe('Charge Nurse Role Access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, users.chargeNurse);
  });

  test('should access audit page', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should access devices page', async ({ page }) => {
    await page.goto('/devices');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should access orders page', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should be denied access to settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/unauthorized');
  });
});

test.describe('Physician Role Access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, users.physician);
  });

  test('should access orders page', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should access alarm limits page', async ({ page }) => {
    await page.goto('/alarm-limits');
    await expect(page).not.toHaveURL('/unauthorized');
  });

  test('should be denied access to settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/unauthorized');
  });

  test('should be denied access to audit', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).toHaveURL('/unauthorized');
  });
});

test.describe('Universal Access Routes', () => {
  // These routes should be accessible by all authenticated users
  const universalRoutes = ['/', '/patients', '/alarms', '/beds', '/trends', '/profile', '/help'];

  for (const [userType, user] of Object.entries(users)) {
    test(`${userType} should access all universal routes`, async ({ page }) => {
      await login(page, user);

      for (const route of universalRoutes) {
        await page.goto(route);
        await expect(page).not.toHaveURL('/unauthorized');
      }
    });
  }
});

test.describe('Dynamic Patient Routes', () => {
  test('all roles should access patient detail pages', async ({ page }) => {
    for (const [userType, user] of Object.entries(users)) {
      await login(page, user);
      await page.goto('/patient/1');
      await expect(page).not.toHaveURL('/unauthorized');

      // Logout for next iteration
      await page.getByRole('button', { name: 'Logout' }).click();
      await page.waitForURL('/login');
    }
  });
});

test.describe('Navigation Filtering', () => {
  test('admin should see all nav items', async ({ page }) => {
    await login(page, users.admin);

    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Flowsheet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible();
  });

  test('administrative should see filtered nav items', async ({ page }) => {
    await login(page, users.administrative);

    // Should see
    await expect(page.getByRole('link', { name: 'Monitor' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reports' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Family' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Discharge' })).toBeVisible();

    // Should not see
    await expect(page.getByRole('link', { name: 'Settings' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Flowsheet' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Orders' })).not.toBeVisible();
  });
});
