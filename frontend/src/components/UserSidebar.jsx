import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Home,
    Bot,
    FolderOpen,
    FileAudio,
    Image,
    Calendar,
    UserCircle,
    LogOut,
    LayoutDashboard
} from 'lucide-react';
import { removeToken } from '../utils/api';

const UserSidebar = ({ user, setUser }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        if (window.confirm("로그아웃 하시겠습니까?")) {
            removeToken();  // JWT 토큰 및 사용자 정보 삭제
            setUser(null);
            navigate('/login');
        }
    };

    // 사용자 메뉴 항목
    const userMenuItems = [
        { name: '메인 화면', icon: <Home size={24} />, path: '/home' },
        { name: '에이닷 챗봇', icon: <Bot size={24} />, path: '/chatbot' },
        { name: '문서 보관함', icon: <FolderOpen size={24} />, path: '/documents' },
        { name: '회의록 분석', icon: <FileAudio size={24} />, path: '/meeting' },
        { name: '이미지 생성', icon: <Image size={24} />, path: '/images' },
        { name: '일정 관리', icon: <Calendar size={24} />, path: '/schedule' },
        { name: '마이페이지', icon: <UserCircle size={24} />, path: '/mypage' },
    ];

    return (
        <aside className="hidden lg:flex w-72 flex-shrink-0 flex-col border-r border-border-light dark:border-border-dark bg-white dark:bg-card-dark h-full p-4">

            {/* 1. 최상단: 브랜드 로고 영역 */}
            <div className="flex flex-col items-center">
                <div
                    className="group cursor-pointer flex items-center justify-center -my-6"
                    onClick={() => navigate('/home')}
                >
                    <img
                        src="/icon/aibotIcon.png"
                        alt="Ai DOT 로고"
                        className="w-48 h-48 object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                    />
                </div>
                <div className="flex flex-col items-center -mt-6">
                    <span className="font-black text-2xl tracking-tight dark:text-white">
                        Ai <span className="text-primary">DOT.</span>
                    </span>
                    <div className="h-1 w-8 bg-primary rounded-full mt-1 opacity-50"></div>
                </div>
            </div>

            {/* 2. 메인 네비게이션 메뉴 */}
            <nav className="flex flex-col gap-1.5 px-1 mt-2 overflow-y-auto flex-1">
                {userMenuItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                            location.pathname === item.path
                                ? 'bg-primary text-white shadow-lg shadow-primary/30 font-bold'
                                : 'text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        {item.icon}
                        <span className="text-sm">{item.name}</span>
                    </button>
                ))}

                {/* 관리자인 경우 관리자 대시보드 이동 버튼 표시 */}
                {user?.role === 'ADMIN' && (
                    <>
                        <div className="my-3 px-4">
                            <div className="border-t border-border-light dark:border-border-dark w-full"></div>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 block opacity-50">Admin</span>
                        </div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-text-muted hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 group"
                        >
                            <LayoutDashboard size={24} className="opacity-70 group-hover:opacity-100" />
                            <span className="text-sm font-medium">관리자 대시보드</span>
                        </button>
                    </>
                )}
            </nav>

            {/* 3. 최하단: 사용자 정보 및 로그아웃 버튼 */}
            <div className="pt-4 border-t border-border-light dark:border-border-dark">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-background-dark/50 border border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <img
                            src={user?.gender === 'F' ? '/avatar/female.png' : '/avatar/male.png'}
                            alt="프로필"
                            className="w-10 h-10 rounded-full shrink-0 border-2 border-primary/20 bg-gray-50"
                        />
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-xs font-bold dark:text-white truncate">
                                {user?.name || '사용자'}
                            </span>
                            <span className="text-[10px] text-primary font-black uppercase tracking-tighter">
                                {user?.role === 'ADMIN' ? 'Administrator' : 'User'}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="p-2.5 text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all group"
                        title="로그아웃"
                    >
                        <LogOut size={20} className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
                <p className="mt-4 text-[9px] text-center text-text-muted opacity-40 uppercase tracking-widest">
                    © 2026 Ai-DOT Service
                </p>
            </div>
        </aside>
    );
};

export default UserSidebar;
