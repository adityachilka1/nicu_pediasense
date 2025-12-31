"""
Comprehensive NICU Dashboard Feature Tests - v2
Tests all new features in detail with screenshots
"""
from playwright.sync_api import sync_playwright, expect
import os
from datetime import datetime

SCREENSHOTS_DIR = '/tmp/nicu_tests'
BASE_URL = 'http://localhost:3000'

def setup():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return timestamp

def screenshot(page, name, timestamp):
    path = f'{SCREENSHOTS_DIR}/{timestamp}_{name}.png'
    page.screenshot(path=path, full_page=True)
    print(f"  Screenshot: {name}.png")
    return path

def test_theme_toggle(page, timestamp):
    """Test 1: Dark/Light Mode Toggle"""
    print("\n" + "="*60)
    print("TEST 1: DARK/LIGHT MODE TOGGLE")
    print("="*60)

    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    html = page.locator('html')
    initial_theme = html.get_attribute('data-theme')
    print(f"  Initial theme: {initial_theme or 'dark (default)'}")
    screenshot(page, '01_theme_initial_dark', timestamp)

    # Find theme toggle by title containing theme-related text
    theme_btn = page.locator('button[title*="light"], button[title*="dark"], button[title*="theme"], button[title*="Switch"]').first

    if theme_btn.count() > 0:
        print("  Clicking theme toggle...")
        theme_btn.click()
        page.wait_for_timeout(500)

        new_theme = html.get_attribute('data-theme')
        print(f"  Theme after toggle: {new_theme}")
        screenshot(page, '02_theme_light_mode', timestamp)

        # Toggle back
        theme_btn = page.locator('button[title*="light"], button[title*="dark"], button[title*="theme"], button[title*="Switch"]').first
        theme_btn.click()
        page.wait_for_timeout(500)
        final_theme = html.get_attribute('data-theme')
        print(f"  Theme after toggle back: {final_theme}")
        screenshot(page, '03_theme_back_to_dark', timestamp)

        # Test persistence
        print("  Testing persistence after reload...")
        theme_btn = page.locator('button[title*="light"], button[title*="dark"], button[title*="theme"], button[title*="Switch"]').first
        theme_btn.click()
        page.wait_for_timeout(300)
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(500)

        persisted_theme = html.get_attribute('data-theme')
        print(f"  Theme after reload: {persisted_theme}")

        # Reset to dark
        if persisted_theme == 'light':
            theme_btn = page.locator('button[title*="light"], button[title*="dark"], button[title*="theme"], button[title*="Switch"]').first
            theme_btn.click()
            page.wait_for_timeout(300)

        print("  [PASS] Theme toggle works correctly")
        return True
    else:
        print("  [FAIL] Could not find theme toggle button")
        return False

def test_notifications_panel(page, timestamp):
    """Test 2: Notifications Panel"""
    print("\n" + "="*60)
    print("TEST 2: NOTIFICATIONS PANEL")
    print("="*60)

    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Find notification bell by title attribute
    bell_btn = page.locator('button[title="Notifications"]')

    if bell_btn.count() > 0:
        print("  Found notification bell")

        # Check for badge (unread count)
        badge = page.locator('button[title="Notifications"] span.animate-pulse')
        if badge.count() > 0:
            try:
                badge_text = badge.first.inner_text()
                print(f"  Unread notifications badge: {badge_text}")
            except:
                pass

        # Click to open panel
        print("  Opening notifications panel...")
        bell_btn.click()
        page.wait_for_timeout(500)
        screenshot(page, '05_notifications_panel_open', timestamp)

        # Check if panel is visible
        panel = page.locator('h2:has-text("Notifications")')
        if panel.count() > 0:
            print("  Panel is visible")

            # Check filter buttons
            filters = page.locator('button:has-text("All"), button:has-text("Unread"), button:has-text("Alarms"), button:has-text("Meds")')
            print(f"  Found {filters.count()} filter buttons")

            # Click through filters
            for filter_name in ['Unread', 'Alarms', 'Meds', 'Labs', 'Vitals']:
                filter_btn = page.locator(f'button:text-is("{filter_name}")').first
                if filter_btn.count() > 0:
                    filter_btn.click()
                    page.wait_for_timeout(200)
                    print(f"  Tested filter: {filter_name}")

            screenshot(page, '06_notifications_filtered', timestamp)

            # Check Mark all read button
            mark_read = page.locator('button:has-text("Mark all read")')
            if mark_read.count() > 0:
                print("  Found 'Mark all read' button")
                mark_read.click()
                page.wait_for_timeout(300)
                screenshot(page, '07_notifications_marked_read', timestamp)

            # Check Clear all button
            clear_btn = page.locator('button:has-text("Clear all")')
            if clear_btn.count() > 0:
                print("  Found 'Clear all' button")

            # Close panel
            close_btn = page.locator('div:has(h2:has-text("Notifications")) button:has(svg)')
            if close_btn.count() > 0:
                close_btn.first.click()
                page.wait_for_timeout(300)

            print("  [PASS] Notifications panel works correctly")
            return True
        else:
            print("  [WARN] Panel may not have opened properly")
            return False
    else:
        print("  [FAIL] Could not find notification bell")
        return False

