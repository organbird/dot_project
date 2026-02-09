import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Cpu, Database, Activity, RefreshCw, Box,
    ArrowUpDown, Clock, User, Hash, ChevronDown,
    Play, Pause, Moon, AlertCircle
} from 'lucide-react';
import { API_BASE } from '../utils/api';

const ProcessTable = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('cpu');
    const [limit, setLimit] = useState(10);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchProcesses = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/admin/processes`, {
                params: { limit, sort_by: sortBy }
            });
            setData(res.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error("Failed to fetch processes", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProcesses();
        let interval;
        if (autoRefresh) {
            interval = setInterval(fetchProcesses, 5000);
        }
        return () => clearInterval(interval);
    }, [sortBy, limit, autoRefresh]);

    // 상태에 따른 아이콘 및 색상
    const getStatusInfo = (status) => {
        switch (status) {
            case 'running':
                return { icon: <Play size={10} />, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30', label: '실행 중' };
            case 'sleeping':
                return { icon: <Moon size={10} />, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30', label: '대기' };
            case 'stopped':
                return { icon: <Pause size={10} />, color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30', label: '중지' };
            case 'zombie':
                return { icon: <AlertCircle size={10} />, color: 'text-red-500 bg-red-100 dark:bg-red-900/30', label: '좀비' };
            default:
                return { icon: <Activity size={10} />, color: 'text-slate-500 bg-slate-100 dark:bg-slate-900/30', label: status };
        }
    };

    // CPU/메모리 사용량에 따른 색상
    const getUsageColor = (value) => {
        if (value >= 80) return 'text-red-500';
        if (value >= 50) return 'text-amber-500';
        if (value >= 20) return 'text-blue-500';
        return 'text-slate-500';
    };

    const getUsageBg = (value) => {
        if (value >= 80) return 'bg-red-500';
        if (value >= 50) return 'bg-amber-500';
        if (value >= 20) return 'bg-blue-500';
        return 'bg-slate-400';
    };

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="animate-spin text-primary mr-2" size={20} />
                <span className="text-sm text-text-muted">프로세스 정보 로딩 중...</span>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-card-dark rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="p-5 border-b border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-slate-900/20">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg">
                            <Box size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black dark:text-white">실행 중인 프로세스</h3>
                            <p className="text-[10px] text-text-muted">
                                총 {data.summary.total}개 프로세스 | 실행 {data.summary.running} | 대기 {data.summary.sleeping}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* 정렬 기준 선택 */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-border-light dark:border-border-dark">
                            <ArrowUpDown size={12} className="text-text-muted" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="text-xs font-bold bg-transparent outline-none dark:text-white cursor-pointer"
                            >
                                <option value="cpu">CPU 순</option>
                                <option value="memory">메모리 순</option>
                            </select>
                        </div>

                        {/* 표시 개수 */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-border-light dark:border-border-dark">
                            <Hash size={12} className="text-text-muted" />
                            <select
                                value={limit}
                                onChange={(e) => setLimit(Number(e.target.value))}
                                className="text-xs font-bold bg-transparent outline-none dark:text-white cursor-pointer"
                            >
                                <option value={5}>Top 5</option>
                                <option value={10}>Top 10</option>
                                <option value={15}>Top 15</option>
                                <option value={20}>Top 20</option>
                            </select>
                        </div>

                        {/* 자동 새로고침 토글 */}
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`p-2 rounded-xl border transition-all ${
                                autoRefresh
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-white dark:bg-slate-800 border-border-light dark:border-border-dark text-text-muted'
                            }`}
                            title={autoRefresh ? '자동 새로고침 켜짐' : '자동 새로고침 꺼짐'}
                        >
                            <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* 테이블 */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-[10px] font-black text-text-muted uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/10">
                            <th className="px-5 py-3">PID</th>
                            <th className="px-5 py-3">프로세스명</th>
                            <th className="px-5 py-3 hidden md:table-cell">사용자</th>
                            <th className="px-5 py-3">
                                <div className="flex items-center gap-1">
                                    <Cpu size={10} /> CPU
                                </div>
                            </th>
                            <th className="px-5 py-3">
                                <div className="flex items-center gap-1">
                                    <Database size={10} /> 메모리
                                </div>
                            </th>
                            <th className="px-5 py-3 hidden lg:table-cell">상태</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                        {data.processes.map((proc, idx) => {
                            const statusInfo = getStatusInfo(proc.status);
                            return (
                                <tr
                                    key={proc.pid}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    {/* PID */}
                                    <td className="px-5 py-3">
                                        <span className="text-xs font-mono font-bold text-text-muted">
                                            {proc.pid}
                                        </span>
                                    </td>

                                    {/* 프로세스명 */}
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-6 rounded-full ${getUsageBg(Math.max(proc.cpu_percent, proc.memory_percent))}`} />
                                            <div>
                                                <p className="text-sm font-bold dark:text-white truncate max-w-[150px]">
                                                    {proc.name}
                                                </p>
                                                <p className="text-[9px] text-text-muted lg:hidden">
                                                    {proc.username}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* 사용자 */}
                                    <td className="px-5 py-3 hidden md:table-cell">
                                        <div className="flex items-center gap-1.5">
                                            <User size={10} className="text-text-muted" />
                                            <span className="text-xs text-text-muted truncate max-w-[100px]">
                                                {proc.username}
                                            </span>
                                        </div>
                                    </td>

                                    {/* CPU */}
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${getUsageBg(proc.cpu_percent)}`}
                                                    style={{ width: `${Math.min(proc.cpu_percent, 100)}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-black ${getUsageColor(proc.cpu_percent)}`}>
                                                {proc.cpu_percent}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* 메모리 */}
                                    <td className="px-5 py-3">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${getUsageBg(proc.memory_percent)}`}
                                                        style={{ width: `${Math.min(proc.memory_percent, 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-black ${getUsageColor(proc.memory_percent)}`}>
                                                    {proc.memory_percent}%
                                                </span>
                                            </div>
                                            <span className="text-[9px] text-text-muted mt-0.5">
                                                {proc.memory_mb > 1024 ? `${(proc.memory_mb / 1024).toFixed(1)} GB` : `${proc.memory_mb} MB`}
                                            </span>
                                        </div>
                                    </td>

                                    {/* 상태 */}
                                    <td className="px-5 py-3 hidden lg:table-cell">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black ${statusInfo.color}`}>
                                            {statusInfo.icon}
                                            {statusInfo.label}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* 푸터 */}
            <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/10 border-t border-border-light dark:border-border-dark flex flex-wrap justify-between items-center gap-2">
                {/* 상태별 요약 */}
                <div className="flex items-center gap-3">
                    {Object.entries(data.summary.statusCounts || {}).slice(0, 4).map(([status, count]) => {
                        const info = getStatusInfo(status);
                        return (
                            <span key={status} className="flex items-center gap-1 text-[10px] text-text-muted">
                                <span className={`${info.color} px-1.5 py-0.5 rounded-md`}>
                                    {info.icon}
                                </span>
                                {count}
                            </span>
                        );
                    })}
                </div>

                {/* 갱신 시간 */}
                <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    {autoRefresh && <RefreshCw size={10} className="animate-spin" />}
                    <Clock size={10} />
                    <span>Last: {lastUpdated?.toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
};

export default ProcessTable;
