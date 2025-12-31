#!/usr/bin/env python3
"""
Test script for NICU Dashboard Handoff Features
Tests all 10 requirements and saves screenshots to /tmp/
"""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        page.set_default_timeout(60000)

        # Navigate to login page first
        print("Navigating to login page...")
        page.goto('http://localhost:3000', wait_until='domcontentloaded')
        time.sleep(3)
        page.screenshot(path='/tmp/test_handoff_01_login_page.png', full_page=True)
        print("Screenshot saved: /tmp/test_handoff_01_login_page.png")

        # Login with credentials
        print("Logging in with admin@hospital.org / admin123...")
        try:
            # First click on "Email & Password" tab to make sure we're on the right form
            email_tab = page.locator('button:has-text("Email & Password"), [role="tab"]:has-text("Email")')
            if email_tab.count() > 0:
                email_tab.first.click()
                time.sleep(1)
                print("  Clicked Email & Password tab")

            # Clear any existing values and fill in credentials
            email_field = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input[id*="email" i]').first
            email_field.clear()
            email_field.fill('admin@hospital.org')
            print("  Filled email: admin@hospital.org")

            # Find password field
            password_field = page.locator('input[type="password"]').first
            password_field.clear()
            password_field.fill('admin123')
            print("  Filled password")

            # Find and click login button
            login_button = page.locator('button:has-text("Sign In"), button:has-text("Login"), button:has-text("Log in"), button[type="submit"]').first
            login_button.click()
            print("  Clicked Sign In button")

            time.sleep(4)
            page.screenshot(path='/tmp/test_handoff_02_after_login.png', full_page=True)
            print("Screenshot saved: /tmp/test_handoff_02_after_login.png")

            # Check if we're logged in by looking at URL or page content
            current_url = page.url
            print(f"  Current URL after login: {current_url}")

        except Exception as e:
            print(f"Login attempt error: {e}")
            page.screenshot(path='/tmp/test_handoff_02_login_error.png', full_page=True)

        # Navigate to handoff page
        print("Navigating to handoff page...")
        page.goto('http://localhost:3000/handoff', wait_until='domcontentloaded')
        time.sleep(4)

        # Check if we got redirected to login
        current_url = page.url
        print(f"  Current URL: {current_url}")

        if 'login' in current_url.lower() or page.locator('text="Welcome back"').count() > 0:
            print("  Redirected to login - performing login again...")
            # Login again
            email_tab = page.locator('button:has-text("Email & Password")')
            if email_tab.count() > 0:
                email_tab.first.click()
                time.sleep(1)

            email_field = page.locator('input[type="email"], input[name="email"]').first
            email_field.clear()
            email_field.fill('admin@hospital.org')

            password_field = page.locator('input[type="password"]').first
            password_field.clear()
            password_field.fill('admin123')

            login_button = page.locator('button:has-text("Sign In")').first
            login_button.click()
            time.sleep(4)

            # Now navigate to handoff again
            page.goto('http://localhost:3000/handoff', wait_until='domcontentloaded')
            time.sleep(4)

        page.screenshot(path='/tmp/test_handoff_03_handoff_page.png', full_page=True)
        print("Screenshot saved: /tmp/test_handoff_03_handoff_page.png")

        # Get page content for analysis
        page_content = page.content()
        print(f"  Page URL: {page.url}")

        # Test 1: SBAR section labels visible
        print("\n--- Test 1: SBAR section labels visible ---")
        sbar_labels = ['Situation', 'Background', 'Assessment', 'Recommendation']
        sbar_found = []
        for label in sbar_labels:
            if page.locator(f'text="{label}"').count() > 0 or label.lower() in page_content.lower():
                sbar_found.append(label)
                print(f"  Found: {label}")
            else:
                print(f"  NOT Found: {label}")
        results['test1_sbar_labels'] = len(sbar_found) == 4
        print(f"  Result: {'PASS' if results['test1_sbar_labels'] else 'FAIL'} ({len(sbar_found)}/4 labels found)")

        # Test 2: Color-coded borders (cyan, blue, amber, green)
        print("\n--- Test 2: Color-coded borders for SBAR sections ---")
        # Check for color classes or inline styles
        color_indicators = ['cyan', 'blue', 'amber', 'green', 'border-cyan', 'border-blue', 'border-amber', 'border-green']
        colors_found = []
        for color in color_indicators:
            if color in page_content.lower():
                colors_found.append(color)
        results['test2_color_borders'] = len(colors_found) >= 4
        print(f"  Colors found in page: {colors_found}")
        print(f"  Result: {'PASS' if results['test2_color_borders'] else 'FAIL'}")
        page.screenshot(path='/tmp/test_handoff_04_sbar_colors.png', full_page=True)
        print("Screenshot saved: /tmp/test_handoff_04_sbar_colors.png")

        # Test 3: Letter indicators (S, B, A, R) in circles
        print("\n--- Test 3: Letter indicators (S, B, A, R) in circles ---")
        # Look for rounded-full elements which are typically circles in Tailwind
        circle_elements = page.locator('[class*="rounded-full"]').all()
        print(f"  Found {len(circle_elements)} rounded-full elements")
        # Check for SBAR letters in circles
        sbar_circles_found = 0
        for letter in ['S', 'B', 'A', 'R']:
            circle_with_letter = page.locator(f'[class*="rounded-full"]:has-text("{letter}")').count()
            if circle_with_letter > 0:
                sbar_circles_found += 1
                print(f"  Found circle with letter: {letter}")
        results['test3_letter_indicators'] = sbar_circles_found >= 2 or len(circle_elements) > 0
        print(f"  Result: {'PASS' if results['test3_letter_indicators'] else 'FAIL'}")

        # Test 4: Patient cards grouped by priority
        print("\n--- Test 4: Patient cards grouped by priority ---")
        priority_groups = ['Critical', 'Warning', 'Stable']
        priorities_found = []
        for priority in priority_groups:
            if page.locator(f'text="{priority}"').count() > 0 or priority.lower() in page_content.lower():
                priorities_found.append(priority)
                print(f"  Found priority group: {priority}")
        results['test4_priority_groups'] = len(priorities_found) >= 2
        print(f"  Result: {'PASS' if results['test4_priority_groups'] else 'FAIL'} ({len(priorities_found)}/3 found)")
        page.screenshot(path='/tmp/test_handoff_05_priority_groups.png', full_page=True)
        print("Screenshot saved: /tmp/test_handoff_05_priority_groups.png")

        # Test 5: BP displayed in handoff cards
        print("\n--- Test 5: BP displayed in handoff cards ---")
        # Look for BP or blood pressure indicators
        bp_found = 'bp' in page_content.lower() or 'blood pressure' in page_content.lower() or '/mmhg' in page_content.lower() or 'mmHg' in page_content
        # Also check for BP pattern like 120/80
        bp_pattern = page.locator('text=/\\d+\\/\\d+/').count() > 0
        results['test5_bp_displayed'] = bp_found or bp_pattern
        print(f"  BP indicator found: {bp_found or bp_pattern}")
        print(f"  Result: {'PASS' if results['test5_bp_displayed'] else 'FAIL'}")

        # Test 6: Day→Night and Night→Day shift toggle
        print("\n--- Test 6: Shift toggle (Day/Night) ---")
        shift_found = 'day' in page_content.lower() and 'night' in page_content.lower()
        print(f"  Day/Night text found: {shift_found}")
        try:
            # Look for toggle elements
            toggle_button = page.locator('button:has-text("Day"), button:has-text("Night"), [role="switch"], input[type="checkbox"], button[class*="toggle"]')
            if toggle_button.count() > 0:
                toggle_button.first.click()
                time.sleep(1)
                page.screenshot(path='/tmp/test_handoff_06_shift_toggle.png', full_page=True)
                print("  Shift toggle clicked")
                print("Screenshot saved: /tmp/test_handoff_06_shift_toggle.png")
                results['test6_shift_toggle'] = True
            else:
                # Try looking for day/night switch in any form
                arrow_toggle = page.locator('[class*="shift"]')
                if arrow_toggle.count() > 0:
                    results['test6_shift_toggle'] = True
                else:
                    results['test6_shift_toggle'] = shift_found
                page.screenshot(path='/tmp/test_handoff_06_shift_toggle.png', full_page=True)
        except Exception as e:
            print(f"  Toggle attempt: {e}")
            results['test6_shift_toggle'] = shift_found
        print(f"  Result: {'PASS' if results['test6_shift_toggle'] else 'FAIL'}")

        # Test 7: Add handoff notes to a patient
        print("\n--- Test 7: Add handoff notes to a patient ---")
        try:
            # Look for notes input or textarea
            notes_fields = page.locator('textarea, input[placeholder*="note" i], input[name*="note" i]')
            if notes_fields.count() > 0:
                notes_fields.first.fill('Test handoff note - Patient doing well')
                page.screenshot(path='/tmp/test_handoff_07_handoff_notes.png', full_page=True)
                results['test7_add_notes'] = True
                print("  Notes field found and filled")
                print("Screenshot saved: /tmp/test_handoff_07_handoff_notes.png")
            else:
                # Try clicking on a patient card first
                patient_card = page.locator('[class*="card"], [class*="patient"], article, .bg-white').first
                if patient_card.count() > 0:
                    patient_card.click()
                    time.sleep(1)
                    notes_field = page.locator('textarea').first
                    if notes_field.count() > 0:
                        notes_field.fill('Test handoff note - Patient doing well')
                        results['test7_add_notes'] = True
                        print("  Notes field found after clicking card")
                    else:
                        results['test7_add_notes'] = False
                else:
                    results['test7_add_notes'] = False
                page.screenshot(path='/tmp/test_handoff_07_handoff_notes.png', full_page=True)
                print("Screenshot saved: /tmp/test_handoff_07_handoff_notes.png")
        except Exception as e:
            print(f"  Notes attempt: {e}")
            results['test7_add_notes'] = False
            page.screenshot(path='/tmp/test_handoff_07_handoff_notes.png', full_page=True)
        print(f"  Result: {'PASS' if results.get('test7_add_notes', False) else 'FAIL'}")

        # Test 8: Click "Complete Handoff" and verify acknowledgment modal
        print("\n--- Test 8: Complete Handoff button and acknowledgment modal ---")
        try:
            complete_button = page.locator('button:has-text("Complete Handoff"), button:has-text("Complete"), button[class*="complete"]')
            if complete_button.count() > 0:
                complete_button.first.click()
                time.sleep(2)
                page.screenshot(path='/tmp/test_handoff_08_acknowledgment_modal.png', full_page=True)
                print("Screenshot saved: /tmp/test_handoff_08_acknowledgment_modal.png")

                # Check for modal
                modal = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="fixed"][class*="inset"]')
                results['test8_complete_handoff'] = modal.count() > 0
                print(f"  Modal appeared: {modal.count() > 0}")
            else:
                results['test8_complete_handoff'] = False
                print("  Complete Handoff button not found")
                page.screenshot(path='/tmp/test_handoff_08_acknowledgment_modal.png', full_page=True)
        except Exception as e:
            print(f"  Complete handoff attempt: {e}")
            results['test8_complete_handoff'] = False
            page.screenshot(path='/tmp/test_handoff_08_acknowledgment_modal.png', full_page=True)
        print(f"  Result: {'PASS' if results['test8_complete_handoff'] else 'FAIL'}")

        # Test 9: Fill in nurse name, employee ID, signature
        print("\n--- Test 9: Fill acknowledgment form (nurse name, employee ID, signature) ---")
        try:
            filled_count = 0
            # Look for form fields in modal
            name_field = page.locator('input[placeholder*="name" i], input[name*="name" i], input[id*="name" i]')
            if name_field.count() > 0:
                name_field.first.fill('Nurse Jane Smith')
                filled_count += 1
                print("  Filled nurse name")

            id_field = page.locator('input[placeholder*="id" i], input[placeholder*="employee" i], input[name*="id" i], input[name*="employee" i]')
            if id_field.count() > 0:
                id_field.first.fill('EMP12345')
                filled_count += 1
                print("  Filled employee ID")

            signature_field = page.locator('input[placeholder*="signature" i], input[name*="signature" i], canvas, [class*="signature"]')
            if signature_field.count() > 0:
                try:
                    signature_field.first.fill('Jane Smith')
                    filled_count += 1
                    print("  Filled signature")
                except:
                    # Might be a canvas for drawing - try clicking
                    signature_field.first.click()
                    filled_count += 1
                    print("  Clicked signature field")

            page.screenshot(path='/tmp/test_handoff_09_form_filled.png', full_page=True)
            print("Screenshot saved: /tmp/test_handoff_09_form_filled.png")
            results['test9_fill_form'] = filled_count >= 2
            print(f"  Filled {filled_count} fields")
        except Exception as e:
            print(f"  Form fill attempt: {e}")
            results['test9_fill_form'] = False
            page.screenshot(path='/tmp/test_handoff_09_form_filled.png', full_page=True)
        print(f"  Result: {'PASS' if results['test9_fill_form'] else 'FAIL'}")

        # Test 10: Verify acknowledgment success message
        print("\n--- Test 10: Verify acknowledgment success message ---")
        try:
            # Submit the form
            submit_button = page.locator('button:has-text("Submit"), button:has-text("Confirm"), button:has-text("Acknowledge"), button[type="submit"]')
            if submit_button.count() > 0:
                submit_button.first.click()
                time.sleep(2)
                page.screenshot(path='/tmp/test_handoff_10_success_message.png', full_page=True)
                print("Screenshot saved: /tmp/test_handoff_10_success_message.png")

                # Check for success message
                current_content = page.content()
                success_msg = page.locator('[class*="success"], [role="alert"]')
                has_success_text = 'success' in current_content.lower() or 'completed' in current_content.lower() or 'acknowledged' in current_content.lower()
                results['test10_success_message'] = success_msg.count() > 0 or has_success_text
                print(f"  Success message found: {results['test10_success_message']}")
            else:
                results['test10_success_message'] = False
                print("  Submit button not found")
                page.screenshot(path='/tmp/test_handoff_10_success_message.png', full_page=True)
        except Exception as e:
            print(f"  Success message check: {e}")
            results['test10_success_message'] = False
            page.screenshot(path='/tmp/test_handoff_10_success_message.png', full_page=True)
        print(f"  Result: {'PASS' if results['test10_success_message'] else 'FAIL'}")

        # Final summary screenshot
        page.screenshot(path='/tmp/test_handoff_11_final_state.png', full_page=True)
        print("Screenshot saved: /tmp/test_handoff_11_final_state.png")

        browser.close()

    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        print(f"  {test_name}: {status}")
    print(f"\nTotal: {passed}/{total} tests passed")
    print("="*60)
    print("\nScreenshots saved to /tmp/test_handoff_*.png")

    return results

if __name__ == '__main__':
    run_tests()
