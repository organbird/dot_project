"""
DOT-Project Screenshot Capture Script
Captures all pages from both web services using Selenium
"""
import os
import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

SCREENSHOT_DIR = r"C:\workspace\app\DOT-Project\screenshot"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def create_driver():
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--force-device-scale-factor=1")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--lang=ko-KR")
    driver = webdriver.Chrome(options=opts)
    driver.implicitly_wait(5)
    return driver

def wait_and_screenshot(driver, filename, wait_sec=3):
    time.sleep(wait_sec)
    # Scroll to top
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(0.5)
    filepath = os.path.join(SCREENSHOT_DIR, filename)
    driver.save_screenshot(filepath)
    print(f"  [OK] {filename}")
    return filepath

def full_page_screenshot(driver, filename, wait_sec=3):
    """Take full page screenshot by adjusting window height"""
    time.sleep(wait_sec)
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(0.5)

    # Get page height
    total_height = driver.execute_script("return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 1080)")
    # Cap at reasonable height
    total_height = min(total_height, 5000)

    # Resize window to capture full page
    driver.set_window_size(1920, total_height)
    time.sleep(1)

    filepath = os.path.join(SCREENSHOT_DIR, filename)
    driver.save_screenshot(filepath)
    print(f"  [OK] {filename} ({total_height}px)")

    # Reset window size
    driver.set_window_size(1920, 1080)
    time.sleep(0.3)
    return filepath

# ============================================================
# PART 1: DOT-Project Main Service (React - http://192.168.0.20:5173)
# ============================================================
def capture_dot_project():
    print("\n=== DOT-Project Main Service (React) ===")
    driver = create_driver()
    base_url = "http://192.168.0.20:5173"

    try:
        # 1. Landing / Index page
        print("\n[1] Index/Landing Page")
        driver.get(base_url + "/")
        wait_and_screenshot(driver, "dot_01_index.png", 4)

        # 2. Login page
        print("[2] Login Page")
        driver.get(base_url + "/login")
        wait_and_screenshot(driver, "dot_02_login.png", 3)

        # 3. Signup page
        print("[3] Signup Page")
        driver.get(base_url + "/signup")
        wait_and_screenshot(driver, "dot_03_signup.png", 3)

        # 4. Login with admin credentials
        print("[4] Logging in as admin...")
        driver.get(base_url + "/login")
        time.sleep(2)

        # Try to find login form and fill it
        try:
            # Look for email/id input
            email_input = None
            for selector in ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="이메일"]', 'input[placeholder*="email"]', 'input[placeholder*="아이디"]']:
                try:
                    email_input = driver.find_element(By.CSS_SELECTOR, selector)
                    break
                except NoSuchElementException:
                    continue

            if not email_input:
                # Try all text/email inputs
                inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="text"], input[type="email"], input:not([type])')
                if inputs:
                    email_input = inputs[0]

            # Look for password input
            pw_input = driver.find_element(By.CSS_SELECTOR, 'input[type="password"]')

            if email_input and pw_input:
                email_input.clear()
                email_input.send_keys("admin@dot.com")
                pw_input.clear()
                pw_input.send_keys("admin123")

                # Find and click login button
                login_btn = None
                for selector in ['button[type="submit"]', 'button:not([type])', 'input[type="submit"]']:
                    try:
                        buttons = driver.find_elements(By.CSS_SELECTOR, selector)
                        for btn in buttons:
                            text = btn.text.lower()
                            if any(keyword in text for keyword in ['로그인', 'login', '로그', '입력', '확인']):
                                login_btn = btn
                                break
                        if login_btn:
                            break
                    except:
                        continue

                if not login_btn:
                    buttons = driver.find_elements(By.CSS_SELECTOR, 'button')
                    if buttons:
                        login_btn = buttons[-1]  # Usually the last button

                if login_btn:
                    login_btn.click()
                    time.sleep(4)
                    print(f"  Current URL after login: {driver.current_url}")
                else:
                    print("  [WARN] Login button not found, trying form submit")
                    pw_input.submit()
                    time.sleep(4)
            else:
                print("  [WARN] Could not find input fields")

        except Exception as e:
            print(f"  [WARN] Login attempt: {e}")

        # Check if we're logged in by looking at current URL
        current = driver.current_url
        print(f"  After login, URL: {current}")

        # 5. Home page
        print("[5] Home Page")
        driver.get(base_url + "/home")
        full_page_screenshot(driver, "dot_04_home.png", 4)

        # 6. Dashboard (Admin)
        print("[6] Dashboard (Admin)")
        driver.get(base_url + "/dashboard")
        full_page_screenshot(driver, "dot_05_dashboard.png", 4)

        # 7. Chatbot page
        print("[7] Chatbot Page")
        driver.get(base_url + "/chatbot")
        wait_and_screenshot(driver, "dot_06_chatbot.png", 4)

        # 8. Schedule page
        print("[8] Schedule Page")
        driver.get(base_url + "/schedule")
        wait_and_screenshot(driver, "dot_07_schedule.png", 4)

        # 9. Documents page
        print("[9] Documents Page")
        driver.get(base_url + "/documents")
        wait_and_screenshot(driver, "dot_08_documents.png", 4)

        # 10. Meeting page
        print("[10] Meeting Page")
        driver.get(base_url + "/meeting")
        wait_and_screenshot(driver, "dot_09_meeting.png", 4)

        # 11. Image Generation page
        print("[11] Image Generation Page")
        driver.get(base_url + "/images")
        wait_and_screenshot(driver, "dot_10_images.png", 4)

        # 12. My Page
        print("[12] My Page")
        driver.get(base_url + "/mypage")
        full_page_screenshot(driver, "dot_11_mypage.png", 4)

        # 13. Admin - Department Management
        print("[13] Admin - Department Management")
        driver.get(base_url + "/admin/depts")
        wait_and_screenshot(driver, "dot_12_admin_depts.png", 4)

        # 14. Admin - Settings
        print("[14] Admin - Settings")
        driver.get(base_url + "/admin/settings")
        full_page_screenshot(driver, "dot_13_admin_settings.png", 4)

        print("\n  DOT-Project capture complete!")

    except Exception as e:
        print(f"  [ERROR] {e}")
    finally:
        driver.quit()

