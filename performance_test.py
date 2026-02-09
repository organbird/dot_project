# -*- coding: utf-8 -*-
"""
DOT-Project 성능 테스트 스크립트
- 동시접속 50명 이상
- 페이지 로딩, API 응답, 스트리밍 TTFT 테스트
"""
import requests
import time
import statistics
import concurrent.futures
from datetime import datetime

# 설정
WEB_URL = "http://192.168.0.20:8081"
API_URL = "http://192.168.0.20:8000"
PASSWORD = "admin123"
CONCURRENT_USERS = 50

# 결과 저장
results = {
    "page_load": [],
    "api_response": [],
    "login_response": [],
    "chat_session": [],
    "streaming_ttft": [],
}

def get_token(user_num):
    """로그인하여 JWT 토큰 획득"""
    email = f"testuser{user_num:03d}@test.com"
    try:
        start = time.time()
        r = requests.post(f"{API_URL}/api/login", json={"email": email, "password": PASSWORD}, timeout=10)
        elapsed = time.time() - start
        if r.status_code == 200:
            return r.json().get("access_token"), elapsed, r.json().get("user", {}).get("id")
        return None, elapsed, None
    except Exception as e:
        return None, 0, None

def test_page_load(user_num):
    """페이지 로딩 테스트"""
    try:
        start = time.time()
        r = requests.get(WEB_URL, timeout=10)
        elapsed = time.time() - start
        return {"user": user_num, "time": elapsed, "status": r.status_code}
    except Exception as e:
        return {"user": user_num, "time": 0, "status": "error", "error": str(e)}

