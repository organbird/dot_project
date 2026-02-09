import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Users,
    Building2,
    MousePointerClick,
    FileText,
    MessageSquare,
    Image,
    FileAudio,
    Calendar,
    TrendingUp,
    TrendingDown,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { API_BASE } from '../utils/api';

const StatCards = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalDepts: 0,
        todayVisitors: 0,
        totalLogs: 0,
        totalChats: 0,
        totalDocuments: 0,
        totalMeetings: 0,
        totalImages: 0,
        todayChats: 0,
        todayDocuments: 0,
        todayMeetings: 0,
        todayImages: 0,
        successLogs: 0,
        failLogs: 0
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await axios.get(`${API_BASE}/api/admin/stats`);
                setStats(response.data);
            } catch (error) {
                console.error("통계 로드 실패:", error);
            }
        };
        fetchStats();
        // 30초마다 갱신
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    // 성공률 계산
    const totalActions = stats.successLogs + stats.failLogs;
    const successRate = totalActions > 0 ? Math.round((stats.successLogs / totalActions) * 100) : 100;

    // 기본 시스템 통계
    const systemCards = [
        {
            title: '전체 사용자',
            value: stats.totalUsers,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            accent: 'bg-blue-500'
        },
        {
            title: '운영 부서',
            value: stats.totalDepts,
            icon: Building2,
            color: 'text-purple-600',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            accent: 'bg-purple-500'
        },
        {
            title: '오늘 접속자',
            value: stats.todayVisitors,
            icon: MousePointerClick,
            color: 'text-orange-600',
            bg: 'bg-orange-50 dark:bg-orange-900/20',
            accent: 'bg-orange-500'
        },
        {
            title: '성공률',
            value: `${successRate}%`,
            icon: successRate >= 90 ? CheckCircle : XCircle,
            color: successRate >= 90 ? 'text-green-600' : 'text-red-600',
            bg: successRate >= 90 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20',
            accent: successRate >= 90 ? 'bg-green-500' : 'bg-red-500',
            isPercentage: true
        },
    ];

    // AI 기능 사용 통계
    const featureCards = [
        {
            title: 'AI 챗봇',
            value: stats.totalChats,
            today: stats.todayChats,
            icon: MessageSquare,
            color: 'text-blue-600',
            bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
        },
        {
            title: '문서 관리',
            value: stats.totalDocuments,
            today: stats.todayDocuments,
            icon: FileText,
            color: 'text-emerald-600',
            bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
        },
        {
            title: '회의록 분석',
            value: stats.totalMeetings,
            today: stats.todayMeetings,
            icon: FileAudio,
            color: 'text-purple-600',
            bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
        },
        {
            title: '이미지 생성',
            value: stats.totalImages,
            today: stats.todayImages,
            icon: Image,
            color: 'text-amber-600',
            bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
        },
    ];

    return (
        <div className="space-y-6">
            {/* 시스템 통계 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {systemCards.map((item, index) => (
                    <div
                        key={index}
                        className="bg-white dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${item.bg}`}>
                                <item.icon size={22} className={item.color} />
                            </div>
                            <div className={`h-1.5 w-8 ${item.accent} rounded-full opacity-60`}></div>
                        </div>
                        <h3 className="text-text-muted text-xs font-medium mb-1">{item.title}</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black dark:text-white">
                                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                            </span>
                            {!item.isPercentage && <span className="text-xs text-text-muted">명/건</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* AI 기능 사용 통계 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {featureCards.map((item, index) => (
                    <div
                        key={index}
                        className={`${item.bg} p-5 rounded-2xl shadow-lg text-white relative overflow-hidden group hover:scale-[1.02] transition-transform`}
                    >
                        {/* 배경 장식 */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <item.icon size={20} />
                                </div>
                                {item.today > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold bg-white/20 px-2 py-1 rounded-full">
                                        <TrendingUp size={10} /> +{item.today} 오늘
                                    </span>
                                )}
                            </div>
                            <h3 className="text-white/80 text-xs font-medium mb-1">{item.title}</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black">{item.value.toLocaleString()}</span>
                                <span className="text-xs text-white/60">건</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StatCards;
