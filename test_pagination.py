#!/usr/bin/env python3
"""Test pagination implementation across API endpoints"""

from playwright.sync_api import sync_playwright
import json

def test_pagination():
    print("Testing pagination implementation...")
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

        # Test patients endpoint with pagination
        print("\n2. Testing /api/patients pagination...")
        response = page.request.get('http://localhost:3000/api/patients?limit=3&offset=0')
        if response.ok:
            data = response.json()
            meta = data.get('meta', {})
            print(f"   Status: OK")
            print(f"   Items returned: {len(data.get('data', []))}")
            print(f"   Total: {meta.get('total', 'N/A')}")
            print(f"   Limit: {meta.get('limit', 'N/A')}")
            print(f"   Offset: {meta.get('offset', 'N/A')}")
            print(f"   Current Page: {meta.get('currentPage', 'N/A')}")
            print(f"   Total Pages: {meta.get('totalPages', 'N/A')}")
            print(f"   Has Next: {meta.get('hasNextPage', 'N/A')}")
        else:
            print(f"   ERROR: {response.status}")

        # Test alarms endpoint with pagination
        print("\n3. Testing /api/alarms pagination...")
        response = page.request.get('http://localhost:3000/api/alarms?limit=5&status=all')
        if response.ok:
            data = response.json()
            meta = data.get('meta', {})
            print(f"   Status: OK")
            print(f"   Items returned: {len(data.get('data', []))}")
            print(f"   Total: {meta.get('total', 'N/A')}")
            print(f"   Critical: {meta.get('critical', 'N/A')}")
            print(f"   Warning: {meta.get('warning', 'N/A')}")
            print(f"   Has Next: {meta.get('hasNextPage', 'N/A')}")
        else:
            print(f"   ERROR: {response.status}")

        # Test orders endpoint with pagination
        print("\n4. Testing /api/orders pagination...")
        response = page.request.get('http://localhost:3000/api/orders?limit=5')
        if response.ok:
            data = response.json()
            meta = data.get('meta', {})
            print(f"   Status: OK")
            print(f"   Items returned: {len(data.get('data', []))}")
            print(f"   Total: {meta.get('total', 'N/A')}")
            print(f"   Has Next: {meta.get('hasNextPage', 'N/A')}")
        else:
            print(f"   ERROR: {response.status}")

        # Test page-based pagination (alternative syntax)
        print("\n5. Testing page-based pagination syntax...")
        response = page.request.get('http://localhost:3000/api/patients?page=1&pageSize=2')
        if response.ok:
            data = response.json()
            meta = data.get('meta', {})
            print(f"   Status: OK")
            print(f"   Items returned: {len(data.get('data', []))}")
            print(f"   Current Page: {meta.get('currentPage', 'N/A')}")
            print(f"   Total Pages: {meta.get('totalPages', 'N/A')}")
        else:
            print(f"   ERROR: {response.status}")

        # Test second page
        print("\n6. Testing second page of patients...")
        response = page.request.get('http://localhost:3000/api/patients?page=2&pageSize=3')
        if response.ok:
            data = response.json()
            meta = data.get('meta', {})
            print(f"   Status: OK")
            print(f"   Items returned: {len(data.get('data', []))}")
            print(f"   Current Page: {meta.get('currentPage', 'N/A')}")
            print(f"   Has Previous: {meta.get('hasPrevPage', 'N/A')}")
            print(f"   Has Next: {meta.get('hasNextPage', 'N/A')}")
        else:
            print(f"   ERROR: {response.status}")

        browser.close()

    print("\n" + "=" * 60)
    print("Pagination test completed!")

if __name__ == '__main__':
    test_pagination()
