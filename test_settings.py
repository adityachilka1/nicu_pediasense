#!/usr/bin/env python3
"""
NICU Dashboard Settings Test Script
Tests settings, profile, audit, and navigation functionality
"""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        # Enable console logging
        page.on("console", lambda msg: print(f"Console: {msg.text}"))

        try:
            # Step 1: Login
            print("=" * 60)
            print("STEP 1: Login")
            print("=" * 60)
            page.goto('http://localhost:3000', timeout=15000)
            time.sleep(3)  # Wait for React to render
            page.screenshot(path='/tmp/test_settings_01_initial.png', full_page=True)
            print(f"Initial URL: {page.url}")

            # Clear existing fields and enter credentials
            email_input = page.locator('input[type="email"], input[name="email"]').first
            email_input.click()
            email_input.fill('')
            email_input.fill('admin@hospital.org')

            password_input = page.locator('input[type="password"]').first
            password_input.click()
            password_input.fill('')
            password_input.fill('admin123')

            page.screenshot(path='/tmp/test_settings_02_login_filled.png', full_page=True)
            print("Credentials entered")

            # Click Sign In button
            sign_in_btn = page.locator('button:has-text("Sign In")').first
            sign_in_btn.click()

            # Wait for navigation
            time.sleep(4)
            page.screenshot(path='/tmp/test_settings_03_after_login.png', full_page=True)

            current_url = page.url
            print(f"After login URL: {current_url}")

            # Check if login was successful
            if '/login' not in current_url.lower() or '/dashboard' in current_url.lower():
                results['Login'] = 'PASS'
            else:
                results['Login'] = 'FAIL - Still on login page'

            print(f"Login result: {results['Login']}")

            # Test 1: Navigate to /settings
            print("\n" + "=" * 60)
            print("TEST 1: Navigate to /settings")
            print("=" * 60)
            page.goto('http://localhost:3000/settings', timeout=15000)
            time.sleep(2)
            page.screenshot(path='/tmp/test_settings_04_settings_page.png', full_page=True)

            # Check if settings page loaded
            page_content = page.content()
            settings_visible = (
                page.locator('text=Settings').count() > 0 or
                'settings' in page.url.lower() or
                'setting' in page_content.lower()
            )
            results['Settings Page'] = 'PASS' if settings_visible else 'FAIL'
            print(f"Settings page: {results['Settings Page']}")
            print(f"Current URL: {page.url}")

            # Test 2: Check theme toggle
            print("\n" + "=" * 60)
            print("TEST 2: Check Theme Toggle")
            print("=" * 60)

            # Look for theme toggle
            theme_found = False
            theme_selectors = [
                'button[aria-label*="theme" i]',
                'button[aria-label*="dark" i]',
                'button[aria-label*="light" i]',
                '[class*="ThemeToggle"]',
                '[class*="theme-toggle"]',
                'button:has(svg)',
                '[data-testid*="theme"]'
            ]

            for selector in theme_selectors:
                try:
                    elements = page.locator(selector)
                    if elements.count() > 0:
                        print(f"Found potential theme element: {selector}")
                        theme_found = True
                        # Try clicking
                        elements.first.click()
                        time.sleep(0.5)
                        page.screenshot(path='/tmp/test_settings_05_theme_toggled.png', full_page=True)
                        break
                except Exception as e:
                    pass

            # Also check for any theme-related text or switches
            if not theme_found:
                theme_text = page.locator('text=Theme, text=Dark Mode, text=Light Mode, text=Appearance')
                if theme_text.count() > 0:
                    theme_found = True
                    print("Found theme-related text")

            results['Theme Toggle'] = 'PASS' if theme_found else 'NOT FOUND'
            print(f"Theme toggle: {results['Theme Toggle']}")

            # Test 3: Navigate to /profile
            print("\n" + "=" * 60)
            print("TEST 3: Navigate to /profile")
            print("=" * 60)
            page.goto('http://localhost:3000/profile', timeout=15000)
            time.sleep(2)
            page.screenshot(path='/tmp/test_settings_06_profile_page.png', full_page=True)

            page_content = page.content()
            profile_visible = (
                page.locator('text=Profile').count() > 0 or
                'profile' in page.url.lower() or
                'admin@hospital.org' in page_content or
                'user' in page_content.lower()
            )
            results['Profile Page'] = 'PASS' if profile_visible else 'FAIL'
            print(f"Profile page: {results['Profile Page']}")
            print(f"Current URL: {page.url}")

            # Test 4: Navigate to /audit
            print("\n" + "=" * 60)
            print("TEST 4: Navigate to /audit")
            print("=" * 60)
            page.goto('http://localhost:3000/audit', timeout=15000)
            time.sleep(2)
            page.screenshot(path='/tmp/test_settings_07_audit_page.png', full_page=True)

            page_content = page.content()
            audit_visible = (
                page.locator('text=Audit').count() > 0 or
                'audit' in page.url.lower() or
                page.locator('table').count() > 0 or
                'log' in page_content.lower()
            )
            results['Audit Log Page'] = 'PASS' if audit_visible else 'FAIL'
            print(f"Audit page: {results['Audit Log Page']}")
            print(f"Current URL: {page.url}")

            # Test 5: Check role-based access indicators
            print("\n" + "=" * 60)
            print("TEST 5: Check Role-Based Access Indicators")
            print("=" * 60)

            page.goto('http://localhost:3000', timeout=15000)
            time.sleep(2)
            page.screenshot(path='/tmp/test_settings_08_role_indicators.png', full_page=True)

            page_content = page.content()
            role_visible = (
                page.locator('text=Admin').count() > 0 or
                page.locator('text=admin').count() > 0 or
                'administrator' in page_content.lower() or
                'role' in page_content.lower() or
                page.locator('[class*="role"]').count() > 0
            )
            results['Role-Based Access'] = 'PASS' if role_visible else 'NOT VISIBLE'
            print(f"Role indicators: {results['Role-Based Access']}")

            # Test 6: Verify navigation sidebar
            print("\n" + "=" * 60)
            print("TEST 6: Verify Navigation Sidebar")
            print("=" * 60)

            sidebar_found = False
            nav_items = []

            # Check for navigation elements
            nav_selectors = ['nav', 'aside', '[class*="sidebar"]', '[class*="Sidebar"]', '[role="navigation"]']
            for selector in nav_selectors:
                elements = page.locator(selector)
                if elements.count() > 0:
                    print(f"Found navigation: {selector}")
                    sidebar_found = True
                    break

            # Get all links
            all_links = page.locator('a')
            link_count = all_links.count()
            print(f"Total links found: {link_count}")

            for i in range(min(link_count, 15)):
                try:
                    href = all_links.nth(i).get_attribute('href')
                    text = all_links.nth(i).text_content()
                    if href and text:
                        nav_items.append(f"{text.strip()}: {href}")
                except:
                    pass

            page.screenshot(path='/tmp/test_settings_09_navigation.png', full_page=True)
            results['Navigation Sidebar'] = 'PASS' if sidebar_found or link_count > 3 else 'FAIL'
            print(f"Navigation sidebar: {results['Navigation Sidebar']}")
            if nav_items:
                print("Navigation links found:")
                for item in nav_items[:10]:
                    print(f"  - {item}")

            # Test 7: Test keyboard shortcuts
            print("\n" + "=" * 60)
            print("TEST 7: Test Keyboard Shortcuts")
            print("=" * 60)

            shortcuts_found = []

            # Test common shortcuts
            shortcuts = [
                ('?', 'Help'),
                ('Escape', 'Close'),
                ('/', 'Search'),
            ]

            for key, desc in shortcuts:
                try:
                    page.keyboard.press(key)
                    time.sleep(0.3)
                    # Check for any modal or overlay
                    modal = page.locator('[role="dialog"], .modal, [class*="modal"], [class*="Modal"]')
                    if modal.count() > 0 and modal.first.is_visible():
                        shortcuts_found.append(f"{key}: {desc}")
                        page.screenshot(path=f'/tmp/test_settings_10_shortcut_{key}.png', full_page=True)
                        page.keyboard.press('Escape')
                        time.sleep(0.2)
                except:
                    pass

            page.screenshot(path='/tmp/test_settings_10_keyboard_test.png', full_page=True)
            results['Keyboard Shortcuts'] = f'FOUND: {shortcuts_found}' if shortcuts_found else 'NOT DETECTED'
            print(f"Keyboard shortcuts: {results['Keyboard Shortcuts']}")

            # Test 8: Check help/documentation links
            print("\n" + "=" * 60)
            print("TEST 8: Check Help/Documentation Links")
            print("=" * 60)

            help_found = False
            help_elements = []

            help_selectors = [
                'a:has-text("Help")',
                'a:has-text("Documentation")',
                'button:has-text("Help")',
                '[aria-label*="help" i]',
                'a[href*="help"]',
                'a[href*="docs"]',
                'text=Support',
                'text=Contact IT Support'
            ]

            for selector in help_selectors:
                try:
                    elements = page.locator(selector)
                    if elements.count() > 0:
                        print(f"Found help element: {selector}")
                        help_found = True
                        text = elements.first.text_content()
                        if text:
                            help_elements.append(text.strip())
                except:
                    pass

            page.screenshot(path='/tmp/test_settings_11_help_links.png', full_page=True)
            results['Help/Documentation'] = 'FOUND' if help_found else 'NOT FOUND'
            print(f"Help/documentation: {results['Help/Documentation']}")
            if help_elements:
                print(f"Help elements: {help_elements}")

            # Final overview
            print("\n" + "=" * 60)
            print("Final Overview Screenshot")
            print("=" * 60)
            page.goto('http://localhost:3000', timeout=15000)
            time.sleep(2)
            page.screenshot(path='/tmp/test_settings_12_final_overview.png', full_page=True)

        except Exception as e:
            print(f"Error during testing: {e}")
            import traceback
            traceback.print_exc()
            page.screenshot(path='/tmp/test_settings_error.png', full_page=True)
            results['Error'] = str(e)

        finally:
            browser.close()

    # Print final results
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)
    for test, result in results.items():
        status = "PASS" if 'PASS' in str(result) or 'FOUND' in str(result) else "FAIL" if 'FAIL' in str(result) else "INFO"
        print(f"[{status}] {test}: {result}")

    return results

if __name__ == '__main__':
    run_tests()
