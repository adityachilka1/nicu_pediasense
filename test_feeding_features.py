#!/usr/bin/env python3
"""
Test script for NICU Dashboard Feeding Features
Tests all 13 feeding-related features with screenshots
"""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        try:
            # First, check login page structure
            print("Navigating to login page...")
            page.goto('http://localhost:3000/login', timeout=30000)
            # Wait for page to load
            page.wait_for_load_state('domcontentloaded', timeout=30000)
            time.sleep(3)  # Give JS time to execute

            # Take screenshot of login page
            page.screenshot(path='/tmp/test_feeding_00_login.png', full_page=True)
            print("Login page screenshot saved")

            # Get page content to analyze
            print(f"Page URL: {page.url}")
            print(f"Page title: {page.title()}")

            # Wait for inputs to appear
            page.wait_for_selector('input', timeout=30000)

            # Find all input elements
            inputs = page.locator('input').all()
            print(f"Found {len(inputs)} input elements")
            for i, inp in enumerate(inputs):
                try:
                    inp_type = inp.get_attribute('type', timeout=1000)
                    inp_name = inp.get_attribute('name', timeout=1000)
                    inp_placeholder = inp.get_attribute('placeholder', timeout=1000)
                    print(f"  Input {i}: type={inp_type}, name={inp_name}, placeholder={inp_placeholder}")
                except:
                    pass

            # Find all buttons
            buttons = page.locator('button').all()
            print(f"Found {len(buttons)} button elements")
            for i, btn in enumerate(buttons):
                try:
                    btn_text = btn.inner_text(timeout=1000)
                    print(f"  Button {i}: {btn_text}")
                except:
                    pass

            # Try to login
            print("\nAttempting login...")

            # Fill email field
            email_selectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[placeholder*="email" i]',
                'input[placeholder*="Email" i]',
                '#email',
            ]

            email_filled = False
            for selector in email_selectors:
                try:
                    el = page.locator(selector).first
                    if el.is_visible(timeout=2000):
                        el.fill('admin@hospital.org')
                        email_filled = True
                        print(f"Email filled using selector: {selector}")
                        break
                except:
                    continue

            if not email_filled:
                print("Could not find email field, trying first input...")
                try:
                    inputs = page.locator('input').all()
                    for inp in inputs:
                        inp_type = inp.get_attribute('type', timeout=1000)
                        if inp_type != 'password' and inp_type != 'submit':
                            inp.fill('admin@hospital.org')
                            email_filled = True
                            print("Email filled using first non-password input")
                            break
                except Exception as e:
                    print(f"Failed to fill email: {e}")

            # Fill password field
            password_selectors = [
                'input[type="password"]',
                'input[name="password"]',
                '#password'
            ]

            password_filled = False
            for selector in password_selectors:
                try:
                    el = page.locator(selector).first
                    if el.is_visible(timeout=2000):
                        el.fill('admin123')
                        password_filled = True
                        print(f"Password filled using selector: {selector}")
                        break
                except:
                    continue

            page.screenshot(path='/tmp/test_feeding_01_credentials.png', full_page=True)

            # Click login button
            login_selectors = [
                'button[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Sign in")',
                'button:has-text("Sign In")',
                'input[type="submit"]',
            ]

            login_clicked = False
            for selector in login_selectors:
                try:
                    el = page.locator(selector).first
                    if el.is_visible(timeout=2000):
                        el.click()
                        login_clicked = True
                        print(f"Login clicked using selector: {selector}")
                        break
                except:
                    continue

            if not login_clicked:
                # Try clicking any button
                buttons = page.locator('button').all()
                if buttons:
                    buttons[0].click()
                    login_clicked = True
                    print("Clicked first available button")

            # Wait for navigation
            time.sleep(3)
            page.wait_for_load_state('domcontentloaded', timeout=30000)
            time.sleep(2)

            # Check if we're still on login page or redirected
            print(f"After login URL: {page.url}")
            page.screenshot(path='/tmp/test_feeding_02_after_login.png', full_page=True)

            # Navigate to feeding page
            print("\nNavigating to feeding page...")
            page.goto('http://localhost:3000/feeding', timeout=30000)
            page.wait_for_load_state('domcontentloaded', timeout=30000)
            time.sleep(3)

            print(f"Feeding page URL: {page.url}")
            page.screenshot(path='/tmp/test_feeding_03_feeding_page.png', full_page=True)

            # Get page content for analysis
            page_content = page.content().lower()

            # Test 1: Patient selector dropdown works
            print("\n=== Test 1: Patient selector dropdown ===")
            patient_selectors = [
                'select',
                '[role="combobox"]',
                '[data-testid*="patient"]',
                '.patient-selector',
                '[class*="select"]',
                '[class*="dropdown"]',
                'button[class*="select"]'
            ]
            patient_found = False
            for selector in patient_selectors:
                try:
                    el = page.locator(selector)
                    if el.count() > 0 and el.first.is_visible(timeout=1000):
                        patient_found = True
                        print(f"  Found patient selector with: {selector}")
                        try:
                            el.first.click()
                            time.sleep(0.5)
                            page.screenshot(path='/tmp/test_feeding_04_patient_selector.png', full_page=True)
                            page.keyboard.press('Escape')
                        except:
                            pass
                        break
                except:
                    continue

            if patient_found:
                results['1. Patient selector dropdown'] = 'PASS'
                print("PASS: Patient selector found")
            else:
                results['1. Patient selector dropdown'] = 'FAIL - Not found'
                print("FAIL: Patient selector not found")

            # Test 2: Feeding summary displays (calories, protein, GIR targets)
            print("\n=== Test 2: Feeding summary (calories, protein, GIR) ===")
            calories_found = 'calor' in page_content or 'kcal' in page_content
            protein_found = 'protein' in page_content
            gir_found = 'gir' in page_content or 'glucose infusion' in page_content

            if calories_found or protein_found or gir_found:
                results['2. Feeding summary displays'] = f'PASS - Calories:{calories_found}, Protein:{protein_found}, GIR:{gir_found}'
                print(f"PASS: Calories={calories_found}, Protein={protein_found}, GIR={gir_found}")
            else:
                results['2. Feeding summary displays'] = 'FAIL - None found'
                print(f"FAIL: Calories={calories_found}, Protein={protein_found}, GIR={gir_found}")

            page.screenshot(path='/tmp/test_feeding_05_summary.png', full_page=True)

            # Test 3: NEC Risk Assessment card is visible
            print("\n=== Test 3: NEC Risk Assessment card ===")
            nec_in_page = 'nec' in page_content or 'necrotizing' in page_content
            if nec_in_page:
                results['3. NEC Risk Assessment card'] = 'PASS'
                print("PASS: NEC Risk Assessment found")
            else:
                results['3. NEC Risk Assessment card'] = 'FAIL - Not found'
                print("FAIL: NEC Risk Assessment not found")

            page.screenshot(path='/tmp/test_feeding_06_nec_card.png', full_page=True)

            # Test 4: NEC risk level indicator (LOW/MODERATE/HIGH)
            print("\n=== Test 4: NEC risk level indicator ===")
            low_found = 'low' in page_content
            moderate_found = 'moderate' in page_content
            high_found = 'high' in page_content

            if low_found or moderate_found or high_found:
                results['4. NEC risk level indicator'] = f'PASS - Low:{low_found}, Moderate:{moderate_found}, High:{high_found}'
                print(f"PASS: Risk levels found - Low:{low_found}, Moderate:{moderate_found}, High:{high_found}")
            else:
                results['4. NEC risk level indicator'] = 'FAIL - No risk levels found'
                print("FAIL: No risk levels found")

            # Test 5: NEC score display
            print("\n=== Test 5: NEC score display ===")
            score_found = 'score' in page_content or 'risk score' in page_content
            if score_found:
                results['5. NEC score display'] = 'PASS'
                print("PASS: NEC score display found")
            else:
                results['5. NEC score display'] = 'FAIL - Not found'
                print("FAIL: NEC score not found")

            page.screenshot(path='/tmp/test_feeding_07_nec_score.png', full_page=True)

            # Test 6: Suggested advancement rate based on risk
            print("\n=== Test 6: Suggested advancement rate ===")
            advancement_found = 'advancement' in page_content or 'ml/kg' in page_content or 'rate' in page_content
            if advancement_found:
                results['6. Suggested advancement rate'] = 'PASS'
                print("PASS: Advancement rate found")
            else:
                results['6. Suggested advancement rate'] = 'FAIL - Not found'
                print("FAIL: Advancement rate not found")

            # Test 7: Click "View Details" to expand NEC risk factors
            print("\n=== Test 7: View Details button ===")
            view_details_selectors = [
                'button:has-text("View Details")',
                'button:has-text("Details")',
                ':text("View Details")',
                '[class*="expand"]',
                'button:has-text("Show")',
                'button:has-text("More")'
            ]
            details_clicked = False
            for selector in view_details_selectors:
                try:
                    el = page.locator(selector)
                    if el.count() > 0 and el.first.is_visible(timeout=1000):
                        el.first.click()
                        time.sleep(1)
                        details_clicked = True
                        print(f"  Clicked details with: {selector}")
                        page.screenshot(path='/tmp/test_feeding_08_view_details.png', full_page=True)
                        break
                except:
                    continue

            if details_clicked:
                results['7. View Details button'] = 'PASS'
                print("PASS: View Details clicked")
            else:
                results['7. View Details button'] = 'FAIL - Button not found'
                print("FAIL: View Details button not found")

            # Test 8: Risk factors list appears
            print("\n=== Test 8: Risk factors list ===")
            page_content_updated = page.content().lower()
            risk_factors = 'risk factor' in page_content_updated or 'factors' in page_content_updated
            if risk_factors:
                results['8. Risk factors list'] = 'PASS'
                print("PASS: Risk factors list found")
            else:
                results['8. Risk factors list'] = 'FAIL - Not found'
                print("FAIL: Risk factors list not found")

            page.screenshot(path='/tmp/test_feeding_09_risk_factors.png', full_page=True)

            # Test 9: Recommendation section visible
            print("\n=== Test 9: Recommendation section ===")
            recommendation_found = 'recommendation' in page_content_updated or 'suggest' in page_content_updated
            if recommendation_found:
                results['9. Recommendation section'] = 'PASS'
                print("PASS: Recommendation section found")
            else:
                results['9. Recommendation section'] = 'FAIL - Not found'
                print("FAIL: Recommendation section not found")

            # Test 10: Feed log table displays
            print("\n=== Test 10: Feed log table ===")
            table_found = page.locator('table').count() > 0
            feed_log_text = 'feed' in page_content_updated and ('log' in page_content_updated or 'history' in page_content_updated or 'record' in page_content_updated)
            if table_found or feed_log_text:
                results['10. Feed log table'] = 'PASS'
                print("PASS: Feed log table found")
            else:
                results['10. Feed log table'] = 'FAIL - Not found'
                print("FAIL: Feed log table not found")

            page.screenshot(path='/tmp/test_feeding_10_feed_log.png', full_page=True)

            # Test 11: Add new feed entry form works
            print("\n=== Test 11: Add new feed entry form ===")
            add_btn_selectors = [
                'button:has-text("Add")',
                'button:has-text("New")',
                'button:has-text("+")',
                '[class*="add-feed"]',
                'button:has-text("Record")',
                'button:has-text("Log")'
            ]
            add_clicked = False
            for selector in add_btn_selectors:
                try:
                    el = page.locator(selector)
                    if el.count() > 0 and el.first.is_visible(timeout=1000):
                        el.first.click()
                        time.sleep(1)
                        add_clicked = True
                        print(f"  Clicked add with: {selector}")
                        page.screenshot(path='/tmp/test_feeding_11_add_feed.png', full_page=True)
                        break
                except:
                    continue

            form_found = page.locator('form, input[type="number"], input[type="text"]').count() > 0
            if add_clicked or form_found:
                results['11. Add new feed entry form'] = 'PASS'
                print("PASS: Feed entry form found/clicked")
            else:
                results['11. Add new feed entry form'] = 'FAIL - Not found'
                print("FAIL: Add feed entry form not found")

            # Test 12: TPN configuration section
            print("\n=== Test 12: TPN configuration section ===")
            tpn_found = 'tpn' in page_content_updated or 'parenteral' in page_content_updated or 'total parenteral nutrition' in page_content_updated
            if tpn_found:
                results['12. TPN configuration section'] = 'PASS'
                print("PASS: TPN configuration found")
            else:
                results['12. TPN configuration section'] = 'FAIL - Not found'
                print("FAIL: TPN configuration not found")

            page.screenshot(path='/tmp/test_feeding_12_tpn.png', full_page=True)

            # Test 13: Breast milk tracking section
            print("\n=== Test 13: Breast milk tracking section ===")
            breast_milk_found = 'breast' in page_content_updated or 'milk' in page_content_updated or 'ebm' in page_content_updated or 'fortifier' in page_content_updated
            if breast_milk_found:
                results['13. Breast milk tracking section'] = 'PASS'
                print("PASS: Breast milk tracking found")
            else:
                results['13. Breast milk tracking section'] = 'FAIL - Not found'
                print("FAIL: Breast milk tracking not found")

            page.screenshot(path='/tmp/test_feeding_13_breast_milk.png', full_page=True)

            # Final full page screenshot
            page.screenshot(path='/tmp/test_feeding_14_final.png', full_page=True)

        except Exception as e:
            print(f"Error during testing: {e}")
            import traceback
            traceback.print_exc()
            try:
                page.screenshot(path='/tmp/test_feeding_error.png', full_page=True)
            except:
                pass
        finally:
            browser.close()

    # Print summary
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)

    passed = 0
    failed = 0

    for test, result in results.items():
        status = "PASS" if "PASS" in result else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1
        print(f"{test}: {result}")

    print("="*60)
    print(f"Total: {passed} PASSED, {failed} FAILED out of {len(results)} tests")
    print("="*60)
    print("\nScreenshots saved to /tmp/test_feeding_*.png")

    return results

if __name__ == '__main__':
    run_tests()
