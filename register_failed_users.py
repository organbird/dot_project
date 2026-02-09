# -*- coding: utf-8 -*-
"""
실패한 사용자들 재등록 스크립트
"""
import requests
import random
import time

BASE_URL = "http://192.168.0.12:8000"

LAST_NAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"]
FIRST_NAMES = ["민준", "서준", "도윤", "예준", "시우", "하준", "지호", "주원", "지후", "준서",
               "서연", "서윤", "지우", "서현", "민서", "하은", "하윤", "윤서", "지민", "채원"]

DEPT_LIST = [1, 2, 3, 4, 5]

# 실패한 번호들
FAILED_NUMBERS = [3, 9, 10, 16, 22, 30, 31, 33, 38, 40, 41, 51, 57, 69, 72, 74, 76, 78, 82, 86, 96, 98]

def register_user(user_data):
    try:
        response = requests.post(
            f"{BASE_URL}/api/register",
            json=user_data,
            timeout=15,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.status_code, response.json()
        elif response.status_code == 400:
            try:
                return response.status_code, response.json()
            except:
                return response.status_code, {"detail": response.text}
        else:
            return response.status_code, {"detail": f"HTTP {response.status_code}"}
    except Exception as e:
        return None, str(e)

def main():
    success_count = 0
    fail_count = 0

    print("=" * 60)
    print(f"실패한 사용자 {len(FAILED_NUMBERS)}명 재등록")
    print("=" * 60)

    for i in FAILED_NUMBERS:
        name = random.choice(LAST_NAMES) + random.choice(FIRST_NAMES)
        email = f"testuser{i:03d}@test.com"
        phone = f"010-{8000+i:04d}-{1000+i:04d}"
        dept_idx = random.choice(DEPT_LIST)
        gender = random.choice(["M", "F"])

        user_data = {
            "email": email,
            "name": name,
            "password": "admin123",
            "phone": phone,
            "dept_idx": dept_idx,
            "role": "USER",
            "gender": gender
        }

        # 재시도 루프
        for attempt in range(3):
            status, result = register_user(user_data)

            if status == 200:
                success_count += 1
                print(f"OK - {email} ({name})")
                break
            elif status == 400 and "이미 등록" in str(result.get("detail", "")):
                success_count += 1
                print(f"SKIP - {email} (이미 등록됨)")
                break
            else:
                if attempt < 2:
                    time.sleep(1)
                    continue
                fail_count += 1
                detail = result.get("detail", result) if isinstance(result, dict) else result
                print(f"FAIL - {email}: {detail}")

        time.sleep(0.2)

    print("=" * 60)
    print(f"완료! 성공: {success_count}명, 실패: {fail_count}명")
    print(f"총 등록 완료: {78 + success_count}명 / 100명")
    print("=" * 60)

if __name__ == "__main__":
    main()
