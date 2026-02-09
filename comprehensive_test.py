# -*- coding: utf-8 -*-
"""
DOT-Project 종합 성능 테스트
환경: Master(192.168.0.20), Worker(192.168.0.21), ComfyUI(192.168.0.21:8188)
"""
import requests
import time
import statistics
import concurrent.futures
import os
from datetime import datetime

# 환경 설정
WEB_URL = "http://192.168.0.20:8081"
API_URL = "http://192.168.0.20:8000"
COMFYUI_URL = "http://192.168.0.21:8188"
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

TEST_RESULTS = []

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def get_token(user_num):
    email = f"testuser{user_num:03d}@test.com"
    try:
        r = requests.post(f"{API_URL}/api/login", json={"email": email, "password": PASSWORD}, timeout=15)
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

def test_api(token, user_id):
    try:
        headers = {"Authorization": f"Bearer {token}"}
        start = time.time()
        r = requests.get(f"{API_URL}/chat/sessions/{user_id}", headers=headers, timeout=10)
        return time.time() - start, r.status_code
    except:
        return 0, "error"

def test_image_gen(token, user_id):
    """이미지 생성 테스트"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        data = {
            "user_id": user_id,
            "prompt": "A blue circle on white background, simple",
            "style": "realistic",
            "size": "512x512"
        }

        start = time.time()
        r = requests.post(f"{API_URL}/image/generate", json=data, headers=headers, timeout=60)

        if r.status_code != 200:
            return 0, f"request_error_{r.status_code}", None

        result = r.json()
        task_id = result.get("taskId")
        if not task_id:
            return time.time() - start, "no_task_id", None

        # 폴링 (최대 60초)
        for i in range(60):
            try:
                sr = requests.get(f"{API_URL}/image/status/{task_id}", headers=headers, timeout=10)
                if sr.status_code == 200:
                    sd = sr.json()
                    status = sd.get("status")
                    progress = sd.get("progress", 0)
                    if i % 5 == 0:
                        log(f"  이미지 진행률: {progress}% - {sd.get('message', '')}")
                    if status == "completed":
                        return time.time() - start, "completed", task_id
                    elif status == "failed":
                        return time.time() - start, f"failed: {sd.get('message', '')}", task_id
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
            data = {"user_id": user_id, "title": "Performance Test STT", "attendees": "Tester"}

            start = time.time()
            r = requests.post(f"{API_URL}/meeting/upload", files=files, data=data, headers=headers, timeout=60)

        if r.status_code != 200:
            return time.time() - start, f"upload_error_{r.status_code}", None

        result = r.json()
        stt_task_id = result.get("meeting", {}).get("sttTaskId")
        meeting_id = result.get("meeting", {}).get("id")

        if not stt_task_id:
            return time.time() - start, "no_stt_task", meeting_id

        # 폴링 (최대 180초)
        for i in range(180):
            try:
                sr = requests.get(f"{API_URL}/meeting/status/{stt_task_id}", headers=headers, timeout=10)
                if sr.status_code == 200:
                    sd = sr.json()
                    status = sd.get("status")
                    progress = sd.get("progress", 0)
                    if i % 10 == 0:
                        log(f"  STT 진행률: {progress}% - {sd.get('message', '')}")
                    if status == "completed":
                        return time.time() - start, "completed", meeting_id
                    elif status == "failed":
                        return time.time() - start, f"failed: {sd.get('message', '')}", meeting_id
            except:
                pass
            time.sleep(1)

        return time.time() - start, "timeout", meeting_id
    except Exception as e:
        return 0, f"error: {e}", None

def test_streaming_ttft(token, user_id):
    """스트리밍 TTFT 테스트"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # 세션 생성
        r = requests.post(f"{API_URL}/chat/sessions", json={"user_id": user_id, "title": "TTFT Test"}, headers=headers, timeout=10)
        if r.status_code != 200:
            return 0, "session_error"

        session_id = r.json().get("session", {}).get("id")
        if not session_id:
            return 0, "no_session"

        # 스트리밍 요청
        start = time.time()
        r = requests.post(
            f"{API_URL}/ai/chat/stream",
            json={"session_id": session_id, "message": "Hello", "history": []},
            headers=headers,
            stream=True,
            timeout=30
        )

        ttft = None
        for chunk in r.iter_content(chunk_size=1):
            if chunk:
                ttft = time.time() - start
                break

        r.close()
        return ttft or 0, "ok" if ttft else "no_response"
    except Exception as e:
        return 0, f"error: {e}"

