// @ts-check
const { test, expect } = require('@playwright/test');
const { TEST_CREDENTIALS, login, logout, isLoggedIn } = require('./test-utils');

test.describe('Login Page UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page with all elements', async ({ page }) => {
    // Check page title/heading
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByText('Sign in to access the monitoring station')).toBeVisible();

    // Check form elements
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // Check login method tabs
    await expect(page.getByRole('button', { name: 'Email & Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Badge Login' })).toBeVisible();

    // Check security notice
    await expect(page.getByText('Security Notice')).toBeVisible();
    await expect(page.getByText('protected health information')).toBeVisible();
  });

  test('should have pre-filled demo credentials', async ({ page }) => {
    const emailInput = page.getByLabel('Email Address');
    const passwordInput = page.getByLabel('Password');

    await expect(emailInput).toHaveValue('nurse.moore@hospital.org');
    await expect(passwordInput).toHaveValue('nurse123');
  });

  test('should display branding on desktop', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 });

    await expect(page.getByRole('heading', { name: /PEDIASENSE|NestWatch/i }).first()).toBeVisible();
    await expect(page.getByText('Real-time monitoring')).toBeVisible();
    // Check for capacity stat - use exact match for the label
    await expect(page.getByText('Bed Capacity', { exact: true })).toBeVisible();
    await expect(page.getByText('Monitoring', { exact: true })).toBeVisible();
  });

  test('should switch between login methods', async ({ page }) => {
    // Click Badge Login tab
    await page.getByRole('button', { name: 'Badge Login' }).click();
    await expect(page.getByText('Tap your badge on the reader')).toBeVisible();
    await expect(page.getByText('Waiting for badge...')).toBeVisible();

    // Switch back to credentials
    await page.getByRole('button', { name: 'Email & Password' }).click();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should show loading state during login', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Check for loading state (button should show "Signing in...")
    await expect(page.getByText('Signing in...')).toBeVisible();
  });
});

test.describe('Login Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Clear pre-filled values and enter invalid credentials
    await page.getByLabel('Email Address').fill('invalid@test.com');
    await page.getByLabel('Password').fill('wrongpassword');

    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for error message
    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 10000 });
  });

  test('should show error for non-existent user', async ({ page }) => {
    await page.getByLabel('Email Address').fill('nonexistent@hospital.org');
    await page.getByLabel('Password').fill('password123');

    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 10000 });
  });

  test('should show error for wrong password', async ({ page }) => {
    await page.getByLabel('Email Address').fill('admin@hospital.org');
    await page.getByLabel('Password').fill('wrongpassword');

    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 10000 });
  });

  test('should require email field', async ({ page }) => {
    await page.getByLabel('Email Address').fill('');
    await page.getByLabel('Password').fill('password123');

    await page.getByRole('button', { name: 'Sign In' }).click();

    // HTML5 validation should prevent submission
    const emailInput = page.getByLabel('Email Address');
    await expect(emailInput).toHaveAttribute('required');
  });

  test('should require password field', async ({ page }) => {
    await page.getByLabel('Email Address').fill('test@test.com');
    await page.getByLabel('Password').fill('');

    await page.getByRole('button', { name: 'Sign In' }).click();

    // HTML5 validation should prevent submission
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAttribute('required');
  });
});

test.describe('Login Flow - Critical User Journeys', () => {
  test('should successfully login with admin credentials and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    // Fill in admin credentials
    await page.getByLabel('Email Address').fill(TEST_CREDENTIALS.admin.email);
    await page.getByLabel('Password').fill(TEST_CREDENTIALS.admin.password);

    // Submit login
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect (could be dashboard, patients, or alarms page)
    await page.waitForURL(/\/(dashboard|patients|alarms)/, { timeout: 15000 });

    // Verify we're logged in
    expect(await isLoggedIn(page)).toBe(true);

    // Verify navigation is visible (indicates successful auth)
    const navigation = page.locator('nav, [role="navigation"]').first();
    await expect(navigation).toBeVisible({ timeout: 5000 });
  });

  test('should successfully login with nurse credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in nurse credentials
    await page.getByLabel('Email Address').fill(TEST_CREDENTIALS.nurse.email);
    await page.getByLabel('Password').fill(TEST_CREDENTIALS.nurse.password);

    // Submit login
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect
    await page.waitForURL(/\/(dashboard|patients|alarms)/, { timeout: 15000 });

    // Verify we're logged in
    expect(await isLoggedIn(page)).toBe(true);
  });

  test('should show error message for failed login and allow retry', async ({ page }) => {
    await page.goto('/login');

    // Try with wrong credentials
    await page.getByLabel('Email Address').fill('admin@hospital.org');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify error appears
    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 10000 });

    // Verify we're still on login page
    await expect(page).toHaveURL(/\/login/);

    // Try again with correct credentials
    await page.getByLabel('Password').fill(TEST_CREDENTIALS.admin.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should succeed
    await page.waitForURL(/\/(dashboard|patients|alarms)/, { timeout: 15000 });
    expect(await isLoggedIn(page)).toBe(true);
  });

  test('should logout and redirect to login page', async ({ page }) => {
    // Login first
    await login(page, TEST_CREDENTIALS.admin);

    // Verify we're logged in
    expect(await isLoggedIn(page)).toBe(true);

    // Perform logout
    await logout(page);

    // Verify we're back on login page
    await expect(page).toHaveURL('/login');

    // Verify we can't access protected pages
    await page.goto('/patients');
    await page.waitForURL('/login', { timeout: 10000 });
  });

  test('should clear session after logout', async ({ page }) => {
    // Login
    await login(page, TEST_CREDENTIALS.admin);

    // Logout
    await logout(page);

    // Try to navigate directly to a protected page
    await page.goto('/patients');

    // Should redirect back to login
    await page.waitForURL('/login', { timeout: 10000 });
  });

  test('should persist session across page reloads', async ({ page }) => {
    // Login
    await login(page, TEST_CREDENTIALS.admin);

    // Get current URL
    const currentURL = page.url();

    // Reload the page
    await page.reload();

    // Should still be authenticated and on same page
    await expect(page).toHaveURL(currentURL);
    expect(await isLoggedIn(page)).toBe(true);
  });

  test('should handle session timeout gracefully', async ({ page }) => {
    // Login
    await login(page, TEST_CREDENTIALS.admin);

    // Clear session cookie to simulate timeout
    await page.context().clearCookies();

    // Try to navigate to a protected page
    await page.goto('/patients');

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 10000 });
  });
});
