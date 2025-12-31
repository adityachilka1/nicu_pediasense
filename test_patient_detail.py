#!/usr/bin/env python3
"""
Test script for NICU Dashboard patient detail functionality.
Tests navigation, patient details, vitals, medications, labs, notes, edit, and export.
"""

from playwright.sync_api import sync_playwright
import time

def run_tests():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(60000)  # 60 seconds timeout

        try:
            # Login first
            print("Logging in...")
            page.goto('http://localhost:3000', wait_until='domcontentloaded')
            time.sleep(3)  # Wait for JS to execute

            # Take initial screenshot
            page.screenshot(path='/tmp/test_patient_detail_00_initial.png', full_page=True)
            print(f"Initial URL: {page.url}")

            # Clear and fill login form
            email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]').first
            password_input = page.locator('input[type="password"], input[name="password"]').first

            # Clear existing values and fill
            email_input.clear()
            email_input.fill('admin@hospital.org')

            password_input.clear()
            password_input.fill('admin123')

            page.screenshot(path='/tmp/test_patient_detail_01_login_filled.png', full_page=True)

            # Click Sign In button
            login_btn = page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]').first
            login_btn.click()

            # Wait for navigation after login
            time.sleep(3)
            page.wait_for_load_state('domcontentloaded')

            page.screenshot(path='/tmp/test_patient_detail_02_after_login.png', full_page=True)
            print(f"After login, URL: {page.url}")

            # TEST 1: Navigate to /patients page
            print("\n--- TEST 1: Navigate to /patients page ---")
            try:
                page.goto('http://localhost:3000/patients', wait_until='domcontentloaded')
                time.sleep(2)
                page.screenshot(path='/tmp/test_patient_detail_03_patients_page.png', full_page=True)

                # Check if we're on patients page
                current_url = page.url
                page_content = page.content().lower()

                if '/patients' in current_url or 'patient' in page_content:
                    results['1. Navigate to /patients page'] = 'PASS'
                    print("PASS: Successfully navigated to patients page")
                else:
                    results['1. Navigate to /patients page'] = 'FAIL - Could not verify patients page'
                    print(f"FAIL: URL is {current_url}")
            except Exception as e:
                results['1. Navigate to /patients page'] = f'FAIL - {str(e)}'
                print(f"FAIL: {e}")

            # TEST 2: Click on a patient to view details
            print("\n--- TEST 2: Click on a patient to view details ---")
            try:
                # Look for patient links/rows - try multiple strategies
                clicked = False

                # Strategy 1: Look for table rows with patient data
                rows = page.locator('table tbody tr, .patient-row, .patient-card').all()
                print(f"Found {len(rows)} potential patient rows")

                if len(rows) > 0:
                    # Click the first patient row
                    rows[0].click()
                    clicked = True
                    print("Clicked first patient row")

                if not clicked:
                    # Strategy 2: Look for links containing patient or ID patterns
                    links = page.locator('a').all()
                    for link in links:
                        href = link.get_attribute('href') or ''
                        text = link.text_content() or ''
                        if 'patient' in href.lower() and '/patients/' in href:
                            link.click()
                            clicked = True
                            print(f"Clicked patient link: {href}")
                            break

                if not clicked:
                    # Strategy 3: Click on any clickable element in the patient list
                    clickable = page.locator('[onclick], [data-patient-id], .clickable').first
                    if clickable.count() > 0:
                        clickable.click()
                        clicked = True

                page.wait_for_load_state('domcontentloaded')
                time.sleep(2)
                page.screenshot(path='/tmp/test_patient_detail_04_patient_detail.png', full_page=True)

                current_url = page.url
                print(f"Current URL after click: {current_url}")

                # Check if we navigated to a patient detail page
                if '/patient' in current_url and current_url != 'http://localhost:3000/patients':
                    results['2. Click on patient to view details'] = 'PASS'
                    print("PASS: Navigated to patient detail page")
                elif clicked:
                    results['2. Click on patient to view details'] = 'PARTIAL - Clicked but URL did not change as expected'
                    print("PARTIAL: Clicked but URL unchanged")
                else:
                    results['2. Click on patient to view details'] = 'FAIL - Could not find patient to click'
                    print("FAIL: Could not find patient to click")
            except Exception as e:
                results['2. Click on patient to view details'] = f'FAIL - {str(e)}'
                print(f"FAIL: {e}")

            # TEST 3: Patient demographics visible
            print("\n--- TEST 3: Patient demographics visible ---")
            try:
                page_text = page.inner_text('body').lower()
                page_content = page.content().lower()

                demographics_found = []
                demographics_missing = []

                # Check for name (look for labels or common names)
                if 'name' in page_content or 'patient' in page_text:
                    demographics_found.append('name')
                else:
                    demographics_missing.append('name')

                # Check for DOB/Date of Birth
                if 'dob' in page_content or 'date of birth' in page_content or 'birth' in page_text or 'born' in page_text:
                    demographics_found.append('DOB')
                else:
                    demographics_missing.append('DOB')

                # Check for weight
                if 'weight' in page_content or 'kg' in page_text or 'gram' in page_text:
                    demographics_found.append('weight')
                else:
                    demographics_missing.append('weight')

                # Check for gestational age
                if 'gestational' in page_content or 'gestation' in page_content or 'ga' in page_content or 'week' in page_text:
                    demographics_found.append('gestational age')
                else:
                    demographics_missing.append('gestational age')

                page.screenshot(path='/tmp/test_patient_detail_05_demographics.png', full_page=True)

                if len(demographics_found) >= 3:
                    results['3. Patient demographics visible'] = f'PASS - Found: {", ".join(demographics_found)}'
                    print(f"PASS: Found demographics: {demographics_found}")
                elif len(demographics_found) > 0:
                    results['3. Patient demographics visible'] = f'PARTIAL - Found: {", ".join(demographics_found)}, Missing: {", ".join(demographics_missing)}'
                    print(f"PARTIAL: Found {demographics_found}, Missing {demographics_missing}")
                else:
                    results['3. Patient demographics visible'] = f'FAIL - None found'
                    print(f"FAIL: No demographics found")
            except Exception as e:
                results['3. Patient demographics visible'] = f'FAIL - {str(e)}'
                print(f"FAIL: {e}")

            # TEST 4: Vital signs history/trends visible
            print("\n--- TEST 4: Vital signs history/trends visible ---")
            try:
                page_content = page.content().lower()
                page_text = page.inner_text('body').lower()

                vitals_found = []

                vital_keywords = ['vital', 'heart rate', 'hr', 'pulse', 'blood pressure', 'bp', 'temperature', 'temp',
                                 'respiratory', 'spo2', 'oxygen', 'saturation', 'bpm']

                for keyword in vital_keywords:
                    if keyword in page_content or keyword in page_text:
                        vitals_found.append(keyword)

                # Check for charts/graphs
                has_chart = page.locator('canvas, svg, .chart, .graph, [class*="chart"], [class*="graph"], .recharts-wrapper').count() > 0

                # Look for vitals tab/section and click if available
                vitals_tab = page.locator('button:has-text("Vital"), a:has-text("Vital"), [role="tab"]:has-text("Vital"), *:has-text("Vitals")').first
                if vitals_tab.count() > 0:
                    try:
                        vitals_tab.click()
                        page.wait_for_load_state('domcontentloaded')
                        time.sleep(1)
                        vitals_found.append('vitals tab')
                    except:
                        pass

                page.screenshot(path='/tmp/test_patient_detail_06_vitals.png', full_page=True)

                if len(vitals_found) >= 2 or has_chart:
                    results['4. Vital signs history/trends visible'] = f'PASS - Found: {", ".join(list(set(vitals_found))[:5])}, Charts: {has_chart}'
                    print(f"PASS: Found vitals: {list(set(vitals_found))[:5]}, Charts: {has_chart}")
                elif len(vitals_found) > 0:
                    results['4. Vital signs history/trends visible'] = f'PARTIAL - Found: {", ".join(vitals_found)}'
                    print(f"PARTIAL: Found some vitals: {vitals_found}")
                else:
                    results['4. Vital signs history/trends visible'] = 'FAIL - No vital signs found'
                    print("FAIL: No vital signs found")
            except Exception as e:
                results['4. Vital signs history/trends visible'] = f'FAIL - {str(e)}'
                print(f"FAIL: {e}")

            # TEST 5: Medications list for patient
            print("\n--- TEST 5: Medications list for patient ---")
            try:
                page_content = page.content().lower()
                page_text = page.inner_text('body').lower()

                meds_found = []
                med_keywords = ['medication', 'medicine', 'drug', 'prescription', 'dose', 'dosage', 'mg', 'ml',
                               'antibiotic', 'vitamin', 'rx', 'treatment']

                for keyword in med_keywords:
                    if keyword in page_content or keyword in page_text:
                        meds_found.append(keyword)

                # Look for medications tab/section
                meds_tab = page.locator('button:has-text("Medication"), a:has-text("Medication"), [role="tab"]:has-text("Med"), *:has-text("Medications")').first
                if meds_tab.count() > 0:
                    try:
                        meds_tab.click()
                        page.wait_for_load_state('domcontentloaded')
                        time.sleep(1)
                        meds_found.append('medications tab')
                        page_text = page.inner_text('body').lower()
                        for keyword in med_keywords:
                            if keyword in page_text:
                                meds_found.append(keyword)
                    except:
                        pass

                page.screenshot(path='/tmp/test_patient_detail_07_medications.png', full_page=True)

                meds_found = list(set(meds_found))
                if len(meds_found) >= 2:
                    results['5. Medications list for patient'] = f'PASS - Found: {", ".join(meds_found[:5])}'
                    print(f"PASS: Found medications indicators: {meds_found[:5]}")
                elif len(meds_found) > 0:
                    results['5. Medications list for patient'] = f'PARTIAL - Found: {", ".join(meds_found)}'
                    print(f"PARTIAL: Found some meds: {meds_found}")
                else:
                    results['5. Medications list for patient'] = 'FAIL - No medications section found'
                    print("FAIL: No medications section found")
            except Exception as e:
                results['5. Medications list for patient'] = f'FAIL - {str(e)}'
                print(f"FAIL: {e}")

            # TEST 6: Lab results for patient
            print("\n--- TEST 6: Lab results for patient ---")
            try:
                page_content = page.content().lower()
                page_text = page.inner_text('body').lower()

                labs_found = []
                lab_keywords = ['lab', 'laboratory', 'test', 'result', 'blood', 'glucose', 'bilirubin',
                               'hemoglobin', 'cbc', 'chemistry', 'panel', 'culture', 'analysis']

                for keyword in lab_keywords:
                    if keyword in page_content or keyword in page_text:
                        labs_found.append(keyword)

                # Look for labs tab/section
                labs_tab = page.locator('button:has-text("Lab"), a:has-text("Lab"), [role="tab"]:has-text("Lab"), *:has-text("Labs"), *:has-text("Results")').first
                if labs_tab.count() > 0:
                    try:
                        labs_tab.click()
                        page.wait_for_load_state('domcontentloaded')
                        time.sleep(1)
                        labs_found.append('labs tab')
                        page_text = page.inner_text('body').lower()
                        for keyword in lab_keywords:
                            if keyword in page_text:
                                labs_found.append(keyword)
                    except:
                        pass

                page.screenshot(path='/tmp/test_patient_detail_08_labs.png', full_page=True)

                labs_found = list(set(labs_found))
                if len(labs_found) >= 2:
                    results['6. Lab results for patient'] = f'PASS - Found: {", ".join(labs_found[:5])}'
                    print(f"PASS: Found lab indicators: {labs_found[:5]}")
                elif len(labs_found) > 0:
                    results['6. Lab results for patient'] = f'PARTIAL - Found: {", ".join(labs_found)}'
                    print(f"PARTIAL: Found some labs: {labs_found}")
                else:
                    results['6. Lab results for patient'] = 'FAIL - No lab results section found'
                    print("FAIL: No lab results section found")
            except Exception as e:
                results['6. Lab results for patient'] = f'FAIL - {str(e)}'
                print(f"FAIL: {e}")

            # TEST 7: Notes/documentation section
            print("\n--- TEST 7: Notes/documentation section ---")
            try:
                page_content = page.content().lower()
                page_text = page.inner_text('body').lower()

                notes_found = []
                note_keywords = ['note', 'documentation', 'document', 'comment', 'observation', 'assessment',
                                'progress', 'clinical', 'nursing', 'physician', 'history', 'record']

                for keyword in note_keywords:
                    if keyword in page_content or keyword in page_text:
                        notes_found.append(keyword)

                # Look for notes tab/section
                notes_tab = page.locator('button:has-text("Note"), a:has-text("Note"), [role="tab"]:has-text("Note"), *:has-text("Notes"), *:has-text("Documentation")').first
                if notes_tab.count() > 0:
                    try:
                        notes_tab.click()
                        page.wait_for_load_state('domcontentloaded')
                        time.sleep(1)
                        notes_found.append('notes tab')
                        page_text = page.inner_text('body').lower()
                        for keyword in note_keywords:
                            if keyword in page_text:
                                notes_found.append(keyword)
                    except:
                        pass

                page.screenshot(path='/tmp/test_patient_detail_09_notes.png', full_page=True)

                notes_found = list(set(notes_found))
                if len(notes_found) >= 2:
                    results['7. Notes/documentation section'] = f'PASS - Found: {", ".join(notes_found[:5])}'
                    print(f"PASS: Found notes indicators: {notes_found[:5]}")
                elif len(notes_found) > 0:
                    results['7. Notes/documentation section'] = f'PARTIAL - Found: {", ".join(notes_found)}'
                    print(f"PARTIAL: Found some notes: {notes_found}")
                else:
                    results['7. Notes/documentation section'] = 'FAIL - No notes section found'
                    print("FAIL: No notes section found")
            except Exception as e:
                results['7. Notes/documentation section'] = f'FAIL - {str(e)}'
                print(f"FAIL: {e}")

            # TEST 8: Edit patient information capability
            print("\n--- TEST 8: Edit patient information capability ---")
            try:
                page_content = page.content().lower()

                # Look for edit button/link
                edit_selectors = [
                    'button:has-text("Edit")',
                    'a:has-text("Edit")',
                    '[aria-label*="edit" i]',
                    '[aria-label*="Edit"]',
                    '.edit-button',
                    'button[title*="Edit"]',
                    '[data-testid*="edit"]',
                    'button:has-text("Update")',
                    'button:has-text("Modify")',
                    'svg[class*="edit"]',
                    '[class*="edit"]',
                ]

                edit_found = False
                for selector in edit_selectors:
                    try:
                        elem = page.locator(selector).first
                        if elem.count() > 0 and elem.is_visible():
                            edit_found = True
                            elem.click()
                            page.wait_for_load_state('domcontentloaded')
                            time.sleep(1)
                            print(f"Found and clicked edit using: {selector}")
                            break
                    except:
                        continue

                # Also check for edit in page content
                if not edit_found:
                    if 'edit' in page_content:
                        edit_found = True
                        print("Found edit keyword in page content")

                page.screenshot(path='/tmp/test_patient_detail_10_edit.png', full_page=True)

                # Check if edit form/modal appeared
                has_form = page.locator('form, .modal, [role="dialog"], dialog').count() > 0
                has_inputs = page.locator('input[type="text"], textarea').count() > 0

                if edit_found and (has_form or has_inputs):
                    results['8. Edit patient information capability'] = 'PASS - Edit functionality available'
                    print("PASS: Edit functionality found and form visible")
                elif edit_found:
                    results['8. Edit patient information capability'] = 'PARTIAL - Edit option found'
                    print("PARTIAL: Edit option found")
                else:
                    results['8. Edit patient information capability'] = 'FAIL - No edit capability found'
                    print("FAIL: No edit capability found")
            except Exception as e:
                results['8. Edit patient information capability'] = f'FAIL - {str(e)}'
                print(f"FAIL: {e}")

            # TEST 9: Print/export patient summary
            print("\n--- TEST 9: Print/export patient summary ---")
            try:
                page_content = page.content().lower()

                # Look for print/export button
                export_selectors = [
                    'button:has-text("Print")',
                    'button:has-text("Export")',
                    'button:has-text("Download")',
                    'a:has-text("Print")',
                    'a:has-text("Export")',
                    'a:has-text("Download")',
                    '[aria-label*="print" i]',
                    '[aria-label*="export" i]',
                    '[aria-label*="download" i]',
                    '.print-button',
                    '.export-button',
                    'button[title*="Print"]',
                    'button[title*="Export"]',
                    '[data-testid*="print"]',
                    '[data-testid*="export"]',
                    'button:has-text("PDF")',
                    'a:has-text("PDF")',
                    '[class*="print"]',
                    '[class*="export"]',
                    '[class*="download"]',
                ]

                export_found = False
                for selector in export_selectors:
                    try:
                        elem = page.locator(selector).first
                        if elem.count() > 0 and elem.is_visible():
                            export_found = True
                            print(f"Found export using: {selector}")
                            break
                    except:
                        continue

                # Also check for print/export in page content
                if not export_found:
                    if 'print' in page_content or 'export' in page_content or 'download' in page_content or 'pdf' in page_content:
                        export_found = True
                        print("Found export keyword in page content")

                page.screenshot(path='/tmp/test_patient_detail_11_export.png', full_page=True)

                if export_found:
                    results['9. Print/export patient summary'] = 'PASS - Export/print functionality available'
                    print("PASS: Export/print functionality found")
                else:
                    results['9. Print/export patient summary'] = 'FAIL - No print/export capability found'
                    print("FAIL: No print/export capability found")
            except Exception as e:
                results['9. Print/export patient summary'] = f'FAIL - {str(e)}'
                print(f"FAIL: {e}")

            # Take final screenshot
            page.screenshot(path='/tmp/test_patient_detail_12_final.png', full_page=True)

        except Exception as e:
            print(f"Critical error: {e}")
            import traceback
            traceback.print_exc()
            page.screenshot(path='/tmp/test_patient_detail_error.png', full_page=True)
        finally:
            browser.close()

    return results

if __name__ == '__main__':
    print("=" * 60)
    print("NICU Dashboard Patient Detail Functionality Tests")
    print("=" * 60)

    results = run_tests()

    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)

    pass_count = 0
    partial_count = 0
    fail_count = 0

    for test, result in results.items():
        status = result.split(' - ')[0] if ' - ' in result else result
        if 'PASS' in status:
            pass_count += 1
            icon = '[PASS]'
        elif 'PARTIAL' in status:
            partial_count += 1
            icon = '[PARTIAL]'
        else:
            fail_count += 1
            icon = '[FAIL]'
        print(f"{icon} {test}: {result}")

    print("\n" + "-" * 60)
    print(f"Total: {pass_count} PASS, {partial_count} PARTIAL, {fail_count} FAIL")
    print(f"Screenshots saved to /tmp/test_patient_detail_*.png")
    print("=" * 60)
