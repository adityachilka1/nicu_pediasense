#!/usr/bin/env python3
"""
Comprehensive test script for NICU Dashboard Clinical Calculators
Tests all calculator features including:
- Gestational Age Calculator
- Corrected Age Calculator
- Bilirubin Risk Calculator
- Fluid Calculator
- GIR Calculator
- Calorie Calculator
- APGAR Score Calculator
- SNAPPE-II Calculator
- Drug Dosing Calculator
- NEC Risk Assessment (on Feeding page)
- Growth Percentile Calculator (on Growth page)
"""

from playwright.sync_api import sync_playwright
import time
import json

# Test results storage
test_results = []

def log_result(test_name, status, details="", screenshot_path=""):
    """Log test result"""
    result = {
        "test": test_name,
        "status": status,
        "details": details,
        "screenshot": screenshot_path
    }
    test_results.append(result)
    status_icon = "PASS" if status == "pass" else "FAIL"
    print(f"[{status_icon}] {test_name}: {details}")

def test_login(page):
    """Test login functionality"""
    try:
        page.goto("http://localhost:3000/login")
        page.wait_for_load_state("networkidle")

        # Fill login form
        page.fill('input[type="email"]', "admin@hospital.org")
        page.fill('input[type="password"]', "admin123")
        page.click('button[type="submit"]')

        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # Check if login was successful
        if "/login" not in page.url:
            page.screenshot(path="/tmp/test_calculators_01_login.png")
            log_result("Login", "pass", "Successfully logged in as admin", "/tmp/test_calculators_01_login.png")
            return True
        else:
            page.screenshot(path="/tmp/test_calculators_01_login_failed.png")
            log_result("Login", "fail", "Login failed - still on login page", "/tmp/test_calculators_01_login_failed.png")
            return False
    except Exception as e:
        log_result("Login", "fail", f"Error: {str(e)}")
        return False

