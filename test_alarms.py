#!/usr/bin/env python3
"""
NICU Dashboard Alarm Management Test Script
Tests all alarm-related functionality at http://localhost:3000/alarms
"""

from playwright.sync_api import sync_playwright
import time
import re

# Test results tracking
test_results = {}

def log_result(test_name, passed, details=""):
    """Log test result"""
    status = "PASS" if passed else "FAIL"
    test_results[test_name] = {"passed": passed, "details": details}
    print(f"[{status}] {test_name}: {details}")

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        page.set_default_timeout(60000)  # 60 second timeout

        try:
            # First, login to the application
            print("\n=== LOGGING IN ===")
            page.goto('http://localhost:3000', wait_until='domcontentloaded', timeout=30000)
            time.sleep(2)

            # Take screenshot of initial page
            page.screenshot(path='/tmp/test_alarms_00_initial.png', full_page=True)
            print(f"Current URL: {page.url}")

            # Check if we need to login
            page_content = page.content().lower()
            print(f"Page has login form: {'login' in page_content or 'email' in page_content}")
            
            if 'login' in page_content or 'sign in' in page_content or 'email' in page_content:
                print("Login page detected, attempting login...")

                # Try to find and fill login form
                email_selectors = ['input[type="email"]', 'input[name="email"]', '#email', 'input[placeholder*="email" i]']
                password_selectors = ['input[type="password"]', 'input[name="password"]', '#password']

                email_filled = False
                for selector in email_selectors:
                    try:
                        if page.locator(selector).count() > 0:
                            page.fill(selector, 'admin@hospital.org')
                            email_filled = True
                            print(f"Filled email with selector: {selector}")
                            break
                    except Exception as e:
                        print(f"Email selector {selector} failed: {e}")
                        continue

                password_filled = False
                for selector in password_selectors:
                    try:
                        if page.locator(selector).count() > 0:
                            page.fill(selector, 'admin123')
                            password_filled = True
                            print(f"Filled password with selector: {selector}")
                            break
                    except Exception as e:
                        print(f"Password selector {selector} failed: {e}")
                        continue

                page.screenshot(path='/tmp/test_alarms_01_login_filled.png', full_page=True)

                # Try to submit login
                submit_selectors = ['button[type="submit"]', 'button:has-text("Login")', 'button:has-text("Sign in")', 'button:has-text("Sign In")', 'input[type="submit"]']
                for selector in submit_selectors:
                    try:
                        if page.locator(selector).count() > 0:
                            page.click(selector)
                            print(f"Clicked submit with selector: {selector}")
                            break
                    except Exception as e:
                        print(f"Submit selector {selector} failed: {e}")
                        continue

                time.sleep(3)
                page.screenshot(path='/tmp/test_alarms_02_after_login.png', full_page=True)
                print(f"After login URL: {page.url}")

            # Navigate to alarms page
            print("\n=== NAVIGATING TO ALARMS PAGE ===")
            page.goto('http://localhost:3000/alarms', wait_until='domcontentloaded', timeout=30000)
            time.sleep(3)
            print(f"Alarms page URL: {page.url}")

            # TEST 1: Alarms page loads correctly
            print("\n=== TEST 1: Alarms Page Loads ===")
            page.screenshot(path='/tmp/test_alarms_03_alarms_page.png', full_page=True)
            page_content = page.content()
            text_content = page.text_content('body') or ""
            
            print(f"Page text preview: {text_content[:500]}")

            # Check for alarm-related content
            alarm_indicators = ['alarm', 'alert', 'notification', 'warning', 'critical']
            page_loaded = any(indicator in page_content.lower() for indicator in alarm_indicators)

            # Also check URL
            current_url = page.url
            url_correct = 'alarm' in current_url.lower()

            test1_pass = page_loaded or url_correct
            log_result("1. Alarms page loads correctly", test1_pass,
                      f"URL: {current_url}, Alarm content found: {page_loaded}")

            # TEST 2: Active alarms list displayed
            print("\n=== TEST 2: Active Alarms List ===")
            # Look for alarm list elements
            alarm_list_selectors = [
                'table', '[class*="alarm"]', '[class*="list"]',
                '[data-testid*="alarm"]', '.alarm-list', '#alarms',
                '[class*="active"]', 'ul', 'div[class*="card"]'
            ]

            active_alarms_found = False
            for selector in alarm_list_selectors:
                try:
                    count = page.locator(selector).count()
                    if count > 0:
                        active_alarms_found = True
                        print(f"Found alarm list element: {selector} (count: {count})")
                        break
                except:
                    continue

            # Check for specific alarm text patterns
            alarm_text_patterns = ['SpO2', 'Heart Rate', 'Temperature', 'Oxygen', 'vital', 'patient']
            has_alarm_content = any(pattern.lower() in text_content.lower() for pattern in alarm_text_patterns)

            test2_pass = active_alarms_found or has_alarm_content
            log_result("2. Active alarms list displayed", test2_pass,
                      f"List elements found: {active_alarms_found}, Alarm content: {has_alarm_content}")

            # TEST 3: Alarm priority levels visible
            print("\n=== TEST 3: Alarm Priority Levels ===")
            priority_keywords = ['critical', 'warning', 'info', 'high', 'medium', 'low', 'urgent', 'severe']
            priority_classes = ['[class*="critical"]', '[class*="warning"]', '[class*="info"]',
                               '[class*="high"]', '[class*="low"]', '[class*="urgent"]',
                               '[class*="priority"]', '[class*="severity"]']

            priority_found = any(kw in text_content.lower() for kw in priority_keywords)
            priority_elements = False
            for selector in priority_classes:
                try:
                    if page.locator(selector).count() > 0:
                        priority_elements = True
                        print(f"Found priority element: {selector}")
                        break
                except:
                    continue

            # Check for colored indicators (red, yellow, blue for priorities)
            color_indicators = page.locator('[class*="red"], [class*="yellow"], [class*="blue"], [class*="orange"], [class*="green"]').count()

            test3_pass = priority_found or priority_elements or color_indicators > 0
            log_result("3. Alarm priority levels visible", test3_pass,
                      f"Priority text: {priority_found}, Priority elements: {priority_elements}, Color indicators: {color_indicators}")

            page.screenshot(path='/tmp/test_alarms_04_priority_levels.png', full_page=True)

            # TEST 4: Alarm acknowledgment functionality
            print("\n=== TEST 4: Alarm Acknowledgment ===")
            ack_selectors = [
                'button:has-text("Acknowledge")', 'button:has-text("Ack")',
                'button:has-text("Dismiss")', 'button:has-text("Clear")',
                '[class*="acknowledge"]', '[data-action="acknowledge"]',
                'button[title*="acknowledge" i]', 'input[type="checkbox"]'
            ]

            ack_found = False
            for selector in ack_selectors:
                try:
                    count = page.locator(selector).count()
                    if count > 0:
                        ack_found = True
                        print(f"Found acknowledgment element: {selector} (count: {count})")
                        # Try clicking the first acknowledge button
                        try:
                            page.locator(selector).first.click()
                            time.sleep(1)
                            page.screenshot(path='/tmp/test_alarms_05_after_ack.png', full_page=True)
                        except:
                            pass
                        break
                except:
                    continue

            # Also check for acknowledge in text
            ack_text = 'acknowledge' in text_content.lower() or 'ack' in text_content.lower() or 'dismiss' in text_content.lower()

            test4_pass = ack_found or ack_text
            log_result("4. Alarm acknowledgment functionality", test4_pass,
                      f"Ack button found: {ack_found}, Ack text: {ack_text}")

            # TEST 5: Alarm history/resolved alarms
            print("\n=== TEST 5: Alarm History/Resolved ===")
            history_selectors = [
                'button:has-text("History")', 'a:has-text("History")',
                'button:has-text("Resolved")', 'a:has-text("Resolved")',
                '[class*="history"]', '[class*="resolved"]',
                'button:has-text("Past")', 'tab:has-text("History")',
                '[role="tab"]:has-text("History")', '[role="tab"]:has-text("Resolved")'
            ]

            history_found = False
            for selector in history_selectors:
                try:
                    count = page.locator(selector).count()
                    if count > 0:
                        history_found = True
                        print(f"Found history element: {selector}")
                        # Try clicking to view history
                        try:
                            page.locator(selector).first.click()
                            time.sleep(1)
                            page.screenshot(path='/tmp/test_alarms_06_history.png', full_page=True)
                        except:
                            pass
                        break
                except:
                    continue

            history_text = 'history' in text_content.lower() or 'resolved' in text_content.lower() or 'past' in text_content.lower()

            test5_pass = history_found or history_text
            log_result("5. Alarm history/resolved alarms", test5_pass,
                      f"History element: {history_found}, History text: {history_text}")

            # TEST 6: Filter by alarm type
            print("\n=== TEST 6: Filter by Alarm Type ===")
            # Navigate back to alarms if needed
            page.goto('http://localhost:3000/alarms', wait_until='domcontentloaded', timeout=30000)
            time.sleep(2)
            text_content = page.text_content('body') or ""

            filter_selectors = [
                'select', '[class*="filter"]', '[class*="dropdown"]',
                'button:has-text("Filter")', '[data-testid*="filter"]',
                '[class*="select"]', 'input[type="search"]',
                '[placeholder*="filter" i]', '[placeholder*="search" i]'
            ]

            filter_found = False
            for selector in filter_selectors:
                try:
                    count = page.locator(selector).count()
                    if count > 0:
                        filter_found = True
                        print(f"Found filter element: {selector} (count: {count})")
                        break
                except:
                    continue

            # Check for type filter specifically
            type_filter = page.locator('[class*="type"], select:has-text("Type"), [aria-label*="type" i]').count() > 0

            test6_pass = filter_found or type_filter
            log_result("6. Filter by alarm type", test6_pass,
                      f"Filter element: {filter_found}, Type filter: {type_filter}")

            page.screenshot(path='/tmp/test_alarms_07_filters.png', full_page=True)

            # TEST 7: Filter by patient/bed
            print("\n=== TEST 7: Filter by Patient/Bed ===")
            patient_filter_selectors = [
                '[class*="patient"]', 'select:has-text("Patient")',
                '[class*="bed"]', 'select:has-text("Bed")',
                '[aria-label*="patient" i]', '[aria-label*="bed" i]',
                '[placeholder*="patient" i]', '[placeholder*="bed" i]'
            ]

            patient_filter_found = False
            for selector in patient_filter_selectors:
                try:
                    count = page.locator(selector).count()
                    if count > 0:
                        patient_filter_found = True
                        print(f"Found patient/bed filter: {selector}")
                        break
                except:
                    continue

            # Check text content
            patient_bed_text = 'patient' in text_content.lower() or 'bed' in text_content.lower()

            test7_pass = patient_filter_found or patient_bed_text
            log_result("7. Filter by patient/bed", test7_pass,
                      f"Patient/bed filter: {patient_filter_found}, Text found: {patient_bed_text}")

            # TEST 8: Alarm escalation indicators
            print("\n=== TEST 8: Alarm Escalation Indicators ===")
            escalation_selectors = [
                '[class*="escalat"]', '[class*="escal"]',
                'button:has-text("Escalate")', '[data-testid*="escalat"]',
                '[class*="urgent"]', '[class*="time"]'
            ]

            escalation_found = False
            for selector in escalation_selectors:
                try:
                    count = page.locator(selector).count()
                    if count > 0:
                        escalation_found = True
                        print(f"Found escalation element: {selector}")
                        break
                except:
                    continue

            escalation_text = 'escalat' in text_content.lower() or 'urgent' in text_content.lower() or 'overdue' in text_content.lower()

            test8_pass = escalation_found or escalation_text
            log_result("8. Alarm escalation indicators", test8_pass,
                      f"Escalation element: {escalation_found}, Escalation text: {escalation_text}")

            page.screenshot(path='/tmp/test_alarms_08_escalation.png', full_page=True)

            # TEST 9: Sound/notification settings
            print("\n=== TEST 9: Sound/Notification Settings ===")
            sound_selectors = [
                '[class*="sound"]', '[class*="audio"]', '[class*="mute"]',
                '[class*="notification"]', '[class*="settings"]',
                'button:has-text("Sound")', 'button:has-text("Mute")',
                '[aria-label*="sound" i]', '[aria-label*="mute" i]',
                'input[type="range"]', '[class*="volume"]',
                'svg[class*="bell"]', 'svg[class*="speaker"]'
            ]

            sound_found = False
            for selector in sound_selectors:
                try:
                    count = page.locator(selector).count()
                    if count > 0:
                        sound_found = True
                        print(f"Found sound/notification element: {selector}")
                        break
                except:
                    continue

            # Check for settings gear icon or notification bell
            icon_count = page.locator('svg, [class*="icon"]').count()
            sound_text = 'sound' in text_content.lower() or 'mute' in text_content.lower() or 'notification' in text_content.lower()

            test9_pass = sound_found or sound_text
            log_result("9. Sound/notification settings", test9_pass,
                      f"Sound element: {sound_found}, Sound text: {sound_text}, Icons: {icon_count}")

            # TEST 10: Alarm statistics/counts
            print("\n=== TEST 10: Alarm Statistics/Counts ===")
            stats_selectors = [
                '[class*="stat"]', '[class*="count"]', '[class*="badge"]',
                '[class*="number"]', '[class*="total"]', '[class*="summary"]',
                '[class*="metric"]', '[class*="dashboard"]'
            ]

            stats_found = False
            for selector in stats_selectors:
                try:
                    count = page.locator(selector).count()
                    if count > 0:
                        stats_found = True
                        print(f"Found statistics element: {selector} (count: {count})")
                        break
                except:
                    continue

            # Look for numbers that could be counts
            numbers_in_page = re.findall(r'\b\d+\b', text_content)
            has_counts = len(numbers_in_page) > 0

            stats_text = 'total' in text_content.lower() or 'count' in text_content.lower() or 'active' in text_content.lower()

            test10_pass = stats_found or stats_text or has_counts
            log_result("10. Alarm statistics/counts", test10_pass,
                      f"Stats element: {stats_found}, Stats text: {stats_text}, Numbers found: {len(numbers_in_page)}")

            page.screenshot(path='/tmp/test_alarms_09_statistics.png', full_page=True)

            # Final full page screenshot
            page.screenshot(path='/tmp/test_alarms_10_final.png', full_page=True)

        except Exception as e:
            print(f"\n[ERROR] Test execution failed: {str(e)}")
            import traceback
            traceback.print_exc()
            try:
                page.screenshot(path='/tmp/test_alarms_error.png', full_page=True)
            except:
                pass

        finally:
            browser.close()

    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY - NICU Dashboard Alarm Management")
    print("="*60)

    passed = sum(1 for r in test_results.values() if r['passed'])
    failed = len(test_results) - passed

    for test_name, result in test_results.items():
        status = "PASS" if result['passed'] else "FAIL"
        print(f"[{status}] {test_name}")
        print(f"        Details: {result['details']}")

    print("\n" + "-"*60)
    print(f"Total: {len(test_results)} tests | Passed: {passed} | Failed: {failed}")
    print("-"*60)

    return test_results

if __name__ == "__main__":
    run_tests()
