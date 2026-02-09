import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { API_BASE } from '../utils/api';

const DeptModal = ({ isOpen, onClose, onSelect }) => {
    const [departments, setDepartments] = useState([]);
    const [newDeptName, setNewDeptName] = useState('');
    const [loading, setLoading] = useState(false);

    const API_BASE_URL = `${API_BASE}/api`;

    useEffect(() => {
        if (isOpen) fetchDepartments();
    }, [isOpen]);

    // 1. 부서 목록 불러오기
    const fetchDepartments = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/depts`);
            // ID가 1인 관리자 부서는 목록에서 제외 (필요시)
            setDepartments(response.data.filter(dept => dept.id !== 1));
        } catch (error) {
            console.error("부서 로드 실패:", error);
        } finally {
            setLoading(false);
        }
    };

    // 2. 부서 추가하기 (수정됨)
    const handleAddDept = async () => {
        if (!newDeptName.trim()) {
            alert('부서명을 입력해주세요.');
            return;
        }
        if (newDeptName.length > 255) {
            alert('부서명은 255자 이내로 입력해주세요.');
            return;
        }
        try {
            // ✅ 이제 편법이 아닌 정식 부서 생성 API를 호출합니다.
            await axios.post(`${API_BASE_URL}/depts`, {
                dept_name: newDeptName
            });

            setNewDeptName('');
            fetchDepartments(); // 목록 새로고침
        } catch (error) {
            const errorMsg = error.response?.data?.detail || "부서 추가 중 오류가 발생했습니다.";
            alert(errorMsg);
        }
    };

    // 3. 부서 삭제하기
    const handleDeleteDept = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("이 부서를 삭제하시겠습니까?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/depts/${id}`);
            fetchDepartments();
        } catch (error) {
            alert("삭제 권한이 없거나 부서에 소속된 사용자가 있어 삭제할 수 없습니다.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-card-dark w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-border-light flex justify-between items-center">
                    <h2 className="font-bold text-lg dark:text-white">부서 관리/선택</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={20} className="dark:text-gray-400"/>
                    </button>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-background-dark/30 border-b border-border-light dark:border-border-dark">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 h-10 px-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-sm outline-none focus:border-primary dark:text-white"
                            placeholder="새 부서 이름 입력 (최대 255자)"
                            maxLength={255}
                            value={newDeptName}
                            onChange={(e) => setNewDeptName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddDept()}
                        />
                        <button
                            onClick={handleAddDept}
                            className="bg-primary text-white px-3 rounded-lg hover:bg-primary-hover transition-colors"
                        >
                            <Plus size={20}/>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 dark:bg-card-dark">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary"/></div>
                    ) : (
                        <div className="space-y-2">
                            {departments.map((dept) => (
                                <div
                                    key={dept.id}
                                    // 💡 중요: 이제 이름만 보내지 않고 dept 객체 전체를 보냅니다.
                                    onClick={() => { onSelect(dept); onClose(); }}
                                    className="group flex items-center justify-between px-4 py-3 rounded-xl border border-border-light dark:border-border-dark hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all bg-white dark:bg-background-dark"
                                >
                                    {/* 💡 필드명 확인: SQL 스키마에 따라 dept_name 사용 */}
                                    <span className="text-text-main dark:text-gray-200 font-medium">
                                        {dept.dept_name}
                                    </span>
                                    <button
                                        onClick={(e) => handleDeleteDept(e, dept.id)}
                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-background-dark/50 text-center text-xs text-text-muted">
                    목록에서 부서를 클릭하면 선택됩니다.
                </div>
            </div>
        </div>
    );
};

export default DeptModal;