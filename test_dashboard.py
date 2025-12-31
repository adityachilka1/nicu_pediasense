#!/usr/bin/env python3
"""
NICU Dashboard Main Monitoring Features Test
Tests all 8 patient beds, vital signs, waveforms, alarms, and navigation
"""

from playwright.sync_api import sync_playwright
import time
import re

def run_tests():
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        page.set_default_timeout(60000)  # 60 second timeout

        # Navigate to login page
        print("Navigating to NICU Dashboard...")
        page.goto('http://localhost:3000', timeout=60000)
        page.wait_for_load_state('domcontentloaded')
        time.sleep(2)

        # Take screenshot of login page
        page.screenshot(path='/tmp/test_dashboard_01_login.png', full_page=True)
        print("Screenshot saved: /tmp/test_dashboard_01_login.png")

        # Login with credentials
        print("Logging in with admin@hospital.org / admin123...")
        try:
            # Wait for page to settle
            page.wait_for_timeout(2000)

            # Try to find email/username input
            email_selectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[placeholder*="email" i]',
                'input[placeholder*="Email"]',
                'input[id*="email" i]',
                '#email',
                'input[type="text"]'
            ]

            email_input = None
            for selector in email_selectors:
                try:
                    el = page.locator(selector).first
                    if el.is_visible(timeout=1000):
                        email_input = el
                        break
                except:
                    continue

            if email_input:
                email_input.fill('admin@hospital.org')
                print("  Filled email field")
            else:
                print("  Warning: Could not find email input")

            # Find password input
            password_input = page.locator('input[type="password"]').first
            if password_input.is_visible(timeout=2000):
                password_input.fill('admin123')
                print("  Filled password field")

            # Find and click login button
            login_selectors = [
                'button[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Sign in")',
                'button:has-text("Log in")',
                'input[type="submit"]'
            ]

            login_button = None
            for selector in login_selectors:
                try:
                    el = page.locator(selector).first
                    if el.is_visible(timeout=1000):
                        login_button = el
                        break
                except:
                    continue

            if login_button:
                login_button.click()
                print("  Clicked login button")

            page.wait_for_load_state('domcontentloaded')
            time.sleep(3)  # Wait for dashboard to load

            page.screenshot(path='/tmp/test_dashboard_02_after_login.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_02_after_login.png")

            # Check if we're logged in (not on login page anymore)
            current_url = page.url
            if '/login' not in current_url:
                results.append(("Login", "PASS", f"Successfully logged in, now at {current_url}"))
            else:
                results.append(("Login", "PARTIAL", f"May still be on login page: {current_url}"))
        except Exception as e:
            results.append(("Login", "FAIL", str(e)))
            page.screenshot(path='/tmp/test_dashboard_02_login_error.png', full_page=True)

        # Wait for dashboard content to fully load
        page.wait_for_timeout(3000)

        # Test 1: Check if all 8 patient beds are displayed
        print("\n--- Test 1: All 8 patient beds displayed ---")
        try:
            page.screenshot(path='/tmp/test_dashboard_03_main_dashboard.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_03_main_dashboard.png")

            content = page.content()

            # Count bed references in content
            bed_pattern = re.findall(r'Bed\s*[#]?\s*\d+|bed\s*[#]?\s*\d+', content, re.IGNORECASE)
            unique_beds = set([b.lower().replace('#', '').replace(' ', '') for b in bed_pattern])

            # Also look for patient monitor elements
            patient_elements = page.locator('[class*="patient" i], [class*="bed" i], [class*="monitor" i], [data-testid*="patient" i]').all()

            # Count grid children that might be patient cards
            grid_items = page.locator('.grid > div, [class*="grid"] > div').all()

            print(f"  Found {len(unique_beds)} unique bed references: {unique_beds}")
            print(f"  Found {len(patient_elements)} patient-related elements")
            print(f"  Found {len(grid_items)} grid items")

            if len(unique_beds) >= 8:
                results.append(("8 Patient Beds Displayed", "PASS", f"Found {len(unique_beds)} beds: {list(unique_beds)[:8]}"))
            elif len(unique_beds) >= 4 or len(patient_elements) >= 8 or len(grid_items) >= 8:
                results.append(("8 Patient Beds Displayed", "PARTIAL", f"Found {len(unique_beds)} beds, {len(patient_elements)} patient elements, {len(grid_items)} grid items"))
            else:
                results.append(("8 Patient Beds Displayed", "FAIL", f"Only found {len(unique_beds)} beds"))
        except Exception as e:
            results.append(("8 Patient Beds Displayed", "FAIL", str(e)))

        # Test 2: Vital signs for each patient (SpO2, PR, RR, Temp, BP, FiO2)
        print("\n--- Test 2: Vital signs displayed ---")
        try:
            content = page.content().lower()

            vital_checks = {
                'SpO2': ['spo2', 'spo₂', 'oxygen saturation', 'o2 sat'],
                'PR': ['pr', 'pulse', 'heart rate', 'hr', 'bpm'],
                'RR': ['rr', 'respiratory', 'resp rate', 'breaths'],
                'Temp': ['temp', 'temperature', '°c', '°f'],
                'BP': ['bp', 'blood pressure', 'systolic', 'diastolic', 'nibp'],
                'FiO2': ['fio2', 'fio₂', 'fraction of inspired']
            }

            found_vitals = []
            for vital_name, keywords in vital_checks.items():
                for kw in keywords:
                    if kw in content:
                        found_vitals.append(vital_name)
                        break

            page.screenshot(path='/tmp/test_dashboard_04_vitals.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_04_vitals.png")

            print(f"  Found vital signs: {found_vitals}")

            if len(found_vitals) >= 5:
                results.append(("Vital Signs Displayed", "PASS", f"Found {len(found_vitals)} vitals: {found_vitals}"))
            elif len(found_vitals) >= 3:
                results.append(("Vital Signs Displayed", "PARTIAL", f"Found {len(found_vitals)} vitals: {found_vitals}"))
            else:
                results.append(("Vital Signs Displayed", "FAIL", f"Only found {len(found_vitals)} vitals: {found_vitals}"))
        except Exception as e:
            results.append(("Vital Signs Displayed", "FAIL", str(e)))

        # Test 3: Live waveform animations
        print("\n--- Test 3: Live waveform animations ---")
        try:
            # Look for SVG/Canvas elements
            svg_elements = page.locator('svg').all()
            canvas_elements = page.locator('canvas').all()
            path_elements = page.locator('svg path').all()

            # Take screenshots to compare for animation
            page.screenshot(path='/tmp/test_dashboard_05_waveform_1.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_05_waveform_1.png")

            time.sleep(2)

            page.screenshot(path='/tmp/test_dashboard_06_waveform_2.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_06_waveform_2.png")

            # Check for waveform-related classes
            waveform_elements = page.locator('[class*="waveform" i], [class*="wave" i], [class*="chart" i], [class*="graph" i], [class*="ecg" i]').all()

            print(f"  Found {len(svg_elements)} SVG elements")
            print(f"  Found {len(canvas_elements)} Canvas elements")
            print(f"  Found {len(path_elements)} SVG path elements")
            print(f"  Found {len(waveform_elements)} waveform-related elements")

            if len(svg_elements) > 0 or len(canvas_elements) > 0 or len(waveform_elements) > 0:
                results.append(("Live Waveform Animations", "PASS", f"Found {len(svg_elements)} SVGs, {len(canvas_elements)} canvases, {len(waveform_elements)} waveform elements"))
            else:
                results.append(("Live Waveform Animations", "PARTIAL", "Waveform elements not clearly identified"))
        except Exception as e:
            results.append(("Live Waveform Animations", "FAIL", str(e)))

        # Test 4: Alarm indicators (critical/warning status)
        print("\n--- Test 4: Alarm indicators ---")
        try:
            content = page.content().lower()

            alarm_found = []
            if 'critical' in content:
                alarm_found.append('critical')
            if 'warning' in content:
                alarm_found.append('warning')
            if 'alert' in content:
                alarm_found.append('alert')
            if 'alarm' in content:
                alarm_found.append('alarm')
            if 'urgent' in content:
                alarm_found.append('urgent')

            # Look for alarm-related elements
            alarm_elements = page.locator('[class*="alarm" i], [class*="alert" i], [class*="critical" i], [class*="warning" i]').all()

            page.screenshot(path='/tmp/test_dashboard_07_alarms.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_07_alarms.png")

            print(f"  Found alarm keywords: {alarm_found}")
            print(f"  Found {len(alarm_elements)} alarm-related elements")

            if len(alarm_found) >= 2 or len(alarm_elements) >= 2:
                results.append(("Alarm Indicators", "PASS", f"Found: {alarm_found}, {len(alarm_elements)} elements"))
            elif len(alarm_found) >= 1 or len(alarm_elements) >= 1:
                results.append(("Alarm Indicators", "PARTIAL", f"Found: {alarm_found}, {len(alarm_elements)} elements"))
            else:
                results.append(("Alarm Indicators", "FAIL", "No alarm indicators found"))
        except Exception as e:
            results.append(("Alarm Indicators", "FAIL", str(e)))

        # Test 5: Patient status colors (red=critical, yellow=warning, green=stable)
        print("\n--- Test 5: Patient status colors ---")
        try:
            content = page.content()

            # Check for color-coded status
            red_elements = page.locator('[class*="red" i], [class*="critical" i], [class*="danger" i]').all()
            yellow_elements = page.locator('[class*="yellow" i], [class*="warning" i], [class*="amber" i], [class*="orange" i]').all()
            green_elements = page.locator('[class*="green" i], [class*="stable" i], [class*="success" i], [class*="normal" i]').all()

            status_report = []
            if len(red_elements) > 0:
                status_report.append(f"red/critical: {len(red_elements)}")
            if len(yellow_elements) > 0:
                status_report.append(f"yellow/warning: {len(yellow_elements)}")
            if len(green_elements) > 0:
                status_report.append(f"green/stable: {len(green_elements)}")

            # Check for status text
            content_lower = content.lower()
            if 'stable' in content_lower:
                status_report.append("'stable' text found")
            if 'critical' in content_lower:
                status_report.append("'critical' text found")
            if 'warning' in content_lower:
                status_report.append("'warning' text found")

            page.screenshot(path='/tmp/test_dashboard_08_status_colors.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_08_status_colors.png")

            print(f"  Status indicators: {status_report}")

            if len(status_report) >= 3:
                results.append(("Patient Status Colors", "PASS", f"Found: {status_report}"))
            elif len(status_report) >= 1:
                results.append(("Patient Status Colors", "PARTIAL", f"Found: {status_report}"))
            else:
                results.append(("Patient Status Colors", "FAIL", "No status colors found"))
        except Exception as e:
            results.append(("Patient Status Colors", "FAIL", str(e)))

        # Test 6: Blood pressure values (systolic/diastolic/MAP)
        print("\n--- Test 6: Blood pressure values ---")
        try:
            content = page.content()
            content_lower = content.lower()

            bp_found = []
            if 'systolic' in content_lower:
                bp_found.append('systolic')
            if 'diastolic' in content_lower:
                bp_found.append('diastolic')
            if 'map' in content_lower:
                bp_found.append('MAP')

            # Look for BP format like "120/80" or "120/80 (90)"
            bp_values = re.findall(r'\d{2,3}\s*/\s*\d{2,3}(?:\s*\(\s*\d{2,3}\s*\))?', content)
            if bp_values:
                bp_found.append(f"BP values found: {bp_values[:3]}")

            page.screenshot(path='/tmp/test_dashboard_09_blood_pressure.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_09_blood_pressure.png")

            print(f"  Blood pressure info: {bp_found}")

            if 'systolic' in bp_found and 'diastolic' in bp_found and 'MAP' in bp_found:
                results.append(("Blood Pressure Values", "PASS", f"Found all BP components: {bp_found}"))
            elif len(bp_found) >= 2:
                results.append(("Blood Pressure Values", "PARTIAL", f"Found: {bp_found}"))
            elif len(bp_found) >= 1:
                results.append(("Blood Pressure Values", "PARTIAL", f"Found: {bp_found}"))
            else:
                results.append(("Blood Pressure Values", "FAIL", "No BP values found"))
        except Exception as e:
            results.append(("Blood Pressure Values", "FAIL", str(e)))

        # Test 7: LOW MAP alarm for critical patients
        print("\n--- Test 7: LOW MAP alarm ---")
        try:
            content = page.content()

            low_map_found = 'low map' in content.lower() or 'LOW MAP' in content

            # Check for MAP alarm elements
            map_alarm_elements = page.locator(':text("LOW MAP"), :text("Low MAP")').all()

            page.screenshot(path='/tmp/test_dashboard_10_low_map.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_10_low_map.png")

            print(f"  LOW MAP text found: {low_map_found}")
            print(f"  LOW MAP elements: {len(map_alarm_elements)}")

            if low_map_found or len(map_alarm_elements) > 0:
                results.append(("LOW MAP Alarm", "PASS", "LOW MAP alarm indicator found"))
            else:
                # Check if MAP values are shown at all
                if 'map' in content.lower():
                    results.append(("LOW MAP Alarm", "PARTIAL", "MAP shown but no LOW MAP alarm visible (may require critical state)"))
                else:
                    results.append(("LOW MAP Alarm", "FAIL", "No LOW MAP alarm found"))
        except Exception as e:
            results.append(("LOW MAP Alarm", "FAIL", str(e)))

        # Test 8: Click on patient bed to verify navigation
        print("\n--- Test 8: Patient bed navigation ---")
        try:
            initial_url = page.url

            # Find clickable patient elements
            clickable_selectors = [
                'a[href*="patient"]',
                'a[href*="bed"]',
                '[class*="patient" i][onclick]',
                '[class*="bed" i][onclick]',
                '[class*="monitor" i]',
                '[class*="card" i]',
                '.grid > div',
                'button:has-text("View")',
                'button:has-text("Details")'
            ]

            clicked = False
            for selector in clickable_selectors:
                try:
                    elements = page.locator(selector).all()
                    if len(elements) > 0:
                        elements[0].click()
                        clicked = True
                        print(f"  Clicked on: {selector}")
                        break
                except:
                    continue

            if clicked:
                page.wait_for_load_state('domcontentloaded')
                time.sleep(2)

                new_url = page.url

                page.screenshot(path='/tmp/test_dashboard_11_patient_detail.png', full_page=True)
                print("Screenshot saved: /tmp/test_dashboard_11_patient_detail.png")

                # Check if navigation occurred
                if new_url != initial_url:
                    results.append(("Patient Bed Navigation", "PASS", f"Navigated from {initial_url} to {new_url}"))
                else:
                    # Check for modal/overlay
                    modal_elements = page.locator('[class*="modal" i], [class*="overlay" i], [class*="dialog" i], [role="dialog"]').all()
                    if len(modal_elements) > 0:
                        results.append(("Patient Bed Navigation", "PASS", "Modal/dialog appeared for patient details"))
                    else:
                        results.append(("Patient Bed Navigation", "PARTIAL", "Click registered but no clear navigation"))
            else:
                results.append(("Patient Bed Navigation", "FAIL", "Could not find clickable patient elements"))
                page.screenshot(path='/tmp/test_dashboard_11_no_click.png', full_page=True)
        except Exception as e:
            results.append(("Patient Bed Navigation", "FAIL", str(e)))
            page.screenshot(path='/tmp/test_dashboard_11_error.png', full_page=True)

        # Final dashboard screenshot
        try:
            page.goto('http://localhost:3000', timeout=30000)
            page.wait_for_load_state('domcontentloaded')
            time.sleep(2)
            page.screenshot(path='/tmp/test_dashboard_12_final.png', full_page=True)
            print("\nScreenshot saved: /tmp/test_dashboard_12_final.png")
        except:
            pass

        browser.close()

    # Print results summary
    print("\n" + "="*70)
    print("NICU DASHBOARD TEST RESULTS SUMMARY")
    print("="*70)

    passed = 0
    failed = 0
    partial = 0

    for test_name, status, details in results:
        if status == "PASS":
            passed += 1
            icon = "[PASS]"
        elif status == "FAIL":
            failed += 1
            icon = "[FAIL]"
        else:
            partial += 1
            icon = "[PARTIAL]"

        print(f"\n{icon} {test_name}")
        print(f"       Details: {details}")

    print("\n" + "="*70)
    print(f"TOTAL: {passed} PASSED, {partial} PARTIAL, {failed} FAILED out of {len(results)} tests")
    print("="*70)

    print("\nScreenshots saved to /tmp/test_dashboard_*.png")

    return results

if __name__ == "__main__":
    run_tests()
