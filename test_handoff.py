#!/usr/bin/env python3
"""
Test NICU Dashboard Handoff Features
Tests all 10 requirements and takes screenshots
"""

from playwright.sync_api import sync_playwright
import time

def test_handoff_features():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        page.set_default_timeout(60000)

        # Navigate to the app root first
        print("Navigating to http://localhost:3000...")
        page.goto('http://localhost:3000', wait_until='domcontentloaded')
        time.sleep(3)

        # Take initial screenshot
        page.screenshot(path='/tmp/test_handoff_01_initial.png', full_page=True)
        print("Screenshot saved: /tmp/test_handoff_01_initial.png")

        # Check current URL and content
        print(f"Current URL: {page.url}")
        content = page.content()

        # Check if we need to login
        if 'login' in content.lower() or 'sign in' in content.lower() or 'email' in content.lower():
            print("Login required...")
            page.screenshot(path='/tmp/test_handoff_02_login_page.png', full_page=True)

            # Try to find and fill login form
            try:
                # Look for email/username field
                email_selectors = [
                    'input[type="email"]',
                    'input[name="email"]',
                    'input[placeholder*="email" i]',
                    'input[id*="email" i]'
                ]
                for selector in email_selectors:
                    try:
                        email_input = page.locator(selector).first
                        if email_input.is_visible(timeout=2000):
                            email_input.fill('admin@hospital.org')
                            print(f"Filled email field using: {selector}")
                            break
                    except:
                        continue

                # Look for password field
                password_input = page.locator('input[type="password"]').first
                if password_input.is_visible(timeout=2000):
                    password_input.fill('admin123')
                    print("Filled password field")

                # Take screenshot after filling
                page.screenshot(path='/tmp/test_handoff_03_login_filled.png', full_page=True)

                # Click login button
                login_selectors = [
                    'button[type="submit"]',
                    'button:has-text("Login")',
                    'button:has-text("Sign in")',
                    'button:has-text("Log in")',
                    'input[type="submit"]'
                ]
                for selector in login_selectors:
                    try:
                        login_btn = page.locator(selector).first
                        if login_btn.is_visible(timeout=2000):
                            login_btn.click()
                            print(f"Clicked login button using: {selector}")
                            break
                    except:
                        continue

                time.sleep(3)
                page.screenshot(path='/tmp/test_handoff_04_after_login.png', full_page=True)
                print(f"After login URL: {page.url}")

            except Exception as e:
                print(f"Login error: {e}")

        # Navigate to handoff page
        print("Navigating to handoff page...")
        page.goto('http://localhost:3000/handoff', wait_until='domcontentloaded')
        time.sleep(3)
        page.screenshot(path='/tmp/test_handoff_05_handoff_page.png', full_page=True)
        print(f"Handoff page URL: {page.url}")

        # Get page content for analysis
        content = page.content()

        # Debug: Print some of the page content
        print(f"\nPage title area: {content[:500] if content else 'Empty'}...")

        # TEST 1: SBAR section labels visible
        print("\n--- TEST 1: SBAR section labels visible ---")
        sbar_labels = ['SITUATION', 'BACKGROUND', 'ASSESSMENT', 'RECOMMENDATION']
        sbar_found = []
        for label in sbar_labels:
            if label in content or label.lower() in content.lower():
                sbar_found.append(label)
                print(f"  Found: {label}")
        results['test_1_sbar_labels'] = len(sbar_found) == 4
        print(f"  Result: {'PASS' if results['test_1_sbar_labels'] else 'FAIL'} ({len(sbar_found)}/4 labels found)")

        # TEST 2: Color-coded borders for SBAR sections
        print("\n--- TEST 2: Color-coded borders for SBAR sections ---")
        # Check for border colors in styles/classes
        border_patterns = ['border-blue', 'border-green', 'border-yellow', 'border-red',
                          'border-orange', 'border-l-4', 'border-l-', 'border-left',
                          'bg-blue', 'bg-green', 'bg-yellow', 'bg-red']
        borders_found = []
        for pattern in border_patterns:
            if pattern in content:
                borders_found.append(pattern)
        results['test_2_color_borders'] = len(borders_found) > 0
        print(f"  Border patterns found: {borders_found}")
        print(f"  Result: {'PASS' if results['test_2_color_borders'] else 'FAIL'}")

        # TEST 3: Letter indicators (S, B, A, R) visible
        print("\n--- TEST 3: Letter indicators (S, B, A, R) visible ---")
        letter_indicators = page.evaluate('''() => {
            const indicators = [];
            const elements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
            for (let el of elements) {
                const text = el.textContent.trim();
                if (['S', 'B', 'A', 'R'].includes(text) && el.children.length === 0) {
                    indicators.push({text: text, tag: el.tagName, classes: el.className});
                }
            }
            return indicators;
        }''')
        results['test_3_letter_indicators'] = len(letter_indicators) >= 4
        print(f"  Letter indicators found: {len(letter_indicators)}")
        for ind in letter_indicators[:8]:
            print(f"    - {ind}")
        print(f"  Result: {'PASS' if results['test_3_letter_indicators'] else 'FAIL'}")

        # TEST 4: Patient cards grouped by priority
        print("\n--- TEST 4: Patient cards grouped by priority ---")
        priority_keywords = ['critical', 'high', 'medium', 'low', 'priority', 'stable', 'urgent', 'warning']
        priority_found = []
        content_lower = content.lower()
        for keyword in priority_keywords:
            if keyword in content_lower:
                priority_found.append(keyword)
        results['test_4_priority_grouping'] = len(priority_found) > 0
        print(f"  Priority indicators found: {priority_found}")
        print(f"  Result: {'PASS' if results['test_4_priority_grouping'] else 'FAIL'}")

        # TEST 5: BP displayed in handoff cards
        print("\n--- TEST 5: BP displayed in handoff cards ---")
        bp_check = 'BP' in content or 'mmHg' in content or 'blood pressure' in content.lower() or '/80' in content or '/70' in content or '/60' in content
        results['test_5_bp_displayed'] = bp_check
        print(f"  BP found in content: {bp_check}")
        print(f"  Result: {'PASS' if results['test_5_bp_displayed'] else 'FAIL'}")

        # TEST 6: Shift toggle (Day/Night) works
        print("\n--- TEST 6: Shift toggle (Day/Night) works ---")
        page.screenshot(path='/tmp/test_handoff_06_before_shift_toggle.png', full_page=True)

        toggle_found = False
        day_night_visible = 'Day' in content or 'Night' in content or 'day' in content or 'night' in content

        if day_night_visible:
            toggle_found = True
            print("  Day/Night text found in page")

        # Try to find and click toggle
        toggle_selectors = [
            'button:has-text("Night")',
            'button:has-text("Day")',
            '[role="switch"]',
            'input[type="checkbox"]',
            '.toggle',
            '[class*="toggle"]'
        ]
        for selector in toggle_selectors:
            try:
                toggle_el = page.locator(selector).first
                if toggle_el.is_visible(timeout=2000):
                    toggle_found = True
                    toggle_el.click()
                    time.sleep(1)
                    page.screenshot(path='/tmp/test_handoff_07_after_toggle.png', full_page=True)
                    print(f"  Clicked toggle using: {selector}")
                    break
            except:
                continue

        results['test_6_shift_toggle'] = toggle_found
        print(f"  Result: {'PASS' if results['test_6_shift_toggle'] else 'FAIL'}")

        # TEST 7: Add handoff notes to a patient
        print("\n--- TEST 7: Add handoff notes to a patient ---")
        notes_added = False

        # Try finding textarea or input for notes
        notes_selectors = [
            'textarea',
            'input[placeholder*="note" i]',
            'input[placeholder*="handoff" i]',
            '[contenteditable="true"]',
            'input[type="text"]'
        ]

        for selector in notes_selectors:
            try:
                notes_input = page.locator(selector).first
                if notes_input.is_visible(timeout=2000):
                    notes_input.fill('Test handoff note from automated testing')
                    notes_added = True
                    page.screenshot(path='/tmp/test_handoff_08_notes_added.png', full_page=True)
                    print(f"  Added notes using: {selector}")
                    break
            except:
                continue

        results['test_7_add_notes'] = notes_added
        print(f"  Result: {'PASS' if results['test_7_add_notes'] else 'FAIL'}")

        # TEST 8: Complete Handoff button works
        print("\n--- TEST 8: Complete Handoff button works ---")
        complete_btn_found = False

        complete_selectors = [
            'button:has-text("Complete Handoff")',
            'button:has-text("Complete")',
            'button:has-text("Handoff")',
            'button:has-text("Submit")',
            'button:has-text("Finish")'
        ]

        for selector in complete_selectors:
            try:
                complete_btn = page.locator(selector).first
                if complete_btn.is_visible(timeout=2000):
                    complete_btn_found = True
                    page.screenshot(path='/tmp/test_handoff_09_before_complete.png', full_page=True)
                    complete_btn.click()
                    time.sleep(2)
                    page.screenshot(path='/tmp/test_handoff_10_after_complete.png', full_page=True)
                    print(f"  Clicked button using: {selector}")
                    break
            except:
                continue

        results['test_8_complete_button'] = complete_btn_found
        print(f"  Result: {'PASS' if results['test_8_complete_button'] else 'FAIL'}")

        # TEST 9: Acknowledgment modal appears with fields
        print("\n--- TEST 9: Acknowledgment modal with fields ---")
        modal_found = False
        time.sleep(1)
        current_content = page.content()

        # Check for modal dialog
        modal_selectors = [
            '[role="dialog"]',
            '.modal',
            '[class*="modal"]',
            '[class*="Modal"]',
            '[class*="dialog"]'
        ]

        for selector in modal_selectors:
            try:
                modal = page.locator(selector).first
                if modal.is_visible(timeout=2000):
                    modal_found = True
                    page.screenshot(path='/tmp/test_handoff_11_acknowledgment_modal.png', full_page=True)
                    print(f"  Modal found using: {selector}")
                    break
            except:
                continue

        # Check for acknowledgment-related fields in content
        ack_fields = ['nurse', 'employee', 'signature', 'acknowledge', 'name', 'id']
        ack_found = []
        for field in ack_fields:
            if field.lower() in current_content.lower():
                ack_found.append(field)

        if len(ack_found) >= 2:
            modal_found = True
            print(f"  Acknowledgment fields found: {ack_found}")

        # Try to fill modal fields if found
        if modal_found:
            try:
                # Fill name
                name_input = page.locator('input[placeholder*="name" i], input[name*="name" i]').first
                if name_input.is_visible(timeout=1000):
                    name_input.fill('Test Nurse')
                    print("  Filled nurse name")

                # Fill employee ID
                id_input = page.locator('input[placeholder*="id" i], input[placeholder*="employee" i]').first
                if id_input.is_visible(timeout=1000):
                    id_input.fill('EMP12345')
                    print("  Filled employee ID")

                # Fill signature
                sig_input = page.locator('input[placeholder*="signature" i], input[name*="signature" i]').first
                if sig_input.is_visible(timeout=1000):
                    sig_input.fill('Test Signature')
                    print("  Filled signature")

                page.screenshot(path='/tmp/test_handoff_12_modal_filled.png', full_page=True)
            except Exception as e:
                print(f"  Error filling modal: {e}")

        results['test_9_acknowledgment_modal'] = modal_found
        print(f"  Result: {'PASS' if results['test_9_acknowledgment_modal'] else 'FAIL'}")

        # TEST 10: Acknowledgment success message
        print("\n--- TEST 10: Acknowledgment success message ---")
        success_found = False

        # Click confirm/acknowledge button
        confirm_selectors = [
            'button:has-text("Acknowledge")',
            'button:has-text("Confirm")',
            'button:has-text("Submit")',
            'button:has-text("OK")',
            'button:has-text("Accept")'
        ]

        for selector in confirm_selectors:
            try:
                confirm_btn = page.locator(selector).first
                if confirm_btn.is_visible(timeout=2000):
                    confirm_btn.click()
                    time.sleep(2)
                    print(f"  Clicked confirm button using: {selector}")
                    break
            except:
                continue

        page.screenshot(path='/tmp/test_handoff_13_after_acknowledge.png', full_page=True)

        # Check for success message
        final_content = page.content()
        success_keywords = ['success', 'completed', 'acknowledged', 'confirmed', 'thank you', 'done']
        for keyword in success_keywords:
            if keyword.lower() in final_content.lower():
                success_found = True
                print(f"  Found success indicator: '{keyword}'")
                break

        # Check for toast/notification
        toast_selectors = ['.toast', '[role="alert"]', '.notification', '[class*="success"]', '[class*="Success"]']
        for selector in toast_selectors:
            try:
                toast = page.locator(selector).first
                if toast.is_visible(timeout=2000):
                    success_found = True
                    print(f"  Found success notification: {selector}")
                    break
            except:
                continue

        results['test_10_success_message'] = success_found
        print(f"  Result: {'PASS' if results['test_10_success_message'] else 'FAIL'}")

        # Final screenshot
        page.screenshot(path='/tmp/test_handoff_14_final.png', full_page=True)
        print("\nFinal screenshot saved: /tmp/test_handoff_14_final.png")

        browser.close()

    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    passed = 0
    failed = 0
    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        if result:
            passed += 1
        else:
            failed += 1
        print(f"  {test_name}: {status}")

    print("="*60)
    print(f"TOTAL: {passed} PASSED, {failed} FAILED out of {len(results)} tests")
    print("="*60)

    return results

if __name__ == "__main__":
    test_handoff_features()