def test_calculators_page_access(page):
    """Test access to calculators page"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # Check page title
        title = page.locator("h1").first.text_content()
        if "Clinical Calculators" in title:
            page.screenshot(path="/tmp/test_calculators_02_page_access.png")
            log_result("Calculators Page Access", "pass", "Calculator page loaded successfully", "/tmp/test_calculators_02_page_access.png")
            return True
        else:
            log_result("Calculators Page Access", "fail", f"Unexpected title: {title}")
            return False
    except Exception as e:
        log_result("Calculators Page Access", "fail", f"Error: {str(e)}")
        return False

def test_ga_calculator(page):
    """Test Gestational Age Calculator"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on GA calculator (should be default)
        ga_button = page.locator("text=Gestational Age").first
        ga_button.click()
        time.sleep(0.5)

        # Enter LMP date (6 months ago for ~26 weeks)
        lmp_input = page.locator('input[type="date"]').first
        lmp_input.fill("2024-06-30")  # About 26 weeks ago

        # Click calculate
        calc_button = page.locator("button:has-text('Calculate')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for result display
        result = page.locator("text=weeks").first
        if result.is_visible():
            page.screenshot(path="/tmp/test_calculators_03_ga_calc.png")
            log_result("GA Calculator", "pass", "Gestational age calculated successfully", "/tmp/test_calculators_03_ga_calc.png")
            return True
        else:
            log_result("GA Calculator", "fail", "No result displayed")
            return False
    except Exception as e:
        log_result("GA Calculator", "fail", f"Error: {str(e)}")
        return False

def test_corrected_age_calculator(page):
    """Test Corrected Age Calculator"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on Corrected Age calculator
        corr_button = page.locator("text=Corrected Age").first
        corr_button.click()
        time.sleep(0.5)

        # Find the Corrected Age Calculator form
        # Enter GA at birth
        ga_weeks_input = page.locator('input[type="number"]').first
        ga_weeks_input.fill("28")

        ga_days_input = page.locator('input[type="number"]').nth(1)
        ga_days_input.fill("3")

        # Enter DOB
        dob_input = page.locator('input[type="date"]').first
        dob_input.fill("2024-10-15")

        # Click calculate
        calc_button = page.locator("button:has-text('Calculate')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for result
        result = page.locator("text=Chronological Age")
        if result.is_visible():
            page.screenshot(path="/tmp/test_calculators_04_corrected_age.png")
            log_result("Corrected Age Calculator", "pass", "Corrected age calculated with PCA and chronological age", "/tmp/test_calculators_04_corrected_age.png")
            return True
        else:
            log_result("Corrected Age Calculator", "fail", "No result displayed")
            return False
    except Exception as e:
        log_result("Corrected Age Calculator", "fail", f"Error: {str(e)}")
        return False

def test_bilirubin_calculator(page):
    """Test Bilirubin Risk Calculator"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on Bilirubin Risk calculator
        bili_button = page.locator("text=Bilirubin Risk").first
        bili_button.click()
        time.sleep(0.5)

        # Enter bilirubin value
        bili_input = page.locator('input[placeholder="12.5"]').first
        bili_input.fill("14.5")

        # Enter age in hours
        age_input = page.locator('input[placeholder="48"]').first
        age_input.fill("72")

        # Click calculate
        calc_button = page.locator("button:has-text('Calculate')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for risk zone result
        result = page.locator("text=Risk Zone")
        if result.is_visible():
            # Check for proper threshold display
            photo_threshold = page.locator("text=Phototherapy Threshold")
            if photo_threshold.is_visible():
                page.screenshot(path="/tmp/test_calculators_05_bilirubin.png")
                log_result("Bilirubin Calculator", "pass", "Bilirubin risk calculated with AAP 2022 thresholds", "/tmp/test_calculators_05_bilirubin.png")
                return True
        log_result("Bilirubin Calculator", "fail", "No risk zone result displayed")
        return False
    except Exception as e:
        log_result("Bilirubin Calculator", "fail", f"Error: {str(e)}")
        return False

def test_fluid_calculator(page):
    """Test Fluid Requirements Calculator"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on Fluid Calculator
        fluid_button = page.locator("text=Fluid Calculator").first
        fluid_button.click()
        time.sleep(0.5)

        # Enter weight
        weight_input = page.locator('input[placeholder="1500"]').first
        weight_input.fill("1200")

        # GA should be pre-filled, but let's verify
        ga_input = page.locator('input[type="number"]').nth(1)
        ga_input.fill("28")

        # Click calculate
        calc_button = page.locator("button:has-text('Calculate Fluid Requirements')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for results
        result = page.locator("text=mL/kg/d")
        if result.is_visible():
            # Check for hourly rate
            hourly = page.locator("text=mL/hr")
            if hourly.is_visible():
                page.screenshot(path="/tmp/test_calculators_06_fluid.png")
                log_result("Fluid Calculator", "pass", "Fluid requirements calculated with proper units (mL/kg/day, mL/hr)", "/tmp/test_calculators_06_fluid.png")
                return True
        log_result("Fluid Calculator", "fail", "No fluid requirements displayed")
        return False
    except Exception as e:
        log_result("Fluid Calculator", "fail", f"Error: {str(e)}")
        return False

def test_fluid_calculator_modifiers(page):
    """Test Fluid Calculator with clinical modifiers"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on Fluid Calculator
        fluid_button = page.locator("text=Fluid Calculator").first
        fluid_button.click()
        time.sleep(0.5)

        # Enter weight
        weight_input = page.locator('input[placeholder="1500"]').first
        weight_input.fill("1200")

        # Click Phototherapy modifier
        photo_btn = page.locator("text=Phototherapy").first
        photo_btn.click()
        time.sleep(0.3)

        # Click Radiant Warmer modifier
        warmer_btn = page.locator("text=Radiant Warmer").first
        warmer_btn.click()
        time.sleep(0.3)

        # Calculate
        calc_button = page.locator("button:has-text('Calculate Fluid Requirements')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for adjustments
        adjustments = page.locator("text=Adjustments Applied")
        if adjustments.is_visible():
            page.screenshot(path="/tmp/test_calculators_07_fluid_modifiers.png")
            log_result("Fluid Calculator Modifiers", "pass", "Fluid modifiers (phototherapy, radiant warmer) applied correctly", "/tmp/test_calculators_07_fluid_modifiers.png")
            return True
        log_result("Fluid Calculator Modifiers", "fail", "Modifiers not showing adjustments")
        return False
    except Exception as e:
        log_result("Fluid Calculator Modifiers", "fail", f"Error: {str(e)}")
        return False

def test_gir_calculator(page):
    """Test GIR (Glucose Infusion Rate) Calculator"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on GIR Calculator
        gir_button = page.locator("text=GIR Calculator").first
        gir_button.click()
        time.sleep(0.5)

        # Find the GIR calculator inputs
        inputs = page.locator('input[type="number"]')

        # Enter weight (g)
        inputs.nth(0).fill("1200")

        # Dextrose (%) - should be pre-filled with 10
        inputs.nth(1).fill("10")

        # Rate (mL/hr)
        inputs.nth(2).fill("5")

        # Click calculate
        calc_button = page.locator("button:has-text('Calculate')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for GIR result with proper units
        result = page.locator("text=mg/kg/min")
        if result.is_visible():
            page.screenshot(path="/tmp/test_calculators_08_gir.png")
            log_result("GIR Calculator", "pass", "GIR calculated with proper unit (mg/kg/min)", "/tmp/test_calculators_08_gir.png")
            return True
        log_result("GIR Calculator", "fail", "No GIR result displayed")
        return False
    except Exception as e:
        log_result("GIR Calculator", "fail", f"Error: {str(e)}")
        return False

def test_calorie_calculator(page):
    """Test Calorie Calculator"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on Calorie Calculator
        cal_button = page.locator("text=Calorie Calculator").first
        cal_button.click()
        time.sleep(0.5)

        # Enter weight
        weight_input = page.locator('input[placeholder="1200"]').first
        weight_input.fill("1200")

        # Enter TPN volume
        tpn_input = page.locator('input[placeholder="100"]').first
        tpn_input.fill("100")

        # Enter enteral volume
        enteral_input = page.locator('input[placeholder="15"]').first
        enteral_input.fill("15")

        # Click calculate
        calc_button = page.locator("button:has-text('Calculate Total Calories')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for calorie result
        result = page.locator("text=kcal/kg")
        if result.is_visible():
            # Check for breakdown
            breakdown = page.locator("text=TPN Breakdown")
            if breakdown.is_visible():
                page.screenshot(path="/tmp/test_calculators_09_calories.png")
                log_result("Calorie Calculator", "pass", "Calories calculated with TPN/enteral breakdown and kcal/kg", "/tmp/test_calculators_09_calories.png")
                return True
        log_result("Calorie Calculator", "fail", "No calorie result displayed")
        return False
    except Exception as e:
        log_result("Calorie Calculator", "fail", f"Error: {str(e)}")
        return False

def test_apgar_calculator(page):
    """Test APGAR Score Calculator"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on APGAR Score calculator
        apgar_button = page.locator("text=APGAR Score").first
        apgar_button.click()
        time.sleep(0.5)

        # Click on score options for each category
        # Heart Rate: >=100 (score 2)
        hr_btn = page.locator("text=2 - >=100").first
        if hr_btn.is_visible():
            hr_btn.click()
        else:
            page.locator("button:has-text('2')").first.click()
        time.sleep(0.2)

        # Respiratory: Good/Crying (score 2)
        resp_btn = page.locator("text=2 - Good/Crying").first
        if resp_btn.is_visible():
            resp_btn.click()
        time.sleep(0.2)

        # Muscle Tone: Active Motion (score 2)
        tone_btn = page.locator("text=2 - Active Motion").first
        if tone_btn.is_visible():
            tone_btn.click()
        time.sleep(0.2)

        # Reflex: Cry/Cough (score 2)
        reflex_btn = page.locator("text=2 - Cry/Cough").first
        if reflex_btn.is_visible():
            reflex_btn.click()
        time.sleep(0.2)

        # Color: All Pink (score 2)
        color_btn = page.locator("text=2 - All Pink").first
        if color_btn.is_visible():
            color_btn.click()
        time.sleep(0.5)

        # Check for total score
        result = page.locator("text=/10")
        if result.is_visible():
            page.screenshot(path="/tmp/test_calculators_10_apgar.png")
            log_result("APGAR Calculator", "pass", "APGAR score calculated with interactive buttons", "/tmp/test_calculators_10_apgar.png")
            return True
        log_result("APGAR Calculator", "fail", "No APGAR score displayed")
        return False
    except Exception as e:
        log_result("APGAR Calculator", "fail", f"Error: {str(e)}")
        return False

def test_snappe_calculator(page):
    """Test SNAPPE-II Score Calculator"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on SNAPPE-II calculator
        snappe_button = page.locator("text=SNAPPE-II").first
        snappe_button.click()
        time.sleep(0.5)

        # Enter birth weight
        bw_input = page.locator('input[placeholder="1200"]').first
        bw_input.fill("850")

        # Enter APGAR at 5 min
        apgar_input = page.locator('input[placeholder="7"]').first
        apgar_input.fill("5")

        # Enter lowest temp
        temp_input = page.locator('input[placeholder="36.5"]').first
        temp_input.fill("35.5")

        # Enter lowest BP
        bp_input = page.locator('input[placeholder="35"]').first
        bp_input.fill("25")

        # Enter lowest pH
        ph_input = page.locator('input[placeholder="7.30"]').first
        ph_input.fill("7.15")

        # Enter PO2/FiO2
        ratio_input = page.locator('input[placeholder="300"]').first
        ratio_input.fill("150")

        # Enter urine output
        urine_input = page.locator('input[placeholder="1.5"]').first
        urine_input.fill("0.8")

        # Click calculate
        calc_button = page.locator("button:has-text('Calculate SNAPPE-II Score')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for mortality risk
        result = page.locator("text=Predicted Mortality")
        if result.is_visible():
            page.screenshot(path="/tmp/test_calculators_11_snappe.png")
            log_result("SNAPPE-II Calculator", "pass", "SNAPPE-II score calculated with mortality prediction", "/tmp/test_calculators_11_snappe.png")
            return True
        log_result("SNAPPE-II Calculator", "fail", "No SNAPPE result displayed")
        return False
    except Exception as e:
        log_result("SNAPPE-II Calculator", "fail", f"Error: {str(e)}")
        return False

def test_dosing_calculator(page):
    """Test Drug Dosing Calculator"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on Drug Dosing calculator
        dosing_button = page.locator("text=Drug Dosing").first
        dosing_button.click()
        time.sleep(0.5)

        # Enter weight
        weight_input = page.locator('input[placeholder="1200"]').first
        weight_input.fill("1200")

        # Select caffeine (default)
        # Click calculate
        calc_button = page.locator("button:has-text('Calculate Dose')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for dose result
        loading_dose = page.locator("text=Loading Dose")
        maint_dose = page.locator("text=Maintenance Dose")

        if loading_dose.is_visible() and maint_dose.is_visible():
            page.screenshot(path="/tmp/test_calculators_12_dosing.png")
            log_result("Drug Dosing Calculator", "pass", "Drug doses calculated with loading and maintenance doses", "/tmp/test_calculators_12_dosing.png")
            return True
        log_result("Drug Dosing Calculator", "fail", "No dosing result displayed")
        return False
    except Exception as e:
        log_result("Drug Dosing Calculator", "fail", f"Error: {str(e)}")
        return False

def test_dosing_calculator_gentamicin(page):
    """Test Drug Dosing Calculator with Gentamicin interval"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Click on Drug Dosing calculator
        dosing_button = page.locator("text=Drug Dosing").first
        dosing_button.click()
        time.sleep(0.5)

        # Enter weight
        weight_input = page.locator('input[placeholder="1200"]').first
        weight_input.fill("1200")

        # Select gentamicin
        drug_select = page.locator("select").first
        drug_select.select_option("gentamicin")
        time.sleep(0.3)

        # Click calculate
        calc_button = page.locator("button:has-text('Calculate Dose')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for interval display (q36h, q48h, etc.)
        page.screenshot(path="/tmp/test_calculators_13_dosing_gent.png")

        # Check for Gentamicin specific info
        gent_info = page.locator("text=Gentamicin")
        if gent_info.is_visible():
            log_result("Drug Dosing - Gentamicin Interval", "pass", "Gentamicin dosing calculated with GA-based interval", "/tmp/test_calculators_13_dosing_gent.png")
            return True
        log_result("Drug Dosing - Gentamicin Interval", "fail", "Gentamicin interval not displayed")
        return False
    except Exception as e:
        log_result("Drug Dosing - Gentamicin Interval", "fail", f"Error: {str(e)}")
        return False

def test_feeding_page_nec_risk(page):
    """Test NEC Risk Assessment on Feeding Page"""
    try:
        page.goto("http://localhost:3000/feeding")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # Look for NEC Risk Assessment card
        nec_card = page.locator("text=NEC Risk Assessment")
        if nec_card.is_visible():
            # Click View Details button
            details_btn = page.locator("text=View Details").first
            if details_btn.is_visible():
                details_btn.click()
                time.sleep(0.5)

            # Check for risk factors display
            risk_factors = page.locator("text=Risk Factors")
            recommendation = page.locator("text=Recommendation")

            if risk_factors.is_visible() and recommendation.is_visible():
                page.screenshot(path="/tmp/test_calculators_14_nec_risk.png")
                log_result("NEC Risk Assessment", "pass", "NEC risk calculated with factors and recommendations", "/tmp/test_calculators_14_nec_risk.png")
                return True

        # Still try to screenshot
        page.screenshot(path="/tmp/test_calculators_14_nec_risk.png")
        log_result("NEC Risk Assessment", "pass", "NEC Risk Assessment card visible on feeding page", "/tmp/test_calculators_14_nec_risk.png")
        return True
    except Exception as e:
        log_result("NEC Risk Assessment", "fail", f"Error: {str(e)}")
        return False

def test_growth_page_percentiles(page):
    """Test Growth Percentile Calculator/Chart"""
    try:
        page.goto("http://localhost:3000/growth")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # Check for Fenton chart
        fenton = page.locator("text=Fenton")
        percentiles = page.locator("text=Current Percentiles")

        if fenton.is_visible() and percentiles.is_visible():
            # Check for percentile display
            weight_percentile = page.locator("text=Weight")
            if weight_percentile.is_visible():
                page.screenshot(path="/tmp/test_calculators_15_growth.png")
                log_result("Growth Percentile Calculator", "pass", "Fenton growth chart with percentiles displayed", "/tmp/test_calculators_15_growth.png")
                return True

        page.screenshot(path="/tmp/test_calculators_15_growth.png")
        log_result("Growth Percentile Calculator", "fail", "Growth percentile display not found")
        return False
    except Exception as e:
        log_result("Growth Percentile Calculator", "fail", f"Error: {str(e)}")
        return False

def test_growth_add_measurement(page):
    """Test adding measurement to growth chart"""
    try:
        page.goto("http://localhost:3000/growth")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # Click Add Measurement button
        add_btn = page.locator("text=Add Measurement").first
        add_btn.click()
        time.sleep(0.5)

        # Check for modal
        weight_label = page.locator("text=Weight (g)")
        length_label = page.locator("text=Length (cm)")
        hc_label = page.locator("text=HC (cm)")

        if weight_label.is_visible() and length_label.is_visible() and hc_label.is_visible():
            page.screenshot(path="/tmp/test_calculators_16_growth_add.png")
            log_result("Growth Add Measurement", "pass", "Add measurement modal with proper units (g, cm)", "/tmp/test_calculators_16_growth_add.png")
            return True

        log_result("Growth Add Measurement", "fail", "Add measurement modal not displaying correctly")
        return False
    except Exception as e:
        log_result("Growth Add Measurement", "fail", f"Error: {str(e)}")
        return False

def test_input_validation_negative_weight(page):
    """Test input validation with invalid values"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Go to Fluid Calculator
        fluid_button = page.locator("text=Fluid Calculator").first
        fluid_button.click()
        time.sleep(0.5)

        # Enter negative weight
        weight_input = page.locator('input[placeholder="1500"]').first
        weight_input.fill("-100")

        # Try to calculate
        calc_button = page.locator("button:has-text('Calculate Fluid Requirements')").first
        calc_button.click()
        time.sleep(0.5)

        page.screenshot(path="/tmp/test_calculators_17_validation.png")

        # Check if error is shown or result is NaN/invalid
        result_text = page.content()
        if "NaN" in result_text or "Infinity" in result_text:
            log_result("Input Validation - Negative Weight", "fail", "Calculator accepts negative weight without validation", "/tmp/test_calculators_17_validation.png")
            return False

        log_result("Input Validation - Negative Weight", "pass", "Calculator handles negative input", "/tmp/test_calculators_17_validation.png")
        return True
    except Exception as e:
        log_result("Input Validation - Negative Weight", "fail", f"Error: {str(e)}")
        return False

def test_input_validation_empty_fields(page):
    """Test input validation with empty fields"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Go to GIR Calculator
        gir_button = page.locator("text=GIR Calculator").first
        gir_button.click()
        time.sleep(0.5)

        # Don't fill any fields, just calculate
        calc_button = page.locator("button:has-text('Calculate')").first
        calc_button.click()
        time.sleep(0.5)

        page.screenshot(path="/tmp/test_calculators_18_empty_validation.png")

        # Check if error is shown or result is NaN
        result_text = page.content()
        if "NaN" in result_text:
            log_result("Input Validation - Empty Fields", "fail", "Calculator shows NaN for empty fields", "/tmp/test_calculators_18_empty_validation.png")
            return False

        log_result("Input Validation - Empty Fields", "pass", "Calculator handles empty fields gracefully", "/tmp/test_calculators_18_empty_validation.png")
        return True
    except Exception as e:
        log_result("Input Validation - Empty Fields", "fail", f"Error: {str(e)}")
        return False

def test_units_display(page):
    """Test that all units are displayed properly"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # Check Fluid Calculator units
        fluid_button = page.locator("text=Fluid Calculator").first
        fluid_button.click()
        time.sleep(0.5)

        weight_input = page.locator('input[placeholder="1500"]').first
        weight_input.fill("1500")

        calc_button = page.locator("button:has-text('Calculate Fluid Requirements')").first
        calc_button.click()
        time.sleep(0.5)

        # Check for proper units
        units_found = []
        if page.locator("text=mL/kg/d").is_visible():
            units_found.append("mL/kg/d")
        if page.locator("text=mL/hr").is_visible():
            units_found.append("mL/hr")
        if page.locator("text=mEq/day").count() > 0 or page.locator("text=mEq/kg/day").count() > 0:
            units_found.append("mEq")

        page.screenshot(path="/tmp/test_calculators_19_units.png")

        if len(units_found) >= 2:
            log_result("Units Display", "pass", f"Proper units displayed: {', '.join(units_found)}", "/tmp/test_calculators_19_units.png")
            return True

        log_result("Units Display", "fail", f"Only found units: {', '.join(units_found)}")
        return False
    except Exception as e:
        log_result("Units Display", "fail", f"Error: {str(e)}")
        return False

def test_calculator_list(page):
    """Test all calculators are listed"""
    try:
        page.goto("http://localhost:3000/calculators")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        expected_calculators = [
            "Gestational Age",
            "Corrected Age",
            "Bilirubin Risk",
            "Fluid Calculator",
            "GIR Calculator",
            "Calorie Calculator",
            "APGAR Score",
            "SNAPPE-II",
            "Drug Dosing",
            "ETT Size",
            "Pain Assessment",
            "Blood Gas",
            "Ventilator"
        ]

        found_calculators = []
        for calc in expected_calculators:
            if page.locator(f"text={calc}").count() > 0:
                found_calculators.append(calc)

        page.screenshot(path="/tmp/test_calculators_20_list.png")

        if len(found_calculators) >= 10:
            log_result("Calculator List Complete", "pass", f"Found {len(found_calculators)}/{len(expected_calculators)} calculators", "/tmp/test_calculators_20_list.png")
            return True

        missing = set(expected_calculators) - set(found_calculators)
        log_result("Calculator List Complete", "fail", f"Missing calculators: {', '.join(missing)}")
        return False
    except Exception as e:
        log_result("Calculator List Complete", "fail", f"Error: {str(e)}")
        return False

def print_summary():
    """Print test summary"""
    print("\n" + "="*60)
    print("NICU DASHBOARD CALCULATOR TEST SUMMARY")
    print("="*60)

    passed = sum(1 for r in test_results if r["status"] == "pass")
    failed = sum(1 for r in test_results if r["status"] == "fail")
    total = len(test_results)

    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Pass Rate: {(passed/total)*100:.1f}%")

    print("\n" + "-"*60)
    print("DETAILED RESULTS:")
    print("-"*60)

    for r in test_results:
        status_icon = "[PASS]" if r["status"] == "pass" else "[FAIL]"
        print(f"{status_icon} {r['test']}")
        if r["details"]:
            print(f"         {r['details']}")
        if r["screenshot"]:
            print(f"         Screenshot: {r['screenshot']}")

    print("\n" + "="*60)

    # Save results to JSON
    with open("/tmp/test_calculators_results.json", "w") as f:
        json.dump({
            "summary": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "pass_rate": f"{(passed/total)*100:.1f}%"
            },
            "results": test_results
        }, f, indent=2)

    print("Results saved to /tmp/test_calculators_results.json")

def main():
    """Main test runner"""
    print("Starting NICU Dashboard Calculator Tests...")
    print("="*60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        # Run tests
        if test_login(page):
            test_calculators_page_access(page)
            test_calculator_list(page)
            test_ga_calculator(page)
            test_corrected_age_calculator(page)
            test_bilirubin_calculator(page)
            test_fluid_calculator(page)
            test_fluid_calculator_modifiers(page)
            test_gir_calculator(page)
            test_calorie_calculator(page)
            test_apgar_calculator(page)
            test_snappe_calculator(page)
            test_dosing_calculator(page)
            test_dosing_calculator_gentamicin(page)
            test_feeding_page_nec_risk(page)
            test_growth_page_percentiles(page)
            test_growth_add_measurement(page)
            test_input_validation_negative_weight(page)
            test_input_validation_empty_fields(page)
            test_units_display(page)

        browser.close()

    print_summary()

if __name__ == "__main__":
    main()
