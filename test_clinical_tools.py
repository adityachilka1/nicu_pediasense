#!/usr/bin/env python3
"""Test NICU Dashboard clinical tools"""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        # Enable console logging
        page.on("console", lambda msg: print(f"Console [{msg.type}]: {msg.text}") if msg.type == "error" else None)

        try:
            # Step 1: Login
            print("=" * 60)
            print("TEST 1: Login to NICU Dashboard")
            print("=" * 60)
            page.goto('http://localhost:3000/login', timeout=60000)
            page.wait_for_load_state('domcontentloaded', timeout=30000)
            time.sleep(2)
            print(f"Current URL: {page.url}")
            page.screenshot(path='/tmp/test_clinical_01_login_page.png', full_page=True)

            # Clear and fill in login credentials
            try:
                # Find and clear email field, then fill with admin credentials
                email_field = page.locator('input[type="email"], input[name="email"]').first
                password_field = page.locator('input[type="password"]').first

                if email_field.is_visible(timeout=5000):
                    print("Found login form, filling credentials...")
                    # Clear existing values and fill
                    email_field.clear()
                    email_field.fill('admin@hospital.org')
                    password_field.clear()
                    password_field.fill('admin123')
                    time.sleep(1)
                    page.screenshot(path='/tmp/test_clinical_02_login_filled.png', full_page=True)

                    # Click Sign In button
                    sign_in_btn = page.locator('button:has-text("Sign In")').first
                    if sign_in_btn.is_visible(timeout=3000):
                        print("Clicking Sign In button...")
                        sign_in_btn.click()
                        # Wait for navigation
                        time.sleep(3)
                        page.wait_for_load_state('domcontentloaded', timeout=30000)
                        time.sleep(2)
                        page.screenshot(path='/tmp/test_clinical_03_after_login.png', full_page=True)
                        print(f"After login URL: {page.url}")

                        # Check if login was successful (not on login page anymore)
                        if '/login' not in page.url:
                            results.append(("Login", "PASS", f"Successfully logged in - redirected to {page.url}"))
                        else:
                            # Check for error message
                            error_msg = page.locator('.error, [role="alert"], .text-red').first
                            if error_msg.count() > 0:
                                results.append(("Login", "FAIL", "Login failed - error message displayed"))
                            else:
                                results.append(("Login", "WARN", "Still on login page after clicking Sign In"))
                    else:
                        results.append(("Login", "FAIL", "Sign In button not found"))
                else:
                    print("No login form visible")
                    results.append(("Login", "SKIP", "No login form visible"))
            except Exception as e:
                print(f"Login error: {e}")
                results.append(("Login", "WARN", str(e)[:100]))

            # Step 2: Navigate to /calculators
            print("\n" + "=" * 60)
            print("TEST 2: Calculators Page")
            print("=" * 60)
            try:
                page.goto('http://localhost:3000/calculators', timeout=30000)
                page.wait_for_load_state('domcontentloaded', timeout=30000)
                time.sleep(2)
                print(f"Calculators URL: {page.url}")
                page.screenshot(path='/tmp/test_clinical_04_calculators.png', full_page=True)

                # Check if redirected to login (need authentication)
                if '/login' in page.url:
                    results.append(("Calculators Page Load", "WARN", "Redirected to login - requires authentication"))
                else:
                    content = page.content().lower()
                    if 'calculator' in content or 'gir' in content or 'fluid' in content or 'dose' in content:
                        results.append(("Calculators Page Load", "PASS", "Calculator page loaded"))
                        print("Found calculator content on page")
                    elif '404' in content or 'not found' in content:
                        results.append(("Calculators Page Load", "FAIL", "404 - Page not found"))
                    else:
                        results.append(("Calculators Page Load", "WARN", "Page loaded but calculator content unclear"))

            except Exception as e:
                print(f"Calculators page error: {e}")
                results.append(("Calculators Page", "FAIL", str(e)[:100]))

            # Step 3: Test clinical calculators (GIR, fluid, dosing)
            print("\n" + "=" * 60)
            print("TEST 3: Test Clinical Calculators")
            print("=" * 60)
            try:
                if '/login' not in page.url:
                    # Look for any input fields on calculator page
                    inputs = page.locator('input[type="number"], input:not([type="hidden"]):not([type="password"]):not([type="email"])').all()
                    print(f"Found {len(inputs)} input fields on calculator page")

                    if len(inputs) >= 1:
                        visible_inputs = 0
                        for i, inp in enumerate(inputs[:5]):
                            try:
                                if inp.is_visible():
                                    inp.fill('10')
                                    visible_inputs += 1
                            except:
                                pass
                        page.screenshot(path='/tmp/test_clinical_05_calculator_input.png', full_page=True)
                        if visible_inputs > 0:
                            results.append(("Calculator Inputs", "PASS", f"Filled {visible_inputs} input fields"))
                        else:
                            results.append(("Calculator Inputs", "WARN", "No visible input fields to fill"))
                    else:
                        results.append(("Calculator Inputs", "SKIP", "No input fields found"))

                    # Look for calculate button
                    calc_btn = page.locator('button:has-text("Calculate"), button:has-text("Compute"), button:has-text("Submit")').first
                    if calc_btn.count() > 0 and calc_btn.is_visible(timeout=3000):
                        calc_btn.click()
                        time.sleep(1)
                        page.screenshot(path='/tmp/test_clinical_06_calculator_result.png', full_page=True)
                        results.append(("Calculator Execution", "PASS", "Calculate button clicked"))
                    else:
                        results.append(("Calculator Execution", "SKIP", "No calculate button found"))
                else:
                    results.append(("Calculator Tests", "SKIP", "Requires authentication"))

            except Exception as e:
                print(f"Calculator test error: {e}")
                results.append(("Calculator Tests", "FAIL", str(e)[:100]))

            # Step 4: Navigate to /trends
            print("\n" + "=" * 60)
            print("TEST 4: Trends Page (Vital Signs)")
            print("=" * 60)
            try:
                page.goto('http://localhost:3000/trends', timeout=30000)
                page.wait_for_load_state('domcontentloaded', timeout=30000)
                time.sleep(2)
                print(f"Trends URL: {page.url}")
                page.screenshot(path='/tmp/test_clinical_07_trends.png', full_page=True)

                if '/login' in page.url:
                    results.append(("Trends Page", "WARN", "Redirected to login - requires authentication"))
                else:
                    content = page.content().lower()
                    if 'trend' in content or 'vital' in content or 'chart' in content or 'graph' in content or 'heart' in content:
                        results.append(("Trends Page", "PASS", "Trends/Vital signs page loaded"))
                    elif '404' in content or 'not found' in content:
                        results.append(("Trends Page", "FAIL", "404 - Page not found"))
                    else:
                        results.append(("Trends Page", "WARN", "Page loaded but trends content unclear"))

            except Exception as e:
                print(f"Trends page error: {e}")
                results.append(("Trends Page", "FAIL", str(e)[:100]))

            # Step 5: Navigate to /reports
            print("\n" + "=" * 60)
            print("TEST 5: Reports Page")
            print("=" * 60)
            try:
                page.goto('http://localhost:3000/reports', timeout=30000)
                page.wait_for_load_state('domcontentloaded', timeout=30000)
                time.sleep(2)
                print(f"Reports URL: {page.url}")
                page.screenshot(path='/tmp/test_clinical_08_reports.png', full_page=True)

                if '/login' in page.url:
                    results.append(("Reports Page", "WARN", "Redirected to login - requires authentication"))
                else:
                    content = page.content().lower()
                    if 'report' in content or 'generate' in content or 'export' in content:
                        results.append(("Reports Page", "PASS", "Reports page loaded"))

                        # Try to generate a report
                        gen_btn = page.locator('button:has-text("Generate"), button:has-text("Create"), button:has-text("Export")').first
                        if gen_btn.count() > 0 and gen_btn.is_visible(timeout=3000):
                            gen_btn.click()
                            time.sleep(2)
                            page.screenshot(path='/tmp/test_clinical_09_report_generated.png', full_page=True)
                            results.append(("Report Generation", "PASS", "Generate button clicked"))
                        else:
                            results.append(("Report Generation", "SKIP", "No generate button found"))
                    elif '404' in content or 'not found' in content:
                        results.append(("Reports Page", "FAIL", "404 - Page not found"))
                    else:
                        results.append(("Reports Page", "WARN", "Page loaded but report content unclear"))

            except Exception as e:
                print(f"Reports page error: {e}")
                results.append(("Reports Page", "FAIL", str(e)[:100]))

            # Step 6: Navigate to /devices
            print("\n" + "=" * 60)
            print("TEST 6: Devices Page")
            print("=" * 60)
            try:
                page.goto('http://localhost:3000/devices', timeout=30000)
                page.wait_for_load_state('domcontentloaded', timeout=30000)
                time.sleep(2)
                print(f"Devices URL: {page.url}")
                page.screenshot(path='/tmp/test_clinical_10_devices.png', full_page=True)

                if '/login' in page.url:
                    results.append(("Devices Page", "WARN", "Redirected to login - requires authentication"))
                else:
                    content = page.content().lower()
                    if 'device' in content or 'monitor' in content or 'equipment' in content or 'sensor' in content:
                        results.append(("Devices Page", "PASS", "Devices page loaded"))
                    elif '404' in content or 'not found' in content:
                        results.append(("Devices Page", "FAIL", "404 - Page not found"))
                    else:
                        results.append(("Devices Page", "WARN", "Page loaded but device content unclear"))

            except Exception as e:
                print(f"Devices page error: {e}")
                results.append(("Devices Page", "FAIL", str(e)[:100]))

            # Step 7: Navigate to /discharge
            print("\n" + "=" * 60)
            print("TEST 7: Discharge Planning Page")
            print("=" * 60)
            try:
                page.goto('http://localhost:3000/discharge', timeout=30000)
                page.wait_for_load_state('domcontentloaded', timeout=30000)
                time.sleep(2)
                print(f"Discharge URL: {page.url}")
                page.screenshot(path='/tmp/test_clinical_11_discharge.png', full_page=True)

                if '/login' in page.url:
                    results.append(("Discharge Page", "WARN", "Redirected to login - requires authentication"))
                else:
                    content = page.content().lower()
                    if 'discharge' in content or 'planning' in content or 'checklist' in content or 'criteria' in content:
                        results.append(("Discharge Page", "PASS", "Discharge planning page loaded"))
                    elif '404' in content or 'not found' in content:
                        results.append(("Discharge Page", "FAIL", "404 - Page not found"))
                    else:
                        results.append(("Discharge Page", "WARN", "Page loaded but discharge content unclear"))

            except Exception as e:
                print(f"Discharge page error: {e}")
                results.append(("Discharge Page", "FAIL", str(e)[:100]))

            # Step 8: Check Lab Results Integration
            print("\n" + "=" * 60)
            print("TEST 8: Lab Results Integration")
            print("=" * 60)
            try:
                page.goto('http://localhost:3000/labs', timeout=30000)
                page.wait_for_load_state('domcontentloaded', timeout=30000)
                time.sleep(2)
                print(f"Labs URL: {page.url}")
                page.screenshot(path='/tmp/test_clinical_12_labs.png', full_page=True)

                if '/login' in page.url:
                    results.append(("Lab Results", "WARN", "Redirected to login - requires authentication"))
                else:
                    content = page.content().lower()
                    if 'lab' in content or 'result' in content or 'blood' in content or 'glucose' in content:
                        results.append(("Lab Results", "PASS", "Lab results page loaded"))
                    elif '404' in content or 'not found' in content:
                        results.append(("Lab Results", "FAIL", "404 - Page not found"))
                    else:
                        results.append(("Lab Results", "WARN", "Page loaded but lab content unclear"))

            except Exception as e:
                print(f"Lab results error: {e}")
                results.append(("Lab Results", "FAIL", str(e)[:100]))

            # Step 9: Verify Medication Tracking
            print("\n" + "=" * 60)
            print("TEST 9: Medication Tracking")
            print("=" * 60)
            try:
                page.goto('http://localhost:3000/medications', timeout=30000)
                page.wait_for_load_state('domcontentloaded', timeout=30000)
                time.sleep(2)
                print(f"Medications URL: {page.url}")
                page.screenshot(path='/tmp/test_clinical_13_medications.png', full_page=True)

                if '/login' in page.url:
                    results.append(("Medication Tracking", "WARN", "Redirected to login - requires authentication"))
                else:
                    content = page.content().lower()
                    if 'medication' in content or 'drug' in content or 'dose' in content or 'prescription' in content:
                        results.append(("Medication Tracking", "PASS", "Medication tracking page loaded"))
                    elif '404' in content or 'not found' in content:
                        results.append(("Medication Tracking", "FAIL", "404 - Page not found"))
                    else:
                        results.append(("Medication Tracking", "WARN", "Page loaded but medication content unclear"))

            except Exception as e:
                print(f"Medication tracking error: {e}")
                results.append(("Medication Tracking", "FAIL", str(e)[:100]))

            # Final dashboard screenshot
            print("\n" + "=" * 60)
            print("Taking final overview screenshots")
            print("=" * 60)
            page.goto('http://localhost:3000/dashboard', timeout=30000)
            page.wait_for_load_state('domcontentloaded', timeout=30000)
            time.sleep(2)
            page.screenshot(path='/tmp/test_clinical_14_final_overview.png', full_page=True)

        except Exception as e:
            print(f"Overall test error: {e}")
            import traceback
            traceback.print_exc()
            results.append(("Overall Test", "FAIL", str(e)[:100]))

        finally:
            browser.close()

    # Print results summary
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)

    pass_count = 0
    fail_count = 0
    warn_count = 0
    skip_count = 0

    for test_name, status, message in results:
        status_icon = {"PASS": "[PASS]", "FAIL": "[FAIL]", "WARN": "[WARN]", "SKIP": "[SKIP]"}.get(status, "[????]")
        print(f"{status_icon} {test_name}: {message}")

        if status == "PASS":
            pass_count += 1
        elif status == "FAIL":
            fail_count += 1
        elif status == "WARN":
            warn_count += 1
        elif status == "SKIP":
            skip_count += 1

    print("\n" + "-" * 60)
    print(f"Total: {len(results)} tests")
    print(f"  PASS: {pass_count}")
    print(f"  FAIL: {fail_count}")
    print(f"  WARN: {warn_count}")
    print(f"  SKIP: {skip_count}")
    print("-" * 60)

    print("\nScreenshots saved to /tmp/test_clinical_*.png")

    return results

if __name__ == "__main__":
    run_tests()