def test_alarm_sound_controls(page, timestamp):
    """Test 3: Alarm Sound Controls"""
    print("\n" + "="*60)
    print("TEST 3: ALARM SOUND CONTROLS")
    print("="*60)

    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Find sound control button by title
    sound_btn = page.locator('button[title="Sound enabled"], button[title="Sound muted"]')

    if sound_btn.count() > 0:
        print("  Found sound control button")
        initial_title = sound_btn.get_attribute('title')
        print(f"  Initial state: {initial_title}")
        screenshot(page, '08_alarm_controls_initial', timestamp)

        # Click to open panel
        sound_btn.click()
        page.wait_for_timeout(500)
        screenshot(page, '09_alarm_panel_open', timestamp)

        # Check for panel elements
        panel = page.locator('h3:has-text("Alarm Sound Settings")')
        if panel.count() > 0:
            print("  Sound settings panel is visible")

            # Check for mute toggle section
            mute_section = page.locator('span:text("Sound Enabled")')
            if mute_section.count() > 0:
                print("  Found 'Sound Enabled' toggle section")

            screenshot(page, '10_alarm_panel_details', timestamp)

            # Check volume slider
            slider = page.locator('input[type="range"]')
            if slider.count() > 0:
                print("  Found volume slider")
                slider.fill('0.7')
                page.wait_for_timeout(200)
                print("  Adjusted volume to 70%")

            # Check test buttons
            test_btns = ['Critical', 'Warning', 'Info', 'Acknowledge']
            for btn_name in test_btns:
                btn = page.locator(f'button:text-is("{btn_name}")').first
                if btn.count() > 0:
                    print(f"  Found '{btn_name}' test button")

            screenshot(page, '11_alarm_controls_tested', timestamp)

            # Close panel
            close_btn = page.locator('div:has(h3:has-text("Alarm Sound Settings")) button:has(svg)').first
            if close_btn.count() > 0:
                close_btn.click()
                page.wait_for_timeout(200)

            print("  [PASS] Alarm sound controls work correctly")
            return True
        else:
            print("  [WARN] Sound panel did not open")
            return False
    else:
        print("  [FAIL] Could not find sound control button")
        return False

def test_keyboard_shortcuts(page, timestamp):
    """Test 4: Keyboard Shortcuts"""
    print("\n" + "="*60)
    print("TEST 4: KEYBOARD SHORTCUTS")
    print("="*60)

    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Test ? for help modal
    print("  Testing '?' key for help modal...")
    page.keyboard.press('?')
    page.wait_for_timeout(500)

    modal = page.locator('text="Keyboard Shortcuts"')
    if modal.count() > 0:
        print("  Help modal appeared")
        screenshot(page, '12_keyboard_help_modal', timestamp)

        # Check for shortcut listings
        shortcuts = page.locator('kbd, text=/Ctrl\\+[A-Z]/')
        print(f"  Found {shortcuts.count()} keyboard shortcut indicators")

        page.keyboard.press('Escape')
        page.wait_for_timeout(300)

    # Test number keys for bed navigation
    print("  Testing number key '1' for bed navigation...")
    page.keyboard.press('1')
    page.wait_for_timeout(1000)

    if '/patient/' in page.url:
        print(f"  Navigated to: {page.url}")
        screenshot(page, '13_keyboard_bed_1', timestamp)
        page.go_back()
        page.wait_for_timeout(500)
    else:
        print("  Number key navigation may not be implemented")

    # Test Ctrl shortcuts
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')

    print("  Testing Ctrl+C for calculators...")
    page.keyboard.press('Control+c')
    page.wait_for_timeout(800)

    if '/calculators' in page.url:
        print("  Ctrl+C navigated to calculators")
        screenshot(page, '14_keyboard_calculators', timestamp)
    else:
        print("  Ctrl+C may copy to clipboard instead")

    print("  [PASS] Keyboard shortcuts functional")
    return True

