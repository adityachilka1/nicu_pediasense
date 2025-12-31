#!/usr/bin/env python3
"""Test the NICU Dashboard Orders page functionality."""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(15000)

        # Login first
        print("Logging in...")
        page.goto('http://localhost:3000/login', wait_until='domcontentloaded')
        time.sleep(2)
        page.screenshot(path='/tmp/test_orders_00_login.png', full_page=True)

        # Fill login form - clear first then fill
        try:
            # Find and clear email input, then fill
            email_input = page.locator('input[type="email"], input[name="email"], input#email').first
            password_input = page.locator('input[type="password"], input[name="password"], input#password').first

            if email_input.is_visible():
                email_input.click()
                email_input.fill('')  # Clear first
                email_input.fill('admin@hospital.org')
                print(f"Email filled: admin@hospital.org")

            if password_input.is_visible():
                password_input.click()
                password_input.fill('')  # Clear first
                password_input.fill('admin123')
                print(f"Password filled")

            time.sleep(1)
            page.screenshot(path='/tmp/test_orders_01_form_filled.png', full_page=True)

            submit_btn = page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]').first
            if submit_btn.is_visible():
                print("Clicking Sign In button...")
                submit_btn.click()

            time.sleep(4)
            page.screenshot(path='/tmp/test_orders_02_after_login.png', full_page=True)

            # Check if login was successful by looking at URL
            current_url = page.url
            print(f"Current URL after login: {current_url}")

            if 'login' not in current_url:
                print("Login successful - redirected away from login page")
            else:
                print("Still on login page - checking for errors")
                page_content = page.content()
                if 'error' in page_content.lower() or 'invalid' in page_content.lower():
                    print("Login error detected")

        except Exception as e:
            print(f"Login error: {e}")
            page.screenshot(path='/tmp/test_orders_02_login_error.png', full_page=True)

        # Navigate to Orders page
        print("\n1. Testing Orders page loads correctly...")
        page.goto('http://localhost:3000/orders', wait_until='domcontentloaded')
        time.sleep(3)
        page.screenshot(path='/tmp/test_orders_03_page_load.png', full_page=True)

        content = page.content().lower()
        current_url = page.url
        print(f"Orders page URL: {current_url}")

        # Check if orders page loaded or redirected to login
        if 'login' in current_url:
            results['1. Orders page loads correctly'] = 'FAIL - Redirected to login (authentication failed)'
            print("FAIL - Redirected to login page")
            # Try to see the actual orders page content for analysis
            print("Page appears to require authentication")
        elif 'order' in content or 'medication' in content or 'lab' in content:
            results['1. Orders page loads correctly'] = 'PASS'
            print("PASS - Orders page loaded")
        else:
            results['1. Orders page loads correctly'] = 'FAIL - Orders content not found'
            print("FAIL - Orders content not found")

        # 2. Test Active orders list displayed
        print("\n2. Testing Active orders list displayed...")
        active_orders = page.locator('text=/active/i, text=/pending/i').count()
        table_rows = page.locator('table tr, [class*="row"], [class*="item"], [class*="card"]').count()

        if active_orders > 0 or table_rows > 2:
            results['2. Active orders list displayed'] = 'PASS'
            print(f"PASS - Found {active_orders} active order elements, {table_rows} rows")
        else:
            results['2. Active orders list displayed'] = 'FAIL - No active orders list found'
            print("FAIL - No active orders list found")

        page.screenshot(path='/tmp/test_orders_04_active_orders.png', full_page=True)

        # 3. Test Order categories
        print("\n3. Testing Order categories (Medications, Labs, Imaging, etc.)...")
        categories_found = []
        category_keywords = ['medication', 'lab', 'imaging', 'diet', 'consult', 'nursing', 'procedure', 'iv', 'fluid']

        for keyword in category_keywords:
            if keyword in content:
                categories_found.append(keyword)

        # Also check for tabs or category buttons
        category_elements = page.locator('button, [role="tab"], [class*="tab"], [class*="category"]').all()
        for elem in category_elements:
            try:
                text = elem.inner_text().lower()
                for keyword in category_keywords:
                    if keyword in text and keyword not in categories_found:
                        categories_found.append(keyword)
            except:
                pass

        if len(categories_found) >= 2:
            results['3. Order categories'] = f'PASS - Found: {", ".join(categories_found)}'
            print(f"PASS - Found categories: {categories_found}")
        elif len(categories_found) == 1:
            results['3. Order categories'] = f'PARTIAL - Found: {", ".join(categories_found)}'
            print(f"PARTIAL - Found categories: {categories_found}")
        else:
            results['3. Order categories'] = 'FAIL - No categories found'
            print("FAIL - No categories found")

        page.screenshot(path='/tmp/test_orders_05_categories.png', full_page=True)

        # 4. Test Order status indicators
        print("\n4. Testing Order status indicators (Pending, Active, Completed)...")
        statuses_found = []
        status_keywords = ['pending', 'active', 'completed', 'discontinued', 'stat', 'routine', 'scheduled']

        for keyword in status_keywords:
            if keyword in content:
                statuses_found.append(keyword)

        # Check for status badges/indicators
        status_elements = page.locator('[class*="status"], [class*="badge"], [class*="chip"], [class*="tag"]').all()
        for elem in status_elements:
            try:
                text = elem.inner_text().lower()
                for keyword in status_keywords:
                    if keyword in text and keyword not in statuses_found:
                        statuses_found.append(keyword)
            except:
                pass

        if len(statuses_found) >= 2:
            results['4. Order status indicators'] = f'PASS - Found: {", ".join(statuses_found)}'
            print(f"PASS - Found statuses: {statuses_found}")
        elif len(statuses_found) == 1:
            results['4. Order status indicators'] = f'PARTIAL - Found: {", ".join(statuses_found)}'
            print(f"PARTIAL - Found statuses: {statuses_found}")
        else:
            results['4. Order status indicators'] = 'FAIL - No status indicators found'
            print("FAIL - No status indicators found")

        page.screenshot(path='/tmp/test_orders_06_statuses.png', full_page=True)

        # 5. Test New order creation capability
        print("\n5. Testing New order creation capability...")
        new_order_selectors = [
            'button:has-text("New Order")',
            'button:has-text("Add Order")',
            'button:has-text("Create Order")',
            'button:has-text("+ New")',
            'button:has-text("New")',
            'a:has-text("New Order")',
            '[class*="add"] button',
            'button[class*="create"]',
            'button[class*="add"]',
            'button >> text=/new/i'
        ]

        new_order_btn = None
        for selector in new_order_selectors:
            try:
                btn = page.locator(selector).first
                if btn.is_visible(timeout=1000):
                    new_order_btn = btn
                    print(f"Found new order button with selector: {selector}")
                    break
            except:
                pass

        try:
            if new_order_btn:
                new_order_btn.click()
                time.sleep(2)
                page.screenshot(path='/tmp/test_orders_07_new_order.png', full_page=True)

                # Check if modal/form appeared
                modal_content = page.content().lower()
                if any(kw in modal_content for kw in ['order type', 'select medication', 'new order', 'create order', 'add order']):
                    results['5. New order creation capability'] = 'PASS'
                    print("PASS - New order form/modal opened")
                else:
                    results['5. New order creation capability'] = 'PARTIAL - Button clicked but form not confirmed'
                    print("PARTIAL - Button clicked but form not confirmed")

                # Close modal if present
                try:
                    close_btn = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label*="close"]').first
                    if close_btn.is_visible(timeout=1000):
                        close_btn.click()
                        time.sleep(0.5)
                except:
                    page.keyboard.press('Escape')
                    time.sleep(0.5)
            else:
                results['5. New order creation capability'] = 'FAIL - New order button not found'
                print("FAIL - New order button not found")
                page.screenshot(path='/tmp/test_orders_07_new_order.png', full_page=True)
        except Exception as e:
            results['5. New order creation capability'] = f'FAIL - {str(e)}'
            print(f"FAIL - {e}")
            page.screenshot(path='/tmp/test_orders_07_new_order.png', full_page=True)

        # 6. Test Order details modal
        print("\n6. Testing Order details modal...")
        page.goto('http://localhost:3000/orders', wait_until='domcontentloaded')
        time.sleep(2)

        # Try clicking on an order row/item
        order_selectors = [
            'table tbody tr',
            '[class*="order-item"]',
            '[class*="order-row"]',
            '[class*="list-item"]',
            '[class*="order"] [class*="card"]'
        ]

        order_item = None
        for selector in order_selectors:
            try:
                items = page.locator(selector).all()
                if len(items) > 0:
                    order_item = items[0]
                    print(f"Found order item with selector: {selector}")
                    break
            except:
                pass

        try:
            if order_item:
                order_item.click()
                time.sleep(2)
                page.screenshot(path='/tmp/test_orders_08_order_details.png', full_page=True)

                modal_content = page.content().lower()
                if any(kw in modal_content for kw in ['detail', 'dose', 'frequency', 'ordered by', 'instructions']):
                    results['6. Order details modal'] = 'PASS'
                    print("PASS - Order details displayed")
                else:
                    results['6. Order details modal'] = 'PARTIAL - Clicked but details not confirmed'
                    print("PARTIAL - Clicked but details not confirmed")

                # Close modal
                page.keyboard.press('Escape')
                time.sleep(0.5)
            else:
                # Try clicking view button
                view_btn = page.locator('button:has-text("View"), button:has-text("Details")').first
                try:
                    if view_btn.is_visible(timeout=1000):
                        view_btn.click()
                        time.sleep(2)
                        page.screenshot(path='/tmp/test_orders_08_order_details.png', full_page=True)
                        results['6. Order details modal'] = 'PASS'
                        print("PASS - Order details opened via button")
                    else:
                        results['6. Order details modal'] = 'FAIL - No order items to click'
                        print("FAIL - No order items to click")
                except:
                    results['6. Order details modal'] = 'FAIL - No order items to click'
                    print("FAIL - No order items to click")
        except Exception as e:
            results['6. Order details modal'] = f'FAIL - {str(e)}'
            print(f"FAIL - {e}")
            page.screenshot(path='/tmp/test_orders_08_order_details.png', full_page=True)

        # 7. Test Filter by order type
        print("\n7. Testing Filter by order type...")
        page.goto('http://localhost:3000/orders', wait_until='domcontentloaded')
        time.sleep(2)

        # Look for filter dropdown or tabs
        filter_found = False

        # Check for select/dropdown
        try:
            type_filter = page.locator('select').first
            if type_filter.is_visible(timeout=1000):
                type_filter.click()
                time.sleep(0.5)
                page.screenshot(path='/tmp/test_orders_09_filter_type.png', full_page=True)
                filter_found = True
                results['7. Filter by order type'] = 'PASS'
                print("PASS - Order type filter found")
        except:
            pass

        if not filter_found:
            # Check for tabs
            try:
                type_tabs = page.locator('[role="tab"], button[class*="tab"]').all()
                if len(type_tabs) > 0:
                    type_tabs[0].click()
                    time.sleep(1)
                    page.screenshot(path='/tmp/test_orders_09_filter_type.png', full_page=True)
                    filter_found = True
                    results['7. Filter by order type'] = 'PASS - Using tabs for filtering'
                    print("PASS - Using tabs for filtering")
            except:
                pass

        if not filter_found:
            # Check for any filter mechanism
            filters = page.locator('[class*="filter"], [class*="Filter"]').count()
            if filters > 0:
                results['7. Filter by order type'] = 'PARTIAL - Filter elements present'
                print("PARTIAL - Filter elements present")
            else:
                results['7. Filter by order type'] = 'FAIL - No type filter found'
                print("FAIL - No type filter found")
            page.screenshot(path='/tmp/test_orders_09_filter_type.png', full_page=True)

        # 8. Test Filter by patient
        print("\n8. Testing Filter by patient...")
        patient_filter_found = False

        # Check for patient filter dropdown
        try:
            patient_select = page.locator('select[name*="patient" i], select[id*="patient" i]').first
            if patient_select.is_visible(timeout=1000):
                patient_select.click()
                time.sleep(0.5)
                page.screenshot(path='/tmp/test_orders_10_filter_patient.png', full_page=True)
                patient_filter_found = True
                results['8. Filter by patient'] = 'PASS'
                print("PASS - Patient filter found")
        except:
            pass

        if not patient_filter_found:
            # Check for search input
            try:
                patient_search = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="patient" i]').first
                if patient_search.is_visible(timeout=1000):
                    patient_search.fill('Baby')
                    time.sleep(1)
                    page.screenshot(path='/tmp/test_orders_10_filter_patient.png', full_page=True)
                    patient_filter_found = True
                    results['8. Filter by patient'] = 'PASS - Search by patient available'
                    print("PASS - Search by patient available")
            except:
                pass

        if not patient_filter_found:
            results['8. Filter by patient'] = 'FAIL - No patient filter found'
            print("FAIL - No patient filter found")
            page.screenshot(path='/tmp/test_orders_10_filter_patient.png', full_page=True)

        # 9. Test Order history
        print("\n9. Testing Order history...")
        page.goto('http://localhost:3000/orders', wait_until='domcontentloaded')
        time.sleep(2)

        history_found = False

        # Look for history link/button
        history_selectors = [
            'button:has-text("History")',
            'a:has-text("History")',
            '[role="tab"]:has-text("Completed")',
            'button:has-text("Completed")',
            '[role="tab"]:has-text("Past")'
        ]

        for selector in history_selectors:
            try:
                history_elem = page.locator(selector).first
                if history_elem.is_visible(timeout=1000):
                    history_elem.click()
                    time.sleep(1)
                    page.screenshot(path='/tmp/test_orders_11_history.png', full_page=True)
                    history_found = True
                    results['9. Order history'] = 'PASS'
                    print("PASS - Order history accessible")
                    break
            except:
                pass

        if not history_found:
            # Check if history is shown inline
            if 'history' in content or 'completed' in content or 'past' in content:
                results['9. Order history'] = 'PARTIAL - History content present on page'
                print("PARTIAL - History content present on page")
            else:
                results['9. Order history'] = 'FAIL - No history section found'
                print("FAIL - No history section found")
            page.screenshot(path='/tmp/test_orders_11_history.png', full_page=True)

        # 10. Test Discontinue/modify order functionality
        print("\n10. Testing Discontinue/modify order functionality...")
        page.goto('http://localhost:3000/orders', wait_until='domcontentloaded')
        time.sleep(2)

        action_found = False

        # Look for discontinue/modify buttons
        action_selectors = [
            'button:has-text("Discontinue")',
            'button:has-text("DC")',
            'button:has-text("Stop")',
            'button:has-text("Modify")',
            'button:has-text("Edit")',
            'button:has-text("Change")',
            '[aria-label*="discontinue" i]',
            '[aria-label*="edit" i]',
            '[aria-label*="modify" i]'
        ]

        for selector in action_selectors:
            try:
                action_btn = page.locator(selector).first
                if action_btn.is_visible(timeout=1000):
                    page.screenshot(path='/tmp/test_orders_12_discontinue.png', full_page=True)
                    action_found = True
                    results['10. Discontinue/modify order'] = f'PASS - {selector.split(":")[-1].strip("\")")} button available'
                    print(f"PASS - Action button found: {selector}")
                    break
            except:
                pass

        if not action_found:
            # Check for action menu (three dots, more options)
            try:
                action_menu = page.locator('[aria-haspopup="menu"], button[class*="more"], button[class*="action"], [class*="dropdown"]').first
                if action_menu.is_visible(timeout=1000):
                    action_menu.click()
                    time.sleep(0.5)
                    page.screenshot(path='/tmp/test_orders_12_discontinue.png', full_page=True)
                    menu_content = page.content().lower()
                    if any(kw in menu_content for kw in ['discontinue', 'modify', 'edit', 'stop', 'cancel']):
                        action_found = True
                        results['10. Discontinue/modify order'] = 'PASS - Actions in menu'
                        print("PASS - Actions in menu")
                    else:
                        results['10. Discontinue/modify order'] = 'PARTIAL - Action menu present'
                        print("PARTIAL - Action menu present")
                        action_found = True
            except:
                pass

        if not action_found:
            results['10. Discontinue/modify order'] = 'FAIL - No discontinue/modify found'
            print("FAIL - No discontinue/modify found")
            page.screenshot(path='/tmp/test_orders_12_discontinue.png', full_page=True)

        # Final screenshot
        page.goto('http://localhost:3000/orders', wait_until='domcontentloaded')
        time.sleep(2)
        page.screenshot(path='/tmp/test_orders_13_final.png', full_page=True)

        browser.close()

    return results


if __name__ == '__main__':
    print("=" * 60)
    print("NICU Dashboard - Orders Page Test Suite")
    print("=" * 60)

    results = run_tests()

    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)

    passed = 0
    failed = 0
    partial = 0

    for test, result in results.items():
        status = result.split(' - ')[0] if ' - ' in result else result
        print(f"{test}: {result}")
        if 'PASS' in status:
            passed += 1
        elif 'PARTIAL' in status:
            partial += 1
        else:
            failed += 1

    print("\n" + "-" * 60)
    print(f"PASSED: {passed} | PARTIAL: {partial} | FAILED: {failed}")
    print(f"Total: {passed + partial + failed} tests")
    print("=" * 60)
    print("\nScreenshots saved to /tmp/test_orders_*.png")
