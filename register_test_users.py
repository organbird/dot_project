# -*- coding: utf-8 -*-
"""
100명의 테스트 사용자 등록 스크립트 (개선 버전)
"""
import requests
import random
import time

BASE_URL = "http://192.168.0.12:8000"

# 한국 이름 샘플
LAST_NAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"]
FIRST_NAMES = ["민준", "서준", "도윤", "예준", "시우", "하준", "지호", "주원", "지후", "준서",
               "서연", "서윤", "지우", "서현", "민서", "하은", "하윤", "윤서", "지민", "채원",
               "현우", "지훈", "건우", "우진", "선우", "준혁", "승현", "민재", "현준", "유준",
               "수아", "지아", "다은", "예은", "수빈", "지영", "유진", "미영", "소연", "혜진"]

# 부서 목록 (1~5번 부서)
DEPT_LIST = [1, 2, 3, 4, 5]

def register_user(user_data, retry=3):
    """사용자 등록 API 호출 (재시도 포함)"""
    for attempt in range(retry):
        try:
            response = requests.post(
                f"{BASE_URL}/api/register",
                json=user_data,
                timeout=10,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                return response.status_code, response.json()
            elif response.status_code == 400:
                # 중복 에러 등은 재시도하지 않음
                try:
                    return response.status_code, response.json()
                except:
                    return response.status_code, {"detail": response.text or "Bad Request"}
            else:
                try:
                    return response.status_code, response.json()
                except:
                    return response.status_code, {"detail": f"HTTP {response.status_code}"}
        except requests.exceptions.Timeout:
            if attempt < retry - 1:
                time.sleep(0.5)
                continue
            return None, "Timeout"
        except Exception as e:
            if attempt < retry - 1:
                time.sleep(0.5)
                continue
            return None, str(e)
    return None, "Max retries exceeded"

def main():
    success_count = 0
    fail_count = 0
    failed_users = []

    print("=" * 60)
    print("테스트 사용자 100명 등록 시작")
    print(f"서버: {BASE_URL}")
    print("=" * 60)

    for i in range(1, 101):
        name = random.choice(LAST_NAMES) + random.choice(FIRST_NAMES)
        email = f"testuser{i:03d}@test.com"
        # 고유한 전화번호 생성 (번호 겹침 방지)
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

        status, result = register_user(user_data)

        if status == 200:
            success_count += 1
            print(f"[{i:3d}/100] OK - {email} ({name})")
        elif status == 400 and "이미 등록" in str(result.get("detail", "")):
            # 이미 등록된 경우 성공으로 카운트
            success_count += 1
            print(f"[{i:3d}/100] SKIP - {email} (이미 등록됨)")
        else:
            fail_count += 1
            detail = result.get("detail", result) if isinstance(result, dict) else result
            print(f"[{i:3d}/100] FAIL - {email}: {detail}")
            failed_users.append((i, email, detail))

        # 서버 부하 방지
        time.sleep(0.05)

    print("=" * 60)
    print(f"완료! 성공: {success_count}명, 실패: {fail_count}명")
    print("=" * 60)

    if failed_users:
        print("\n실패 목록:")
        for idx, email, reason in failed_users[:10]:
            print(f"  - {email}: {reason}")
        if len(failed_users) > 10:
            print(f"  ... 외 {len(failed_users) - 10}건")

    print("\n" + "=" * 60)
    print("로그인 테스트 계정 정보:")
    print("  이메일: testuser001@test.com ~ testuser100@test.com")
    print("  비밀번호: admin123")
    print("=" * 60)

if __name__ == "__main__":
    main()
