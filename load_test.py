# -*- coding: utf-8 -*-
"""
DOT-Project 부하 테스트 - 동시접속 50~100명 확장 테스트
"""
import requests
import time
import statistics
import concurrent.futures
from datetime import datetime

WEB_URL = "http://192.168.0.20:8081"
API_URL = "http://192.168.0.12:8000"
PASSWORD = "admin123"

def get_token(user_num):
    email = f"testuser{user_num:03d}@test.com"
    try:
        r = requests.post(f"{API_URL}/api/login", json={"email": email, "password": PASSWORD}, timeout=10)
        if r.status_code == 200:
            data = r.json()
            return data.get("access_token"), data.get("user", {}).get("id")
    except:
        pass
    return None, None

def test_page_load():
    try:
        start = time.time()
        r = requests.get(WEB_URL, timeout=10)
        return time.time() - start, r.status_code
    except:
        return 0, "error"

def test_api_call(token, user_id):
    try:
        headers = {"Authorization": f"Bearer {token}"}
        start = time.time()
        r = requests.get(f"{API_URL}/chat/sessions/{user_id}", headers=headers, timeout=10)
        return time.time() - start, r.status_code
    except:
        return 0, "error"

def run_load_test(concurrent_users, tokens_data):
    print(f"\n{'='*60}")
    print(f"[LOAD TEST] 동시 접속자 {concurrent_users}명")
    print(f"{'='*60}")

    # 페이지 로딩 테스트
    page_times = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrent_users) as executor:
        futures = [executor.submit(test_page_load) for _ in range(concurrent_users)]
        for f in concurrent.futures.as_completed(futures):
            elapsed, status = f.result()
            if elapsed > 0:
                page_times.append(elapsed)

    if page_times:
        print(f"  [페이지 로딩] 평균: {statistics.mean(page_times):.3f}초, P95: {sorted(page_times)[int(len(page_times)*0.95)]:.3f}초, 최대: {max(page_times):.3f}초")

    # API 응답 테스트
    api_times = []
    test_count = min(concurrent_users, len(tokens_data))
    user_list = list(tokens_data.keys())[:test_count]

    with concurrent.futures.ThreadPoolExecutor(max_workers=test_count) as executor:
        futures = [executor.submit(test_api_call, tokens_data[u]["token"], tokens_data[u]["user_id"]) for u in user_list]
        for f in concurrent.futures.as_completed(futures):
            elapsed, status = f.result()
            if elapsed > 0:
                api_times.append(elapsed)

    if api_times:
        print(f"  [API 응답]    평균: {statistics.mean(api_times):.3f}초, P95: {sorted(api_times)[int(len(api_times)*0.95)]:.3f}초, 최대: {max(api_times):.3f}초")

    return {
        "users": concurrent_users,
        "page_avg": statistics.mean(page_times) if page_times else 0,
        "page_p95": sorted(page_times)[int(len(page_times)*0.95)] if len(page_times) > 1 else (page_times[0] if page_times else 0),
        "page_max": max(page_times) if page_times else 0,
        "api_avg": statistics.mean(api_times) if api_times else 0,
        "api_p95": sorted(api_times)[int(len(api_times)*0.95)] if len(api_times) > 1 else (api_times[0] if api_times else 0),
        "api_max": max(api_times) if api_times else 0,
    }

def main():
    print("="*70)
    print("DOT-Project 부하 테스트 (동시접속 50~100명)")
    print(f"시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)

    # 토큰 획득
    print("\n[준비] 테스트 계정 로그인 중...")
    tokens_data = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(get_token, i): i for i in range(1, 101)}
        for f in concurrent.futures.as_completed(futures):
            user_num = futures[f]
            token, user_id = f.result()
            if token:
                tokens_data[user_num] = {"token": token, "user_id": user_id}

    print(f"  로그인 성공: {len(tokens_data)}명")

    # 부하 테스트
    test_levels = [50, 75, 100]
    all_results = []

    for level in test_levels:
        result = run_load_test(level, tokens_data)
        all_results.append(result)
        time.sleep(2)  # 쿨다운

    # 최종 보고서
    print("\n" + "="*70)
    print("[FINAL REPORT] 부하 테스트 결과 요약")
    print("="*70)
    print(f"{'동시접속':<12} {'페이지 평균':<12} {'페이지 P95':<12} {'API 평균':<12} {'API P95':<12}")
    print("-"*70)

    for r in all_results:
        page_status = "[PASS]" if r["page_avg"] <= 3.0 else "[FAIL]"
        api_status = "[PASS]" if r["api_avg"] <= 2.0 else "[FAIL]"
        print(f"{r['users']:<12} {r['page_avg']:.3f}초 {page_status:<4}  {r['page_p95']:.3f}초       {r['api_avg']:.3f}초 {api_status:<4}  {r['api_p95']:.3f}초")

    print("-"*70)
    print("목표: 페이지 로딩 3초 이하, API 응답 2초 이하")
    print("="*70)

if __name__ == "__main__":
    main()
