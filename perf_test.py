# -*- coding: utf-8 -*-
"""
DOT-Project 종합 성능 테스트
목표: 페이지 1초, API 1초, 이미지 2분, STT 10분, 챗봇 3초, 동시접속 50명+
"""
import requests
import time
import statistics
import concurrent.futures
import os
from datetime import datetime

WEB_URL = "http://192.168.0.20:8081"
API_URL = "http://192.168.0.20:8000"
COMFYUI_URL = "http://192.168.0.21:8188"
PASSWORD = "admin123"
AUDIO_FILE = r"C:\workspace\app\DOT-Project\음성 260120_090501.m4a"

TARGETS = {"page": 1.0, "api": 1.0, "image": 120.0, "stt": 600.0, "chat": 3.0}

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def get_token(user_num):
    try:
        r = requests.post(f"{API_URL}/api/login",
            json={"email": f"testuser{user_num:03d}@test.com", "password": PASSWORD}, timeout=15)
        if r.status_code == 200:
            d = r.json()
            return d.get("access_token"), d.get("user", {}).get("id")
    except: pass
    return None, None

def test_page():
    try:
        start = time.time()
        r = requests.get(WEB_URL, timeout=10)
        return time.time() - start, r.status_code
    except: return 0, "error"

def test_api(token, user_id):
    try:
        start = time.time()
        r = requests.get(f"{API_URL}/chat/sessions/{user_id}",
            headers={"Authorization": f"Bearer {token}"}, timeout=10)
        return time.time() - start, r.status_code
    except: return 0, "error"

def test_chat(token):
    try:
        start = time.time()
        r = requests.post(f"{API_URL}/ai/chat",
            json={"message": "안녕"},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=60)
        return time.time() - start, "ok" if r.status_code == 200 else f"err_{r.status_code}"
    except Exception as e:
        return 0, str(e)[:30]

def test_image(token, user_id):
    try:
        start = time.time()
        r = requests.post(f"{API_URL}/image/generate",
            json={"user_id": user_id, "prompt": "blue circle", "style": "realistic", "size": "512x512"},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, timeout=60)

        if r.status_code != 200: return 0, f"req_err_{r.status_code}", None

        task_id = r.json().get("taskId")
        if not task_id: return time.time() - start, "no_task", None

        for i in range(150):
            try:
                sr = requests.get(f"{API_URL}/image/status/{task_id}",
                    headers={"Authorization": f"Bearer {token}"}, timeout=10)
                if sr.status_code == 200:
                    sd = sr.json()
                    if i % 15 == 0: log(f"  IMG: {sd.get('progress',0)}%")
                    if sd.get("status") == "completed": return time.time() - start, "completed", task_id
                    if sd.get("status") == "failed": return time.time() - start, "failed", task_id
            except: pass
            time.sleep(1)
        return time.time() - start, "timeout", task_id
    except Exception as e: return 0, str(e)[:30], None

def test_stt(token, user_id):
    if not os.path.exists(AUDIO_FILE): return 0, "no_file", None
    try:
        with open(AUDIO_FILE, "rb") as f:
            start = time.time()
            r = requests.post(f"{API_URL}/meeting/upload",
                files={"file": (os.path.basename(AUDIO_FILE), f, "audio/m4a")},
                data={"user_id": user_id, "title": "Test", "attendees": "Tester"},
                headers={"Authorization": f"Bearer {token}"}, timeout=120)

        if r.status_code != 200: return time.time() - start, f"upload_err_{r.status_code}", None

        stt_task = r.json().get("meeting", {}).get("sttTaskId")
        meeting_id = r.json().get("meeting", {}).get("id")
        if not stt_task: return time.time() - start, "no_task", meeting_id

        for i in range(660):
            try:
                sr = requests.get(f"{API_URL}/meeting/status/{stt_task}",
                    headers={"Authorization": f"Bearer {token}"}, timeout=10)
                if sr.status_code == 200:
                    sd = sr.json()
                    if i % 30 == 0: log(f"  STT: {sd.get('progress',0)}% - {sd.get('message','')[:30]}")
                    if sd.get("status") == "completed": return time.time() - start, "completed", meeting_id
                    if sd.get("status") == "failed": return time.time() - start, "failed", meeting_id
            except: pass
            time.sleep(1)
        return time.time() - start, "timeout", meeting_id
    except Exception as e: return 0, str(e)[:30], None

def load_test(tokens, users):
    log(f"부하테스트: {users}명")
    page_t, api_t = [], []

    with concurrent.futures.ThreadPoolExecutor(max_workers=users) as ex:
        for t, _ in [f.result() for f in concurrent.futures.as_completed([ex.submit(test_page) for _ in range(users)])]:
            if t > 0: page_t.append(t)

    ul = list(tokens.keys())[:users]
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(ul)) as ex:
        for t, _ in [f.result() for f in concurrent.futures.as_completed([ex.submit(test_api, tokens[u]["token"], tokens[u]["uid"]) for u in ul])]:
            if t > 0: api_t.append(t)

    return {
        "users": users,
        "page_avg": statistics.mean(page_t) if page_t else 0,
        "page_p95": sorted(page_t)[int(len(page_t)*0.95)] if len(page_t) > 1 else (page_t[0] if page_t else 0),
        "api_avg": statistics.mean(api_t) if api_t else 0,
        "api_p95": sorted(api_t)[int(len(api_t)*0.95)] if len(api_t) > 1 else (api_t[0] if api_t else 0),
    }

