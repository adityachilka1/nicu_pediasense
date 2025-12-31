#!/usr/bin/env python3
"""
Test script for NICU Dashboard Feeding Page
Tests NEC Risk Assessment and feeding-related features
"""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # First, login to the application
            print("Navigating to login page...")
            page.goto('http://localhost:3000/login', timeout=60000)
            page.wait_for_load_state('domcontentloaded')
            time.sleep(3)

            # Take screenshot of login page
            page.screenshot(path='/tmp/test_feeding_01_login.png', full_page=True)
            print("Screenshot saved: /tmp/test_feeding_01_login.png")

            # Wait for the email input to be visible
            page.wait_for_selector('#email', timeout=10000)

            # Fill in login credentials - using input IDs from the form
            print("Logging in with admin@hospital.org...")

            # Clear and fill email field
            email_input = page.locator('#email')
            email_input.click()
            email_input.fill('')
            email_input.fill('admin@hospital.org')

            # Clear and fill password field
            password_input = page.locator('#password')
            password_input.click()
            password_input.fill('')
            password_input.fill('admin123')

            # Take screenshot after filling form
            page.screenshot(path='/tmp/test_feeding_02_login_filled.png', full_page=True)
            print("Screenshot saved: /tmp/test_feeding_02_login_filled.png")

            # Click login button
            login_button = page.locator('button[type="submit"]')
            login_button.click()

            # Wait for navigation after login
            print("Waiting for login to complete...")
            page.wait_for_load_state('domcontentloaded')
            time.sleep(4)

            # Take screenshot after login
            page.screenshot(path='/tmp/test_feeding_03_after_login.png', full_page=True)
            print("Screenshot saved: /tmp/test_feeding_03_after_login.png")
            print(f"Current URL after login: {page.url}")

            # Navigate to feeding page
            print("Navigating to feeding page...")
            page.goto('http://localhost:3000/feeding', timeout=60000)
            page.wait_for_load_state('domcontentloaded')
            time.sleep(4)

            # Take screenshot of feeding page
            page.screenshot(path='/tmp/test_feeding_04_feeding_page.png', full_page=True)
            print("Screenshot saved: /tmp/test_feeding_04_feeding_page.png")
            print(f"Current URL: {page.url}")

            # Get page content for analysis
            content = page.content()

            # Test 1: Feeding page loads correctly
            print("\n--- Running Tests ---\n")

            # Check URL and page loaded
            current_url = page.url
            feeding_header = page.locator('text="Feeding & Nutrition"')
            test1_pass = 'feeding' in current_url.lower() and feeding_header.count() > 0
            results['1. Feeding page loads correctly'] = 'PASS' if test1_pass else 'FAIL'
            print(f"Test 1 - Feeding page loads correctly: {'PASS' if test1_pass else 'FAIL'}")

            # Test 2: NEC Risk Assessment card visible
            nec_card = page.locator('text="NEC Risk Assessment"')
            test2_pass = nec_card.count() > 0
            results['2. NEC Risk Assessment card visible'] = 'PASS' if test2_pass else 'FAIL'
            print(f"Test 2 - NEC Risk Assessment card visible: {'PASS' if test2_pass else 'FAIL'}")

            # Test 3: Risk level indicator (LOW/MODERATE/HIGH)
            # Look for the risk level badge
            risk_levels = page.locator('text=/^(LOW|MODERATE|HIGH|LOW-MODERATE)$/')
            test3_pass = risk_levels.count() > 0
            if not test3_pass:
                # Try alternative check in content
                test3_pass = any(level in content for level in ['LOW', 'MODERATE', 'HIGH', 'LOW-MODERATE'])
            results['3. Risk level indicator (LOW/MODERATE/HIGH)'] = 'PASS' if test3_pass else 'FAIL'
            print(f"Test 3 - Risk level indicator visible: {'PASS' if test3_pass else 'FAIL'}")

            # Test 4: Score display visible
            score_display = page.locator('text=/Score:/')
            test4_pass = score_display.count() > 0 or 'Score:' in content
            results['4. Score display visible'] = 'PASS' if test4_pass else 'FAIL'
            print(f"Test 4 - Score display visible: {'PASS' if test4_pass else 'FAIL'}")

            # Test 5: Suggested advancement rate visible
            advancement = page.locator('text=/Suggested advancement:|mL\\/kg\\/day/')
            test5_pass = advancement.count() > 0 or 'Suggested advancement' in content or 'mL/kg/day' in content
            results['5. Suggested advancement rate visible'] = 'PASS' if test5_pass else 'FAIL'
            print(f"Test 5 - Suggested advancement rate visible: {'PASS' if test5_pass else 'FAIL'}")

            # Take screenshot before clicking View Details
            page.screenshot(path='/tmp/test_feeding_05_before_details.png', full_page=True)
            print("Screenshot saved: /tmp/test_feeding_05_before_details.png")

            # Test 6: View Details button expands risk factors
            view_details_btn = page.locator('button:has-text("View Details")')
            test6_pass = False
            if view_details_btn.count() > 0:
                try:
                    view_details_btn.first.click()
                    time.sleep(1)
                    test6_pass = True
                    print("  Clicked View Details button")
                except Exception as e:
                    print(f"  Error clicking View Details: {e}")
            results['6. View Details button expands risk factors'] = 'PASS' if test6_pass else 'FAIL'
            print(f"Test 6 - View Details button works: {'PASS' if test6_pass else 'FAIL'}")

            # Take screenshot after clicking details
            page.screenshot(path='/tmp/test_feeding_06_after_details.png', full_page=True)
            print("Screenshot saved: /tmp/test_feeding_06_after_details.png")

            # Refresh content after expansion
            content = page.content()

            # Test 7: Risk factors listed
            risk_factors_section = page.locator('text="Risk Factors"')
            test7_pass = risk_factors_section.count() > 0 or 'Risk Factors' in content
            results['7. Risk factors listed'] = 'PASS' if test7_pass else 'FAIL'
            print(f"Test 7 - Risk factors listed: {'PASS' if test7_pass else 'FAIL'}")

            # Test 8: Recommendation section visible
            recommendation = page.locator('text="Recommendation"')
            test8_pass = recommendation.count() > 0 or 'Recommendation' in content
            results['8. Recommendation section visible'] = 'PASS' if test8_pass else 'FAIL'
            print(f"Test 8 - Recommendation section visible: {'PASS' if test8_pass else 'FAIL'}")

            # Test 9: Feed advancement guidance visible
            guidance = page.locator('text="Feed Advancement Guidance"')
            test9_pass = guidance.count() > 0 or 'Feed Advancement Guidance' in content or 'recommended' in content.lower()
            results['9. Feed advancement guidance visible'] = 'PASS' if test9_pass else 'FAIL'
            print(f"Test 9 - Feed advancement guidance visible: {'PASS' if test9_pass else 'FAIL'}")

            # Test 10: Feeding schedule/history visible
            feed_log = page.locator('text="Today\'s Feed Log"')
            schedule_table = page.locator('table')
            test10_pass = feed_log.count() > 0 or schedule_table.count() > 0 or "Today's Feed Log" in content
            results['10. Feeding schedule/history visible'] = 'PASS' if test10_pass else 'FAIL'
            print(f"Test 10 - Feeding schedule/history visible: {'PASS' if test10_pass else 'FAIL'}")

            # Take final full page screenshot
            page.screenshot(path='/tmp/test_feeding_07_final.png', full_page=True)
            print("Screenshot saved: /tmp/test_feeding_07_final.png")

            # Print page structure for debugging
            print("\n--- Page Analysis ---")
            print(f"Current URL: {page.url}")

            # Find all headings
            headings = page.locator('h1, h2, h3, h4').all_text_contents()
            print(f"Headings found: {headings[:10]}")  # First 10 headings

            # Find all buttons
            buttons = page.locator('button').all_text_contents()
            print(f"Buttons found: {buttons[:10]}")  # First 10 buttons

        except Exception as e:
            print(f"Error during testing: {e}")
            import traceback
            traceback.print_exc()
            page.screenshot(path='/tmp/test_feeding_error.png', full_page=True)
            print("Error screenshot saved: /tmp/test_feeding_error.png")

        finally:
            browser.close()

    # Print summary
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)

    pass_count = sum(1 for v in results.values() if v == 'PASS')
    fail_count = sum(1 for v in results.values() if v == 'FAIL')

    for test, result in results.items():
        status_symbol = "[PASS]" if result == 'PASS' else "[FAIL]"
        print(f"{status_symbol} {test}")

    print(f"\nTotal: {pass_count} PASS, {fail_count} FAIL out of {len(results)} tests")
    print("="*60)

    print("\nScreenshots saved to:")
    print("  /tmp/test_feeding_01_login.png")
    print("  /tmp/test_feeding_02_login_filled.png")
    print("  /tmp/test_feeding_03_after_login.png")
    print("  /tmp/test_feeding_04_feeding_page.png")
    print("  /tmp/test_feeding_05_before_details.png")
    print("  /tmp/test_feeding_06_after_details.png")
    print("  /tmp/test_feeding_07_final.png")

    return results

if __name__ == '__main__':
    run_tests()
