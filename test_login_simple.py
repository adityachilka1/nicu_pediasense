#!/usr/bin/env python3
"""Test login functionality with new secure credentials"""

from playwright.sync_api import sync_playwright

def test_login():
    print("Starting login test...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to login page
        print("1. Navigating to login page...")
        page.goto('http://localhost:3000/login', wait_until='domcontentloaded')
        page.wait_for_timeout(2000)  # Wait for JS to render

        # Take screenshot of login page
        page.screenshot(path='/tmp/login_page.png', full_page=True)
        print("   Screenshot saved: /tmp/login_page.png")

        # Find and fill email field
        print("2. Filling in credentials...")
        email_input = page.locator('input[type="email"], input[name="email"], input[id="email"]').first
        email_input.fill('admin@hospital.org')

        # Find and fill password field
        password_input = page.locator('input[type="password"], input[name="password"], input[id="password"]').first
        password_input.fill('Admin#Secure2024!')

        # Take screenshot before submit
        page.screenshot(path='/tmp/login_filled.png', full_page=True)
        print("   Screenshot saved: /tmp/login_filled.png")

        # Find and click submit button
        print("3. Submitting login form...")
        submit_button = page.locator('button[type="submit"]').first
        submit_button.click()

        # Wait for navigation
        print("4. Waiting for response...")
        page.wait_for_timeout(5000)  # Wait for auth processing

        # Take screenshot of result
        page.screenshot(path='/tmp/login_result.png', full_page=True)
        print("   Screenshot saved: /tmp/login_result.png")

        # Check current URL
        current_url = page.url
        print(f"5. Current URL: {current_url}")

        # Check for error messages on page
        page_content = page.content()

        if 'dashboard' in current_url.lower() or '/login' not in current_url:
            print("\n✅ LOGIN SUCCESSFUL!")
            print(f"   Redirected to: {current_url}")
            title = page.title()
            print(f"   Page title: {title}")
        elif 'error' in page_content.lower() or 'invalid' in page_content.lower():
            print("\n❌ LOGIN FAILED - Error detected")
            # Extract error message if visible
            error_el = page.locator('[role="alert"], .error, [class*="error"]').first
            if error_el.count() > 0:
                print(f"   Error: {error_el.text_content()}")
        else:
            print("\n⚠️  Still on login page - may have failed")

        browser.close()
        print("\nTest completed.")

if __name__ == '__main__':
    test_login()
