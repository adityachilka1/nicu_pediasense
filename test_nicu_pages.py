#!/usr/bin/env python3
"""Test NICU Dashboard settings and alarms pages."""

from playwright.sync_api import sync_playwright
import sys

def test_nicu_dashboard():
    results = {}
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Capture console errors
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)

        try:
            # Step 1: Login
            print("Step 1: Logging in...")
            page.goto('http://localhost:3000', timeout=60000)
            page.wait_for_load_state('domcontentloaded')
            page.wait_for_timeout(2000)
            page.screenshot(path='/tmp/test_settings_01_initial.png')
            print(f"  - Initial URL: {page.url}")

            # Check if we need to login
            if 'login' in page.url.lower():
                print("  - Login page detected")

                # Make sure we're on Email & Password tab (click it explicitly)
                email_tab = page.locator('button:has-text("Email & Password"), [role="tab"]:has-text("Email")')
                if email_tab.count() > 0:
                    print("  - Clicking Email & Password tab...")
                    email_tab.first.click()
                    page.wait_for_timeout(500)

                # Clear and fill email
                email_input = page.locator('input[type="email"], input[name="email"], input[id*="email" i]').first
                email_input.clear()
                email_input.fill('admin@hospital.org')

                # Clear and fill password
                password_input = page.locator('input[type="password"], input[name="password"]').first
                password_input.clear()
                password_input.fill('admin123')

                page.screenshot(path='/tmp/test_settings_02_credentials.png')
                print("  - Credentials entered")

                # Click Sign In button
                sign_in_btn = page.locator('button:has-text("Sign In")').first
                print(f"  - Found Sign In button: {sign_in_btn.count() > 0}")
                sign_in_btn.click()

                page.wait_for_timeout(3000)
                page.screenshot(path='/tmp/test_settings_03_after_login.png')
                print(f"  - After login, URL: {page.url}")

                # Check if login was successful (not still on login page)
                if 'login' in page.url.lower():
                    print("  - WARNING: Still on login page, login may have failed")
                    # Try waiting longer
                    page.wait_for_timeout(2000)
                    print(f"  - After extra wait, URL: {page.url}")
            else:
                print(f"  - Not on login page, already authenticated")

            # Test 1: Settings page
            print("\nTest 1: Settings page (/settings)")
            page.goto('http://localhost:3000/settings', timeout=60000)
            page.wait_for_load_state('domcontentloaded')
            page.wait_for_timeout(2000)
            current_url = page.url
            page.screenshot(path='/tmp/test_settings_04_settings.png')

            # Check for settings content
            settings_content = page.content()
            # Page is loaded if we're on settings URL (not redirected to login)
            page_loaded = '/settings' in current_url and 'login' not in current_url
            has_settings_content = (
                'settings' in settings_content.lower() or
                'configuration' in settings_content.lower() or
                'preferences' in settings_content.lower() or
                page.locator('form, input, select, [class*="setting"]').count() > 0
            )
            results['settings'] = {
                'url': current_url,
                'loaded': page_loaded,
                'has_content': has_settings_content if page_loaded else False,
                'screenshot': '/tmp/test_settings_04_settings.png'
            }
            print(f"  - URL: {current_url}")
            print(f"  - Page loaded: {page_loaded}")
            print(f"  - Has settings content: {has_settings_content}")

            # Test 2: Alarms page
            print("\nTest 2: Alarms page (/alarms)")
            page.goto('http://localhost:3000/alarms', timeout=60000)
            page.wait_for_load_state('domcontentloaded')
            page.wait_for_timeout(2000)
            current_url = page.url
            page.screenshot(path='/tmp/test_settings_05_alarms.png')

            # Check for alarms content
            alarms_content = page.content()
            page_loaded = '/alarms' in current_url and 'login' not in current_url
            has_alarms_content = (
                'alarm' in alarms_content.lower() or
                'alert' in alarms_content.lower() or
                page.locator('[class*="alarm"], [class*="alert"], table, [role="list"]').count() > 0
            )
            results['alarms'] = {
                'url': current_url,
                'loaded': page_loaded,
                'has_content': has_alarms_content if page_loaded else False,
                'screenshot': '/tmp/test_settings_05_alarms.png'
            }
            print(f"  - URL: {current_url}")
            print(f"  - Page loaded: {page_loaded}")
            print(f"  - Has alarms content: {has_alarms_content}")

            # Test 3: Orders page
            print("\nTest 3: Orders page (/orders)")
            page.goto('http://localhost:3000/orders', timeout=60000)
            page.wait_for_load_state('domcontentloaded')
            page.wait_for_timeout(2000)
            current_url = page.url
            page.screenshot(path='/tmp/test_settings_06_orders.png')

            # Check for orders content
            orders_content = page.content()
            page_loaded = '/orders' in current_url and 'login' not in current_url
            has_orders_content = (
                'order' in orders_content.lower() or
                page.locator('table, [class*="order"], [role="list"], [role="grid"]').count() > 0
            )
            results['orders'] = {
                'url': current_url,
                'loaded': page_loaded,
                'has_content': has_orders_content if page_loaded else False,
                'screenshot': '/tmp/test_settings_06_orders.png'
            }
            print(f"  - URL: {current_url}")
            print(f"  - Page loaded: {page_loaded}")
            print(f"  - Has orders content: {has_orders_content}")

            # Test 4: Patients page
            print("\nTest 4: Patients page (/patients)")
            page.goto('http://localhost:3000/patients', timeout=60000)
            page.wait_for_load_state('domcontentloaded')
            page.wait_for_timeout(2000)
            current_url = page.url
            page.screenshot(path='/tmp/test_settings_07_patients.png')

            # Check for patients content
            patients_content = page.content()
            page_loaded = '/patients' in current_url and 'login' not in current_url
            has_patients_content = (
                'patient' in patients_content.lower() or
                page.locator('table, [class*="patient"], [role="list"], [role="grid"], .card').count() > 0
            )
            results['patients'] = {
                'url': current_url,
                'loaded': page_loaded,
                'has_content': has_patients_content if page_loaded else False,
                'screenshot': '/tmp/test_settings_07_patients.png'
            }
            print(f"  - URL: {current_url}")
            print(f"  - Page loaded: {page_loaded}")
            print(f"  - Has patients content: {has_patients_content}")

            # Test 5: Navigation check - verify nav elements exist
            print("\nTest 5: Navigation check")
            nav_elements = page.locator('nav, [role="navigation"], .sidebar, .nav, header a, [class*="menu"]').count()
            results['navigation'] = {
                'has_nav_elements': nav_elements > 0,
                'nav_count': nav_elements
            }
            print(f"  - Navigation elements found: {nav_elements}")

        except Exception as e:
            print(f"\nError during testing: {e}")
            page.screenshot(path='/tmp/test_settings_error.png')
            results['error'] = str(e)

        finally:
            browser.close()

    # Print summary
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)

    all_pass = True

    for test_name in ['settings', 'alarms', 'orders', 'patients']:
        if test_name in results:
            r = results[test_name]
            passed = r.get('loaded', False) and r.get('has_content', False)
            status = "PASS" if passed else "FAIL"
            if not passed:
                all_pass = False
            print(f"\n{test_name.upper()} PAGE: {status}")
            print(f"  - URL: {r.get('url', 'N/A')}")
            print(f"  - Page loaded: {r.get('loaded', False)}")
            print(f"  - Content visible: {r.get('has_content', False)}")
            print(f"  - Screenshot: {r.get('screenshot', 'N/A')}")

    if 'navigation' in results:
        nav_pass = results['navigation'].get('has_nav_elements', False)
        if not nav_pass:
            all_pass = False
        print(f"\nNAVIGATION: {'PASS' if nav_pass else 'FAIL'}")
        print(f"  - Nav elements found: {results['navigation'].get('nav_count', 0)}")

    if console_errors:
        print(f"\nConsole Errors: {len(console_errors)}")
        for err in console_errors[:5]:
            print(f"  - {err[:100]}")

    print("\n" + "="*60)
    print(f"OVERALL: {'ALL TESTS PASSED' if all_pass else 'SOME TESTS FAILED'}")
    print("="*60)

    return 0 if all_pass else 1

if __name__ == '__main__':
    sys.exit(test_nicu_dashboard())
