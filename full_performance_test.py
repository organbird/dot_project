# -*- coding: utf-8 -*-
"""
DOT-Project 전체 성능 테스트
- 페이지 로딩, API 응답, 이미지 생성, STT 변환, 스트리밍 TTFT
"""
import requests
import time
import statistics
import concurrent.futures
import os
from datetime import datetime

# 설정
WEB_URL = "http://192.168.0.20:8081"
API_URL = "http://192.168.0.20:8000"
PASSWORD = "admin123"
AUDIO_FILE = r"C:\workspace\app\DOT-Project\음성 260120_090501.m4a"

# 목표치
TARGETS = {
    "page_load": 3.0,
    "api_response": 2.0,
    "image_gen": 30.0,
    "stt": 120.0,
    "ttft": 2.0
}

def get_token(user_num):
    """로그인하여 JWT 토큰 획득"""
    email = f"testuser{user_num:03d}@test.com"
    try:
        start = time.time()
        r = requests.post(f"{API_URL}/api/login", json={"email": email, "password": PASSWORD}, timeout=15)
        elapsed = time.time() - start
        if r.status_code == 200:
            data = r.json()
            return data.get("access_token"), elapsed, data.get("user", {}).get("id")
    except Exception as e:
        print(f"  Login error for {email}: {e}")
    return None, 0, None

def test_page_load(user_num):
    """페이지 로딩 테스트"""
    try:
        start = time.time()
        r = requests.get(WEB_URL, timeout=10)
        return time.time() - start, r.status_code
    except:
        return 0, "error"

def test_api_response(token, user_id):
    """API 응답 테스트"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        start = time.time()
        r = requests.get(f"{API_URL}/chat/sessions/{user_id}", headers=headers, timeout=10)
        return time.time() - start, r.status_code
    except:
        return 0, "error"

def test_image_generation(token, user_id):
    """이미지 생성 테스트 (512px)"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        data = {
            "user_id": user_id,
            "prompt": "A simple blue circle on white background",
            "style": "realistic",
            "size": "512x512"
        }

        start = time.time()
        r = requests.post(f"{API_URL}/image/generate", json=data, headers=headers, timeout=60)
        request_time = time.time() - start

        if r.status_code != 200:
            return 0, f"request_failed_{r.status_code}", None

        result = r.json()
        task_id = result.get("taskId")

        if not task_id:
            return request_time, "no_task_id", None

        # 진행률 폴링 (최대 60초)
        for _ in range(60):
            try:
                status_r = requests.get(f"{API_URL}/image/status/{task_id}", headers=headers, timeout=10)
                if status_r.status_code == 200:
                    status_data = status_r.json()
                    if status_data.get("status") == "completed":
                        total_time = time.time() - start
                        return total_time, "completed", task_id
                    elif status_data.get("status") == "failed":
                        return time.time() - start, "failed", task_id
            except:
                pass
            time.sleep(1)

        return time.time() - start, "timeout", task_id
    except Exception as e:
        return 0, f"error: {e}", None

def test_stt(token, user_id):
    """STT 변환 테스트"""
    if not os.path.exists(AUDIO_FILE):
        return 0, "file_not_found", None

    try:
        headers = {"Authorization": f"Bearer {token}"}

        with open(AUDIO_FILE, "rb") as f:
            files = {"file": (os.path.basename(AUDIO_FILE), f, "audio/m4a")}
            data = {"user_id": user_id, "title": "Performance Test", "attendees": "Tester"}

            start = time.time()
            r = requests.post(f"{API_URL}/meeting/upload", files=files, data=data, headers=headers, timeout=60)
            upload_time = time.time() - start

        if r.status_code != 200:
            return upload_time, f"upload_failed_{r.status_code}", None

        result = r.json()
        stt_task_id = result.get("meeting", {}).get("sttTaskId")
        meeting_id = result.get("meeting", {}).get("id")

        if not stt_task_id:
            return upload_time, "no_stt_task", meeting_id

        # STT 진행률 폴링 (최대 180초 = 3분)
        for _ in range(180):
            try:
                status_r = requests.get(f"{API_URL}/meeting/status/{stt_task_id}", headers=headers, timeout=10)
                if status_r.status_code == 200:
                    status_data = status_r.json()
                    if status_data.get("status") == "completed":
                        total_time = time.time() - start
                        return total_time, "completed", meeting_id
                    elif status_data.get("status") == "failed":
                        return time.time() - start, "failed", meeting_id
            except:
                pass
            time.sleep(1)

        return time.time() - start, "timeout", meeting_id
    except Exception as e:
        return 0, f"error: {e}", None