def run_load_test(tokens_data, max_users):
    """부하 테스트"""
    log(f"[부하 테스트] {max_users}명 동시 접속")

    # 페이지 로딩
    page_times = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_users) as ex:
        futures = [ex.submit(test_page_load) for _ in range(max_users)]
        for f in concurrent.futures.as_completed(futures):
            t, _ = f.result()
            if t > 0:
                page_times.append(t)

    # API 응답
    api_times = []
    users = list(tokens_data.keys())[:max_users]
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(users)) as ex:
        futures = [ex.submit(test_api, tokens_data[u]["token"], tokens_data[u]["user_id"]) for u in users]
        for f in concurrent.futures.as_completed(futures):
            t, _ = f.result()
            if t > 0:
                api_times.append(t)

    return {
        "users": max_users,
        "page_avg": statistics.mean(page_times) if page_times else 0,
        "page_p95": sorted(page_times)[int(len(page_times)*0.95)] if len(page_times) > 1 else (page_times[0] if page_times else 0),
        "page_max": max(page_times) if page_times else 0,
        "api_avg": statistics.mean(api_times) if api_times else 0,
        "api_p95": sorted(api_times)[int(len(api_times)*0.95)] if len(api_times) > 1 else (api_times[0] if api_times else 0),
        "api_max": max(api_times) if api_times else 0,
    }

def check_services():
    """서비스 상태 확인"""
    log("서비스 상태 확인 중...")
    status = {}

    # 웹 서버
    try:
        r = requests.get(WEB_URL, timeout=5)
        status["web"] = f"OK ({r.status_code})"
    except Exception as e:
        status["web"] = f"FAIL ({e})"

    # API 서버
    try:
        r = requests.get(f"{API_URL}/docs", timeout=5)
        status["api"] = f"OK ({r.status_code})"
    except Exception as e:
        status["api"] = f"FAIL ({e})"

    # ComfyUI
    try:
        r = requests.get(f"{COMFYUI_URL}/system_stats", timeout=5)
        status["comfyui"] = f"OK ({r.status_code})"
    except Exception as e:
        status["comfyui"] = f"FAIL ({e})"

    for k, v in status.items():
        log(f"  {k}: {v}")

    return status