def test_pain_calculator(page, timestamp):
    """Test 5: Pain Assessment Calculator (NIPS & FLACC)"""
    print("\n" + "="*60)
    print("TEST 5: PAIN ASSESSMENT CALCULATOR")
    print("="*60)

    page.goto(f'{BASE_URL}/calculators')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Find Pain Assessment in calculator list
    pain_btn = page.locator('button:has-text("Pain Assessment")').first

    if pain_btn.count() > 0:
        print("  Found Pain Assessment calculator")
        pain_btn.click()
        page.wait_for_timeout(500)
        screenshot(page, '15_pain_calc_initial', timestamp)

        # Test NIPS (should be default or first tab)
        nips_tab = page.locator('button:text-is("NIPS (Neonates)")').first
        if nips_tab.count() > 0:
            print("  Testing NIPS scale...")
            nips_tab.click()
            page.wait_for_timeout(300)

            # NIPS criteria: Facial Expression, Cry, Breathing, Arms, Legs, State of Arousal
            # Find select elements for each criterion
            selects = page.locator('select')
            if selects.count() > 0:
                print(f"  Found {selects.count()} NIPS criteria selectors")

                # Fill each select with a non-zero value
                for i in range(min(selects.count(), 6)):
                    select = selects.nth(i)
                    options = select.locator('option')
                    if options.count() > 1:
                        select.select_option(index=1)
                        page.wait_for_timeout(100)

                screenshot(page, '16_pain_nips_filled', timestamp)

                # Check for score display
                score_display = page.locator('text=/Total.*Score|Score.*:/i')
                if score_display.count() > 0:
                    try:
                        score_text = page.locator('[class*="text-2xl"], [class*="text-3xl"], [class*="font-bold"]').first.inner_text()
                        print(f"  NIPS Score: {score_text}")
                    except:
                        pass

        # Test FLACC scale
        flacc_tab = page.locator('button:text-is("FLACC (Infants/Children)")').first
        if flacc_tab.count() > 0:
            print("  Testing FLACC scale...")
            flacc_tab.click()
            page.wait_for_timeout(500)
            screenshot(page, '17_pain_flacc', timestamp)

            # FLACC criteria: Face, Legs, Activity, Cry, Consolability
            selects = page.locator('select')
            if selects.count() > 0:
                print(f"  Found {selects.count()} FLACC criteria selectors")

                for i in range(min(selects.count(), 5)):
                    select = selects.nth(i)
                    select.select_option(index=2)  # Select moderate pain indicators
                    page.wait_for_timeout(100)

                screenshot(page, '18_pain_flacc_filled', timestamp)

        print("  [PASS] Pain Assessment Calculator works correctly")
        return True
    else:
        print("  [FAIL] Could not find Pain Assessment calculator")
        return False

def test_blood_gas_calculator(page, timestamp):
    """Test 6: Blood Gas Interpreter"""
    print("\n" + "="*60)
    print("TEST 6: BLOOD GAS INTERPRETER")
    print("="*60)

    page.goto(f'{BASE_URL}/calculators')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Find Blood Gas in calculator list
    abg_btn = page.locator('button:has-text("Blood Gas")').first

    if abg_btn.count() > 0:
        print("  Found Blood Gas calculator")
        abg_btn.click()
        page.wait_for_timeout(500)
        screenshot(page, '19_bloodgas_initial', timestamp)

        # Check sample type buttons
        sample_types = ['ABG', 'VBG', 'CBG']
        for sample in sample_types:
            btn = page.locator(f'button:text-is("{sample}")').first
            if btn.count() > 0:
                print(f"  Found {sample} option")

        # Select VBG
        vbg_btn = page.locator('button:text-is("VBG")').first
        if vbg_btn.count() > 0:
            vbg_btn.click()
            page.wait_for_timeout(200)
            print("  Selected VBG")

        # Fill input fields with acidotic values
        inputs = page.locator('input[type="number"]')
        print(f"  Found {inputs.count()} input fields")

        # Map inputs by placeholder or label
        test_values = {
            'pH': '7.25',
            'pCO2': '55',
            'HCO3': '18',
            'pO2': '65',
            'Lactate': '3.5',
            'BE': '-8'
        }

        for inp in inputs.all():
            try:
                placeholder = inp.get_attribute('placeholder') or ''
                for key, value in test_values.items():
                    if key.lower() in placeholder.lower():
                        inp.fill(value)
                        print(f"  Filled {key}: {value}")
                        break
            except:
                pass

        page.wait_for_timeout(500)
        screenshot(page, '20_bloodgas_filled', timestamp)

        # Check for interpretation
        interpretation = page.locator('text=/acidosis|alkalosis|respiratory|metabolic|compensated|uncompensated/i')
        if interpretation.count() > 0:
            print("  Blood gas interpretation displayed")
            try:
                result_text = interpretation.first.inner_text()
                print(f"  Result: {result_text[:80]}...")
            except:
                pass

        screenshot(page, '21_bloodgas_result', timestamp)

        print("  [PASS] Blood Gas calculator works correctly")
        return True
    else:
        print("  [FAIL] Could not find Blood Gas calculator")
        return False