def test_api_response(user_num, token, user_id):
    """API 응답 테스트 (채팅 세션 목록 조회)"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        start = time.time()
        r = requests.get(f"{API_URL}/chat/sessions/{user_id}", headers=headers, timeout=10)
        elapsed = time.time() - start
        return {"user": user_num, "time": elapsed, "status": r.status_code}
    except Exception as e:
        return {"user": user_num, "time": 0, "status": "error", "error": str(e)}

def test_streaming_ttft(user_num, token, user_id):
    """스트리밍 첫 토큰(TTFT) 테스트"""
    try:
        # 먼저 세션 생성
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = requests.post(f"{API_URL}/chat/sessions", json={"user_id": user_id, "title": f"Test Session {user_num}"}, headers=headers, timeout=10)
        if r.status_code != 200:
            return {"user": user_num, "ttft": 0, "status": "session_error"}

        session_id = r.json().get("session", {}).get("id")
        if not session_id:
            return {"user": user_num, "ttft": 0, "status": "no_session_id"}

        # 스트리밍 요청
        start = time.time()
        r = requests.post(
            f"{API_URL}/ai/chat/stream",
            json={"session_id": session_id, "message": "안녕하세요", "history": []},
            headers=headers,
            stream=True,
            timeout=30
        )

        # 첫 번째 청크 수신까지의 시간 측정
        ttft = None
        for chunk in r.iter_content(chunk_size=1):
            if chunk:
                ttft = time.time() - start
                break

        r.close()
        return {"user": user_num, "ttft": ttft or 0, "status": "ok" if ttft else "no_response"}
    except Exception as e:
        return {"user": user_num, "ttft": 0, "status": "error", "error": str(e)}

def run_concurrent_test(test_func, test_name, tokens_data, max_workers=50):
    """동시 접속 테스트 실행"""
    print(f"\n{'='*60}")
    print(f"[{test_name}] 동시 {max_workers}명 테스트 시작...")
    print(f"{'='*60}")

    results_list = []
    start_time = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        if test_name == "페이지 로딩":
            futures = {executor.submit(test_page_load, i): i for i in range(1, max_workers + 1)}
        elif test_name == "API 응답":
            futures = {executor.submit(test_api_response, i, tokens_data[i]["token"], tokens_data[i]["user_id"]): i
                      for i in range(1, min(max_workers + 1, len(tokens_data) + 1)) if i in tokens_data}
        elif test_name == "스트리밍 TTFT":
            futures = {executor.submit(test_streaming_ttft, i, tokens_data[i]["token"], tokens_data[i]["user_id"]): i
                      for i in range(1, min(max_workers + 1, len(tokens_data) + 1)) if i in tokens_data}

        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            results_list.append(result)

    total_time = time.time() - start_time
    return results_list, total_time

def analyze_results(results_list, metric_key, target_threshold, test_name):
    """결과 분석"""
    times = [r[metric_key] for r in results_list if r[metric_key] > 0]

    if not times:
        print(f"  [!] 유효한 결과 없음")
        return None

    avg_time = statistics.mean(times)
    max_time = max(times)
    min_time = min(times)
    p95 = sorted(times)[int(len(times) * 0.95)] if len(times) > 1 else times[0]
    success_count = len([r for r in results_list if r.get("status") in [200, "ok"]])
    fail_count = len(results_list) - success_count
    pass_count = len([t for t in times if t <= target_threshold])

    result = {
        "test_name": test_name,
        "total_requests": len(results_list),
        "success": success_count,
        "fail": fail_count,
        "avg": avg_time,
        "min": min_time,
        "max": max_time,
        "p95": p95,
        "target": target_threshold,
        "pass_rate": (pass_count / len(times) * 100) if times else 0,
        "passed": avg_time <= target_threshold
    }

    print(f"  총 요청: {result['total_requests']}건")
    print(f"  성공/실패: {result['success']}/{result['fail']}")
    print(f"  평균: {result['avg']:.3f}초")
    print(f"  최소/최대: {result['min']:.3f}초 / {result['max']:.3f}초")
    print(f"  P95: {result['p95']:.3f}초")
    print(f"  목표: {result['target']}초 이하")
    print(f"  달성률: {result['pass_rate']:.1f}%")
    print(f"  결과: {'[PASS]' if result['passed'] else '[FAIL]'}")

    return result

def main():
    print("="*70)
    print("DOT-Project 성능 테스트")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"웹 서버: {WEB_URL}")
    print(f"API 서버: {API_URL}")
    print(f"동시 접속자: {CONCURRENT_USERS}명")
    print("="*70)

    # 1. 로그인하여 토큰 획득
    print("\n[1/4] 테스트 계정 로그인 중...")
    tokens_data = {}
    login_times = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(get_token, i): i for i in range(1, CONCURRENT_USERS + 1)}
        for future in concurrent.futures.as_completed(futures):
            user_num = futures[future]
            token, elapsed, user_id = future.result()
            if token:
                tokens_data[user_num] = {"token": token, "user_id": user_id}
                login_times.append(elapsed)

    print(f"  로그인 성공: {len(tokens_data)}/{CONCURRENT_USERS}명")
    if login_times:
        print(f"  로그인 평균 시간: {statistics.mean(login_times):.3f}초")

    all_results = []

    # 2. 페이지 로딩 테스트 (목표: 3초 이하)
    page_results, _ = run_concurrent_test(test_page_load, "페이지 로딩", {}, CONCURRENT_USERS)
    result = analyze_results(page_results, "time", 3.0, "페이지 로딩")
    if result:
        all_results.append(result)

    # 3. API 응답 테스트 (목표: 2초 이하)
    if tokens_data:
        api_results, _ = run_concurrent_test(test_api_response, "API 응답", tokens_data, min(CONCURRENT_USERS, len(tokens_data)))
        result = analyze_results(api_results, "time", 2.0, "API 응답")
        if result:
            all_results.append(result)

    # 4. 스트리밍 TTFT 테스트 (목표: 2초 이하) - 10명씩 테스트
    if tokens_data:
        print(f"\n{'='*60}")
        print("[스트리밍 TTFT] 동시 10명 테스트 시작...")
        print(f"{'='*60}")

        ttft_results = []
        test_users = min(10, len(tokens_data))

        with concurrent.futures.ThreadPoolExecutor(max_workers=test_users) as executor:
            futures = {executor.submit(test_streaming_ttft, i, tokens_data[i]["token"], tokens_data[i]["user_id"]): i
                      for i in list(tokens_data.keys())[:test_users]}
            for future in concurrent.futures.as_completed(futures):
                ttft_results.append(future.result())

        result = analyze_results(ttft_results, "ttft", 2.0, "스트리밍 TTFT")
        if result:
            all_results.append(result)

    # 최종 보고서
    print("\n" + "="*70)
    print("[REPORT] 최종 성능 테스트 보고서")
    print("="*70)
    print(f"테스트 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"테스트 환경: 웹({WEB_URL}), API({API_URL})")
    print(f"동시 접속자: {CONCURRENT_USERS}명")
    print("-"*70)
    print(f"{'테스트 항목':<20} {'평균':<10} {'P95':<10} {'목표':<10} {'달성률':<10} {'결과':<10}")
    print("-"*70)

    for r in all_results:
        status = "[PASS]" if r["passed"] else "[FAIL]"
        print(f"{r['test_name']:<20} {r['avg']:.3f}초    {r['p95']:.3f}초    {r['target']}초     {r['pass_rate']:.1f}%      {status}")

    print("-"*70)

    # 미테스트 항목 안내
    print("\n[!] 별도 테스트 필요 항목:")
    print("  - 이미지 생성 (512px): 목표 30초 이하 - GPU Worker 필요")
    print("  - STT 변환 (1분 음성): 목표 2분 이하 - GPU Worker + 오디오 파일 필요")

    passed_count = len([r for r in all_results if r["passed"]])
    print(f"\n총 {len(all_results)}개 테스트 중 {passed_count}개 통과")

    return all_results

if __name__ == "__main__":
    main()
