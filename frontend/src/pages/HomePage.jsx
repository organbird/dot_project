import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../components/UserLayout';
import {
    MessageSquare,
    FileText,
    Image,
    Calendar,
    Clock,
    User,
    Mail,
    Building2,
    Shield,
    ChevronRight,
    Sparkles,
    TrendingUp,
    Loader2
} from 'lucide-react';
import { API_BASE } from '../utils/api';

// API 기본 URL
const API_BASE_URL = API_BASE;

const HomePage = ({ user, setUser }) => {
    const navigate = useNavigate();

    // 로딩 상태
    const [isLoading, setIsLoading] = useState(true);

    // 통계 데이터
    const [stats, setStats] = useState({
        chatCount: 0,
        documentCount: 0,
        imageCount: 0,
        scheduleCount: 0
    });

    // 최근 AI 대화
    const [recentChats, setRecentChats] = useState([]);

    // 최근 문서
    const [recentDocuments, setRecentDocuments] = useState([]);

    // 사용자 프로필 (부서명 포함)
    const [profile, setProfile] = useState(null);

    // 컴포넌트 마운트 시 데이터 로드
    useEffect(() => {
        if (user?.id) {
            fetchHomeData();
        }
    }, [user?.id]);

    // 홈페이지 데이터 가져오기 (통합 API 사용)
    const fetchHomeData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/user/${user.id}/home-data`);

            if (!response.ok) {
                throw new Error('데이터를 불러오는데 실패했습니다.');
            }

            const data = await response.json();

            // 통계 데이터 설정
            setStats(data.stats);

            // 최근 AI 대화 설정
            setRecentChats(data.recentChats);

            // 최근 문서 설정
            setRecentDocuments(data.recentDocuments);

            // 프로필 정보 설정
            setProfile(data.profile);

        } catch (error) {
            console.error('홈 데이터 로드 실패:', error);
            // 에러 시 기본값 유지
        } finally {
            setIsLoading(false);
        }
    };

    // 현재 시간에 따른 인사말
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return '좋은 아침이에요';
        if (hour < 18) return '좋은 오후예요';
        return '좋은 저녁이에요';
    };

    // 통계 카드 데이터
    const statCards = [
        {
            title: 'AI 채팅',
            value: stats.chatCount,
            unit: '회',
            icon: <MessageSquare size={24} />,
            color: 'bg-blue-500',
            lightBg: 'bg-blue-50 dark:bg-blue-500/10',
        },
        {
            title: '생성 문서',
            value: stats.documentCount,
            unit: '개',
            icon: <FileText size={24} />,
            color: 'bg-emerald-500',
            lightBg: 'bg-emerald-50 dark:bg-emerald-500/10',
        },
        {
            title: '이미지 생성',
            value: stats.imageCount,
            unit: '개',
            icon: <Image size={24} />,
            color: 'bg-purple-500',
            lightBg: 'bg-purple-50 dark:bg-purple-500/10',
        },
        {
            title: '오늘 일정',
            value: stats.scheduleCount,
            unit: '건',
            icon: <Calendar size={24} />,
            color: 'bg-amber-500',
            lightBg: 'bg-amber-50 dark:bg-amber-500/10',
        },
    ];

    // 프로필 데이터 (API에서 가져온 정보 또는 user 객체 사용)
    const displayProfile = profile || {
        name: user?.name,
        email: user?.email,
        role: user?.role,
        deptIdx: user?.dept_idx,
        deptName: '로딩 중...'
    };

    return (
        <UserLayout user={user} setUser={setUser}>
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 md:gap-8">

                {/* 1. 환영 메시지 섹션 */}
                <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-primary/20">
                    {/* 배경 장식 */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={20} className="text-yellow-300" />
                                <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                                    {new Date().toLocaleDateString('ko-KR', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                                {getGreeting()}, {user?.name}님!
                            </h1>
                            <p className="mt-2 text-white/80 text-sm md:text-base">
                                오늘도 Ai DOT.과 함께 생산적인 하루 보내세요.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                            <img
                                src={user?.gender === 'F' ? '/avatar/female.png' : '/avatar/male.png'}
                                alt="프로필"
                                className="w-14 h-14 rounded-2xl border-2 border-white/30 shadow-lg bg-white/20"
                            />
                            <div>
                                <p className="font-bold">{user?.name}</p>
                                <p className="text-xs text-white/70">{user?.email}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. 통계 카드 섹션 */}
                <section>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {statCards.map((card, index) => (
                            <div
                                key={index}
                                className="bg-white dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`p-2.5 rounded-xl ${card.lightBg}`}>
                                        <div className={`${card.color} text-white p-2 rounded-lg`}>
                                            {card.icon}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-text-muted mb-1">{card.title}</p>
                                <p className="text-2xl font-black dark:text-white">
                                    {isLoading ? '-' : card.value}
                                    <span className="text-sm font-medium text-text-muted ml-1">{card.unit}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. 최근 업무 히스토리 섹션 */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* 최근 AI 대화 */}
                    <div className="lg:col-span-1 bg-white dark:bg-card-dark rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                                <h3 className="font-bold dark:text-white">최근 AI 대화</h3>
                            </div>
                            <button
                                onClick={() => navigate('/chatbot')}
                                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                            >
                                전체보기 <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            {isLoading ? (
                                <div className="text-center py-8">
                                    <Loader2 size={32} className="mx-auto mb-2 animate-spin text-primary" />
                                    <p className="text-sm text-text-muted">불러오는 중...</p>
                                </div>
                            ) : recentChats.length > 0 ? (
                                recentChats.map((chat) => (
                                    <div
                                        key={chat.id}
                                        onClick={() => navigate(`/chatbot?session=${chat.id}`)}
                                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg shrink-0">
                                                <MessageSquare size={16} className="text-blue-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm dark:text-white truncate group-hover:text-primary transition-colors">
                                                    {chat.title}
                                                </p>
                                                <p className="text-xs text-text-muted mt-1 truncate">{chat.preview}</p>
                                                <p className="text-[10px] text-text-muted mt-2 flex items-center gap-1">
                                                    <Clock size={10} /> {chat.time}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-text-muted">
                                    <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">아직 대화 기록이 없습니다</p>
                                    <button
                                        onClick={() => navigate('/chatbot')}
                                        className="mt-3 text-xs text-primary font-bold hover:underline"
                                    >
                                        첫 대화 시작하기
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 최근 문서 */}
                    <div className="lg:col-span-1 bg-white dark:bg-card-dark rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-5 bg-emerald-500 rounded-full"></div>
                                <h3 className="font-bold dark:text-white">최근 문서</h3>
                            </div>
                            <button
                                onClick={() => navigate('/documents')}
                                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                            >
                                전체보기 <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            {isLoading ? (
                                <div className="text-center py-8">
                                    <Loader2 size={32} className="mx-auto mb-2 animate-spin text-primary" />
                                    <p className="text-sm text-text-muted">불러오는 중...</p>
                                </div>
                            ) : recentDocuments.length > 0 ? (
                                recentDocuments.map((doc) => (
                                    <div
                                        key={doc.id}
                                        onClick={() => navigate('/documents')}
                                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg shrink-0">
                                                <FileText size={16} className="text-emerald-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm dark:text-white truncate group-hover:text-primary transition-colors">
                                                    {doc.title}
                                                </p>
                                                <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                                                    <Clock size={10} /> {doc.date}
                                                    <span className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[9px] uppercase">
                                                        {doc.type}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-text-muted">
                                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">아직 문서가 없습니다</p>
                                    <button
                                        onClick={() => navigate('/documents')}
                                        className="mt-3 text-xs text-primary font-bold hover:underline"
                                    >
                                        문서 업로드하기
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 접속 계정 정보 */}
                    <div className="lg:col-span-1 bg-white dark:bg-card-dark rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
                                <h3 className="font-bold dark:text-white">내 계정 정보</h3>
                            </div>
                        </div>
                        <div className="p-5">
                            {/* 프로필 이미지 */}
                            <div className="flex flex-col items-center mb-6">
                                <img
                                    src={user?.gender === 'F' ? '/avatar/female.png' : '/avatar/male.png'}
                                    alt="프로필"
                                    className="w-20 h-20 rounded-2xl border-4 border-primary/20 shadow-lg bg-gray-50"
                                />
                                <p className="mt-3 font-bold text-lg dark:text-white">{displayProfile.name}</p>
                                <span className={`mt-1 text-xs font-bold px-3 py-1 rounded-full ${
                                    displayProfile.role === 'ADMIN'
                                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20'
                                        : 'bg-primary/10 text-primary'
                                }`}>
                                    {displayProfile.role === 'ADMIN' ? 'Administrator' : 'User'}
                                </span>
                            </div>

                            {/* 계정 상세 정보 */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                                        <Mail size={16} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-text-muted uppercase tracking-wider">이메일</p>
                                        <p className="text-sm font-medium dark:text-white">{displayProfile.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                                        <Building2 size={16} className="text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-text-muted uppercase tracking-wider">부서</p>
                                        <p className="text-sm font-medium dark:text-white">
                                            {isLoading ? '로딩 중...' : displayProfile.deptName}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                                        <Shield size={16} className="text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-text-muted uppercase tracking-wider">권한</p>
                                        <p className="text-sm font-medium dark:text-white">{displayProfile.role}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </UserLayout>
    );
};

export default HomePage;