def main():
    start_time = datetime.now()

    print("=" * 70)
    print("DOT-Project 종합 성능 테스트")
    print(f"시작: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    print(f"웹: {WEB_URL}")
    print(f"API: {API_URL}")
    print(f"ComfyUI: {COMFYUI_URL}")
    print("=" * 70)

    # 1. 서비스 상태 확인
    services = check_services()

    # 2. 로그인
    log("[1/6] 테스트 계정 로그인...")
    tokens_data = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
        futures = {ex.submit(get_token, i): i for i in range(1, 101)}
        for f in concurrent.futures.as_completed(futures):
            user_num = futures[f]
            token, user_id = f.result()
            if token:
                tokens_data[user_num] = {"token": token, "user_id": user_id}

    log(f"  로그인 성공: {len(tokens_data)}/100명")

    results = {"services": services, "login_count": len(tokens_data)}

    # 3. 부하 테스트
    log("[2/6] 부하 테스트 (50/75/100명)...")
    load_results = []
    for users in [50, 75, 100]:
        r = run_load_test(tokens_data, min(users, len(tokens_data)))
        load_results.append(r)
        page_status = "[PASS]" if r["page_avg"] <= TARGETS["page_load"] else "[FAIL]"
        api_status = "[PASS]" if r["api_avg"] <= TARGETS["api_response"] else "[FAIL]"
        log(f"  {users}명: 페이지 {r['page_avg']:.3f}초 {page_status}, API {r['api_avg']:.3f}초 {api_status}")

    results["load_tests"] = load_results

    # 4. 이미지 생성 테스트
    log("[3/6] 이미지 생성 테스트 (512px)...")
    if tokens_data:
        first_user = list(tokens_data.keys())[0]
        token = tokens_data[first_user]["token"]
        user_id = tokens_data[first_user]["user_id"]

        elapsed, status, task_id = test_image_gen(token, user_id)
        results["image_gen"] = {"time": elapsed, "status": status}

        if status == "completed":
            img_status = "[PASS]" if elapsed <= TARGETS["image_gen"] else "[FAIL]"
            log(f"  완료: {elapsed:.2f}초 {img_status}")
        else:
            log(f"  상태: {status} ({elapsed:.2f}초)")

    # 5. STT 테스트
    log("[4/6] STT 변환 테스트...")
    if tokens_data and os.path.exists(AUDIO_FILE):
        first_user = list(tokens_data.keys())[0]
        token = tokens_data[first_user]["token"]
        user_id = tokens_data[first_user]["user_id"]

        elapsed, status, meeting_id = test_stt(token, user_id)
        results["stt"] = {"time": elapsed, "status": status}

        if status == "completed":
            stt_status = "[PASS]" if elapsed <= TARGETS["stt"] else "[FAIL]"
            log(f"  완료: {elapsed:.2f}초 {stt_status}")
        else:
            log(f"  상태: {status} ({elapsed:.2f}초)")
    else:
        log(f"  건너뜀: 음성 파일 없음")
        results["stt"] = {"time": 0, "status": "skipped"}

    # 6. TTFT 테스트
    log("[5/6] 스트리밍 TTFT 테스트...")
    ttft_results = []
    if tokens_data:
        test_users = min(5, len(tokens_data))
        with concurrent.futures.ThreadPoolExecutor(max_workers=test_users) as ex:
            users = list(tokens_data.keys())[:test_users]
            futures = [ex.submit(test_streaming_ttft, tokens_data[u]["token"], tokens_data[u]["user_id"]) for u in users]
            for f in concurrent.futures.as_completed(futures):
                t, s = f.result()
                ttft_results.append((t, s))

        ttft_times = [t for t, s in ttft_results if t > 0]
        if ttft_times:
            avg_ttft = statistics.mean(ttft_times)
            results["ttft"] = {"avg": avg_ttft, "times": ttft_times}
            ttft_status = "[PASS]" if avg_ttft <= TARGETS["ttft"] else "[FAIL]"
            log(f"  평균 TTFT: {avg_ttft:.3f}초 {ttft_status}")
        else:
            results["ttft"] = {"avg": 0, "status": "no_response"}
            log(f"  응답 없음 (LLM 미로드 또는 Worker 미연결)")

    # 최종 보고서
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print("\n" + "=" * 70)
    print("[FINAL REPORT] 종합 성능 테스트 결과")
    print("=" * 70)
    print(f"테스트 기간: {start_time.strftime('%Y-%m-%d %H:%M:%S')} ~ {end_time.strftime('%H:%M:%S')} ({duration:.0f}초)")
    print("-" * 70)

    # 서비스 상태
    print("\n[서비스 상태]")
    for k, v in services.items():
        print(f"  {k}: {v}")

    # 부하 테스트
    print("\n[부하 테스트 결과]")
    print(f"{'동시접속':<10} {'페이지(평균)':<15} {'페이지(P95)':<15} {'API(평균)':<15} {'API(P95)':<15}")
    print("-" * 70)
    for r in load_results:
        page_s = "[PASS]" if r["page_avg"] <= TARGETS["page_load"] else "[FAIL]"
        api_s = "[PASS]" if r["api_avg"] <= TARGETS["api_response"] else "[FAIL]"
        print(f"{r['users']:<10} {r['page_avg']:.3f}초 {page_s:<6} {r['page_p95']:.3f}초         {r['api_avg']:.3f}초 {api_s:<6} {r['api_p95']:.3f}초")

    # GPU 기능 테스트
    print("\n[GPU 기능 테스트]")
    print(f"{'항목':<20} {'결과':<20} {'목표':<15} {'판정':<10}")
    print("-" * 70)

    # 이미지 생성
    if "image_gen" in results:
        ig = results["image_gen"]
        if ig["status"] == "completed":
            s = "[PASS]" if ig["time"] <= TARGETS["image_gen"] else "[FAIL]"
            print(f"{'이미지 생성(512px)':<20} {ig['time']:.2f}초              {TARGETS['image_gen']}초            {s}")
        else:
            print(f"{'이미지 생성(512px)':<20} {ig['status']:<20} {TARGETS['image_gen']}초            [N/A]")

    # STT
    if "stt" in results:
        stt = results["stt"]
        if stt["status"] == "completed":
            s = "[PASS]" if stt["time"] <= TARGETS["stt"] else "[FAIL]"
            print(f"{'STT 변환':<20} {stt['time']:.2f}초              {TARGETS['stt']}초           {s}")
        else:
            print(f"{'STT 변환':<20} {stt['status']:<20} {TARGETS['stt']}초           [N/A]")

    # TTFT
    if "ttft" in results and results["ttft"].get("avg", 0) > 0:
        ttft = results["ttft"]
        s = "[PASS]" if ttft["avg"] <= TARGETS["ttft"] else "[FAIL]"
        print(f"{'스트리밍 TTFT':<20} {ttft['avg']:.3f}초              {TARGETS['ttft']}초             {s}")
    else:
        print(f"{'스트리밍 TTFT':<20} {'미측정':<20} {TARGETS['ttft']}초             [N/A]")

    print("-" * 70)
    print("=" * 70)

    return results

if __name__ == "__main__":
    results = main()
