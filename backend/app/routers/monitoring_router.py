"""
모니터링 API 라우터 - 대시보드 통계, 서버 상태, 프로세스 관리
"""

import platform
from datetime import date, timedelta, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import psutil

from app.database import get_db
from app import models

router = APIRouter()


@router.get("/api/admin/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """대시보드 통계 (기본 + AI 기능 사용량)"""
    today = date.today()

    total_users = db.query(models.User).count()
    total_depts = db.query(models.Dept).count()
    today_visitors = db.query(models.SystemLog.user_id).filter(
        models.SystemLog.action.like("%LOGIN%"),
        models.SystemLog.created_at >= today
    ).distinct().count()
    total_logs = db.query(models.SystemLog).count()

    total_chats = db.query(models.ChatSession).count()
    total_documents = db.query(models.Document).count()
    total_meetings = db.query(models.MeetingNote).count()
    total_images = db.query(models.GeneratedImage).count()

    today_chats = db.query(models.ChatSession).filter(models.ChatSession.created_at >= today).count()
    today_documents = db.query(models.Document).filter(models.Document.created_at >= today).count()
    today_meetings = db.query(models.MeetingNote).filter(models.MeetingNote.created_at >= today).count()
    today_images = db.query(models.GeneratedImage).filter(models.GeneratedImage.created_at >= today).count()

    success_logs = db.query(models.SystemLog).filter(models.SystemLog.action.like("%SUCCESS%")).count()
    fail_logs = db.query(models.SystemLog).filter(models.SystemLog.action.like("%FAIL%")).count()

    return {
        "totalUsers": total_users, "totalDepts": total_depts,
        "todayVisitors": today_visitors, "totalLogs": total_logs,
        "totalChats": total_chats, "totalDocuments": total_documents,
        "totalMeetings": total_meetings, "totalImages": total_images,
        "todayChats": today_chats, "todayDocuments": today_documents,
        "todayMeetings": today_meetings, "todayImages": today_images,
        "successLogs": success_logs, "failLogs": fail_logs
    }


@router.get("/api/admin/daily-activity")
def get_daily_activity(days: int = 7, db: Session = Depends(get_db)):
    """일별 활동 추이 (최근 N일)"""
    result = []
    today = date.today()

    for i in range(days - 1, -1, -1):
        target_date = today - timedelta(days=i)
        next_date = target_date + timedelta(days=1)

        chats = db.query(models.ChatSession).filter(
            models.ChatSession.created_at >= target_date,
            models.ChatSession.created_at < next_date
        ).count()
        documents = db.query(models.Document).filter(
            models.Document.created_at >= target_date,
            models.Document.created_at < next_date
        ).count()
        meetings = db.query(models.MeetingNote).filter(
            models.MeetingNote.created_at >= target_date,
            models.MeetingNote.created_at < next_date
        ).count()
        images = db.query(models.GeneratedImage).filter(
            models.GeneratedImage.created_at >= target_date,
            models.GeneratedImage.created_at < next_date
        ).count()
        logins = db.query(models.SystemLog).filter(
            models.SystemLog.action.like("%LOGIN_SUCCESS%"),
            models.SystemLog.created_at >= target_date,
            models.SystemLog.created_at < next_date
        ).count()

        result.append({
            "date": target_date.strftime("%m/%d"),
            "fullDate": target_date.strftime("%Y-%m-%d"),
            "chats": chats, "documents": documents,
            "meetings": meetings, "images": images,
            "logins": logins, "total": chats + documents + meetings + images
        })

    return result


@router.get("/api/admin/feature-usage")
def get_feature_usage(db: Session = Depends(get_db)):
    """기능별 사용량 통계"""
    return [
        {"name": "AI 챗봇", "value": db.query(models.ChatSession).count(), "color": "#3B82F6"},
        {"name": "문서 관리", "value": db.query(models.Document).count(), "color": "#10B981"},
        {"name": "회의록 분석", "value": db.query(models.MeetingNote).count(), "color": "#8B5CF6"},
        {"name": "이미지 생성", "value": db.query(models.GeneratedImage).count(), "color": "#F59E0B"},
    ]


@router.get("/api/admin/server-health")
def get_server_health():
    """서버 상태 모니터링 (CPU, 메모리, 디스크, 네트워크)"""
    cpu_percent = psutil.cpu_percent(interval=0.1)
    cpu_count = psutil.cpu_count()
    cpu_freq = psutil.cpu_freq()

    memory = psutil.virtual_memory()
    memory_total_gb = memory.total / (1024 ** 3)
    memory_used_gb = memory.used / (1024 ** 3)
    memory_available_gb = memory.available / (1024 ** 3)

    try:
        disk_path = 'C:\\' if platform.system() == 'Windows' else '/'
        disk = psutil.disk_usage(disk_path)
        disk_total_gb = disk.total / (1024 ** 3)
        disk_used_gb = disk.used / (1024 ** 3)
        disk_free_gb = disk.free / (1024 ** 3)
        disk_percent = disk.percent
    except Exception:
        disk_total_gb = disk_used_gb = disk_free_gb = disk_percent = 0

    net_io = psutil.net_io_counters()
    process_count = len(psutil.pids())

    boot_time = datetime.fromtimestamp(psutil.boot_time())
    uptime = datetime.now() - boot_time

    if cpu_percent > 90 or memory.percent > 90 or disk_percent > 90:
        status, status_color = "Critical", "red"
    elif cpu_percent > 70 or memory.percent > 70 or disk_percent > 80:
        status, status_color = "Warning", "yellow"
    else:
        status, status_color = "Healthy", "green"

    return {
        "cpu": round(cpu_percent, 1), "memory": round(memory.percent, 1),
        "disk": round(disk_percent, 1), "status": status, "statusColor": status_color,
        "cpuCores": cpu_count,
        "cpuFreqCurrent": round(cpu_freq.current, 0) if cpu_freq else 0,
        "cpuFreqMax": round(cpu_freq.max, 0) if cpu_freq and cpu_freq.max else 0,
        "memoryTotal": round(memory_total_gb, 2),
        "memoryUsed": round(memory_used_gb, 2),
        "memoryAvailable": round(memory_available_gb, 2),
        "diskTotal": round(disk_total_gb, 2),
        "diskUsed": round(disk_used_gb, 2),
        "diskFree": round(disk_free_gb, 2),
        "networkSent": round(net_io.bytes_sent / (1024 ** 2), 2),
        "networkRecv": round(net_io.bytes_recv / (1024 ** 2), 2),
        "processCount": process_count,
        "platform": platform.system(), "hostname": platform.node(),
        "pythonVersion": platform.python_version(),
        "uptimeDays": uptime.days,
        "uptimeHours": uptime.seconds // 3600,
        "uptimeMinutes": (uptime.seconds % 3600) // 60,
        "uptimeText": f"{uptime.days}일 {uptime.seconds // 3600}시간 {(uptime.seconds % 3600) // 60}분",
        "bootTime": boot_time.strftime("%Y-%m-%d %H:%M:%S")
    }


@router.get("/api/admin/processes")
def get_running_processes(limit: int = 10, sort_by: str = "cpu"):
    """실행 중인 프로세스 목록 (CPU/메모리 기준 정렬)"""
    processes = []

    for proc in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent', 'memory_info', 'status', 'create_time']):
        try:
            pinfo = proc.info
            cpu_pct = pinfo['cpu_percent'] or 0
            mem_pct = pinfo['memory_percent'] or 0
            mem_mb = (pinfo['memory_info'].rss / (1024 * 1024)) if pinfo['memory_info'] else 0

            try:
                create_time = datetime.fromtimestamp(pinfo['create_time']).strftime("%Y-%m-%d %H:%M:%S") if pinfo['create_time'] else None
            except Exception:
                create_time = None

            processes.append({
                'pid': pinfo['pid'], 'name': pinfo['name'] or 'Unknown',
                'username': pinfo['username'] or 'SYSTEM',
                'cpu_percent': round(cpu_pct, 1), 'memory_percent': round(mem_pct, 1),
                'memory_mb': round(mem_mb, 1), 'status': pinfo['status'] or 'unknown',
                'create_time': create_time
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    sort_key = 'memory_percent' if sort_by == "memory" else 'cpu_percent'
    processes.sort(key=lambda x: x[sort_key], reverse=True)
    top_processes = processes[:limit]

    total_processes = len(processes)
    status_counts = {}
    for p in processes:
        status_counts[p['status']] = status_counts.get(p['status'], 0) + 1

    return {
        "processes": top_processes,
        "summary": {
            "total": total_processes,
            "running": sum(1 for p in processes if p['status'] == 'running'),
            "sleeping": sum(1 for p in processes if p['status'] == 'sleeping'),
            "statusCounts": status_counts
        },
        "sortBy": sort_by, "limit": limit
    }
