import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    LogIn, UserPlus, UserCog, AlertCircle, Activity,
    X, Calendar, Clock, Info, Download, Search, Monitor,
    ChevronLeft, ChevronRight, MessageSquare, FileText,
    FileAudio, Image, Trash2, Upload, CheckCircle, Edit3
} from 'lucide-react';
import { API_BASE } from '../utils/api';

const SystemLogTable = () => {
    const [logs, setLogs] = useState([]);
    const [selectedLog, setSelectedLog] = useState(null); // 모달 상세 데이터
    const [searchTerm, setSearchTerm] = useState('');
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // 페이징 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const pageSize = 5;

    // 데이터 로드 함수
    const fetchLogs = async (page = currentPage, search = searchTerm) => {
        try {
            const res = await axios.get(`${API_BASE}/api/admin/logs`, {
                params: { page, size: pageSize, q: search }
            });
            setLogs(res.data.items || []);
            setTotalPages(res.data.total_pages || 1);
            setTotalItems(res.data.total || 0);
            setLastUpdated(new Date());
        } catch (err) {
            console.error("로그 로드 실패:", err);
        }
    };

    // 페이지/검색어 변경 시 로드
    useEffect(() => {
        fetchLogs(currentPage, searchTerm);
    }, [currentPage, searchTerm]);

    // 실시간 갱신 (30초)
    useEffect(() => {
        const interval = setInterval(() => fetchLogs(currentPage, searchTerm), 30000);
        return () => clearInterval(interval);
    }, [currentPage, searchTerm]);

    const formatKST = (dateString, type = 'time') => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return type === 'date'
            ? date.toLocaleDateString('ko-KR')
            : date.toLocaleTimeString('ko-KR', { hour12: false });
    };

    const getActionStyle = (action) => {
        const type = action.toUpperCase();

        // 로그인 관련
        if (type.includes('LOGIN_SUCCESS')) return { color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', icon: <LogIn size={14} />, label: '로그인 성공' };
        if (type.includes('LOGIN_FAIL')) return { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <AlertCircle size={14} />, label: '로그인 실패' };
        if (type.includes('REGISTER')) return { color: 'text-green-600 bg-green-50 dark:bg-green-900/20', icon: <UserPlus size={14} />, label: '회원가입' };

        // 챗봇 관련
        if (type.includes('CHAT_CREATE')) return { color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', icon: <MessageSquare size={14} />, label: '대화 생성' };
        if (type.includes('CHAT_DELETE')) return { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <Trash2 size={14} />, label: '대화 삭제' };

        // 문서 관련
        if (type.includes('DOC_UPLOAD')) return { color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', icon: <Upload size={14} />, label: '문서 업로드' };
        if (type.includes('DOC_DELETE')) return { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <Trash2 size={14} />, label: '문서 삭제' };

        // 회의록 관련
        if (type.includes('MEETING_CREATE')) return { color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20', icon: <FileAudio size={14} />, label: '회의록 생성' };
        if (type.includes('MEETING_DELETE')) return { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <Trash2 size={14} />, label: '회의록 삭제' };

        // 이미지 관련
        if (type.includes('IMAGE_CREATE') || type.includes('IMAGE_GENERATE')) return { color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', icon: <Image size={14} />, label: '이미지 생성' };
        if (type.includes('IMAGE_DELETE')) return { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <Trash2 size={14} />, label: '이미지 삭제' };

        // 일정 관련
        if (type.includes('SCHEDULE_CREATE')) return { color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20', icon: <Calendar size={14} />, label: '일정 생성' };
        if (type.includes('SCHEDULE_UPDATE')) return { color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20', icon: <Edit3 size={14} />, label: '일정 수정' };
        if (type.includes('SCHEDULE_DELETE')) return { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <Trash2 size={14} />, label: '일정 삭제' };

        // 사용자 관리
        if (type.includes('USER_ROLE')) return { color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20', icon: <UserCog size={14} />, label: '권한 변경' };
        if (type.includes('USER_PWD')) return { color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20', icon: <UserCog size={14} />, label: '비밀번호 변경' };
        if (type.includes('USER_MOVE')) return { color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20', icon: <UserCog size={14} />, label: '부서 이동' };

        // 성공/실패 일반
        if (type.includes('SUCCESS')) return { color: 'text-green-600 bg-green-50 dark:bg-green-900/20', icon: <CheckCircle size={14} />, label: '성공' };
        if (type.includes('FAIL') || type.includes('ERROR')) return { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <AlertCircle size={14} />, label: '실패' };

        return { color: 'text-slate-600 bg-slate-50 dark:bg-slate-900/20', icon: <Activity size={14} />, label: action };
    };

    return (
        <div className="w-full bg-white dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm relative">

            {/* 상단 툴바 */}
            <div className="flex justify-between items-center p-5 border-b dark:border-border-dark">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                    <input
                        type="text"
                        placeholder="사용자, 이메일, 내용 검색..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs outline-none dark:text-white focus:ring-2 focus:ring-primary/20"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-primary uppercase tracking-tighter">System Activity</span>
                    <span className="text-[10px] font-bold text-text-muted">Total: {totalItems} logs</span>
                </div>
            </div>

            {/* 테이블 */}
            <div className="overflow-x-auto min-h-[450px]">
                <table className="w-full border-collapse">
                    <thead>
                    <tr className="text-left bg-slate-50/50 dark:bg-slate-900/20 text-[10px] font-black text-text-muted uppercase tracking-widest">
                        <th className="p-4">사용자</th>
                        <th className="p-4">액션</th>
                        <th className="p-4 hidden lg:table-cell">상세내용</th>
                        <th className="p-4 text-right">시간</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-border-dark">
                    {logs.map((log) => {
                        const style = getActionStyle(log.action);
                        return (
                            <tr
                                key={log.id}
                                onClick={() => setSelectedLog(log)}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group transition-colors"
                            >
                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold dark:text-white group-hover:text-primary">{log.user_name}</span>
                                        <span className="text-[10px] text-text-muted font-mono">{log.user_email}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${style.color}`}>
                                            {style.icon} {style.label}
                                        </span>
                                </td>
                                <td className="p-4 hidden lg:table-cell text-xs text-text-muted italic truncate max-w-xs">{log.details}</td>
                                <td className="p-4 text-[10px] text-text-muted font-mono text-right">{formatKST(log.created_at)}</td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>

            {/* 하단 페이징 */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/10 border-t dark:border-border-dark flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-text-muted">SYNC: {lastUpdated.toLocaleTimeString()}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 rounded-lg transition-all">
                        <ChevronLeft size={18} className="dark:text-white" />
                    </button>
                    <span className="text-xs font-black dark:text-white min-w-[40px] text-center">
                        {currentPage} / {totalPages}
                    </span>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 rounded-lg transition-all">
                        <ChevronRight size={18} className="dark:text-white" />
                    </button>
                </div>
            </div>

            {/* --- ✅ 상세 모달창 섹션 --- */}
            {selectedLog && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => setSelectedLog(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-2 font-black dark:text-white uppercase">
                                <Info className="text-primary" size={20} /> Log Details
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X size={20} className="dark:text-white" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black text-primary uppercase mb-1">User</p>
                                    <p className="text-xl font-bold dark:text-white">{selectedLog.user_name}</p>
                                    <p className="text-xs text-text-muted">{selectedLog.user_email}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-text-muted uppercase mb-1">IP</p>
                                    <p className="font-mono text-sm dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{selectedLog.ip_addr}</p>
                                </div>
                            </div>

                            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed dark:border-slate-700">
                                <div className="flex gap-4 mb-3 text-[10px] font-bold text-text-muted">
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {formatKST(selectedLog.created_at, 'date')}</span>
                                    <span className="flex items-center gap-1"><Clock size={12}/> {formatKST(selectedLog.created_at, 'time')}</span>
                                </div>
                                <p className="text-sm leading-relaxed dark:text-gray-200">
                                    <strong className="text-primary mr-2">[{selectedLog.action}]</strong>
                                    {selectedLog.details}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-text-muted bg-gray-100 dark:bg-gray-800 w-fit px-3 py-1 rounded-full">
                                <Monitor size={10} /> Target: {selectedLog.target_type} (ID: {selectedLog.target_id})
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50">
                            <button onClick={() => setSelectedLog(null)} className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                                확인 완료
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemLogTable;