import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import {
    Building2,
    Users,
    ArrowRightLeft,
    X,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { API_BASE } from '../utils/api';

const DeptManagementPage = ({ user, setUser }) => {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState(null);
    const [deptUsers, setDeptUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [activeUser, setActiveUser] = useState(null);
    const [targetDeptId, setTargetDeptId] = useState('');

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/depts`);
            setDepartments(res.data);
        } catch (err) {
            console.error("부서 목록 로드 실패:", err);
        }
    };

    const fetchDeptUsers = async (deptId) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/admin/depts/${deptId}/users`);
            setDeptUsers(res.data);
        } catch (err) {
            console.error("부서원 로드 실패:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleMoveUser = async () => {
        if (!targetDeptId) return alert("이동할 부서를 선택하세요.");
        try {
            await axios.patch(`${API_BASE}/api/admin/users/move-dept`, {
                user_id: activeUser.id,
                new_dept_idx: parseInt(targetDeptId)
            });
            alert(`${activeUser.email} 사용자의 부서가 변경되었습니다.`);
            setIsMoveModalOpen(false);
            setTargetDeptId('');
            fetchDeptUsers(selectedDept.id);
        } catch (err) {
            alert("이동 처리 중 오류가 발생했습니다.");
        }
    };

    return (
        <AdminLayout user={user} setUser={setUser}>
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 md:gap-8">

                {/* 헤더 */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-border-light dark:border-border-dark pb-6">
                    <div>
                        <p className="text-primary text-[10px] md:text-xs font-bold uppercase tracking-tighter mb-1">Department Management</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight dark:text-white">부서 관리</h1>
                        <p className="text-text-muted text-sm mt-1">부서별 인원을 확인하고 관리하세요</p>
                    </div>
                </div>

                {/* 메인 콘텐츠 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* 부서 리스트 */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-5 bg-primary rounded-full"></div>
                                    <Building2 size={18} className="text-primary" />
                                    <h3 className="font-bold dark:text-white">부서 목록</h3>
                                    <span className="ml-auto px-2.5 py-1 text-xs font-bold bg-primary/10 text-primary rounded-lg">
                                        {departments.length}개
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 max-h-[600px] overflow-y-auto">
                                <div className="space-y-2">
                                    {departments.map(dept => (
                                        <button
                                            key={dept.id}
                                            onClick={() => { setSelectedDept(dept); fetchDeptUsers(dept.id); }}
                                            className={`w-full p-4 rounded-2xl border-2 text-left flex justify-between items-center transition-all ${
                                                selectedDept?.id === dept.id
                                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/25'
                                                    : 'bg-gray-50 dark:bg-gray-800/50 border-transparent hover:border-primary/30 dark:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                                    selectedDept?.id === dept.id
                                                        ? 'bg-white/20'
                                                        : 'bg-primary/10'
                                                }`}>
                                                    <Building2 size={18} className={selectedDept?.id === dept.id ? 'text-white' : 'text-primary'} />
                                                </div>
                                                <span className="font-bold">{dept.dept_name}</span>
                                            </div>
                                            <ChevronRight size={18} className={selectedDept?.id === dept.id ? 'text-white' : 'text-gray-400'} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 부서원 관리 테이블 */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden min-h-[600px]">
                            {selectedDept ? (
                                <>
                                    {/* 테이블 헤더 */}
                                    <div className="p-5 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-5 bg-green-500 rounded-full"></div>
                                            <Users size={18} className="text-green-600" />
                                            <h3 className="font-bold dark:text-white">{selectedDept.dept_name} 소속 직원</h3>
                                            <span className="ml-auto px-2.5 py-1 text-xs font-bold bg-green-500/10 text-green-600 rounded-lg">
                                                {deptUsers.length}명
                                            </span>
                                        </div>
                                    </div>

                                    {/* 로딩 상태 */}
                                    {loading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <div className="flex items-center gap-3 text-text-muted">
                                                <Loader2 className="animate-spin" size={24} />
                                                <span>로딩 중...</span>
                                            </div>
                                        </div>
                                    ) : deptUsers.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                                            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                                <Users size={32} className="text-gray-400" />
                                            </div>
                                            <p className="font-medium">소속 직원이 없습니다</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border-light dark:divide-border-dark">
                                            {deptUsers.map(u => (
                                                <div key={u.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                            {u.name?.[0] || u.email?.[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-800 dark:text-white">{u.name}</p>
                                                            <p className="text-sm text-text-muted">{u.email}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => { setActiveUser(u); setIsMoveModalOpen(true); }}
                                                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary hover:text-white transition-all"
                                                    >
                                                        <ArrowRightLeft size={14} />
                                                        부서 이동
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[600px] text-text-muted">
                                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                        <Building2 size={40} className="text-gray-400" />
                                    </div>
                                    <p className="text-lg font-medium">부서를 선택해주세요</p>
                                    <p className="text-sm mt-1">왼쪽에서 부서를 선택하면 소속 직원이 표시됩니다</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 부서 이동 모달 */}
                {isMoveModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-border-light dark:border-border-dark">
                            {/* 모달 헤더 */}
                            <div className="flex items-center justify-between px-8 py-5 border-b border-border-light dark:border-border-dark">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                    <h2 className="text-xl font-bold dark:text-white">부서 이동</h2>
                                </div>
                                <button
                                    onClick={() => setIsMoveModalOpen(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    <X size={20} className="dark:text-white" />
                                </button>
                            </div>

                            {/* 모달 바디 */}
                            <div className="p-8">
                                {/* 현재 선택된 사용자 정보 카드 */}
                                <div className="mb-6 p-5 bg-gray-50 dark:bg-background-dark rounded-2xl border border-border-light dark:border-border-dark">
                                    <div className="text-xs text-text-muted mb-3 font-bold uppercase">이동 대상자</div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg">
                                            {activeUser?.name?.[0] || activeUser?.email?.[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold dark:text-white text-lg">{activeUser?.name || '이름 없음'}</p>
                                            <p className="text-sm text-text-muted">{activeUser?.email}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* 부서 선택 */}
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        이동할 부서 선택
                                    </label>
                                    <select
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        value={targetDeptId}
                                        onChange={(e) => setTargetDeptId(e.target.value)}
                                    >
                                        <option value="">부서를 선택해 주세요</option>
                                        {departments
                                            .filter(d => d.id !== selectedDept?.id)
                                            .map(d => (
                                                <option key={d.id} value={d.id}>{d.dept_name}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>

                            {/* 모달 푸터 */}
                            <div className="flex justify-end gap-3 px-8 py-5 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark rounded-b-[2rem]">
                                <button
                                    onClick={() => setIsMoveModalOpen(false)}
                                    className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleMoveUser}
                                    className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/25"
                                >
                                    부서 이동 확정
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default DeptManagementPage;
