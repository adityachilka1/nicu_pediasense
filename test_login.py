#!/usr/bin/env python3
"""Test login functionality with new secure credentials"""

from playwright.sync_api import sync_playwright
import sys

def test_login():
    print("Starting login test...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to login page
        print("1. Navigating to login page...")
        page.goto('http://localhost:3000/login')
        page.wait_for_load_state('networkidle')

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
        submit_button = page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign"), button:has-text("Log")').first
        submit_button.click()

        # Wait for navigation or response
        page.wait_for_timeout(3000)
        page.wait_for_load_state('networkidle')

        # Take screenshot of result
        page.screenshot(path='/tmp/login_result.png', full_page=True)
        print("   Screenshot saved: /tmp/login_result.png")

        # Check if login was successful
        current_url = page.url
        print(f"4. Current URL: {current_url}")

        # Check for error messages
        error_elements = page.locator('.error, [class*="error"], [class*="Error"], [role="alert"]').all()
        if error_elements:
            for el in error_elements:
                if el.is_visible():
                    print(f"   ERROR: {el.text_content()}")

        # Check page content for success indicators
        page_content = page.content()

        if '/login' not in current_url or 'dashboard' in current_url.lower() or 'NICU' in page_content:
            print("\n✅ LOGIN SUCCESSFUL!")
            print(f"   Redirected to: {current_url}")

            # Get page title or header
            title = page.title()
            print(f"   Page title: {title}")

            # Look for user info on page
            user_info = page.locator('text=admin, text=Admin, text=System').first
            if user_info.count() > 0:
                print(f"   User visible: Yes")
        else:
            print("\n❌ LOGIN FAILED or still on login page")
            print(f"   Current URL: {current_url}")

            # Check for specific error messages
            if 'invalid' in page_content.lower() or 'error' in page_content.lower():
                print("   Possible error on page")

        browser.close()
        print("\nTest completed.")

if __name__ == '__main__':
    test_login()
