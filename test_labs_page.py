#!/usr/bin/env python3
"""Test script for NICU Dashboard Labs Page"""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(60000)  # 60 second timeout

        # Step 1: Login first
        print("Logging in...")
        page.goto('http://localhost:3000/login', wait_until='domcontentloaded')
        time.sleep(3)  # Wait for page to stabilize

        # Take screenshot of login page
        page.screenshot(path='/tmp/test_labs_login.png')
        print(f"  Login page URL: {page.url}")

        # Fill login credentials using id selectors
        email_input = page.locator('#email')
        password_input = page.locator('#password')

        if email_input.count() > 0 and password_input.count() > 0:
            # Clear fields first and fill with admin credentials
            email_input.fill('admin@hospital.org')
            password_input.fill('admin123')

            # Click Sign In button
            submit_btn = page.locator('button[type="submit"]')
            if submit_btn.count() > 0:
                submit_btn.click()
                time.sleep(5)  # Wait for redirect
                print(f"  After login URL: {page.url}")
        else:
            print("Could not find login form elements")
            page.screenshot(path='/tmp/test_labs_login_error.png')

        # Navigate to labs page
        print("Navigating to labs page...")
        page.goto('http://localhost:3000/labs', wait_until='domcontentloaded')
        time.sleep(3)  # Wait for page to fully load

        # Take initial screenshot
        page.screenshot(path='/tmp/test_labs_initial.png', full_page=True)

        # Test 1: Labs page loads (NO 404 error)
        print("\nTest 1: Labs page loads (NO 404 error)")
        page_content = page.content()
        page_title = page.title()
        is_404 = '404' in page_title.lower() or 'not found' in page_content.lower()
        current_url = page.url
        results['1_page_loads'] = not is_404 and '/labs' in current_url
        print(f"  URL: {current_url}")
        print(f"  Title: {page_title}")
        print(f"  PASS" if results['1_page_loads'] else f"  FAIL - Page shows 404 or wrong URL")

        # Test 2: Laboratory Results heading visible
        print("\nTest 2: Laboratory Results heading visible")
        heading = page.locator('h1:has-text("Laboratory Results")')
        results['2_heading_visible'] = heading.count() > 0 and heading.first.is_visible()
        print(f"  PASS" if results['2_heading_visible'] else "  FAIL - Heading not found")

        # Test 3: Category filters visible (CBC, Chemistry, Blood Gas, etc.)
        print("\nTest 3: Category filters visible")
        categories = ['CBC', 'Chemistry', 'Blood Gas', 'Coagulation', 'Bilirubin', 'Microbiology', 'All Categories']
        found_categories = []
        for cat in categories:
            cat_elem = page.locator(f'button:has-text("{cat}")')
            if cat_elem.count() > 0:
                found_categories.append(cat)
        results['3_category_filters'] = len(found_categories) >= 2
        print(f"  Found categories: {found_categories}")
        print(f"  PASS" if results['3_category_filters'] else "  FAIL - Not enough category filters found")
        page.screenshot(path='/tmp/test_labs_categories.png', full_page=True)

        # Test 4: Patient filter dropdown works
        print("\nTest 4: Patient filter dropdown works")
        patient_dropdown = page.locator('select')
        if patient_dropdown.count() > 0:
            try:
                # Check if the dropdown has options
                options = patient_dropdown.first.locator('option')
                opt_count = options.count()
                print(f"  Found select with {opt_count} options")

                # Try to select a patient
                patient_dropdown.first.select_option(index=1)
                time.sleep(0.5)
                results['4_patient_filter'] = True
                print("  PASS - Patient dropdown works")

                # Reset to all patients
                patient_dropdown.first.select_option(value='all')
            except Exception as e:
                results['4_patient_filter'] = False
                print(f"  FAIL - Could not interact with patient dropdown: {e}")
        else:
            results['4_patient_filter'] = False
            print("  FAIL - No patient filter dropdown found")
        page.screenshot(path='/tmp/test_labs_patient_filter.png', full_page=True)

        # Test 5: Results table displayed
        print("\nTest 5: Results table displayed")
        table = page.locator('table')
        results['5_results_table'] = table.count() > 0 and table.first.is_visible()
        if results['5_results_table']:
            # Count rows
            rows = page.locator('table tbody tr')
            print(f"  Found table with {rows.count()} data rows")
        print(f"  PASS" if results['5_results_table'] else "  FAIL - No results table found")
        page.screenshot(path='/tmp/test_labs_table.png', full_page=True)

        # Test 6: Pending orders section visible
        print("\nTest 6: Pending orders section visible")
        # Click on the pending tab first
        pending_tab = page.locator('button:has-text("pending")')
        if pending_tab.count() > 0:
            pending_tab.click()
            time.sleep(1)
            # Check if the pending table is visible
            pending_table = page.locator('table')
            results['6_pending_orders'] = pending_table.count() > 0 and pending_table.first.is_visible()
            print(f"  PASS - Pending orders tab and section visible" if results['6_pending_orders'] else "  FAIL")
        else:
            # Try looking for "Pending" text anywhere
            pending_text = page.locator('text=Pending')
            results['6_pending_orders'] = pending_text.count() > 0
            print(f"  PASS" if results['6_pending_orders'] else "  FAIL - Pending orders section not found")
        page.screenshot(path='/tmp/test_labs_pending.png', full_page=True)

        # Test 7: Critical values highlighted
        print("\nTest 7: Critical values highlighted")
        # Click on critical tab
        critical_tab = page.locator('button:has-text("critical")')
        if critical_tab.count() > 0:
            critical_tab.click()
            time.sleep(1)

        # Look for critical value indicators
        critical_border = page.locator('[class*="border-red"]')
        critical_bg = page.locator('[class*="bg-red"]')
        critical_text = page.locator('text=Critical')

        results['7_critical_values'] = (critical_border.count() > 0 or
                                        critical_bg.count() > 0 or
                                        critical_text.count() > 0)
        print(f"  Found {critical_border.count()} border-red, {critical_bg.count()} bg-red elements")
        print(f"  PASS" if results['7_critical_values'] else "  FAIL - No critical value highlighting found")
        page.screenshot(path='/tmp/test_labs_critical.png', full_page=True)

        # Test 8: Result detail modal works when clicking a result
        print("\nTest 8: Result detail modal works")
        # Go back to results tab
        results_tab = page.locator('button:has-text("results")')
        if results_tab.count() > 0:
            results_tab.first.click()
            time.sleep(1)

        # Click on "View Results" button
        view_btn = page.locator('button:has-text("View Results")')
        if view_btn.count() > 0:
            try:
                view_btn.first.click()
                time.sleep(1)

                # Check for modal
                modal = page.locator('[class*="fixed inset-0"]')
                results['8_result_modal'] = modal.count() > 0 and modal.first.is_visible()

                page.screenshot(path='/tmp/test_labs_modal.png', full_page=True)

                # Close modal if open
                close_btn = page.locator('button:has-text("Close")')
                if close_btn.count() > 0:
                    close_btn.first.click()
                    time.sleep(0.5)
            except Exception as e:
                results['8_result_modal'] = False
                print(f"  Error: {e}")
        else:
            results['8_result_modal'] = False
        print(f"  PASS" if results.get('8_result_modal', False) else "  FAIL - Modal did not open")

        # Test 9: Stats cards visible (Total Results, Pending, Critical)
        print("\nTest 9: Stats cards visible")
        stats_texts = ['Results Today', 'Pending Orders', 'Critical Values', 'Finalized']
        found_stats = []
        for stat in stats_texts:
            stat_elem = page.locator(f'text={stat}')
            if stat_elem.count() > 0:
                found_stats.append(stat)

        results['9_stats_cards'] = len(found_stats) >= 3
        print(f"  Found stats: {found_stats}")
        print(f"  PASS" if results['9_stats_cards'] else "  FAIL - Stats cards not found")
        page.screenshot(path='/tmp/test_labs_stats.png', full_page=True)

        # Final screenshot
        page.screenshot(path='/tmp/test_labs_final.png', full_page=True)

        browser.close()

    # Print summary
    print("\n" + "="*50)
    print("TEST SUMMARY")
    print("="*50)

    test_names = {
        '1_page_loads': 'Labs page loads (NO 404 error)',
        '2_heading_visible': 'Laboratory Results heading visible',
        '3_category_filters': 'Category filters visible',
        '4_patient_filter': 'Patient filter dropdown works',
        '5_results_table': 'Results table displayed',
        '6_pending_orders': 'Pending orders section visible',
        '7_critical_values': 'Critical values highlighted',
        '8_result_modal': 'Result detail modal works',
        '9_stats_cards': 'Stats cards visible'
    }

    passed = 0
    failed = 0

    for key, name in test_names.items():
        status = "PASS" if results.get(key, False) else "FAIL"
        if results.get(key, False):
            passed += 1
        else:
            failed += 1
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {failed} failed")
    print(f"\nScreenshots saved to /tmp/test_labs_*.png")

    return results

if __name__ == '__main__':
    run_tests()
