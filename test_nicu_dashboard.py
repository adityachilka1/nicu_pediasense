#!/usr/bin/env python3
"""
NICU Dashboard Test Script
Tests the main dashboard functionality after login
"""

from playwright.sync_api import sync_playwright
import time
import re

def run_tests():
    results = {
        "1. Dashboard loads with all 8 patient beds": "PENDING",
        "2. Vitals displayed (SpO2, PR, RR, Temp)": "PENDING",
        "3. Blood pressure (BP) with systolic/diastolic format": "PENDING",
        "4. MAP values displayed in parentheses": "PENDING",
        "5. NBP/ART source labels visible": "PENDING",
        "6. Waveforms rendering (canvas elements)": "PENDING",
        "7. Critical alarms visible for unstable patients": "PENDING",
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        try:
            # Navigate to login page
            print("Navigating to NICU Dashboard...")
            page.goto('http://localhost:3000', timeout=60000, wait_until='domcontentloaded')
            time.sleep(2)  # Wait for page to stabilize

            # Take screenshot of login page
            page.screenshot(path='/tmp/test_dashboard_01_login.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_01_login.png")

            # Login - clear any existing values and fill with admin credentials
            print("Logging in with admin@hospital.org...")

            # Find and fill email input
            email_input = page.locator('input[type="email"]')
            email_input.wait_for(timeout=10000)
            email_input.clear()
            email_input.fill('admin@hospital.org')

            # Find and fill password input
            password_input = page.locator('input[type="password"]')
            password_input.clear()
            password_input.fill('admin123')

            # Take screenshot before clicking login
            page.screenshot(path='/tmp/test_dashboard_02_before_login.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_02_before_login.png")

            # Click Sign In button
            sign_in_btn = page.locator('button:has-text("Sign In")')
            sign_in_btn.click()

            # Wait for navigation to dashboard - use time.sleep instead of networkidle
            print("Waiting for dashboard to load...")
            time.sleep(8)  # Give time for login and dashboard to fully render

            # Take screenshot after login
            page.screenshot(path='/tmp/test_dashboard_03_after_login.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_03_after_login.png")

            # Check current URL
            current_url = page.url
            print(f"Current URL: {current_url}")

            # Get page content for analysis
            content = page.content()

            # Take full dashboard screenshot
            page.screenshot(path='/tmp/test_dashboard_04_dashboard.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_04_dashboard.png")

            # TEST 1: Check for 8 patient beds
            print("\nTest 1: Checking for 8 patient beds...")
            # Look for BED labels (BED 01 through BED 08)
            bed_numbers_found = set()
            for i in range(1, 9):
                bed_num = f"0{i}" if i < 10 else str(i)
                if f"BED {bed_num}" in content or f"BED{bed_num}" in content or f"Bed {bed_num}" in content:
                    bed_numbers_found.add(i)
                # Also try single digit
                if f"BED {i}" in content or f"Bed {i}" in content:
                    bed_numbers_found.add(i)

            # Also count elements with bed in class
            bed_elements = page.locator('[class*="bed" i]').all()

            if len(bed_numbers_found) >= 8:
                results["1. Dashboard loads with all 8 patient beds"] = f"PASS (Found beds: {sorted(bed_numbers_found)})"
            elif len(bed_numbers_found) >= 1:
                results["1. Dashboard loads with all 8 patient beds"] = f"PARTIAL (Found {len(bed_numbers_found)} beds: {sorted(bed_numbers_found)})"
            else:
                results["1. Dashboard loads with all 8 patient beds"] = f"FAIL (No beds found)"

            # TEST 2: Check for vitals (SpO2, PR, RR, Temp)
            print("\nTest 2: Checking for vitals display...")
            vitals_found = []

            # Check for SpO2
            if 'SpO2' in content or 'SpO₂' in content or 'spo2' in content.lower():
                vitals_found.append('SpO2')

            # Check for PR (Pulse Rate)
            if re.search(r'\bPR\b', content) or 'pulse' in content.lower() or 'bpm' in content.lower():
                vitals_found.append('PR')

            # Check for RR (Respiratory Rate)
            if re.search(r'\bRR\b', content) or 'RESP' in content or '/min' in content:
                vitals_found.append('RR')

            # Check for Temp
            if 'TEMP' in content or 'temp' in content.lower() or '°C' in content or '°F' in content:
                vitals_found.append('Temp')

            if len(vitals_found) >= 4:
                results["2. Vitals displayed (SpO2, PR, RR, Temp)"] = f"PASS (Found: {', '.join(vitals_found)})"
            elif len(vitals_found) >= 2:
                results["2. Vitals displayed (SpO2, PR, RR, Temp)"] = f"PARTIAL (Found: {', '.join(vitals_found)})"
            else:
                results["2. Vitals displayed (SpO2, PR, RR, Temp)"] = f"FAIL (Only found: {', '.join(vitals_found) if vitals_found else 'none'})"

            page.screenshot(path='/tmp/test_dashboard_05_vitals.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_05_vitals.png")

            # TEST 3: Check for Blood Pressure with systolic/diastolic format
            print("\nTest 3: Checking for BP systolic/diastolic format...")
            # Look for BP pattern like "62/38" or "120/80"
            bp_pattern = re.findall(r'\b\d{2,3}/\d{2,3}\b', content)

            if len(bp_pattern) > 0:
                results["3. Blood pressure (BP) with systolic/diastolic format"] = f"PASS (Found {len(bp_pattern)} BP readings: {bp_pattern[:8]})"
            else:
                results["3. Blood pressure (BP) with systolic/diastolic format"] = "FAIL (No BP readings found)"

            page.screenshot(path='/tmp/test_dashboard_06_bp.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_06_bp.png")

            # TEST 4: Check for MAP values in parentheses
            print("\nTest 4: Checking for MAP values in parentheses...")
            # Look for MAP pattern like "(46)" or "(35)" after BP values
            map_pattern = re.findall(r'\(\d{2,3}\)', content)

            if len(map_pattern) > 0:
                results["4. MAP values displayed in parentheses"] = f"PASS (Found {len(map_pattern)} MAP values: {map_pattern[:8]})"
            else:
                results["4. MAP values displayed in parentheses"] = "FAIL (No MAP values in parentheses found)"

            page.screenshot(path='/tmp/test_dashboard_07_map.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_07_map.png")

            # TEST 5: Check for NBP/ART source labels
            print("\nTest 5: Checking for NBP/ART source labels...")
            sources = []
            if 'NBP' in content:
                sources.append('NBP')
            if 'ART' in content:
                sources.append('ART')
            if 'IBP' in content:
                sources.append('IBP')

            if len(sources) >= 1:
                results["5. NBP/ART source labels visible"] = f"PASS (Found: {', '.join(sources)})"
            else:
                results["5. NBP/ART source labels visible"] = "FAIL (No NBP/ART/IBP labels found)"

            page.screenshot(path='/tmp/test_dashboard_08_sources.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_08_sources.png")

            # TEST 6: Check for waveform canvas elements
            print("\nTest 6: Checking for waveform canvas elements...")
            canvas_elements = page.locator('canvas').all()
            svg_paths = page.locator('svg path').all()

            canvas_count = len(canvas_elements)
            svg_count = len(svg_paths)

            if canvas_count > 0:
                results["6. Waveforms rendering (canvas elements)"] = f"PASS (Found {canvas_count} canvas elements)"
            elif svg_count > 0:
                results["6. Waveforms rendering (canvas elements)"] = f"PASS (Found {svg_count} SVG path elements for waveforms)"
            else:
                results["6. Waveforms rendering (canvas elements)"] = "FAIL (No canvas or SVG waveforms found)"

            page.screenshot(path='/tmp/test_dashboard_09_waveforms.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_09_waveforms.png")

            # TEST 7: Check for critical alarms
            print("\nTest 7: Checking for critical alarms...")
            alarms_found = []

            # Check for specific alarm text in the dashboard
            if 'HIGH PRIORITY ALARM' in content or 'HIGH PRIORITY' in content:
                alarms_found.append('HIGH PRIORITY ALARM')
            if 'WARNING' in content:
                alarms_found.append('WARNING')
            if 'CRIT' in content or 'CRITICAL' in content:
                alarms_found.append('CRITICAL')
            if 'ALARM' in content:
                alarms_found.append('ALARM')
            if 'ACKNOWLEDGE' in content:
                alarms_found.append('ACKNOWLEDGE button')

            # Check for alarm elements
            alarm_elements = page.locator('[class*="alarm" i], [class*="alert" i], [class*="warning" i], [class*="critical" i]').all()

            if len(alarms_found) > 0 or len(alarm_elements) > 0:
                results["7. Critical alarms visible for unstable patients"] = f"PASS (Found: {', '.join(alarms_found)}, {len(alarm_elements)} alarm elements)"
            else:
                results["7. Critical alarms visible for unstable patients"] = "FAIL (No alarm indicators found)"

            page.screenshot(path='/tmp/test_dashboard_10_alarms.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_10_alarms.png")

            # Final full dashboard screenshot
            page.screenshot(path='/tmp/test_dashboard_final.png', full_page=True)
            print("Screenshot saved: /tmp/test_dashboard_final.png")

        except Exception as e:
            print(f"Error during testing: {e}")
            import traceback
            traceback.print_exc()
            page.screenshot(path='/tmp/test_dashboard_error.png', full_page=True)
            print("Error screenshot saved: /tmp/test_dashboard_error.png")

        finally:
            browser.close()

    # Print results
    print("\n" + "="*70)
    print("NICU DASHBOARD TEST RESULTS")
    print("="*70)

    pass_count = 0
    fail_count = 0
    partial_count = 0

    for test, result in results.items():
        if "PASS" in result and "PARTIAL" not in result:
            pass_count += 1
            status_icon = "[PASS]"
        elif "PARTIAL" in result:
            partial_count += 1
            status_icon = "[PARTIAL]"
        elif "FAIL" in result:
            fail_count += 1
            status_icon = "[FAIL]"
        else:
            status_icon = "[PENDING]"
        print(f"\n{status_icon} {test}")
        print(f"         {result}")

    print("\n" + "="*70)
    print(f"SUMMARY: {pass_count} PASSED, {partial_count} PARTIAL, {fail_count} FAILED")
    print("="*70)
    print("\nScreenshots saved to /tmp/test_dashboard_*.png")

    return results

if __name__ == "__main__":
    run_tests()
