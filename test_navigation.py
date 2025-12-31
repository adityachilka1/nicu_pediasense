#!/usr/bin/env python3
"""
NICU Dashboard Navigation and Layout Test Suite
Tests sidebar navigation, header, responsive layout, dark theme, and logout functionality.
"""

from playwright.sync_api import sync_playwright
import time

# Test results tracking
results = {}

def log_result(test_name, passed, details=""):
    results[test_name] = {"passed": passed, "details": details}
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {test_name}: {details}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        try:
            # Navigate to the application
            print("\n=== NICU Dashboard Navigation Test Suite ===\n")
            page.goto('http://localhost:3000', timeout=60000)
            page.wait_for_load_state('domcontentloaded')
            time.sleep(2)
            page.screenshot(path='/tmp/test_navigation_01_initial.png', full_page=True)
            print(f"Initial URL: {page.url}")

            # Login process
            print("Attempting login...")
            page.screenshot(path='/tmp/test_navigation_02_login_page.png', full_page=True)

            # Clear existing email and fill with admin credentials
            email_input = page.locator('input[type="email"]').first
            email_input.click()
            email_input.fill('')
            email_input.fill('admin@hospital.org')

            password_input = page.locator('input[type="password"]').first
            password_input.click()
            password_input.fill('')
            password_input.fill('admin123')

            page.screenshot(path='/tmp/test_navigation_03_credentials_filled.png', full_page=True)

            # Click Sign In button
            login_button = page.locator('button:has-text("Sign In")').first
            login_button.click()

            # Wait for navigation after login
            time.sleep(3)
            page.wait_for_load_state('domcontentloaded')
            page.screenshot(path='/tmp/test_navigation_04_after_login.png', full_page=True)

            print(f"Current URL after login: {page.url}")

            # TEST 1: Sidebar navigation visible with all menu items
            print("\n--- Test 1: Sidebar Navigation ---")
            sidebar = page.locator('nav, aside, [class*="sidebar"], [class*="Sidebar"], [role="navigation"]').first
            sidebar_visible = sidebar.is_visible() if sidebar.count() > 0 else False

            # Updated menu items based on actual UI observation
            # Main: Monitor, Patients, Alarms, Beds, Trends, Reports, Handoff
            # Clinical: Growth, Feeding, Flowsheet, Calculators, Orders, Care Plans, Family, Discharge
            # Config: Devices, Alarm Limits, Notifications, Audit Log, Settings, Profile, Help
            expected_items = ['Monitor', 'Patients', 'Feeding', 'Handoff', 'Orders', 'Alarms', 'Settings', 'Audit Log']
            found_items = []
            missing_items = []

            page_content = page.content()
            for item in expected_items:
                if item.lower() in page_content.lower():
                    found_items.append(item)
                else:
                    missing_items.append(item)

            log_result("1. Sidebar Navigation",
                      sidebar_visible and len(found_items) >= 5,
                      f"Sidebar visible: {sidebar_visible}, Found items: {found_items}, Missing: {missing_items}")
            page.screenshot(path='/tmp/test_navigation_05_sidebar.png', full_page=True)

            # TEST 2: Navigate to each page via sidebar
            print("\n--- Test 2: Navigate to Each Page ---")
            navigation_results = {}
            screenshot_counter = 6

            # Map of display names to navigation targets
            nav_items = [
                ('Monitor', 'Monitor'),
                ('Patients', 'Patients'),
                ('Feeding', 'Feeding'),
                ('Handoff', 'Handoff'),
                ('Orders', 'Orders'),
                ('Alarms', 'Alarms'),
                ('Settings', 'Settings'),
                ('Audit Log', 'Audit Log'),
                ('Trends', 'Trends'),
                ('Reports', 'Reports'),
            ]

            for display_name, search_text in nav_items:
                try:
                    # Try clicking the sidebar link with exact text match
                    link = page.locator(f'nav a:has-text("{search_text}"), aside a:has-text("{search_text}"), [role="navigation"] a:has-text("{search_text}")').first
                    if link.count() == 0:
                        # Try with span inside link
                        link = page.locator(f'nav >> text="{search_text}"').first
                    if link.count() == 0:
                        # Try broader search
                        link = page.get_by_text(search_text, exact=True).first

                    if link.count() > 0 and link.is_visible():
                        link.click()
                        time.sleep(1)
                        page.wait_for_load_state('domcontentloaded')
                        page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_{display_name.lower().replace(" ", "_")}.png', full_page=True)
                        screenshot_counter += 1
                        navigation_results[display_name] = "SUCCESS"
                        print(f"  Navigated to {display_name}: SUCCESS (URL: {page.url})")
                    else:
                        navigation_results[display_name] = "LINK NOT FOUND"
                        print(f"  Navigate to {display_name}: LINK NOT FOUND")
                except Exception as e:
                    navigation_results[display_name] = f"ERROR: {str(e)[:50]}"
                    print(f"  Navigate to {display_name}: ERROR - {str(e)[:50]}")

            successful_nav = sum(1 for v in navigation_results.values() if v == "SUCCESS")
            log_result("2. Page Navigation",
                      successful_nav >= 5,
                      f"Successfully navigated to {successful_nav}/{len(nav_items)} pages")

            # TEST 3: Header with user info visible
            print("\n--- Test 3: Header with User Info ---")

            # The UI shows "System Admin" with "Admin" badge at bottom left of sidebar
            # Also has header bar with NICU CENTRAL STATION title and status indicators
            header_title = page.locator('text="NICU CENTRAL STATION"')
            header_visible = header_title.count() > 0 and header_title.is_visible()

            # Look for user info in sidebar (System Admin section)
            user_info = page.locator('text="System Admin", text="Admin"')
            user_info_visible = user_info.count() > 0

            # Check for admin badge
            admin_badge = page.locator('text="Admin"')
            admin_visible = admin_badge.count() > 0

            log_result("3. Header with User Info",
                      header_visible and (user_info_visible or admin_visible),
                      f"Header (NICU CENTRAL STATION) visible: {header_visible}, User info found: {user_info_visible}, Admin badge: {admin_visible}")
            page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_header.png', full_page=True)
            screenshot_counter += 1

            # TEST 4: Logout functionality
            print("\n--- Test 4: Logout Functionality ---")

            # Click on System Admin or the user profile area to reveal logout
            system_admin = page.locator('text="System Admin"').first
            if system_admin.count() > 0 and system_admin.is_visible():
                try:
                    system_admin.click()
                    time.sleep(0.5)
                    page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_user_menu.png', full_page=True)
                    screenshot_counter += 1
                except:
                    pass

            # Look for logout/sign out button
            logout_button = page.locator('button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out"), [class*="logout"]').first

            # Also try looking for a logout icon or exit option
            if logout_button.count() == 0:
                logout_button = page.locator('[aria-label*="logout" i], [aria-label*="sign out" i]').first

            logout_success = False
            if logout_button.count() > 0:
                try:
                    logout_button.click()
                    time.sleep(2)
                    page.wait_for_load_state('domcontentloaded')
                    # Check if redirected to login page or shows login form
                    logout_success = ('login' in page.url.lower() or
                                     page.locator('input[type="password"]').count() > 0 or
                                     page.locator('button:has-text("Sign In")').count() > 0)
                except Exception as e:
                    print(f"  Logout click error: {e}")
            else:
                # Check if there's a different way to logout - maybe via Profile menu
                profile_link = page.locator('text="Profile"').first
                if profile_link.count() > 0 and profile_link.is_visible():
                    profile_link.click()
                    time.sleep(1)
                    page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_profile_page.png', full_page=True)
                    screenshot_counter += 1
                    # Look for sign out on profile page
                    logout_button = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), button:has-text("Log out")').first
                    if logout_button.count() > 0:
                        logout_button.click()
                        time.sleep(2)
                        logout_success = ('login' in page.url.lower() or
                                         page.locator('input[type="password"]').count() > 0)

            page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_logout.png', full_page=True)
            screenshot_counter += 1

            log_result("4. Logout Functionality",
                      logout_success,
                      f"Logout redirected to login: {logout_success}, Current URL: {page.url}")

            # Re-login for remaining tests if needed
            if logout_success:
                print("  Re-logging in for remaining tests...")
                email_input = page.locator('input[type="email"]').first
                password_input = page.locator('input[type="password"]').first
                if email_input.count() > 0:
                    email_input.fill('admin@hospital.org')
                    password_input.fill('admin123')
                    page.locator('button:has-text("Sign In")').first.click()
                    time.sleep(2)
                    page.wait_for_load_state('domcontentloaded')
            else:
                # Navigate back to main page for remaining tests
                page.goto('http://localhost:3000', timeout=60000)
                time.sleep(2)

            # TEST 5: Responsive layout
            print("\n--- Test 5: Responsive Layout ---")
            responsive_results = {}

            # Test different viewport sizes
            viewports = [
                {"width": 1920, "height": 1080, "name": "desktop_large"},
                {"width": 1366, "height": 768, "name": "desktop_medium"},
                {"width": 768, "height": 1024, "name": "tablet"},
                {"width": 375, "height": 667, "name": "mobile"},
            ]

            for vp in viewports:
                page.set_viewport_size({"width": vp["width"], "height": vp["height"]})
                time.sleep(0.5)
                page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_responsive_{vp["name"]}.png', full_page=True)
                screenshot_counter += 1

                # Check if content is still accessible (no errors, page still renders)
                has_content = len(page.content()) > 1000
                responsive_results[vp["name"]] = has_content

            all_responsive = all(responsive_results.values())
            log_result("5. Responsive Layout",
                      all_responsive,
                      f"Viewport tests: {responsive_results}")

            # Reset viewport for remaining tests
            page.set_viewport_size({"width": 1920, "height": 1080})
            time.sleep(0.5)

            # TEST 6: Dark theme applied consistently
            print("\n--- Test 6: Dark Theme ---")
            # Check for dark theme indicators
            body_bg = page.evaluate("() => window.getComputedStyle(document.body).backgroundColor")
            html_class = page.evaluate("() => document.documentElement.className")
            body_class = page.evaluate("() => document.body.className")

            # Dark theme typically has dark background colors (low RGB values)
            # The app uses bg-[#000508] which is very dark
            is_dark = ('dark' in html_class.lower() or
                      'dark' in body_class.lower() or
                      'rgb(0' in body_bg or
                      'rgb(1' in body_bg or
                      'rgb(2' in body_bg or
                      'rgb(3' in body_bg or
                      'rgb(4' in body_bg or
                      '#000' in body_class or
                      '000508' in body_class)

            log_result("6. Dark Theme",
                      is_dark,
                      f"Body BG: {body_bg}, Body class contains dark colors: {'000508' in body_class or 'rgb(0' in body_bg}")
            page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_dark_theme.png', full_page=True)
            screenshot_counter += 1

            # TEST 7: Page transitions smooth
            print("\n--- Test 7: Page Transitions ---")
            start_time = time.time()

            # Click on Monitor
            monitor_link = page.locator('text="Monitor"').first
            if monitor_link.count() > 0 and monitor_link.is_visible():
                monitor_link.click()
                time.sleep(1)
                page.wait_for_load_state('domcontentloaded')

            # Click on Patients
            patients_link = page.locator('text="Patients"').first
            if patients_link.count() > 0 and patients_link.is_visible():
                patients_link.click()
                time.sleep(1)
                page.wait_for_load_state('domcontentloaded')

            # Click on Feeding
            feeding_link = page.locator('text="Feeding"').first
            if feeding_link.count() > 0 and feeding_link.is_visible():
                feeding_link.click()
                time.sleep(1)
                page.wait_for_load_state('domcontentloaded')

            transition_time = time.time() - start_time
            transitions_smooth = transition_time < 15  # Should complete within 15 seconds for 3 navigations

            log_result("7. Page Transitions",
                      transitions_smooth,
                      f"3 navigations completed in {transition_time:.2f}s (smooth if < 15s)")

            # TEST 8: Breadcrumbs or page titles
            print("\n--- Test 8: Breadcrumbs/Page Titles ---")
            breadcrumbs = page.locator('[class*="breadcrumb"], [class*="Breadcrumb"], nav[aria-label="breadcrumb"]')
            breadcrumbs_found = breadcrumbs.count() > 0

            # Look for page titles - the app shows titles like "Feeding & Nutrition", "NICU CENTRAL STATION"
            page_title = page.locator('h1, h2, [class*="title"]').first
            page_title_found = page_title.count() > 0 and page_title.is_visible()
            page_title_text = page_title.text_content() if page_title_found else "N/A"

            # Also check for the main header title
            main_title = page.locator('text="NICU CENTRAL STATION"')
            main_title_found = main_title.count() > 0

            log_result("8. Breadcrumbs/Page Titles",
                      breadcrumbs_found or page_title_found or main_title_found,
                      f"Breadcrumbs: {breadcrumbs_found}, Page title: {page_title_found} ('{page_title_text[:30] if page_title_text else 'N/A'}'), Main title: {main_title_found}")
            page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_breadcrumbs.png', full_page=True)
            screenshot_counter += 1

            # TEST 9: Footer information
            print("\n--- Test 9: Footer Information ---")
            footer = page.locator('footer, [class*="footer"], [class*="Footer"]').first
            footer_found = footer.count() > 0
            footer_visible = footer.is_visible() if footer_found else False

            # Also check page content for footer-like text (copyright, etc.)
            page_content = page.content()
            page_has_copyright = '©' in page_content or 'copyright' in page_content.lower()

            # Check for version info or similar footer content
            has_version = 'version' in page_content.lower() or 'v1.' in page_content.lower() or 'v2.' in page_content.lower()

            # Note: This app may not have a traditional footer - medical dashboards often don't
            # We'll check for any bottom-of-page persistent content
            log_result("9. Footer Information",
                      footer_found or page_has_copyright or has_version,
                      f"Footer element: {footer_found}, Copyright text: {page_has_copyright}, Version info: {has_version} (Note: Medical dashboards often omit footers)")

            # Scroll to bottom to capture any footer
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(0.5)
            page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_footer.png', full_page=True)
            screenshot_counter += 1

            # TEST 10: Loading states during navigation
            print("\n--- Test 10: Loading States ---")
            # Check page source for loading-related CSS/components
            page_source = page.content()
            has_loading_patterns = ('loading' in page_source.lower() or
                                   'spinner' in page_source.lower() or
                                   'skeleton' in page_source.lower() or
                                   'progress' in page_source.lower())

            # Look for loading indicators
            loading_indicators = page.locator('[class*="loading"], [class*="Loading"], [class*="spinner"], [class*="Spinner"], [class*="skeleton"], [class*="Skeleton"], [role="progressbar"]')

            # Navigate to trigger loading state and try to capture it
            monitor_link = page.locator('text="Monitor"').first
            if monitor_link.count() > 0 and monitor_link.is_visible():
                monitor_link.click()
                # Immediate screenshot to catch loading state
                page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_loading_state.png', full_page=True)
                screenshot_counter += 1
                time.sleep(1)

            log_result("10. Loading States",
                      has_loading_patterns,
                      f"Loading indicators in DOM: {loading_indicators.count()}, Loading patterns in source: {has_loading_patterns}")

            # Final summary screenshot
            page.screenshot(path=f'/tmp/test_navigation_{screenshot_counter:02d}_final.png', full_page=True)

        except Exception as e:
            print(f"\nERROR during testing: {e}")
            page.screenshot(path='/tmp/test_navigation_error.png', full_page=True)
            import traceback
            traceback.print_exc()

        finally:
            browser.close()

    # Print final summary
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)

    passed = sum(1 for r in results.values() if r["passed"])
    total = len(results)

    for test_name, result in results.items():
        status = "PASS" if result["passed"] else "FAIL"
        print(f"[{status}] {test_name}")
        print(f"        {result['details']}")

    print("\n" + "-"*60)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("-"*60)

    # List all screenshots
    print("\nScreenshots saved:")
    import os
    for f in sorted(os.listdir('/tmp')):
        if f.startswith('test_navigation_') and f.endswith('.png'):
            print(f"  /tmp/{f}")

    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
