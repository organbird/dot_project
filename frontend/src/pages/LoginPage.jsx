import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { setToken, setUser as saveUser, API_BASE } from '../utils/api';

const LoginPage = ({ setUser }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!userId || !password) {
            alert("이메일과 비밀번호를 모두 입력해주세요.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userId,
                    password: password
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '로그인에 실패했습니다.');
            }

            const data = await response.json();

            // JWT 토큰 저장
            setToken(data.access_token);

            // 사용자 정보 저장
            saveUser(data.user);
            setUser(data.user);

            // 역할에 따라 리다이렉트
            if (data.user.role === 'ADMIN') {
                navigate('/dashboard');
            } else {
                navigate('/home');
            }
        } catch (error) {
            alert(error.message || '아이디 또는 비밀번호를 확인하세요.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FFF6EB] flex items-center justify-center px-6 relative overflow-hidden">
            {/* 배경 장식 요소 */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-200/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-300/20 rounded-full blur-[120px]" />

            <div className="relative w-full max-w-[450px]">
                {/* 뒤로가기 버튼 */}
                <button
                    onClick={() => navigate("/")}
                    className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors mb-8 font-medium group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    메인으로 돌아가기
                </button>

                <div className="bg-white/80 backdrop-blur-xl p-10 md:p-12 rounded-[2.5rem] shadow-[0_20px_50px_rgba(255,145,0,0.1)] border border-white">
                    {/* 헤더 */}
                    <div className="text-center mb-10">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <img
                                src="/icon/aibotIcon.png"
                                alt="Ai DOT"
                                className="w-12 h-12 object-contain"
                            />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tighter">
                            반가워요! <span className="text-orange-500">Ai DOT.</span>입니다
                        </h1>
                        <p className="text-gray-500 font-medium">서비스 이용을 위해 로그인을 해주세요.</p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">이메일</label>
                                <input
                                    type="email"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    maxLength={50}
                                    className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl focus:border-orange-400 focus:bg-white outline-none transition-all placeholder:text-gray-400"
                                    placeholder="이메일을 입력하세요 (최대 50자)"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">비밀번호</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        maxLength={20}
                                        className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl focus:border-orange-400 focus:bg-white outline-none transition-all placeholder:text-gray-400 pr-12"
                                        placeholder="비밀번호를 입력하세요"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-3 mb-8">
                            <button
                                type="button"
                                className="text-sm font-semibold text-gray-400 hover:text-orange-500 transition-colors"
                            >
                                비밀번호를 잊으셨나요?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-orange-500 text-white py-5 rounded-2xl font-black text-lg hover:bg-orange-600 shadow-xl shadow-orange-200 hover:shadow-orange-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? '로그인 중...' : '로그인'}
                        </button>
                    </form>

                    <div className="mt-10 pt-8 border-t border-gray-100 text-center">
                        <p className="text-gray-500 font-medium">
                            아직 계정이 없으신가요?{" "}
                            <Link
                                to="/signup"
                                className="text-orange-500 font-bold hover:underline underline-offset-4 ml-2"
                            >
                                회원가입
                            </Link>
                        </p>
                    </div>
                </div>

                {/* 하단 카피라이트 */}
                <p className="text-center text-xs text-gray-400 mt-8">
                    © 2026 Ai DOT. All rights reserved.
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
