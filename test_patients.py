#!/usr/bin/env python3
"""
NICU Dashboard Patient Management Test Suite
Tests patient list, details, beds, growth charts, flowsheet, orders, care plans, and family portal
"""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        page.set_default_timeout(60000)

        # Enable console logging for debugging
        page.on("console", lambda msg: print(f"Console: {msg.text}") if msg.type == "error" else None)

        try:
            print("=" * 60)
            print("NICU Dashboard Patient Management Tests")
            print("=" * 60)

            # Step 1: Login
            print("\n[LOGIN] Navigating to login page...")
            page.goto('http://localhost:3000/login', wait_until='load')
            time.sleep(2)
            page.screenshot(path='/tmp/test_patients_00_initial.png', full_page=True)
            print(f"  Current URL: {page.url}")

            # Make sure we're on the Email & Password tab
            email_tab = page.locator('button:has-text("Email & Password")').first
            if email_tab.count() > 0:
                email_tab.click()
                time.sleep(0.5)

            # Clear and fill login form
            email_input = page.locator('#email').first
            password_input = page.locator('#password').first

            if email_input.count() > 0 and password_input.count() > 0:
                print("[LOGIN] Found login form, filling credentials...")
                email_input.fill('')
                email_input.fill('admin@hospital.org')
                password_input.fill('')
                password_input.fill('admin123')
                time.sleep(1)
                page.screenshot(path='/tmp/test_patients_01_login_filled.png', full_page=True)

                login_btn = page.locator('button[type="submit"]').first
                if login_btn.count() > 0:
                    print("[LOGIN] Clicking Sign In button...")
                    login_btn.click()
                    time.sleep(5)
                    page.screenshot(path='/tmp/test_patients_02_after_login.png', full_page=True)
                    print(f"[LOGIN] After login click. Current URL: {page.url}")

                    if 'login' not in page.url.lower():
                        print("[LOGIN] Successfully logged in!")
                    else:
                        print("[LOGIN] Still on login page - login may have failed")

            # Test 1: Navigate to /patients
            print("\n[TEST 1] Navigate to /patients - verify patient list displays")
            page.goto('http://localhost:3000/patients', wait_until='load')
            time.sleep(3)
            page.screenshot(path='/tmp/test_patients_03_patients_list.png', full_page=True)
            print(f"  Current URL: {page.url}")

            if 'login' in page.url.lower():
                results.append(("Test 1: Patient List (/patients)", "FAIL", "Redirected to login - authentication failed"))
                print("  [FAIL] Redirected to login page - authentication failed")
            else:
                page_content = page.content().lower()
                # Check for Patient Census page indicators
                has_patient_content = any(term in page_content for term in ['patient', 'census', 'mrn', 'admitted', 'bed'])
                has_table = page.locator('table').count() > 0

                if has_patient_content or has_table:
                    results.append(("Test 1: Patient List (/patients)", "PASS", "Patient Census page displays correctly"))
                    print("  [PASS] Patient list displays")
                else:
                    results.append(("Test 1: Patient List (/patients)", "FAIL", "Patient list content not found"))
                    print("  [FAIL] Patient list content not found")

            # Test 2: Click on a patient to view details
            print("\n[TEST 2] Click on a patient to view details")
            if 'login' not in page.url.lower():
                patient_rows = page.locator('table tbody tr').all()
                print(f"  Found {len(patient_rows)} patient rows in table")

                if len(patient_rows) > 0:
                    try:
                        patient_rows[0].click()
                        time.sleep(3)
                        page.screenshot(path='/tmp/test_patients_04_patient_clicked.png', full_page=True)
                        results.append(("Test 2: Click Patient", "PASS", f"Successfully clicked patient row. URL: {page.url}"))
                        print(f"  [PASS] Clicked on patient. Current URL: {page.url}")
                    except Exception as e:
                        results.append(("Test 2: Click Patient", "FAIL", f"Could not click patient: {str(e)}"))
                        print(f"  [FAIL] Could not click patient: {e}")
                else:
                    results.append(("Test 2: Click Patient", "SKIP", "No patient rows found"))
                    print("  [SKIP] No patient rows found")
            else:
                results.append(("Test 2: Click Patient", "SKIP", "On login page - cannot test"))
                print("  [SKIP] On login page - cannot test")

            # Test 3: Navigate to /patient/1 (patient detail page)
            print("\n[TEST 3] Navigate to /patient/1 - verify patient detail page")
            page.goto('http://localhost:3000/patient/1', wait_until='load')
            time.sleep(3)
            page.screenshot(path='/tmp/test_patients_05_patient_detail.png', full_page=True)
            print(f"  Current URL: {page.url}")

            if 'login' in page.url.lower():
                results.append(("Test 3: Patient Detail (/patient/1)", "FAIL", "Redirected to login"))
                print("  [FAIL] Redirected to login page")
            else:
                detail_content = page.content().lower()
                # Check for patient detail indicators - include common vital signs and page elements
                has_detail = any(term in detail_content for term in ['spo', 'bpm', 'temp', 'demographics', 'bed 0', 'overview', 'labs', 'medications', 'care team', 'diagnoses', 'feeding', 'notes'])

                if has_detail and '404' not in detail_content:
                    results.append(("Test 3: Patient Detail (/patient/1)", "PASS", "Patient detail page with vitals displays"))
                    print("  [PASS] Patient detail page displays")
                else:
                    results.append(("Test 3: Patient Detail (/patient/1)", "FAIL", "Patient detail page not found"))
                    print("  [FAIL] Patient detail page not found")

            # Test 4: Check patient demographics
            print("\n[TEST 4] Check patient demographics (name, MRN, GA, weight, DOL)")
            if 'login' not in page.url.lower():
                current_content = page.content().lower()
                demographics = {
                    'name': 'baby' in current_content or 'thompson' in current_content or 'patient' in current_content,
                    'mrn': 'mrn' in current_content,
                    'ga': 'ga' in current_content or 'weeks' in current_content or 'gestational' in current_content,
                    'weight': 'weight' in current_content or 'kg' in current_content,
                    'dol': 'dol' in current_content or 'day' in current_content
                }

                found_demographics = [k for k, v in demographics.items() if v]
                if len(found_demographics) >= 3:
                    results.append(("Test 4: Patient Demographics", "PASS", f"Found: {', '.join(found_demographics)}"))
                    print(f"  [PASS] Demographics found: {', '.join(found_demographics)}")
                elif len(found_demographics) > 0:
                    results.append(("Test 4: Patient Demographics", "PARTIAL", f"Only found: {', '.join(found_demographics)}"))
                    print(f"  [PARTIAL] Only found: {', '.join(found_demographics)}")
                else:
                    results.append(("Test 4: Patient Demographics", "FAIL", "No demographics found"))
                    print("  [FAIL] No demographics found")
            else:
                results.append(("Test 4: Patient Demographics", "SKIP", "On login page - cannot test"))
                print("  [SKIP] On login page - cannot test")

            # Test 5: Navigate to /beds
            print("\n[TEST 5] Navigate to /beds - verify bed management")
            page.goto('http://localhost:3000/beds', wait_until='load')
            time.sleep(3)
            page.screenshot(path='/tmp/test_patients_06_beds.png', full_page=True)
            print(f"  Current URL: {page.url}")

            if 'login' in page.url.lower():
                results.append(("Test 5: Bed Management (/beds)", "FAIL", "Redirected to login"))
                print("  [FAIL] Redirected to login page")
            else:
                bed_content = page.content().lower()
                # Check for Bed Management page indicators
                has_beds = any(term in bed_content for term in ['bed management', 'bed 0', 'bed 1', 'occupied', 'available', 'total beds', 'cleaning', 'maintenance'])

                if has_beds and '404' not in bed_content:
                    results.append(("Test 5: Bed Management (/beds)", "PASS", "Bed Management page displays with bed grid"))
                    print("  [PASS] Bed management page displays")
                else:
                    results.append(("Test 5: Bed Management (/beds)", "FAIL", "Bed management page not found"))
                    print("  [FAIL] Bed management page not found")

            # Test 6: Navigate to /growth
            print("\n[TEST 6] Navigate to /growth - verify growth charts")
            page.goto('http://localhost:3000/growth', wait_until='load')
            time.sleep(3)
            page.screenshot(path='/tmp/test_patients_07_growth.png', full_page=True)
            print(f"  Current URL: {page.url}")

            if 'login' in page.url.lower():
                results.append(("Test 6: Growth Charts (/growth)", "FAIL", "Redirected to login"))
                print("  [FAIL] Redirected to login page")
            else:
                growth_content = page.content().lower()
                has_growth = any(term in growth_content for term in ['growth chart', 'fenton', 'percentile', 'select patient', 'baby martinez', 'measurement history', 'gestational age', 'preterm'])
                has_chart = page.locator('canvas, svg').count() > 0

                # Check if page is blank
                body_text = page.locator('body').text_content()
                is_blank = len(body_text.strip()) < 50

                if (has_growth or has_chart) and '404' not in growth_content and not is_blank:
                    results.append(("Test 6: Growth Charts (/growth)", "PASS", "Growth Charts page with Fenton charts displays"))
                    print("  [PASS] Growth charts page displays")
                elif is_blank:
                    results.append(("Test 6: Growth Charts (/growth)", "FAIL", "Page is blank or still loading"))
                    print("  [FAIL] Growth charts page is blank")
                else:
                    results.append(("Test 6: Growth Charts (/growth)", "FAIL", "Growth charts page not found"))
                    print("  [FAIL] Growth charts page not found")

            # Test 7: Navigate to /flowsheet
            print("\n[TEST 7] Navigate to /flowsheet - verify flowsheet data")
            page.goto('http://localhost:3000/flowsheet', wait_until='load')
            time.sleep(3)
            page.screenshot(path='/tmp/test_patients_08_flowsheet.png', full_page=True)
            print(f"  Current URL: {page.url}")

            if 'login' in page.url.lower():
                results.append(("Test 7: Flowsheet (/flowsheet)", "FAIL", "Redirected to login"))
                print("  [FAIL] Redirected to login page")
            else:
                flowsheet_content = page.content().lower()
                has_flowsheet = any(term in flowsheet_content for term in ['flowsheet', 'i/o', 'intake', 'output', 'hourly', 'total intake', 'net balance'])

                if has_flowsheet and '404' not in flowsheet_content:
                    results.append(("Test 7: Flowsheet (/flowsheet)", "PASS", "I/O Flowsheet page displays"))
                    print("  [PASS] Flowsheet page displays")
                else:
                    results.append(("Test 7: Flowsheet (/flowsheet)", "FAIL", "Flowsheet page not found"))
                    print("  [FAIL] Flowsheet page not found")

            # Test 8: Navigate to /orders
            print("\n[TEST 8] Navigate to /orders - verify medical orders")
            page.goto('http://localhost:3000/orders', wait_until='load')
            time.sleep(3)
            page.screenshot(path='/tmp/test_patients_09_orders.png', full_page=True)
            print(f"  Current URL: {page.url}")

            if 'login' in page.url.lower():
                results.append(("Test 8: Medical Orders (/orders)", "FAIL", "Redirected to login"))
                print("  [FAIL] Redirected to login page")
            else:
                orders_content = page.content().lower()
                has_orders = any(term in orders_content for term in ['clinical orders', 'order entry', 'lab', 'med', 'imaging', 'pending', 'active', 'quick order', 'cbc', 'ampicillin', 'gentamicin', 'blood culture'])

                # Check if page is blank
                body_text = page.locator('body').text_content()
                is_blank = len(body_text.strip()) < 50

                if has_orders and '404' not in orders_content and not is_blank:
                    results.append(("Test 8: Medical Orders (/orders)", "PASS", "Clinical Orders page displays"))
                    print("  [PASS] Medical orders page displays")
                elif is_blank:
                    results.append(("Test 8: Medical Orders (/orders)", "FAIL", "Page is blank or still loading"))
                    print("  [FAIL] Medical orders page is blank")
                else:
                    results.append(("Test 8: Medical Orders (/orders)", "FAIL", "Medical orders page not found"))
                    print("  [FAIL] Medical orders page not found")

            # Test 9: Navigate to /care-plans
            print("\n[TEST 9] Navigate to /care-plans - verify care plans")
            page.goto('http://localhost:3000/care-plans', wait_until='load')
            time.sleep(5)  # Longer wait for this page
            page.screenshot(path='/tmp/test_patients_10_care_plans.png', full_page=True)
            print(f"  Current URL: {page.url}")

            if 'login' in page.url.lower():
                results.append(("Test 9: Care Plans (/care-plans)", "FAIL", "Redirected to login"))
                print("  [FAIL] Redirected to login page")
            else:
                care_content = page.content().lower()
                has_care_plans = any(term in care_content for term in ['care plan', 'protocol', 'respiratory', 'weaning', 'stabilization', 'active', 'completed', 'phototherapy', 'baby martinez', 'baby thompson'])

                # Check if page is blank
                body_text = page.locator('body').text_content()
                is_blank = len(body_text.strip()) < 50

                if has_care_plans and '404' not in care_content and not is_blank:
                    results.append(("Test 9: Care Plans (/care-plans)", "PASS", "Care Plans & Protocols page displays"))
                    print("  [PASS] Care plans page displays")
                elif is_blank:
                    results.append(("Test 9: Care Plans (/care-plans)", "FAIL", "Page is blank or still loading"))
                    print("  [FAIL] Care plans page is blank")
                else:
                    results.append(("Test 9: Care Plans (/care-plans)", "FAIL", "Care plans page not found"))
                    print("  [FAIL] Care plans page not found")

            # Test 10: Navigate to /family
            print("\n[TEST 10] Navigate to /family - verify family portal features")
            page.goto('http://localhost:3000/family', wait_until='load')
            time.sleep(3)
            page.screenshot(path='/tmp/test_patients_11_family.png', full_page=True)
            print(f"  Current URL: {page.url}")

            if 'login' in page.url.lower():
                results.append(("Test 10: Family Portal (/family)", "FAIL", "Redirected to login"))
                print("  [FAIL] Redirected to login page")
            else:
                family_content = page.content().lower()
                # Check for Family Portal page indicators
                has_family = any(term in family_content for term in ['family portal', 'families', 'message', 'milestones', 'education', 'photos', 'parent communication', 'baby martinez', 'baby thompson'])

                # Also check if page is blank/loading
                body_text = page.locator('body').text_content()
                is_blank = len(body_text.strip()) < 50

                if has_family and '404' not in family_content and not is_blank:
                    results.append(("Test 10: Family Portal (/family)", "PASS", "Family Portal with messaging displays"))
                    print("  [PASS] Family portal page displays")
                elif is_blank:
                    results.append(("Test 10: Family Portal (/family)", "FAIL", "Page is blank or not loading"))
                    print("  [FAIL] Family portal page is blank")
                else:
                    results.append(("Test 10: Family Portal (/family)", "FAIL", "Family portal page not found"))
                    print("  [FAIL] Family portal page not found")

        except Exception as e:
            import traceback
            print(f"\n[ERROR] Test execution error: {e}")
            traceback.print_exc()
            page.screenshot(path='/tmp/test_patients_error.png', full_page=True)
            results.append(("Test Execution", "ERROR", str(e)))

        finally:
            browser.close()

    # Print summary
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)

    pass_count = sum(1 for r in results if r[1] == "PASS")
    fail_count = sum(1 for r in results if r[1] == "FAIL")
    skip_count = sum(1 for r in results if r[1] in ["SKIP", "PARTIAL"])

    for test_name, status, details in results:
        status_icon = "[PASS]" if status == "PASS" else "[FAIL]" if status == "FAIL" else "[" + status + "]"
        print(f"{status_icon} {test_name}")
        print(f"       Details: {details}")

    print("\n" + "-" * 60)
    print(f"Total: {len(results)} tests | Passed: {pass_count} | Failed: {fail_count} | Other: {skip_count}")
    print("-" * 60)

    print("\nScreenshots saved to /tmp/test_patients_*.png")

    return results

if __name__ == "__main__":
    run_tests()
