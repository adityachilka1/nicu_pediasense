// @ts-check
/**
 * Shared test utilities for Playwright E2E tests
 */

/**
 * Test credentials for different user roles
 */
const TEST_CREDENTIALS = {
  admin: {
    email: 'admin@hospital.org',
    password: 'Admin#Secure2024!',
  },
  nurse: {
    email: 'nurse.moore@hospital.org',
    password: 'nurse123',
  },
  doctor: {
    email: 'dr.patel@hospital.org',
    password: 'doctor123',
  },
};

/**
 * Login helper function
 * @param {import('@playwright/test').Page} page
 * @param {object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 */
async function login(page, credentials = TEST_CREDENTIALS.admin) {
  await page.goto('/login');

  // Fill in credentials
  await page.getByLabel('Email Address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);

  // Click sign in
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for navigation to complete
  await page.waitForURL(/\/(dashboard|patients|alarms)?/, { timeout: 15000 });
}

/**
 * Logout helper function
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
  // Look for user menu or logout button
  const logoutButton = page.getByRole('button', { name: /logout|sign out/i });

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
  } else {
    // Try clicking user menu first
    const userMenu = page.locator('[data-testid="user-menu"], [aria-label*="user menu"]').first();
    if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userMenu.click();
      await page.getByRole('button', { name: /logout|sign out/i }).click();
    }
  }

  // Wait for redirect to login
  await page.waitForURL('/login', { timeout: 10000 });
}

/**
 * Select a patient from the patient selector
 * @param {import('@playwright/test').Page} page
 * @param {string} patientName - Name or MRN of the patient
 */
async function selectPatient(page, patientName) {
  // Look for patient selector dropdown
  const selector = page.locator('[data-testid="patient-selector"], select').first();

  if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
    await selector.click();
    await page.getByText(patientName, { exact: false }).click();

    // Wait a moment for patient to load
    await page.waitForTimeout(1000);
  }
}

/**
 * Navigate to a specific page
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 */
async function navigateTo(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for a toast notification
 * @param {import('@playwright/test').Page} page
 * @param {string} message - Expected message in the toast
 * @param {object} options
 * @param {number} options.timeout - Timeout in ms
 * @param {'success'|'error'|'info'|'warning'} options.type - Toast type
 */
async function waitForToast(page, message, options = {}) {
  const { timeout = 10000, type } = options;

  let toastLocator = page.locator('[role="alert"], .toast, [data-testid="toast"]');

  if (type) {
    toastLocator = toastLocator.filter({ hasText: message });
  }

  await toastLocator.filter({ hasText: message }).first().waitFor({
    state: 'visible',
    timeout
  });
}

/**
 * Dismiss all visible toasts
 * @param {import('@playwright/test').Page} page
 */
async function dismissToasts(page) {
  const closeButtons = page.locator('[role="alert"] button, .toast button[aria-label*="close"]');
  const count = await closeButtons.count();

  for (let i = 0; i < count; i++) {
    const button = closeButtons.nth(i);
    if (await button.isVisible()) {
      await button.click();
    }
  }
}

/**
 * Fill a form field by label
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 * @param {string} value
 */
async function fillFormField(page, label, value) {
  const field = page.getByLabel(label, { exact: false });
  await field.fill(value);
}

/**
 * Wait for API response
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} urlPattern
 * @param {Function} action
 * @returns {Promise<import('@playwright/test').Response>}
 */
async function waitForAPI(page, urlPattern, action) {
  const responsePromise = page.waitForResponse(urlPattern);
  await action();
  return await responsePromise;
}

/**
 * Get table row count
 * @param {import('@playwright/test').Page} page
 * @param {string} tableSelector
 */
async function getTableRowCount(page, tableSelector = 'table tbody tr') {
  return await page.locator(tableSelector).count();
}

/**
 * Search in a search box
 * @param {import('@playwright/test').Page} page
 * @param {string} searchTerm
 * @param {string} placeholder - Placeholder text to identify the search box
 */
async function searchFor(page, searchTerm, placeholder = 'Search') {
  const searchBox = page.getByPlaceholder(placeholder, { exact: false });
  await searchBox.fill(searchTerm);

  // Wait for debounce/search to complete
  await page.waitForTimeout(500);
}

/**
 * Click a button by text
 * @param {import('@playwright/test').Page} page
 * @param {string} buttonText
 */
async function clickButton(page, buttonText) {
  await page.getByRole('button', { name: buttonText, exact: false }).click();
}

/**
 * Verify navigation occurred
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} expectedPath
 */
async function verifyNavigation(page, expectedPath) {
  await page.waitForURL(expectedPath, { timeout: 10000 });
}

/**
 * Check if user is logged in
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function isLoggedIn(page) {
  const currentURL = page.url();
  return !currentURL.includes('/login') && !currentURL.includes('/unauthorized');
}

/**
 * Take a screenshot with a descriptive name
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function takeScreenshot(page, name) {
  await page.screenshot({
    path: `test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true
  });
}

module.exports = {
  TEST_CREDENTIALS,
  login,
  logout,
  selectPatient,
  navigateTo,
  waitForToast,
  dismissToasts,
  fillFormField,
  waitForAPI,
  getTableRowCount,
  searchFor,
  clickButton,
  verifyNavigation,
  isLoggedIn,
  takeScreenshot,
};
