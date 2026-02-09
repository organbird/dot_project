import React, { useState } from 'react';
import UserSidebar from './UserSidebar';
import { Menu, X, Home, Bot, FolderOpen, FileAudio, Image, Calendar, UserCircle, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { removeToken } from '../utils/api';

const UserLayout = ({ children, user, setUser }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // 사용자 메뉴 항목 (UserSidebar와 동일)
    const menuItems = [
        { name: '메인 화면', icon: <Home size={24} />, path: '/home' },
        { name: '에이닷 챗봇', icon: <Bot size={24} />, path: '/chatbot' },
        { name: '문서 보관함', icon: <FolderOpen size={24} />, path: '/documents' },
        { name: '회의록 분석', icon: <FileAudio size={24} />, path: '/meeting' },
        { name: '이미지 생성', icon: <Image size={24} />, path: '/images' },
        { name: '일정 관리', icon: <Calendar size={24} />, path: '/schedule' },
        { name: '마이페이지', icon: <UserCircle size={24} />, path: '/mypage' },
    ];

    // 모바일 하단 탭바용 메뉴 (주요 5개만)
    const bottomTabItems = [
        { name: '홈', icon: <Home size={24} />, path: '/home' },
        { name: '챗봇', icon: <Bot size={24} />, path: '/chatbot' },
        { name: '문서', icon: <FolderOpen size={24} />, path: '/documents' },
        { name: '일정', icon: <Calendar size={24} />, path: '/schedule' },
    ];

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-background-dark overflow-hidden">
            {/* 1. 데스크톱 사이드바 (Lg 이상에서만 보임) */}
            <UserSidebar user={user} setUser={setUser} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

                {/* 2. 모바일 상단 헤더 (Lg 미만에서만 보임) */}
                <header className="lg:hidden flex items-center justify-between px-6 py-2 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark z-20">
                    <div className="flex items-center gap-1">
                        <img src="/icon/aibotIcon.png" alt="DOT" className="w-12 h-12 object-contain" />
                        <span className="font-black text-lg dark:text-white">Ai <span className="text-primary">DOT.</span></span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        {isMobileMenuOpen ? <X size={24} className="dark:text-white" /> : <Menu size={24} className="dark:text-white" />}
                    </button>
                </header>

                {/* 3. 모바일 전체화면 오버레이 메뉴 */}
                {isMobileMenuOpen && (
                    <div className="lg:hidden fixed inset-0 bg-white dark:bg-card-dark z-30 flex flex-col p-8 animate-in slide-in-from-top duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <span className="font-black text-2xl text-primary">MENU</span>
                            <button onClick={() => setIsMobileMenuOpen(false)}><X size={32} className="dark:text-white" /></button>
                        </div>
                        <nav className="space-y-4">
                            {menuItems.map((item) => (
                                <button
                                    key={item.path}
                                    onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
                                    className={`flex items-center gap-4 text-xl font-bold w-full py-2 ${location.pathname === item.path ? 'text-primary' : 'text-text-muted dark:text-gray-400'}`}
                                >
                                    {item.icon} {item.name}
                                </button>
                            ))}
                            <div className="border-t border-border-light dark:border-border-dark my-4"></div>
                            <button
                                onClick={() => { removeToken(); setUser(null); navigate('/login'); }}
                                className="flex items-center gap-4 text-xl font-bold text-red-500 w-full py-2"
                            >
                                <LogOut size={24} /> 로그아웃
                            </button>
                        </nav>
                    </div>
                )}

                {/* 4. 메인 콘텐츠 영역 */}
                <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
                    {children}
                </main>

                {/* 5. 모바일 하단 탭 바 (Lg 미만에서만 보임) */}
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-card-dark/80 backdrop-blur-lg border-t border-border-light dark:border-border-dark px-4 py-3 flex justify-around items-center z-20">
                    {bottomTabItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex flex-col items-center gap-1 transition-all ${location.pathname === item.path ? 'text-primary' : 'text-text-muted dark:text-gray-500'}`}
                        >
                            {item.icon}
                            <span className="text-[10px] font-bold">{item.name}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => navigate('/mypage')}
                        className={`flex flex-col items-center gap-1 transition-all ${location.pathname === '/mypage' ? 'text-primary' : 'text-text-muted dark:text-gray-500'}`}
                    >
                        <img
                            src={user?.gender === 'F' ? '/avatar/female.png' : '/avatar/male.png'}
                            alt="프로필"
                            className="size-6 rounded-full bg-gray-100"
                        />
                        <span className="text-[10px] font-bold">MY</span>
                    </button>
                </nav>
            </div>
        </div>
    );
};

export default UserLayout;
