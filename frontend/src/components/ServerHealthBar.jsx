import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Cpu, Database, HardDrive, Activity, Wifi, Server,
    Clock, Zap, Monitor, ChevronDown, ChevronUp,
    ArrowUpCircle, ArrowDownCircle, Box, RefreshCw
} from 'lucide-react';
import { API_BASE } from '../utils/api';

const ServerHealthBar = () => {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/admin/server-health`);
                setHealth(res.data);
                setLastUpdated(new Date());
            } catch (err) {
                console.error("Health check failed", err);
            } finally {
                setLoading(false);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 5000);
        return () => clearInterval(interval);
    }, []);

    // 상태에 따른 색상 반환
    const getStatusColor = (value, thresholds = { warning: 70, critical: 90 }) => {
        if (value >= thresholds.critical) return 'text-red-500';
        if (value >= thresholds.warning) return 'text-amber-500';
        return 'text-emerald-500';
    };

    const getStatusBgColor = (value, thresholds = { warning: 70, critical: 90 }) => {
        if (value >= thresholds.critical) return 'bg-red-500';
        if (value >= thresholds.warning) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const getGradient = (value) => {
        if (value >= 90) return 'from-red-500 to-red-600';
        if (value >= 70) return 'from-amber-500 to-orange-500';
        return 'from-emerald-500 to-teal-500';
    };

    // 원형 프로그레스 컴포넌트
    const CircularProgress = ({ value, size = 80, strokeWidth = 8, icon: Icon, label, detail }) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (value / 100) * circumference;

        return (
            <div className="flex flex-col items-center">
                <div className="relative" style={{ width: size, height: size }}>
                    {/* 배경 원 */}
                    <svg className="transform -rotate-90" width={size} height={size}>
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            fill="transparent"
                            className="text-slate-200 dark:text-slate-700"
                        />
                        {/* 프로그레스 원 */}
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            className={`${getStatusColor(value)} transition-all duration-1000`}
                        />
                    </svg>
                    {/* 중앙 아이콘 및 퍼센트 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Icon size={16} className={getStatusColor(value)} />
                        <span className={`text-sm font-black ${getStatusColor(value)}`}>{value}%</span>
                    </div>
                </div>
                <span className="text-[10px] font-bold text-text-muted mt-2 uppercase tracking-wider">{label}</span>
                {detail && <span className="text-[9px] text-text-muted">{detail}</span>}
            </div>
        );
    };

    // 바 형태 프로그레스 컴포넌트
    const ProgressBar = ({ icon: Icon, label, value, detail, colorClass }) => (
        <div className="flex items-center gap-3 flex-1 min-w-[180px]">
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${getGradient(value)} shadow-lg`}>
                <Icon size={16} className="text-white" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between text-[10px] font-bold mb-1.5">
                    <span className="text-text-muted uppercase tracking-wider">{label}</span>
                    <span className={getStatusColor(value)}>{value}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full bg-gradient-to-r ${getGradient(value)} transition-all duration-1000`}
                        style={{ width: `${value}%` }}
                    />
                </div>
                {detail && (
                    <div className="text-[9px] text-text-muted mt-1">{detail}</div>
                )}
            </div>
        </div>
    );

    // 정보 카드 컴포넌트
    const InfoCard = ({ icon: Icon, label, value, subValue, color = "text-primary" }) => (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-border-light dark:border-border-dark shadow-sm">
            <div className="flex items-center gap-2 mb-1">
                <Icon size={12} className={color} />
                <span className="text-[9px] font-bold text-text-muted uppercase">{label}</span>
            </div>
            <div className={`text-lg font-black ${color}`}>{value}</div>
            {subValue && <div className="text-[9px] text-text-muted">{subValue}</div>}
        </div>
    );

    if (loading || !health) {
        return (
            <div className="flex items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-border-light dark:border-border-dark">
                <RefreshCw className="animate-spin text-primary mr-2" size={16} />
                <span className="text-sm text-text-muted">서버 상태 확인 중...</span>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-card-dark rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div
                className="flex justify-between items-center p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-4">
                    {/* 상태 표시등 */}
                    <div className={`relative`}>
                        <div className={`size-3 rounded-full ${getStatusBgColor(Math.max(health.cpu, health.memory, health.disk))} animate-pulse`} />
                        <div className={`absolute inset-0 size-3 rounded-full ${getStatusBgColor(Math.max(health.cpu, health.memory, health.disk))} animate-ping opacity-30`} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <Server size={16} className="text-primary" />
                            <span className="text-sm font-black dark:text-white">Server Status</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                health.status === 'Healthy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                health.status === 'Warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                                {health.status}
                            </span>
                        </div>
                        <div className="text-[10px] text-text-muted flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1">
                                <Clock size={10} />
                                Uptime: {health.uptimeText}
                            </span>
                            <span>|</span>
                            <span>{health.hostname} ({health.platform})</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* 미니 상태 표시 */}
                    <div className="hidden md:flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Cpu size={14} className={getStatusColor(health.cpu)} />
                            <span className={`text-sm font-black ${getStatusColor(health.cpu)}`}>{health.cpu}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Database size={14} className={getStatusColor(health.memory)} />
                            <span className={`text-sm font-black ${getStatusColor(health.memory)}`}>{health.memory}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <HardDrive size={14} className={getStatusColor(health.disk, { warning: 80, critical: 90 })} />
                            <span className={`text-sm font-black ${getStatusColor(health.disk, { warning: 80, critical: 90 })}`}>{health.disk}%</span>
                        </div>
                    </div>

                    {/* 토글 버튼 */}
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        {expanded ? <ChevronUp size={18} className="dark:text-white" /> : <ChevronDown size={18} className="dark:text-white" />}
                    </button>
                </div>
            </div>

            {/* 확장된 상세 정보 */}
            {expanded && (
                <div className="border-t border-border-light dark:border-border-dark">
                    {/* 메인 리소스 - 원형 차트 */}
                    <div className="p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30">
                        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                            <CircularProgress
                                value={health.cpu}
                                icon={Cpu}
                                label="CPU"
                                detail={`${health.cpuCores} Cores`}
                            />
                            <CircularProgress
                                value={health.memory}
                                icon={Database}
                                label="Memory"
                                detail={`${health.memoryUsed}/${health.memoryTotal} GB`}
                            />
                            <CircularProgress
                                value={health.disk}
                                icon={HardDrive}
                                label="Disk"
                                detail={`${health.diskUsed}/${health.diskTotal} GB`}
                            />
                        </div>
                    </div>

                    {/* 상세 정보 그리드 */}
                    <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* CPU 정보 */}
                        <InfoCard
                            icon={Cpu}
                            label="CPU 코어"
                            value={`${health.cpuCores} Cores`}
                            subValue={health.cpuFreqCurrent > 0 ? `${health.cpuFreqCurrent} MHz` : null}
                            color="text-blue-500"
                        />

                        {/* 메모리 정보 */}
                        <InfoCard
                            icon={Database}
                            label="사용 가능 메모리"
                            value={`${health.memoryAvailable} GB`}
                            subValue={`전체 ${health.memoryTotal} GB`}
                            color="text-purple-500"
                        />

                        {/* 디스크 정보 */}
                        <InfoCard
                            icon={HardDrive}
                            label="디스크 여유 공간"
                            value={`${health.diskFree} GB`}
                            subValue={`전체 ${health.diskTotal} GB`}
                            color="text-orange-500"
                        />

                        {/* 프로세스 */}
                        <InfoCard
                            icon={Box}
                            label="실행 중인 프로세스"
                            value={health.processCount}
                            color="text-cyan-500"
                        />
                    </div>

                    {/* 네트워크 및 시스템 정보 */}
                    <div className="px-6 pb-6">
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Wifi size={14} className="text-primary" />
                                <span className="text-xs font-black text-text-muted uppercase">Network I/O</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl p-3">
                                    <ArrowUpCircle size={20} className="text-emerald-500" />
                                    <div>
                                        <div className="text-[9px] font-bold text-text-muted uppercase">Sent</div>
                                        <div className="text-sm font-black text-emerald-500">
                                            {health.networkSent > 1024 ? `${(health.networkSent / 1024).toFixed(2)} GB` : `${health.networkSent} MB`}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl p-3">
                                    <ArrowDownCircle size={20} className="text-blue-500" />
                                    <div>
                                        <div className="text-[9px] font-bold text-text-muted uppercase">Received</div>
                                        <div className="text-sm font-black text-blue-500">
                                            {health.networkRecv > 1024 ? `${(health.networkRecv / 1024).toFixed(2)} GB` : `${health.networkRecv} MB`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 푸터 - 시스템 정보 및 갱신 시간 */}
                    <div className="px-6 pb-4 flex flex-wrap justify-between items-center gap-2 text-[10px] text-text-muted">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <Monitor size={10} />
                                {health.platform}
                            </span>
                            <span className="flex items-center gap-1">
                                <Zap size={10} />
                                Python {health.pythonVersion}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock size={10} />
                                Boot: {health.bootTime}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <RefreshCw size={10} className="animate-spin" />
                            <span>Last updated: {lastUpdated?.toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServerHealthBar;