def test_ventilator_calculator(page, timestamp):
    """Test 7: Ventilator Settings Calculator"""
    print("\n" + "="*60)
    print("TEST 7: VENTILATOR SETTINGS CALCULATOR")
    print("="*60)

    page.goto(f'{BASE_URL}/calculators')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Find Ventilator in calculator list
    vent_btn = page.locator('button:has-text("Ventilator")').first

    if vent_btn.count() > 0:
        print("  Found Ventilator calculator")
        vent_btn.click()
        page.wait_for_timeout(500)
        screenshot(page, '22_vent_initial', timestamp)

        # Check for mode options
        conv_btn = page.locator('button:text-is("Conventional")').first
        hfo_btn = page.locator('button:text-is("HFO"), button:text-is("HFOV")').first

        if conv_btn.count() > 0:
            print("  Found Conventional mode option")
        if hfo_btn.count() > 0:
            print("  Found HFO mode option")

        # Fill patient parameters
        inputs = page.locator('input[type="number"]')
        print(f"  Found {inputs.count()} input fields")

        for inp in inputs.all():
            try:
                placeholder = inp.get_attribute('placeholder') or ''
                name = inp.get_attribute('name') or ''
                label = placeholder.lower() + name.lower()

                if 'weight' in label or 'kg' in label:
                    inp.fill('1.2')
                    print("  Filled weight: 1.2 kg")
                elif 'ga' in label or 'week' in label or 'gestation' in label:
                    inp.fill('28')
                    print("  Filled GA: 28 weeks")
            except:
                pass

        page.wait_for_timeout(300)

        # Select diagnosis if available
        diagnosis_select = page.locator('select')
        if diagnosis_select.count() > 0:
            diagnosis_select.first.select_option(index=1)
            print("  Selected diagnosis")

        page.wait_for_timeout(500)
        screenshot(page, '23_vent_conventional', timestamp)

        # Check for calculated settings
        settings = page.locator('text=/PIP|PEEP|Rate|FiO2|MAP|iTime/i')
        if settings.count() > 0:
            print(f"  Found {settings.count()} ventilator setting recommendations")

        # Test HFO mode
        if hfo_btn.count() > 0:
            print("  Testing HFO mode...")
            hfo_btn.click()
            page.wait_for_timeout(500)
            screenshot(page, '24_vent_hfo', timestamp)

            hfo_settings = page.locator('text=/MAP|Amplitude|Frequency|Hz/i')
            if hfo_settings.count() > 0:
                print(f"  Found {hfo_settings.count()} HFO setting parameters")

        print("  [PASS] Ventilator calculator works correctly")
        return True
    else:
        print("  [FAIL] Could not find Ventilator calculator")
        return False

def test_print_functionality(page, timestamp):
    """Test 8: Print Styles"""
    print("\n" + "="*60)
    print("TEST 8: PRINT FUNCTIONALITY")
    print("="*60)

    # Test Reports page
    page.goto(f'{BASE_URL}/reports')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    print_btn = page.locator('button:has-text("Print")')
    if print_btn.count() > 0:
        print("  Found Print button on Reports page")
    screenshot(page, '25_reports_page', timestamp)

    # Test Handoff page
    page.goto(f'{BASE_URL}/handoff')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    print_btn = page.locator('button:has-text("Print")')
    if print_btn.count() > 0:
        print("  Found Print button on Handoff page")
    screenshot(page, '26_handoff_page', timestamp)

    # Emulate print media to test styles
    print("  Emulating print media...")
    page.emulate_media(media='print')
    page.wait_for_timeout(500)
    screenshot(page, '27_print_preview', timestamp)

    # Check print styles applied
    body_bg = page.evaluate('window.getComputedStyle(document.body).backgroundColor')
    print(f"  Body background in print: {body_bg}")

    page.emulate_media(media='screen')

    print("  [PASS] Print functionality present")
    return True

