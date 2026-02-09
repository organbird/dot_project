import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import {
    ShieldCheck,
    Key,
    Search,
    UserCog,
    User,
    Mail,
    ChevronRight,
    RefreshCw,
    Loader2
} from 'lucide-react';
import { API_BASE } from '../utils/api';

const AdminSettingsPage = ({ user, setUser }) => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [newRole, setNewRole] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/admin/users`);
            setUsers(res.data);
        } catch (err) {
            console.error("사용자 로드 실패:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (type) => {
        if (!selectedUser) return;
        const confirmMsg = type === 'role' ? "사용자 권한을 변경하시겠습니까?" : "비밀번호를 초기화하시겠습니까?";
        if (!window.confirm(confirmMsg)) return;

        try {
            const payload = { user_id: selectedUser.id };
            if (type === 'role') payload.new_role = newRole;
            if (type === 'password') {
                if (!newPassword) return alert("새 비밀번호를 입력하세요.");
                payload.new_password = newPassword;
            }
            await axios.patch(`${API_BASE}/api/admin/users/update`, payload);
            alert("성공적으로 변경되었습니다.");
            setNewPassword('');
            fetchUsers();
        } catch (err) {
            alert("변경 중 오류가 발생했습니다.");
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.includes(searchTerm) || u.email.includes(searchTerm)
    );

    return (
        <AdminLayout user={user} setUser={setUser}>
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 md:gap-8">

                {/* 헤더 */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-border-light dark:border-border-dark pb-6">
                    <div>
                        <p className="text-primary text-[10px] md:text-xs font-bold uppercase tracking-tighter mb-1">User Settings</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight dark:text-white">사용자 계정 관리</h1>
                        <p className="text-text-muted text-sm mt-1">사용자 권한 및 비밀번호를 관리하세요</p>
                    </div>
                    <button
                        onClick={fetchUsers}
                        className="flex items-center gap-2 px-4 py-2 mt-4 md:mt-0 text-text-muted hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        <span className="text-sm font-medium">새로고침</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* 왼쪽: 사용자 리스트 영역 */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden h-[700px] flex flex-col">
                            {/* 헤더 */}
                            <div className="p-5 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-1.5 h-5 bg-primary rounded-full"></div>
                                    <UserCog size={18} className="text-primary" />
                                    <h3 className="font-bold dark:text-white">사용자 목록</h3>
                                    <span className="ml-auto px-2.5 py-1 text-xs font-bold bg-primary/10 text-primary rounded-lg">
                                        {filteredUsers.length}명
                                    </span>
                                </div>
                                {/* 검색 */}
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                                    <input
                                        type="text"
                                        placeholder="이름 또는 이메일 검색"
                                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted transition-all"
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* 사용자 목록 */}
                            <div className="flex-1 overflow-y-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <Loader2 className="animate-spin text-primary" size={24} />
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                                        <User size={32} className="mb-2 text-gray-400" />
                                        <p className="text-sm">검색 결과가 없습니다</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border-light dark:divide-border-dark">
                                        {filteredUsers.map(u => (
                                            <div
                                                key={u.id}
                                                onClick={() => {setSelectedUser(u); setNewRole(u.role);}}
                                                className={`p-4 cursor-pointer flex items-center justify-between transition-all ${
                                                    selectedUser?.id === u.id
                                                        ? 'bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-4 border-l-transparent'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                                        selectedUser?.id === u.id
                                                            ? 'bg-primary text-white'
                                                            : 'bg-gray-100 dark:bg-gray-800 text-text-muted'
                                                    }`}>
                                                        {u.name[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold dark:text-white">{u.name}</p>
                                                        <p className="text-xs text-text-muted truncate max-w-[140px]">{u.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                                        u.role === 'ADMIN'
                                                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600'
                                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                                    }`}>
                                                        {u.role}
                                                    </span>
                                                    <ChevronRight size={16} className={selectedUser?.id === u.id ? 'text-primary' : 'text-gray-300 dark:text-gray-600'} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 오른쪽: 상세 설정 영역 */}
                    <div className="lg:col-span-2 space-y-6">
                        {selectedUser ? (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                {/* 현재 사용자 정보 카드 */}
                                <div className="bg-gradient-to-br from-primary via-primary to-purple-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-primary/25">
                                    <div className="flex items-center gap-5">
                                        <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-lg">
                                            <User size={40} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black">{selectedUser.name}</h2>
                                            <div className="flex items-center gap-2 mt-1 text-white/80">
                                                <Mail size={14} /> {selectedUser.email}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-lg text-xs font-bold">
                                                    ID: {selectedUser.id}
                                                </span>
                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                                    selectedUser.role === 'ADMIN'
                                                        ? 'bg-amber-400 text-amber-900'
                                                        : 'bg-white/20'
                                                }`}>
                                                    {selectedUser.role === 'ADMIN' ? 'Administrator' : 'User'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 권한 변경 카드 */}
                                <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                                    <div className="p-5 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-5 bg-primary rounded-full"></div>
                                            <ShieldCheck size={18} className="text-primary" />
                                            <h3 className="font-bold dark:text-white">계정 권한 변경</h3>
                                        </div>
                                    </div>
                                    <div className="p-6 md:p-8">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <select
                                                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary/30 dark:text-white transition-all"
                                                value={newRole}
                                                onChange={(e) => setNewRole(e.target.value)}
                                            >
                                                <option value="USER">일반 사용자 (USER)</option>
                                                <option value="ADMIN">시스템 관리자 (ADMIN)</option>
                                            </select>
                                            <button
                                                onClick={() => handleUpdate('role')}
                                                className="px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
                                            >
                                                권한 변경
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 비밀번호 초기화 카드 */}
                                <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                                    <div className="p-5 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-5 bg-orange-500 rounded-full"></div>
                                            <Key size={18} className="text-orange-500" />
                                            <h3 className="font-bold dark:text-white">비밀번호 초기화</h3>
                                        </div>
                                    </div>
                                    <div className="p-6 md:p-8">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <input
                                                type="password"
                                                placeholder="새로운 비밀번호 입력"
                                                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-orange-500/30 dark:text-white placeholder:text-text-muted transition-all"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                            <button
                                                onClick={() => handleUpdate('password')}
                                                className="px-8 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 shadow-lg shadow-orange-500/25 transition-all"
                                            >
                                                비밀번호 재설정
                                            </button>
                                        </div>
                                        <p className="mt-4 text-xs text-text-muted flex items-center gap-1.5">
                                            <Key size={12} /> 초기화 시 즉시 적용되며 이전 비밀번호는 사용할 수 없습니다.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[700px] flex flex-col items-center justify-center text-text-muted bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark">
                                <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                    <UserCog size={40} className="text-gray-400" />
                                </div>
                                <p className="text-lg font-medium dark:text-gray-400">사용자를 선택해주세요</p>
                                <p className="text-sm mt-1">왼쪽에서 수정할 사용자를 선택하면 설정이 표시됩니다</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminSettingsPage;
