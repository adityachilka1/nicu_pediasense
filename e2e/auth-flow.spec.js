// @ts-check
const { test, expect } = require('@playwright/test');

// Test data for different users
const testUsers = {
  admin: {
    email: 'admin@hospital.org',
    password: 'admin123',
    name: 'System Admin',
    role: 'Admin',
  },
  physician: {
    email: 'dr.chen@hospital.org',
    password: 'doctor123',
    name: 'Dr. Sarah Chen',
    role: 'Physician',
  },
  chargeNurse: {
    email: 'nurse.moore@hospital.org',
    password: 'nurse123',
    name: 'Jessica Moore',
    role: 'Charge Nurse',
  },
  staffNurse: {
    email: 'staff.clark@hospital.org',
    password: 'staff123',
    name: 'Amanda Clark',
    role: 'Staff Nurse',
  },
  administrative: {
    email: 'clerk@hospital.org',
    password: 'clerk123',
    name: 'Unit Clerk',
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

test.describe('Successful Login Flow', () => {
  test('should login with admin credentials and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Clear pre-filled values and enter admin credentials
    await page.getByLabel('Email Address').clear();
    await page.getByLabel('Email Address').fill(testUsers.admin.email);
    await page.getByLabel('Password').clear();
    await page.getByLabel('Password').fill(testUsers.admin.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Should show user info in navigation (use locator in nav to avoid conflicts)
    await expect(page.locator('nav').getByText(testUsers.admin.name)).toBeVisible();
    await expect(page.locator('nav .inline-flex').getByText(testUsers.admin.role)).toBeVisible();
  });

  test('should login with charge nurse credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email Address').fill(testUsers.chargeNurse.email);
    await page.getByLabel('Password').fill(testUsers.chargeNurse.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.locator('nav').getByText(testUsers.chargeNurse.name)).toBeVisible();
  });

  test('should login with administrative credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email Address').fill(testUsers.administrative.email);
    await page.getByLabel('Password').fill(testUsers.administrative.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.locator('nav').getByText(testUsers.administrative.name)).toBeVisible();
  });

  test('should be case-insensitive for email', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Clear pre-filled values and enter uppercase email
    await page.getByLabel('Email Address').clear();
    await page.getByLabel('Email Address').fill('ADMIN@HOSPITAL.ORG');
    await page.getByLabel('Password').clear();
    await page.getByLabel('Password').fill(testUsers.admin.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL('/', { timeout: 10000 });
  });
});

test.describe('Session Persistence', () => {
  test('should maintain session after page refresh', async ({ page }) => {
    await login(page, testUsers.chargeNurse);

    // Refresh the page
    await page.reload();

    // Should still be on dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText(testUsers.chargeNurse.name)).toBeVisible();
  });

  test('should maintain session when navigating', async ({ page }) => {
    await login(page, testUsers.chargeNurse);

    // Navigate to different pages
    await page.getByRole('link', { name: 'Patients' }).click();
    await expect(page).toHaveURL('/patients');

    await page.getByRole('link', { name: 'Alarms' }).click();
    await expect(page).toHaveURL('/alarms');

    // Should still show user info
    await expect(page.getByText(testUsers.chargeNurse.name)).toBeVisible();
  });
});

test.describe('Logout Flow', () => {
  test('should logout and redirect to login page', async ({ page }) => {
    await login(page, testUsers.chargeNurse);

    // Click logout button
    await page.getByRole('button', { name: 'Logout' }).click();

    // Should redirect to login page
    await expect(page).toHaveURL('/login');
  });

  test('should not access protected routes after logout', async ({ page }) => {
    await login(page, testUsers.chargeNurse);
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL('/login');

    // Try to access dashboard
    await page.goto('/');

    // Should redirect back to login
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Protected Route Redirects', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to login with callback URL', async ({ page }) => {
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test('should redirect to original URL after login', async ({ page }) => {
    // Go to protected page (will redirect to login)
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fpatients/);

    // Login
    await page.getByLabel('Email Address').fill(testUsers.chargeNurse.email);
    await page.getByLabel('Password').fill(testUsers.chargeNurse.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should redirect to original URL
    await expect(page).toHaveURL('/patients');
  });

  test('should redirect authenticated user away from login page', async ({ page }) => {
    await login(page, testUsers.chargeNurse);

    // Try to go back to login page
    await page.goto('/login');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
  });
});

test.describe('User Info Display', () => {
  test('should display correct user initials', async ({ page }) => {
    await login(page, testUsers.chargeNurse);

    // Jessica Moore should show "JM"
    await expect(page.locator('nav').getByText('JM')).toBeVisible();
  });

  test('should display role badge with correct color for admin', async ({ page }) => {
    await login(page, testUsers.admin);

    // Use more specific selector to target just the role badge, not the name
    const roleBadge = page.locator('nav .inline-flex').getByText('Admin');
    await expect(roleBadge).toBeVisible();
    // Admin has red color
    await expect(roleBadge).toHaveClass(/red/);
  });

  test('should display role badge with correct color for charge nurse', async ({ page }) => {
    await login(page, testUsers.chargeNurse);

    const roleBadge = page.locator('nav').getByText('Charge Nurse');
    await expect(roleBadge).toBeVisible();
    // Charge Nurse has cyan color
    await expect(roleBadge).toHaveClass(/cyan/);
  });

  test('should display role badge with correct color for administrative', async ({ page }) => {
    await login(page, testUsers.administrative);

    const roleBadge = page.locator('nav').getByText('Administrative');
    await expect(roleBadge).toBeVisible();
    // Administrative has yellow color
    await expect(roleBadge).toHaveClass(/yellow/);
  });
});

test.describe('All Demo Users Login', () => {
  for (const [userType, user] of Object.entries(testUsers)) {
    test(`should login successfully as ${userType}`, async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('Email Address').fill(user.email);
      await page.getByLabel('Password').fill(user.password);
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(page).toHaveURL('/');
      await expect(page.getByText(user.name)).toBeVisible();
    });
  }
});
