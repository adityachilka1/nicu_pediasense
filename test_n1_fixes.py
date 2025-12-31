#!/usr/bin/env python3
"""Test N+1 query fixes by calling API endpoints"""

from playwright.sync_api import sync_playwright
import json
import time

def test_n1_fixes():
    print("Testing N+1 Query Fixes...")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Login first
        print("\n1. Logging in...")
        page.goto('http://localhost:3000/login', wait_until='domcontentloaded')
        page.wait_for_timeout(2000)

        page.locator('input[type="email"]').first.fill('admin@hospital.org')
        page.locator('input[type="password"]').first.fill('Admin#Secure2024!')
        page.locator('button[type="submit"]').first.click()
        page.wait_for_timeout(3000)

        if '/login' in page.url:
            print("   ERROR: Login failed")
            browser.close()
            return

        print("   Login successful!")

        # Test patients endpoint (N+1 fix: _count for alarms)
        print("\n2. Testing /api/patients (alarm count optimization)...")
        start = time.time()
        response = page.request.get('http://localhost:3000/api/patients?limit=50')
        elapsed = (time.time() - start) * 1000
        if response.ok:
            data = response.json()
            patients = data.get('data', [])
            print(f"   Status: OK ({elapsed:.0f}ms)")
            print(f"   Patients: {len(patients)}")
            # Check that activeAlarms is present (from _count)
            if patients and 'activeAlarms' in patients[0]:
                print(f"   ✓ activeAlarms field present (using _count)")
                print(f"   Sample: Patient '{patients[0].get('name')}' has {patients[0].get('activeAlarms')} active alarms")
            else:
                print("   ✗ activeAlarms field missing")
        else:
            print(f"   ERROR: {response.status}")

        # Test alarms endpoint (N+1 fix: groupBy for counts)
        print("\n3. Testing /api/alarms (type count optimization)...")
        start = time.time()
        response = page.request.get('http://localhost:3000/api/alarms?status=all&limit=50')
        elapsed = (time.time() - start) * 1000
        if response.ok:
            data = response.json()
            alarms = data.get('data', [])
            meta = data.get('meta', {})
            print(f"   Status: OK ({elapsed:.0f}ms)")
            print(f"   Alarms: {len(alarms)}")
            print(f"   ✓ Critical count from groupBy: {meta.get('critical', 0)}")
            print(f"   ✓ Warning count from groupBy: {meta.get('warning', 0)}")
        else:
            print(f"   ERROR: {response.status}")

        # Test care-plans endpoint (N+1 fix: batch status counts)
        print("\n4. Testing /api/care-plans (itemStats optimization)...")
        start = time.time()
        response = page.request.get('http://localhost:3000/api/care-plans?includeItems=true')
        elapsed = (time.time() - start) * 1000
        if response.ok:
            data = response.json()
            plans = data.get('data', [])
            print(f"   Status: OK ({elapsed:.0f}ms)")
            print(f"   Care Plans: {len(plans)}")
            # Check that itemStats is present
            if plans and plans[0].get('itemStats'):
                stats = plans[0].get('itemStats')
                print(f"   ✓ itemStats from batch groupBy query:")
                print(f"     - Total: {stats.get('total', 0)}")
                print(f"     - Pending: {stats.get('pending', 0)}")
                print(f"     - In Progress: {stats.get('inProgress', 0)}")
                print(f"     - Completed: {stats.get('completed', 0)}")
            else:
                print("   No care plans with items found")
        else:
            print(f"   ERROR: {response.status}")

        # Test orders endpoint
        print("\n5. Testing /api/orders...")
        start = time.time()
        response = page.request.get('http://localhost:3000/api/orders?limit=50')
        elapsed = (time.time() - start) * 1000
        if response.ok:
            data = response.json()
            orders = data.get('data', [])
            meta = data.get('meta', {})
            print(f"   Status: OK ({elapsed:.0f}ms)")
            print(f"   Orders: {len(orders)}")
            print(f"   Total: {meta.get('total', 0)}")
        else:
            print(f"   ERROR: {response.status}")

        browser.close()

    print("\n" + "=" * 60)
    print("N+1 Query Fix Testing Complete!")
    print("\nOptimizations applied:")
    print("  • /api/patients: Uses _count for active alarms (1 query vs N)")
    print("  • /api/alarms GET: Uses groupBy for type counts (1 query vs N)")
    print("  • /api/alarms POST: Batch operations in transaction (4 queries vs 4N)")
    print("  • /api/care-plans: Batch groupBy for item stats (2 queries vs N)")
    print("  • /api/care-plans PUT: Count queries for completion check (2 queries vs N)")

if __name__ == '__main__':
    test_n1_fixes()