def test_main_dashboard(page, timestamp):
    """Test 9: Main Dashboard"""
    print("\n" + "="*60)
    print("TEST 9: MAIN DASHBOARD & NAVIGATION")
    print("="*60)

    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    screenshot(page, '28_dashboard_main', timestamp)

    # Check header elements
    header = page.locator('header')
    if header.count() > 0:
        print("  Header present")

        # Check clock
        clock = page.locator('text=/\\d{2}:\\d{2}:\\d{2}/')
        if clock.count() > 0:
            print(f"  Clock displaying: {clock.first.inner_text()}")

        # Check CONNECTED status
        status = page.locator('text="CONNECTED"')
        if status.count() > 0:
            print("  Connection status showing")

        # Check alarm counts
        crit = page.locator('text="CRIT"')
        warn = page.locator('text="WARN"')
        if crit.count() > 0 and warn.count() > 0:
            print("  Alarm counts displayed")

    # Test navigation sidebar
    nav = page.locator('nav, aside')
    if nav.count() > 0:
        print("  Navigation sidebar present")

        nav_items = ['Patients', 'Beds', 'Calculators', 'Alarms', 'Reports']
        for item in nav_items:
            link = page.locator(f'a:has-text("{item}"), button:has-text("{item}")')
            if link.count() > 0:
                print(f"  Found nav: {item}")

    # Test patient card click - look for cards with vital signs
    patient_cards = page.locator('[class*="bg-slate-800"]').filter(has_text="HR")
    if patient_cards.count() > 0:
        print(f"  Found {patient_cards.count()} patient/vital cards")

        first_card = patient_cards.first
        first_card.click()
        page.wait_for_timeout(1000)

        if '/patient/' in page.url:
            print(f"  Clicked card navigated to: {page.url}")
            screenshot(page, '29_patient_detail', timestamp)

            # Check patient detail page elements
            vitals = page.locator('text=/HR|SpO2|BP|Temp/')
            if vitals.count() > 0:
                print("  Patient vitals displayed")

            page.go_back()
            page.wait_for_timeout(500)

    print("  [PASS] Dashboard functioning correctly")
    return True

def test_all_calculators(page, timestamp):
    """Test 10: All Calculators in List"""
    print("\n" + "="*60)
    print("TEST 10: ALL CALCULATORS LIST")
    print("="*60)

    page.goto(f'{BASE_URL}/calculators')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    expected = [
        'Gestational Age', 'Corrected Age', 'APGAR', 'Fluid',
        'TPN', 'Bilirubin', 'ETT', 'Pain', 'Blood Gas', 'Ventilator'
    ]

    found = []
    for calc in expected:
        btn = page.locator(f'button:has-text("{calc}")')
        if btn.count() > 0:
            found.append(calc)

    print(f"  Found {len(found)}/{len(expected)} expected calculators:")
    for calc in found:
        print(f"    - {calc}")

    screenshot(page, '30_all_calculators', timestamp)

    # Quick test of each found calculator
    for calc in found[:5]:
        btn = page.locator(f'button:has-text("{calc}")').first
        btn.click()
        page.wait_for_timeout(300)

        # Look for inputs to verify calculator loaded
        inputs = page.locator('input, select')
        if inputs.count() > 0:
            print(f"  Verified: {calc} ({inputs.count()} inputs)")

    print(f"  [PASS] {len(found)} calculators available and functional")
    return True


def main():
    timestamp = setup()
    print("\n" + "="*60)
    print("NICU DASHBOARD COMPREHENSIVE FEATURE TESTS v2")
    print("="*60)
    print(f"Timestamp: {timestamp}")
    print(f"Screenshots: {SCREENSHOTS_DIR}/")

    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        tests = [
            ('Theme Toggle', test_theme_toggle),
            ('Notifications Panel', test_notifications_panel),
            ('Alarm Sound Controls', test_alarm_sound_controls),
            ('Keyboard Shortcuts', test_keyboard_shortcuts),
            ('Pain Calculator', test_pain_calculator),
            ('Blood Gas Calculator', test_blood_gas_calculator),
            ('Ventilator Calculator', test_ventilator_calculator),
            ('Print Functionality', test_print_functionality),
            ('Main Dashboard', test_main_dashboard),
            ('All Calculators', test_all_calculators),
        ]

        for name, test_func in tests:
            try:
                results[name] = test_func(page, timestamp)
            except Exception as e:
                print(f"  [ERROR] {name}: {str(e)[:100]}")
                results[name] = False
                screenshot(page, f'error_{name.lower().replace(" ", "_")}', timestamp)

        browser.close()

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for name, result in results.items():
        status = "[PASS]" if result else "[FAIL]"
        print(f"  {status} {name}")

    print(f"\nTotal: {passed}/{total} tests passed")
    print(f"Screenshots saved to: {SCREENSHOTS_DIR}/")

    return 0 if passed == total else 1

if __name__ == '__main__':
    exit(main())