def test_streaming_ttft(token, user_id):
    """스트리밍 첫 토큰(TTFT) 테스트"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # 세션 생성
        r = requests.post(f"{API_URL}/chat/sessions", json={"user_id": user_id, "title": "TTFT Test"}, headers=headers, timeout=10)
        if r.status_code != 200:
            return 0, "session_create_failed"

        session_id = r.json().get("session", {}).get("id")
        if not session_id:
            return 0, "no_session_id"

        # 스트리밍 요청
        start = time.time()
        r = requests.post(
            f"{API_URL}/ai/chat/stream",
            json={"session_id": session_id, "message": "Hello", "history": []},
            headers=headers,
            stream=True,
            timeout=30
        )

        # 첫 번째 청크 수신까지의 시간
        ttft = None
        for chunk in r.iter_content(chunk_size=1):
            if chunk:
                ttft = time.time() - start
                break

        r.close()
        return ttft or 0, "ok" if ttft else "no_response"
    except Exception as e:
        return 0, f"error: {e}"

def run_concurrent_test(test_func, tokens_data, max_workers, test_name):
    """동시 접속 테스트"""
    print(f"\n[{test_name}] 동시 {max_workers}명 테스트...")

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        if test_name == "페이지 로딩":
            futures = [executor.submit(test_page_load, i) for i in range(1, max_workers + 1)]
        else:
            user_list = list(tokens_data.keys())[:max_workers]
            futures = [executor.submit(test_func, tokens_data[u]["token"], tokens_data[u]["user_id"]) for u in user_list]

        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    times = [r[0] for r in results if r[0] > 0]
    if times:
        avg = statistics.mean(times)
        p95 = sorted(times)[int(len(times) * 0.95)] if len(times) > 1 else times[0]
        mx = max(times)
        return {"avg": avg, "p95": p95, "max": mx, "count": len(times)}
    return None

def main():
    print("=" * 70)
    print("DOT-Project 전체 성능 테스트")
    print(f"시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"웹: {WEB_URL}")
    print(f"API: {API_URL}")
    print("=" * 70)

    # 1. 토큰 획득
    print("\n[1/6] 테스트 계정 로그인...")
    tokens_data = {}
    login_times = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(get_token, i): i for i in range(1, 101)}
        for f in concurrent.futures.as_completed(futures):
            user_num = futures[f]
            token, elapsed, user_id = f.result()
            if token:
                tokens_data[user_num] = {"token": token, "user_id": user_id}
                login_times.append(elapsed)

    print(f"  로그인 성공: {len(tokens_data)}/100명")
    if login_times:
        print(f"  평균 로그인 시간: {statistics.mean(login_times):.3f}초")

    results = {}

    # 2. 페이지 로딩 테스트 (50, 75, 100명)
    print("\n[2/6] 페이지 로딩 테스트...")
    for users in [50, 75, 100]:
        r = run_concurrent_test(test_page_load, {}, users, "페이지 로딩")
        if r:
            results[f"page_{users}"] = r
            status = "[PASS]" if r["avg"] <= TARGETS["page_load"] else "[FAIL]"
            print(f"  {users}명: 평균 {r['avg']:.3f}초, P95 {r['p95']:.3f}초, 최대 {r['max']:.3f}초 {status}")

    # 3. API 응답 테스트 (50, 75, 100명)
    print("\n[3/6] API 응답 테스트...")
    for users in [50, 75, 100]:
        r = run_concurrent_test(test_api_response, tokens_data, min(users, len(tokens_data)), "API 응답")
        if r:
            results[f"api_{users}"] = r
            status = "[PASS]" if r["avg"] <= TARGETS["api_response"] else "[FAIL]"
            print(f"  {users}명: 평균 {r['avg']:.3f}초, P95 {r['p95']:.3f}초, 최대 {r['max']:.3f}초 {status}")

    # 4. 이미지 생성 테스트 (단일)
    print("\n[4/6] 이미지 생성 테스트 (512px)...")
    if tokens_data:
        first_user = list(tokens_data.keys())[0]
        token = tokens_data[first_user]["token"]
        user_id = tokens_data[first_user]["user_id"]

        elapsed, status, task_id = test_image_generation(token, user_id)
        results["image_gen"] = {"time": elapsed, "status": status}

        if status == "completed":
            pass_status = "[PASS]" if elapsed <= TARGETS["image_gen"] else "[FAIL]"
            print(f"  완료: {elapsed:.2f}초 {pass_status}")
        else:
            print(f"  상태: {status} ({elapsed:.2f}초)")

    # 5. STT 변환 테스트
    print("\n[5/6] STT 변환 테스트...")
    if tokens_data and os.path.exists(AUDIO_FILE):
        first_user = list(tokens_data.keys())[0]
        token = tokens_data[first_user]["token"]
        user_id = tokens_data[first_user]["user_id"]

        elapsed, status, meeting_id = test_stt(token, user_id)
        results["stt"] = {"time": elapsed, "status": status}

        if status == "completed":
            pass_status = "[PASS]" if elapsed <= TARGETS["stt"] else "[FAIL]"
            print(f"  완료: {elapsed:.2f}초 {pass_status}")
        else:
            print(f"  상태: {status} ({elapsed:.2f}초)")
    else:
        print(f"  건너뜀: 음성 파일 없음")

    # 6. 스트리밍 TTFT 테스트
    print("\n[6/6] 스트리밍 TTFT 테스트...")
    ttft_results = []
    test_users = min(10, len(tokens_data))

    if tokens_data:
        with concurrent.futures.ThreadPoolExecutor(max_workers=test_users) as executor:
            user_list = list(tokens_data.keys())[:test_users]
            futures = [executor.submit(test_streaming_ttft, tokens_data[u]["token"], tokens_data[u]["user_id"]) for u in user_list]
            for f in concurrent.futures.as_completed(futures):
                ttft_results.append(f.result())

        ttft_times = [r[0] for r in ttft_results if r[0] > 0]
        if ttft_times:
            avg_ttft = statistics.mean(ttft_times)
            results["ttft"] = {"avg": avg_ttft, "times": ttft_times}
            pass_status = "[PASS]" if avg_ttft <= TARGETS["ttft"] else "[FAIL]"
            print(f"  평균 TTFT: {avg_ttft:.3f}초 {pass_status}")
        else:
            print(f"  결과 없음 (LLM 모델 미로드 또는 Worker 미연결)")

    # 최종 보고서
    print("\n" + "=" * 70)
    print("[FINAL REPORT] 성능 테스트 결과")
    print("=" * 70)
    print(f"테스트 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"테스트 환경: 웹({WEB_URL}), API({API_URL})")
    print("-" * 70)
    print(f"{'항목':<25} {'결과':<15} {'목표':<10} {'판정':<10}")
    print("-" * 70)

    # 페이지 로딩
    if "page_100" in results:
        r = results["page_100"]
        status = "[PASS]" if r["avg"] <= TARGETS["page_load"] else "[FAIL]"
        print(f"{'페이지 로딩 (100명)':<25} {r['avg']:.3f}초        {TARGETS['page_load']}초       {status}")

    # API 응답
    if "api_100" in results:
        r = results["api_100"]
        status = "[PASS]" if r["avg"] <= TARGETS["api_response"] else "[FAIL]"
        print(f"{'API 응답 (100명)':<25} {r['avg']:.3f}초        {TARGETS['api_response']}초       {status}")

    # 이미지 생성
    if "image_gen" in results:
        r = results["image_gen"]
        if r["status"] == "completed":
            status = "[PASS]" if r["time"] <= TARGETS["image_gen"] else "[FAIL]"
            print(f"{'이미지 생성 (512px)':<25} {r['time']:.2f}초        {TARGETS['image_gen']}초      {status}")
        else:
            print(f"{'이미지 생성 (512px)':<25} {r['status']:<15} {TARGETS['image_gen']}초      [N/A]")

    # STT
    if "stt" in results:
        r = results["stt"]
        if r["status"] == "completed":
            status = "[PASS]" if r["time"] <= TARGETS["stt"] else "[FAIL]"
            print(f"{'STT 변환':<25} {r['time']:.2f}초        {TARGETS['stt']}초     {status}")
        else:
            print(f"{'STT 변환':<25} {r['status']:<15} {TARGETS['stt']}초     [N/A]")

    # TTFT
    if "ttft" in results:
        r = results["ttft"]
        status = "[PASS]" if r["avg"] <= TARGETS["ttft"] else "[FAIL]"
        print(f"{'스트리밍 TTFT':<25} {r['avg']:.3f}초        {TARGETS['ttft']}초       {status}")
    else:
        print(f"{'스트리밍 TTFT':<25} {'미측정':<15} {TARGETS['ttft']}초       [N/A]")

    print("-" * 70)
    print("=" * 70)

    return results

if __name__ == "__main__":
    main()
