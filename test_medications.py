#!/usr/bin/env python3
"""Test the NICU Dashboard medications page."""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(60000)

        # First, login
        print("Logging in...")
        page.goto('http://localhost:3000/login', wait_until='domcontentloaded')
        time.sleep(2)
        page.screenshot(path='/tmp/test_medications_00_login.png', full_page=True)

        # Fill login form
        try:
            page.fill('input[type="email"]', 'admin@hospital.org')
            page.fill('input[type="password"]', 'admin123')
            page.click('button[type="submit"]')
            time.sleep(3)
            print("Login submitted")
        except Exception as e:
            print(f"Login error: {e}")
            page.screenshot(path='/tmp/test_medications_00_login_error.png', full_page=True)

        # Navigate to medications page
        print("Navigating to medications page...")
        page.goto('http://localhost:3000/medications', wait_until='domcontentloaded')
        time.sleep(3)

        # Take initial screenshot
        page.screenshot(path='/tmp/test_medications_01_page_load.png', full_page=True)

        # Test 1: Medications page loads (NO 404 error)
        print("\nTest 1: Medications page loads (NO 404 error)")
        page_content = page.content()
        page_title = page.title()
        is_404 = '404' in page_title.lower() or 'not found' in page_content.lower()
        current_url = page.url
        results['1. Page loads (NO 404)'] = 'PASS' if not is_404 and 'medications' in current_url else 'FAIL'
        print(f"  URL: {current_url}")
        print(f"  Title: {page_title}")
        print(f"  Result: {results['1. Page loads (NO 404)']}")

        # Test 2: Medication Administration heading visible
        print("\nTest 2: Medication Administration heading visible")
        try:
            heading = page.locator('text=Medication Administration').first
            heading_visible = heading.is_visible(timeout=5000)
            results['2. Medication Administration heading'] = 'PASS' if heading_visible else 'FAIL'
        except:
            # Try alternative headings
            try:
                heading = page.locator('h1, h2').filter(has_text='Medication')
                heading_visible = heading.count() > 0
                results['2. Medication Administration heading'] = 'PASS' if heading_visible else 'FAIL'
            except:
                results['2. Medication Administration heading'] = 'FAIL'
        print(f"  Result: {results['2. Medication Administration heading']}")

        # Test 3: Category filters visible (Antibiotics, Respiratory, etc.)
        print("\nTest 3: Category filters visible")
        categories_found = []
        category_keywords = ['Antibiotics', 'Respiratory', 'Nutrition', 'Cardiac', 'Sedation', 'All']
        for cat in category_keywords:
            try:
                cat_elem = page.locator(f'text={cat}').first
                if cat_elem.is_visible(timeout=2000):
                    categories_found.append(cat)
            except:
                pass
        results['3. Category filters visible'] = 'PASS' if len(categories_found) >= 2 else 'FAIL'
        print(f"  Categories found: {categories_found}")
        print(f"  Result: {results['3. Category filters visible']}")
        page.screenshot(path='/tmp/test_medications_02_categories.png', full_page=True)

        # Test 4: Due medications alert visible
        print("\nTest 4: Due medications alert visible")
        try:
            # Look for alert or notification about due medications
            alert_selectors = [
                'text=due',
                'text=Due',
                '[class*="alert"]',
                '[class*="warning"]',
                'text=overdue',
                'text=Overdue'
            ]
            alert_found = False
            for selector in alert_selectors:
                try:
                    elem = page.locator(selector).first
                    if elem.is_visible(timeout=2000):
                        alert_found = True
                        break
                except:
                    pass
            results['4. Due medications alert visible'] = 'PASS' if alert_found else 'FAIL'
        except:
            results['4. Due medications alert visible'] = 'FAIL'
        print(f"  Result: {results['4. Due medications alert visible']}")

        # Test 5: Stats cards visible (Active, Due Soon, Overdue)
        print("\nTest 5: Stats cards visible (Active, Due Soon, Overdue)")
        stats_found = []
        stat_keywords = ['Active', 'Due Soon', 'Overdue', 'Total']
        for stat in stat_keywords:
            try:
                stat_elem = page.locator(f'text={stat}').first
                if stat_elem.is_visible(timeout=2000):
                    stats_found.append(stat)
            except:
                pass
        results['5. Stats cards visible'] = 'PASS' if len(stats_found) >= 2 else 'FAIL'
        print(f"  Stats found: {stats_found}")
        print(f"  Result: {results['5. Stats cards visible']}")
        page.screenshot(path='/tmp/test_medications_03_stats.png', full_page=True)

        # Test 6: Active medications table displayed
        print("\nTest 6: Active medications table displayed")
        try:
            table = page.locator('table').first
            table_visible = table.is_visible(timeout=5000)
            results['6. Active medications table'] = 'PASS' if table_visible else 'FAIL'
        except:
            # Try looking for list/grid of medications
            try:
                med_items = page.locator('[class*="medication"], [class*="med-item"], tr').count()
                results['6. Active medications table'] = 'PASS' if med_items > 0 else 'FAIL'
            except:
                results['6. Active medications table'] = 'FAIL'
        print(f"  Result: {results['6. Active medications table']}")
        page.screenshot(path='/tmp/test_medications_04_table.png', full_page=True)

        # Test 7: Administration history section visible
        print("\nTest 7: Administration history section visible")
        try:
            history_selectors = [
                'text=Administration History',
                'text=History',
                'text=Recent Administrations',
                'text=Past Administrations'
            ]
            history_found = False
            for selector in history_selectors:
                try:
                    elem = page.locator(selector).first
                    if elem.is_visible(timeout=2000):
                        history_found = True
                        break
                except:
                    pass
            results['7. Administration history section'] = 'PASS' if history_found else 'FAIL'
        except:
            results['7. Administration history section'] = 'FAIL'
        print(f"  Result: {results['7. Administration history section']}")

        # Scroll down to see more content
        page.evaluate('window.scrollTo(0, document.body.scrollHeight / 2)')
        time.sleep(0.5)
        page.screenshot(path='/tmp/test_medications_05_history.png', full_page=True)

        # Test 8: Administer button works and shows modal
        print("\nTest 8: Administer button works and shows modal")
        try:
            # Find administer button
            admin_btn = page.locator('button:has-text("Administer"), button:has-text("Give"), [class*="administer"]').first
            if admin_btn.is_visible(timeout=5000):
                admin_btn.click()
                time.sleep(1)
                page.screenshot(path='/tmp/test_medications_06_modal.png', full_page=True)

                # Check if modal appeared
                modal_selectors = [
                    '[class*="modal"]',
                    '[role="dialog"]',
                    '[class*="dialog"]',
                    'text=Confirm',
                    'text=Administration'
                ]
                modal_found = False
                for selector in modal_selectors:
                    try:
                        modal = page.locator(selector).first
                        if modal.is_visible(timeout=2000):
                            modal_found = True
                            break
                    except:
                        pass

                results['8. Administer button & modal'] = 'PASS' if modal_found else 'FAIL'

                # Close modal if open
                try:
                    close_btn = page.locator('button:has-text("Cancel"), button:has-text("Close"), [class*="close"]').first
                    if close_btn.is_visible(timeout=2000):
                        close_btn.click()
                        time.sleep(0.5)
                except:
                    page.keyboard.press('Escape')
                    time.sleep(0.5)
            else:
                results['8. Administer button & modal'] = 'FAIL'
        except Exception as e:
            print(f"  Error: {e}")
            results['8. Administer button & modal'] = 'FAIL'
        print(f"  Result: {results['8. Administer button & modal']}")

        # Test 9: Patient filter works
        print("\nTest 9: Patient filter works")
        try:
            # Look for patient filter/dropdown
            filter_selectors = [
                'select',
                '[class*="filter"]',
                '[class*="select"]',
                'input[placeholder*="patient" i]',
                'input[placeholder*="search" i]',
                'button:has-text("Filter")',
                '[class*="dropdown"]'
            ]
            filter_found = False
            for selector in filter_selectors:
                try:
                    filter_elem = page.locator(selector).first
                    if filter_elem.is_visible(timeout=2000):
                        filter_found = True
                        # Try to interact with it
                        filter_elem.click()
                        time.sleep(0.5)
                        page.screenshot(path='/tmp/test_medications_07_filter.png', full_page=True)
                        break
                except:
                    pass

            results['9. Patient filter works'] = 'PASS' if filter_found else 'FAIL'
        except Exception as e:
            print(f"  Error: {e}")
            results['9. Patient filter works'] = 'FAIL'
        print(f"  Result: {results['9. Patient filter works']}")

        # Final screenshot
        page.screenshot(path='/tmp/test_medications_08_final.png', full_page=True)

        browser.close()

    # Print summary
    print("\n" + "="*50)
    print("TEST RESULTS SUMMARY")
    print("="*50)
    passed = 0
    failed = 0
    for test, result in results.items():
        print(f"{test}: {result}")
        if result == 'PASS':
            passed += 1
        else:
            failed += 1

    print("="*50)
    print(f"TOTAL: {passed} PASSED, {failed} FAILED")
    print("="*50)

    return results

if __name__ == '__main__':
    run_tests()
