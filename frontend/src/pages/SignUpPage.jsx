import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import DeptModal from '../components/DeptModal';
import { API_BASE } from '../utils/api';

const SignUpPage = () => {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDeptName, setSelectedDeptName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        name: '',
        password: '',
        phone: '',
        dept_idx: '',
        role: 'USER',
        gender: 'M'
    });

    // 이메일 유효성 체크 (최대 50자, 형식 검증)
    const emailValidation = useMemo(() => {
        if (!formData.email) return { valid: false, message: '' };
        if (formData.email.length > 50) return { valid: false, message: '이메일은 50자 이내로 입력해주세요' };
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) return { valid: false, message: '올바른 이메일 형식이 아닙니다' };
        return { valid: true, message: '사용 가능' };
    }, [formData.email]);

    const isEmailValid = emailValidation.valid;

    // 이름 유효성 체크 (최대 50자)
    const nameValidation = useMemo(() => {
        if (!formData.name) return { valid: false, message: '' };
        if (formData.name.length > 50) return { valid: false, message: '이름은 50자 이내로 입력해주세요' };
        if (formData.name.trim().length < 2) return { valid: false, message: '이름은 2자 이상 입력해주세요' };
        return { valid: true, message: '' };
    }, [formData.name]);

    // 비밀번호 유효성 체크 (4자 이상, 20자 이하)
    const passwordValidation = useMemo(() => {
        if (!formData.password) return { valid: false, message: '' };
        if (formData.password.length < 4) return { valid: false, message: '비밀번호는 4자 이상이어야 합니다' };
        if (formData.password.length > 20) return { valid: false, message: '비밀번호는 20자 이내로 입력해주세요' };
        return { valid: true, message: '사용 가능' };
    }, [formData.password]);

    // 휴대폰 번호 자동 하이픈
    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        let formattedNumber = '';

        if (value.length <= 3) {
            formattedNumber = value;
        } else if (value.length <= 7) {
            formattedNumber = `${value.slice(0, 3)}-${value.slice(3)}`;
        } else {
            formattedNumber = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`;
        }

        setFormData({ ...formData, phone: formattedNumber });
    };

    const handleSignup = async (e) => {
        e.preventDefault();

        // 유효성 검사 - 각 필드별 명확한 오류 메시지
        if (!formData.email) return alert("이메일을 입력해주세요.");
        if (!emailValidation.valid) return alert(`이메일 오류: ${emailValidation.message}`);

        if (!formData.name) return alert("이름을 입력해주세요.");
        if (!nameValidation.valid) return alert(`이름 오류: ${nameValidation.message}`);

        if (!formData.phone) return alert("연락처를 입력해주세요.");
        if (formData.phone.length < 12) return alert("연락처 오류: 휴대폰 번호를 정확히 입력해주세요. (010-0000-0000)");

        if (!formData.dept_idx) return alert("부서 오류: 소속 부서를 선택해주세요.");

        if (!formData.password) return alert("비밀번호를 입력해주세요.");
        if (!passwordValidation.valid) return alert(`비밀번호 오류: ${passwordValidation.message}`);

        setIsLoading(true);
        try {
            await axios.post(`${API_BASE}/api/register`, formData);
            alert("회원가입 성공! 로그인 페이지로 이동합니다.");
            navigate('/login');
        } catch (error) {
            const errorMsg = error.response?.data?.detail;
            if (typeof errorMsg === 'string') {
                // 백엔드에서 전달된 구체적인 오류 메시지 표시
                alert(`회원가입 실패: ${errorMsg}`);
            } else {
                alert("회원가입 실패: 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FFF6EB] flex items-center justify-center px-6 py-12 relative overflow-hidden">
            {/* 배경 장식 */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-200/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-300/20 rounded-full blur-[120px]" />

            <div className="relative w-full max-w-[500px]">
                {/* 뒤로가기 버튼 */}
                <button
                    onClick={() => navigate("/login")}
                    className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors mb-6 font-medium group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    로그인으로 돌아가기
                </button>

                <div className="bg-white/80 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(255,145,0,0.15)] border border-white">
                    {/* 헤더 */}
                    <div className="text-center mb-8">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <img
                                src="/icon/aibotIcon.png"
                                alt="Ai DOT"
                                className="w-10 h-10 object-contain"
                            />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tighter">회원가입</h1>
                        <p className="text-gray-500 font-medium text-sm">
                            <span className="text-orange-500 font-bold">Ai DOT.</span>과 함께 스마트하게 시작하세요.
                        </p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-5">
                        {/* 이메일 (최대 50자) */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5 ml-1">
                                <label className="text-sm font-bold text-gray-700">이메일 <span className="text-xs text-gray-400">({formData.email.length}/50)</span></label>
                                {formData.email && (
                                    <span className={`text-[11px] flex items-center gap-1 ${emailValidation.valid ? 'text-green-500' : 'text-red-500'}`}>
                                        {emailValidation.valid ? <><CheckCircle2 size={12} /> {emailValidation.message}</> : <><AlertCircle size={12} /> {emailValidation.message}</>}
                                    </span>
                                )}
                            </div>
                            <input
                                type="email"
                                placeholder="example@dot.com"
                                maxLength={50}
                                className={`w-full bg-gray-50/50 border-2 p-3.5 rounded-2xl outline-none transition-all ${
                                    formData.email
                                        ? (emailValidation.valid ? 'border-green-400 focus:border-green-500' : 'border-red-300 focus:border-red-400')
                                        : 'border-gray-100 focus:border-orange-400 focus:bg-white'
                                }`}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>

                        {/* 이름 & 연락처 그리드 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                                    이름 <span className="text-xs text-gray-400">({formData.name.length}/50)</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="성함 (2~50자)"
                                    maxLength={50}
                                    className={`w-full bg-gray-50/50 border-2 p-3.5 rounded-2xl outline-none transition-all ${
                                        formData.name && !nameValidation.valid
                                            ? 'border-red-300 focus:border-red-400'
                                            : 'border-gray-100 focus:border-orange-400 focus:bg-white'
                                    }`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                                {formData.name && !nameValidation.valid && (
                                    <p className="text-xs text-red-500 mt-1 ml-1">{nameValidation.message}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">연락처</label>
                                <input
                                    type="text"
                                    placeholder="010-0000-0000"
                                    maxLength={13}
                                    className="w-full bg-gray-50/50 border-2 border-gray-100 p-3.5 rounded-2xl focus:border-orange-400 focus:bg-white outline-none transition-all"
                                    value={formData.phone}
                                    onChange={handlePhoneChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* 성별 선택 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">성별</label>
                            <div className="flex gap-4">
                                <label
                                    className={`flex-1 flex items-center justify-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                                        formData.gender === 'M'
                                            ? 'border-orange-400 bg-orange-50 text-orange-600'
                                            : 'border-gray-100 bg-gray-50/50 text-gray-500 hover:border-orange-200'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="M"
                                        checked={formData.gender === 'M'}
                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                        className="hidden"
                                    />
                                    <img src="/avatar/male.png" alt="남성" className="w-8 h-8" />
                                    <span className="font-bold">남성</span>
                                </label>
                                <label
                                    className={`flex-1 flex items-center justify-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                                        formData.gender === 'F'
                                            ? 'border-orange-400 bg-orange-50 text-orange-600'
                                            : 'border-gray-100 bg-gray-50/50 text-gray-500 hover:border-orange-200'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="F"
                                        checked={formData.gender === 'F'}
                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                        className="hidden"
                                    />
                                    <img src="/avatar/female.png" alt="여성" className="w-8 h-8" />
                                    <span className="font-bold">여성</span>
                                </label>
                            </div>
                        </div>

                        {/* 비밀번호 (4~20자) */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5 ml-1">
                                <label className="text-sm font-bold text-gray-700">비밀번호 <span className="text-xs text-gray-400">({formData.password.length}/20)</span></label>
                                {formData.password && (
                                    <span className={`text-[11px] flex items-center gap-1 ${passwordValidation.valid ? 'text-green-500' : 'text-red-500'}`}>
                                        {passwordValidation.valid ? <><CheckCircle2 size={12} /> {passwordValidation.message}</> : <><AlertCircle size={12} /> {passwordValidation.message}</>}
                                    </span>
                                )}
                            </div>
                            <input
                                type="password"
                                placeholder="4~20자 입력"
                                maxLength={20}
                                className={`w-full bg-gray-50/50 border-2 p-3.5 rounded-2xl outline-none transition-all ${
                                    formData.password
                                        ? (passwordValidation.valid ? 'border-green-400 focus:border-green-500' : 'border-red-300 focus:border-red-400')
                                        : 'border-gray-100 focus:border-orange-400 focus:bg-white'
                                }`}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                minLength={4}
                            />
                        </div>

                        {/* 부서 선택 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">소속 부서</label>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className={`w-full p-4 text-left rounded-2xl border-2 transition-all flex items-center justify-between ${
                                    selectedDeptName
                                        ? "border-orange-400 bg-white text-gray-900 font-bold"
                                        : "border-gray-100 bg-gray-50/50 text-gray-400 hover:border-orange-300"
                                }`}
                            >
                                <span>{selectedDeptName || "부서를 선택해 주세요"}</span>
                                <ChevronDown size={18} className={selectedDeptName ? "text-orange-500" : "text-gray-400"} />
                            </button>
                        </div>

                        {/* 가입 완료 버튼 */}
                        <button
                            type="submit"
                            disabled={isLoading || (formData.email && !emailValidation.valid) || (formData.name && !nameValidation.valid) || (formData.password && !passwordValidation.valid)}
                            className="w-full bg-orange-500 text-white py-5 rounded-2xl font-black text-lg hover:bg-orange-600 shadow-xl shadow-orange-200 hover:shadow-orange-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? '가입 처리 중...' : '가입 완료하기'}
                        </button>
                    </form>

                    {/* 하단 링크 */}
                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                        <p className="text-gray-500 font-medium text-sm">
                            이미 계정이 있으신가요?{" "}
                            <button
                                onClick={() => navigate('/login')}
                                className="text-orange-500 font-bold hover:underline underline-offset-4 ml-1"
                            >
                                로그인
                            </button>
                        </p>
                    </div>
                </div>

                {/* 하단 카피라이트 */}
                <p className="text-center text-xs text-gray-400 mt-8">
                    © 2026 Ai DOT. All rights reserved.
                </p>
            </div>

            {/* 부서 선택 모달 */}
            <DeptModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelect={(dept) => {
                    setFormData({ ...formData, dept_idx: dept.id });
                    setSelectedDeptName(dept.dept_name);
                }}
            />
        </div>
    );
};

export default SignUpPage;
