import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { verifyToken, getStoredUser } from './utils/api';
import IndexPage from './pages/IndexPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SchedulePage from './pages/SchedulePage';
import DocumentPage from './pages/DocumentPage';
import MeetingPage from './pages/MeetingPage';
import ImagePage from './pages/ImagePage';
import MyPage from './pages/MyPage';
import ChatbotPage from './pages/ChatbotPage';
import DashboardPage from './pages/DashboardPage';
import SignUpPage from "./pages/SignUpPage";
import DeptManagementPage from "./pages/DeptManagementPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // 앱 시작 시 저장된 다크모드 설정 적용
    useEffect(() => {
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode && JSON.parse(savedDarkMode)) {
            document.documentElement.classList.add('dark');
        }
    }, []);

    // 앱 시작 시 토큰 검증 및 사용자 상태 복원
    useEffect(() => {
        const initAuth = async () => {
            // 먼저 localStorage에서 사용자 정보 로드 (빠른 UI 복원)
            const storedUser = getStoredUser();
            if (storedUser) {
                setUser(storedUser);
            }

            // 서버에서 토큰 유효성 검증
            const verifiedUser = await verifyToken();
            if (verifiedUser) {
                setUser(verifiedUser);
            } else if (storedUser) {
                // 토큰이 만료되었으면 사용자 상태 초기화
                setUser(null);
            }

            setIsLoading(false);
        };

        initAuth();
    }, []);

    // 로딩 중 표시
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#FFF6EB] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                {/* 누구나 접근 가능한 페이지 */}
                <Route path="/" element={<IndexPage />} />
                <Route path="/login" element={<LoginPage setUser={setUser} />} />
                <Route path="/signup" element={<SignUpPage />} />

                {/* [그룹 1] 로그인만 하면 들어갈 수 있는 페이지들 */}
                <Route element={<ProtectedRoute isAllowed={!!user} />}>
                    <Route path="/home" element={<HomePage user={user} setUser={setUser} />} />
                    <Route path="/chatbot" element={<ChatbotPage user={user} setUser={setUser} />} />
                    <Route path="/schedule" element={<SchedulePage user={user} setUser={setUser} />} />
                    <Route path="/documents" element={<DocumentPage user={user} setUser={setUser} />} />
                    <Route path="/meeting" element={<MeetingPage user={user} setUser={setUser} />} />
                    <Route path="/images" element={<ImagePage user={user} setUser={setUser} />} />
                    <Route path="/mypage" element={<MyPage user={user} setUser={setUser} />} />
                </Route>

                {/* [그룹 2] 관리자(ADMIN)만 들어갈 수 있는 페이지들 */}
                <Route
                    element={
                        <ProtectedRoute
                            isAllowed={user?.role === 'ADMIN'}
                            redirectPath="/home" // 관리자가 아니면 홈으로 리다이렉트
                        />
                    }
                >
                    <Route path="/dashboard" element={<DashboardPage user={user} setUser={setUser} />} />
                    <Route path="/admin/depts" element={<DeptManagementPage user={user} />} />
                    <Route path="/admin/settings" element={<AdminSettingsPage user={user} setUser={setUser} />} />
                </Route>

                {/* 잘못된 경로는 인덱스 페이지로 */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;