# ============================================================
# PART 2: AIDot Admin Portal (Spring Boot - http://192.168.0.9:8081)
# ============================================================
def capture_aidot():
    print("\n=== AIDot Admin Portal (Spring Boot) ===")
    driver = create_driver()
    base_url = "http://192.168.0.9:8081"

    try:
        # 1. Index/Landing page
        print("\n[1] Index/Landing Page")
        driver.get(base_url + "/")
        full_page_screenshot(driver, "aidot_01_index.png", 4)

        # 2. Download page
        print("[2] Download Page")
        driver.get(base_url + "/download-page")
        wait_and_screenshot(driver, "aidot_02_download.png", 3)

        # 3. Admin Login page
        print("[3] Admin Login Page")
        driver.get(base_url + "/system-manager-login")
        wait_and_screenshot(driver, "aidot_03_login.png", 3)

        # 4. Login with admin credentials
        print("[4] Logging in as admin...")
        try:
            # Find login form
            email_input = None
            for selector in ['input[name="userId"]', 'input[name="email"]', 'input[name="username"]', 'input[type="email"]', 'input[type="text"]']:
                try:
                    email_input = driver.find_element(By.CSS_SELECTOR, selector)
                    break
                except NoSuchElementException:
                    continue

            pw_input = driver.find_element(By.CSS_SELECTOR, 'input[type="password"]')

            if email_input and pw_input:
                email_input.clear()
                email_input.send_keys("admin@dot.com")
                pw_input.clear()
                pw_input.send_keys("admin123")

                # Click login button
                login_btn = None
                for selector in ['button[type="submit"]', 'input[type="submit"]', 'button']:
                    try:
                        login_btn = driver.find_element(By.CSS_SELECTOR, selector)
                        break
                    except NoSuchElementException:
                        continue

                if login_btn:
                    login_btn.click()
                    time.sleep(4)
                    print(f"  URL after login: {driver.current_url}")
                else:
                    pw_input.submit()
                    time.sleep(4)

        except Exception as e:
            print(f"  [WARN] Login attempt: {e}")

        # 5. Dashboard
        print("[5] Dashboard")
        driver.get(base_url + "/deployment")
        full_page_screenshot(driver, "aidot_04_dashboard.png", 4)

        # 6. Try license view if deployments exist
        print("[6] License Certificate View (if available)")
        try:
            # Check for any links to license pages
            license_links = driver.find_elements(By.CSS_SELECTOR, 'a[href*="license"]')
            if license_links:
                license_links[0].click()
                time.sleep(3)
                wait_and_screenshot(driver, "aidot_05_license.png", 2)
            else:
                # Try direct access with ID 1
                driver.get(base_url + "/deployment/license/1")
                time.sleep(3)
                if "error" not in driver.page_source.lower() and "404" not in driver.title:
                    wait_and_screenshot(driver, "aidot_05_license.png", 2)
                else:
                    print("  [SKIP] No license certificate available")
        except Exception as e:
            print(f"  [SKIP] License view: {e}")

        print("\n  AIDot capture complete!")

    except Exception as e:
        print(f"  [ERROR] {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    print("Starting screenshot capture...")
    print(f"Output directory: {SCREENSHOT_DIR}")

    capture_dot_project()
    capture_aidot()

    # List all captured files
    print("\n=== Captured Screenshots ===")
    files = sorted(os.listdir(SCREENSHOT_DIR))
    for f in files:
        if f.endswith('.png'):
            size = os.path.getsize(os.path.join(SCREENSHOT_DIR, f))
            print(f"  {f} ({size//1024}KB)")

    print(f"\nTotal: {len([f for f in files if f.endswith('.png')])} screenshots")
    print("Done!")
