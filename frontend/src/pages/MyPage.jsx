import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../components/UserLayout';
import {
    User,
    Mail,
    Phone,
    Building,
    Calendar,
    Shield,
    Edit3,
    Lock,
    Save,
    X,
    MessageSquare,
    FileText,
    Image,
    FileAudio,
    CalendarDays,
    TrendingUp,
    Award,
    Sun,
    Moon
} from 'lucide-react';
import { API_BASE } from '../utils/api';

export default function MyPage({ user, setUser }) {
    const navigate = useNavigate();

    // 상태 관리
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);
    const [monthlyActivity, setMonthlyActivity] = useState(null);

    // 편집 모드
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', phone: '' });
    const [saving, setSaving] = useState(false);

    // 비밀번호 변경 모달
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [changingPassword, setChangingPassword] = useState(false);

    // 다크모드 상태 (localStorage에서 초기값 로드)
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode');
        return saved ? JSON.parse(saved) : false;
    });

    // 다크모드 토글 함수
    const toggleDarkMode = () => {
        setIsDarkMode(prev => !prev);
    };

    // 다크모드 상태 변경 시 HTML에 클래스 적용 및 localStorage 저장
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    // 마이페이지 데이터 로드
    const fetchMyPageData = async () => {
        if (!user?.id) return;

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/user/${user.id}/mypage-data`);
            if (response.ok) {
                const data = await response.json();
                setProfile(data.profile);
                setStats(data.stats);
                setMonthlyActivity(data.monthlyActivity);
                setEditForm({
                    name: data.profile.name,
                    phone: data.profile.phone || ''
                });
            }
        } catch (error) {
            console.error('마이페이지 데이터 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // 프로필 수정
    const updateProfile = async () => {
        if (!editForm.name.trim()) {
            alert('이름을 입력해주세요.');
            return;
        }
        if (editForm.name.trim().length < 2 || editForm.name.length > 50) {
            alert('이름은 2~50자 이내로 입력해주세요.');
            return;
        }
        if (editForm.phone && editForm.phone.length < 12) {
            alert('연락처를 올바르게 입력해주세요. (010-0000-0000)');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`${API_BASE}/user/${user.id}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name,
                    phone: editForm.phone
                })
            });

            if (response.ok) {
                const data = await response.json();
                setProfile(prev => ({ ...prev, ...data.profile }));
                setEditMode(false);
                alert('프로필이 수정되었습니다.');

                // 상위 user 상태 업데이트
                if (setUser) {
                    setUser(prev => ({ ...prev, name: editForm.name }));
                }
            } else {
                const error = await response.json();
                alert(error.detail || '프로필 수정에 실패했습니다.');
            }
        } catch (error) {
            console.error('프로필 수정 실패:', error);
            alert('프로필 수정 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    // 비밀번호 변경
    const changePassword = async () => {
        if (!passwordForm.currentPassword) {
            alert('현재 비밀번호를 입력해주세요.');
            return;
        }
        if (!passwordForm.newPassword) {
            alert('새 비밀번호를 입력해주세요.');
            return;
        }
        if (passwordForm.newPassword.length < 4) {
            alert('새 비밀번호는 4자 이상이어야 합니다.');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            alert('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        setChangingPassword(true);
        try {
            const response = await fetch(`${API_BASE}/user/${user.id}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: passwordForm.currentPassword,
                    new_password: passwordForm.newPassword
                })
            });

            if (response.ok) {
                alert('비밀번호가 변경되었습니다.');
                setShowPasswordModal(false);
                setPasswordForm({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
            } else {
                const error = await response.json();
                alert(error.detail || '비밀번호 변경에 실패했습니다.');
            }
        } catch (error) {
            console.error('비밀번호 변경 실패:', error);
            alert('비밀번호 변경 중 오류가 발생했습니다.');
        } finally {
            setChangingPassword(false);
        }
    };

    // 편집 취소
    const cancelEdit = () => {
        setEditForm({
            name: profile?.name || '',
            phone: profile?.phone || ''
        });
        setEditMode(false);
    };

    // 초기 로드
    useEffect(() => {
        fetchMyPageData();
    }, [user?.id]);

    if (loading) {
        return (
            <UserLayout user={user} setUser={setUser} activeMenu="마이페이지">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-primary border-t-transparent"></div>
                </div>
            </UserLayout>
        );
    }

    return (
        <UserLayout user={user} setUser={setUser} activeMenu="마이페이지">
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 md:gap-8">
                {/* 헤더 */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-border-light dark:border-border-dark pb-6">
                    <div>
                        <p className="text-primary text-[10px] md:text-xs font-bold uppercase tracking-tighter mb-1">My Page</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight dark:text-white">마이페이지</h1>
                        <p className="text-text-muted text-sm mt-1">내 정보를 확인하고 관리하세요</p>
                    </div>

                    {/* 다크모드 토글 */}
                    <div className="mt-4 md:mt-0 flex items-center gap-3">
                        <span className="text-sm text-text-muted font-medium">
                            {isDarkMode ? '다크 모드' : '라이트 모드'}
                        </span>
                        <button
                            onClick={toggleDarkMode}
                            className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                                isDarkMode
                                    ? 'bg-gray-700'
                                    : 'bg-amber-100'
                            }`}
                            title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
                        >
                            <div
                                className={`absolute top-1 w-6 h-6 rounded-full transition-all duration-300 flex items-center justify-center ${
                                    isDarkMode
                                        ? 'left-9 bg-gray-900'
                                        : 'left-1 bg-amber-400'
                                }`}
                            >
                                {isDarkMode ? (
                                    <Moon size={14} className="text-yellow-300" />
                                ) : (
                                    <Sun size={14} className="text-amber-700" />
                                )}
                            </div>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 프로필 카드 */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                            {/* 프로필 헤더 */}
                            <div className="bg-gradient-to-br from-primary via-primary to-purple-600 px-6 py-10 text-center">
                                <div className="w-28 h-28 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-4 border-4 border-white/30 shadow-xl">
                                    <img
                                        src={user?.gender === 'F' ? '/avatar/female.png' : '/avatar/male.png'}
                                        alt="프로필"
                                        className="w-24 h-24 rounded-full bg-white/30"
                                    />
                                </div>
                                <h2 className="text-xl font-bold text-white">{profile?.name}</h2>
                                <p className="text-white/80 text-sm mt-1">{profile?.email}</p>
                                <span className={`inline-block mt-3 px-4 py-1.5 rounded-full text-xs font-bold ${
                                    profile?.role === 'ADMIN'
                                        ? 'bg-amber-400 text-amber-900'
                                        : 'bg-white/20 text-white'
                                }`}>
                                    {profile?.roleText}
                                </span>
                            </div>

                            {/* 프로필 정보 */}
                            <div className="p-6">
                                {!editMode ? (
                                    <>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                    <User size={18} className="text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-text-muted font-medium">이름</p>
                                                    <p className="font-semibold text-gray-800 dark:text-white">{profile?.name}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                                    <Mail size={18} className="text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-text-muted font-medium">이메일</p>
                                                    <p className="font-semibold text-gray-800 dark:text-white">{profile?.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                                    <Phone size={18} className="text-purple-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-text-muted font-medium">연락처</p>
                                                    <p className="font-semibold text-gray-800 dark:text-white">{profile?.phone || '-'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                                    <Building size={18} className="text-orange-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-text-muted font-medium">소속 부서</p>
                                                    <p className="font-semibold text-gray-800 dark:text-white">{profile?.deptName}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                                                    <Calendar size={18} className="text-pink-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-text-muted font-medium">가입일</p>
                                                    <p className="font-semibold text-gray-800 dark:text-white">{profile?.createdAt}</p>
                                                    <p className="text-xs text-text-muted">{profile?.memberSince}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 버튼 */}
                                        <div className="mt-6 space-y-2">
                                            <button
                                                onClick={() => setEditMode(true)}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium"
                                            >
                                                <Edit3 size={16} />
                                                <span>프로필 수정</span>
                                            </button>
                                            <button
                                                onClick={() => setShowPasswordModal(true)}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
                                            >
                                                <Lock size={16} />
                                                <span>비밀번호 변경</span>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* 편집 모드 */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                    이름 <span className="text-xs text-gray-400">({editForm.name.length}/50)</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editForm.name}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                    maxLength={50}
                                                    placeholder="2~50자 입력"
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                    연락처
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editForm.phone}
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/[^0-9-]/g, '');
                                                        setEditForm({ ...editForm, phone: value });
                                                    }}
                                                    maxLength={13}
                                                    placeholder="010-0000-0000"
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted"
                                                />
                                            </div>
                                        </div>

                                        {/* 편집 버튼 */}
                                        <div className="mt-6 flex gap-2">
                                            <button
                                                onClick={cancelEdit}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                                            >
                                                <X size={16} />
                                                <span>취소</span>
                                            </button>
                                            <button
                                                onClick={updateProfile}
                                                disabled={saving}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
                                            >
                                                <Save size={16} />
                                                <span>{saving ? '저장 중...' : '저장'}</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 활동 통계 */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* 전체 활동 통계 */}
                        <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm p-6 md:p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                <Award size={20} className="text-primary" />
                                <h3 className="text-lg font-bold dark:text-white">전체 활동 통계</h3>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                                            <MessageSquare size={22} className="text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black text-primary">{stats?.totalChats || 0}</p>
                                            <p className="text-xs text-text-muted font-medium">AI 대화</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 dark:bg-green-500/10 rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                                            <FileText size={22} className="text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black text-green-600">{stats?.totalDocuments || 0}</p>
                                            <p className="text-xs text-text-muted font-medium">문서</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-purple-50 dark:bg-purple-500/10 rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                                            <Image size={22} className="text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black text-purple-600">{stats?.totalImages || 0}</p>
                                            <p className="text-xs text-text-muted font-medium">이미지</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-orange-50 dark:bg-orange-500/10 rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                                            <FileAudio size={22} className="text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black text-orange-600">{stats?.totalMeetings || 0}</p>
                                            <p className="text-xs text-text-muted font-medium">회의록</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-pink-50 dark:bg-pink-500/10 rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-500/20 flex items-center justify-center">
                                            <CalendarDays size={22} className="text-pink-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black text-pink-600">{stats?.totalSchedules || 0}</p>
                                            <p className="text-xs text-text-muted font-medium">일정</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-cyan-50 dark:bg-cyan-500/10 rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
                                            <Calendar size={22} className="text-cyan-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black text-cyan-600">{stats?.todaySchedules || 0}</p>
                                            <p className="text-xs text-text-muted font-medium">오늘 일정</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 이번 달 활동 */}
                        <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm p-6 md:p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-1.5 h-6 bg-green-500 rounded-full"></div>
                                <TrendingUp size={20} className="text-green-600" />
                                <h3 className="text-lg font-bold dark:text-white">이번 달 활동</h3>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                    <p className="text-3xl font-black text-gray-800 dark:text-white">{monthlyActivity?.chats || 0}</p>
                                    <p className="text-sm text-text-muted mt-1 font-medium">AI 대화</p>
                                </div>
                                <div className="text-center p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                    <p className="text-3xl font-black text-gray-800 dark:text-white">{monthlyActivity?.documents || 0}</p>
                                    <p className="text-sm text-text-muted mt-1 font-medium">문서 작성</p>
                                </div>
                                <div className="text-center p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                    <p className="text-3xl font-black text-gray-800 dark:text-white">{monthlyActivity?.images || 0}</p>
                                    <p className="text-sm text-text-muted mt-1 font-medium">이미지 생성</p>
                                </div>
                                <div className="text-center p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                    <p className="text-3xl font-black text-gray-800 dark:text-white">{monthlyActivity?.meetings || 0}</p>
                                    <p className="text-sm text-text-muted mt-1 font-medium">회의록 작성</p>
                                </div>
                            </div>
                        </div>

                        {/* 계정 정보 */}
                        <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm p-6 md:p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-1.5 h-6 bg-gray-500 rounded-full"></div>
                                <Shield size={20} className="text-gray-600 dark:text-gray-400" />
                                <h3 className="text-lg font-bold dark:text-white">계정 정보</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                    <div>
                                        <p className="text-sm text-text-muted font-medium">계정 유형</p>
                                        <p className="font-bold text-gray-800 dark:text-white mt-1">{profile?.roleText}</p>
                                    </div>
                                    <Shield size={28} className={profile?.role === 'ADMIN' ? 'text-amber-500' : 'text-gray-400'} />
                                </div>

                                <div className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                    <div>
                                        <p className="text-sm text-text-muted font-medium">소속 부서</p>
                                        <p className="font-bold text-gray-800 dark:text-white mt-1">{profile?.deptName}</p>
                                    </div>
                                    <Building size={28} className="text-gray-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 비밀번호 변경 모달 */}
                {showPasswordModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-border-light dark:border-border-dark">
                            {/* 모달 헤더 */}
                            <div className="flex items-center justify-between px-8 py-5 border-b border-border-light dark:border-border-dark">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                    <h2 className="text-xl font-bold dark:text-white">비밀번호 변경</h2>
                                </div>
                                <button
                                    onClick={() => setShowPasswordModal(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    <X size={20} className="dark:text-white" />
                                </button>
                            </div>

                            {/* 모달 바디 */}
                            <div className="p-8 space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        현재 비밀번호
                                    </label>
                                    <input
                                        type="password"
                                        value={passwordForm.currentPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        새 비밀번호
                                    </label>
                                    <input
                                        type="password"
                                        value={passwordForm.newPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                    />
                                    <p className="text-xs text-text-muted mt-1">4자 이상 입력해주세요</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        새 비밀번호 확인
                                    </label>
                                    <input
                                        type="password"
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* 모달 푸터 */}
                            <div className="flex justify-end gap-3 px-8 py-5 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark rounded-b-[2rem]">
                                <button
                                    onClick={() => setShowPasswordModal(false)}
                                    className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={changePassword}
                                    disabled={changingPassword}
                                    className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
                                >
                                    {changingPassword ? '변경 중...' : '변경하기'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </UserLayout>
    );
}