def check_svc():
    log("서비스 확인...")
    s = {}
    for name, url in [("web", WEB_URL), ("api", f"{API_URL}/docs"), ("comfyui", f"{COMFYUI_URL}/system_stats")]:
        try:
            r = requests.get(url, timeout=5)
            s[name] = "OK"
        except: s[name] = "FAIL"
        log(f"  {name}: {s[name]}")
    return s

def main():
    t0 = datetime.now()
    print("="*70)
    print(f"DOT-Project 성능 테스트 | {t0.strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)

    svc = check_svc()

    log("[1/5] 로그인...")
    tokens = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
        futs = {ex.submit(get_token, i): i for i in range(1, 101)}
        for f in concurrent.futures.as_completed(futs):
            n = futs[f]
            tk, uid = f.result()
            if tk: tokens[n] = {"token": tk, "uid": uid}
    log(f"  성공: {len(tokens)}/100")

    log("[2/5] 부하테스트...")
    loads = []
    for u in [50, 75, 100]:
        r = load_test(tokens, min(u, len(tokens)))
        loads.append(r)
        ps = "[PASS]" if r["page_avg"] <= TARGETS["page"] else "[FAIL]"
        as_ = "[PASS]" if r["api_avg"] <= TARGETS["api"] else "[FAIL]"
        log(f"  {r['users']}명: 페이지 {r['page_avg']:.3f}초 {ps}, API {r['api_avg']:.3f}초 {as_}")

    results = {"svc": svc, "login": len(tokens), "loads": loads}

    log("[3/5] 챗봇...")
    if tokens:
        tk = tokens[list(tokens.keys())[0]]
        ct, cs = test_chat(tk["token"])
        results["chat"] = {"time": ct, "status": cs}
        if ct > 0:
            s = "[PASS]" if ct <= TARGETS["chat"] else "[FAIL]"
            log(f"  {ct:.2f}초 {s} ({cs})")
        else:
            log(f"  실패: {cs}")

    log("[4/5] 이미지 생성...")
    if tokens:
        tk = tokens[list(tokens.keys())[0]]
        it, ist, _ = test_image(tk["token"], tk["uid"])
        results["image"] = {"time": it, "status": ist}
        if ist == "completed":
            s = "[PASS]" if it <= TARGETS["image"] else "[FAIL]"
            log(f"  {it:.2f}초 {s}")
        else:
            log(f"  {ist} ({it:.2f}초)")

    log("[5/5] STT 변환...")
    if tokens and os.path.exists(AUDIO_FILE):
        tk = tokens[list(tokens.keys())[0]]
        st, sst, _ = test_stt(tk["token"], tk["uid"])
        results["stt"] = {"time": st, "status": sst}
        if sst == "completed":
            s = "[PASS]" if st <= TARGETS["stt"] else "[FAIL]"
            log(f"  {st:.2f}초 ({st/60:.1f}분) {s}")
        else:
            log(f"  {sst} ({st:.2f}초)")
    else:
        results["stt"] = {"time": 0, "status": "skipped"}
        log("  건너뜀")

    t1 = datetime.now()
    dur = (t1 - t0).total_seconds()

    print("\n" + "="*70)
    print("[결과 요약]")
    print("="*70)
    print(f"테스트 시간: {dur:.0f}초 ({dur/60:.1f}분)")
    print(f"\n서비스: web={svc.get('web')}, api={svc.get('api')}, comfyui={svc.get('comfyui')}")
    print(f"\n부하테스트 (목표: 페이지 {TARGETS['page']}초, API {TARGETS['api']}초):")
    for r in loads:
        ps = "[PASS]" if r["page_avg"] <= TARGETS["page"] else "[FAIL]"
        as_ = "[PASS]" if r["api_avg"] <= TARGETS["api"] else "[FAIL]"
        print(f"  {r['users']:>3}명: 페이지 {r['page_avg']:.3f}초 {ps}, API {r['api_avg']:.3f}초 {as_}")

    print(f"\n기능테스트:")

    if "chat" in results:
        c = results["chat"]
        if c["time"] > 0:
            s = "[PASS]" if c["time"] <= TARGETS["chat"] else "[FAIL]"
            print(f"  챗봇: {c['time']:.2f}초 {s} (목표: {TARGETS['chat']}초)")
        else:
            print(f"  챗봇: 실패 ({c['status']})")

    if "image" in results:
        im = results["image"]
        if im["status"] == "completed":
            s = "[PASS]" if im["time"] <= TARGETS["image"] else "[FAIL]"
            print(f"  이미지: {im['time']:.2f}초 {s} (목표: {TARGETS['image']}초)")
        else:
            print(f"  이미지: {im['status']} ({im['time']:.2f}초)")

    if "stt" in results:
        st = results["stt"]
        if st["status"] == "completed":
            s = "[PASS]" if st["time"] <= TARGETS["stt"] else "[FAIL]"
            print(f"  STT: {st['time']:.2f}초 ({st['time']/60:.1f}분) {s} (목표: {TARGETS['stt']/60:.0f}분)")
        else:
            print(f"  STT: {st['status']} ({st['time']:.2f}초)")

    print("="*70)
    return results

if __name__ == "__main__":
    main()
