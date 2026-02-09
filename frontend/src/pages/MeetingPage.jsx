import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../components/UserLayout';
import {
    Plus,
    Search,
    FileAudio,
    ChevronLeft,
    ChevronRight,
    X,
    Edit3,
    Trash2,
    Eye,
    Upload,
    Clock,
    Users,
    FileText,
    CheckCircle,
    AlertCircle,
    Loader
} from 'lucide-react';
import { API_BASE } from '../utils/api';

// 상태별 스타일
const STATUS_STYLES = {
    'QUEUED': { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400', icon: Clock },
    'PROCESSING': { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', icon: Loader },
    'COMPLETED': { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
    'ERROR': { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', icon: AlertCircle }
};

export default function MeetingPage({ user, setUser }) {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    // 상태 관리
    const [meetings, setMeetings] = useState([]);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        pageSize: 10
    });
    const [searchText, setSearchText] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [loading, setLoading] = useState(false);

    // 모달 상태
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create', 'view', 'edit'
    const [selectedMeeting, setSelectedMeeting] = useState(null);

    // 업로드 모달 상태
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // STT 폴링 상태
    const [sttTaskId, setSttTaskId] = useState(null);
    const [sttProgress, setSttProgress] = useState({ status: 'idle', progress: 0, message: '' });
    const sttTimerRef = useRef(null);

    // 폼 데이터
    const [formData, setFormData] = useState({
        title: '',
        transcript: '',
        summary: '',
        attendees: '',
        duration: 0
    });

    // 회의록 목록 조회
    const fetchMeetings = async (page = 1) => {
        if (!user?.id) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                size: '10'
            });

            if (searchText) {
                params.append('search', searchText);
            }

            const response = await fetch(
                `${API_BASE}/meeting/list/${user.id}?${params.toString()}`
            );

            if (response.ok) {
                const data = await response.json();
                setMeetings(data.meetings);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('회의록 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // 회의록 상세 조회
    const fetchMeetingDetail = async (meetingId) => {
        try {
            const response = await fetch(`${API_BASE}/meeting/${meetingId}`);
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('회의록 상세 조회 실패:', error);
        }
        return null;
    };

    // 회의록 생성 (텍스트 입력)
    const createMeeting = async () => {
        try {
            const response = await fetch(`${API_BASE}/meeting/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    title: formData.title,
                    transcript: formData.transcript,
                    summary: formData.summary,
                    attendees: formData.attendees,
                    duration: formData.duration
                })
            });

            if (response.ok) {
                alert('회의록이 등록되었습니다.');
                closeModal();
                fetchMeetings(1);
            } else {
                alert('회의록 등록에 실패했습니다.');
            }
        } catch (error) {
            console.error('회의록 생성 실패:', error);
            alert('회의록 등록 중 오류가 발생했습니다.');
        }
    };

    // 회의록 파일 업로드
    const uploadMeeting = async () => {
        if (!uploadFile) {
            alert('파일을 선택해주세요.');
            return;
        }
        if (!formData.title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }
        if (formData.title.length > 255) {
            alert('제목은 255자 이내로 입력해주세요.');
            return;
        }

        setUploading(true);
        try {
            const formDataObj = new FormData();
            formDataObj.append('user_id', user.id);
            formDataObj.append('title', formData.title);
            formDataObj.append('attendees', formData.attendees);
            formDataObj.append('file', uploadFile);

            const response = await fetch(`${API_BASE}/meeting/upload`, {
                method: 'POST',
                body: formDataObj
            });

            if (response.ok) {
                const result = await response.json();
                closeUploadModal();
                fetchMeetings(1);
                // STT 폴링 시작
                if (result.meeting?.sttTaskId) {
                    startSttPolling(result.meeting.sttTaskId);
                }
            } else {
                const error = await response.json();
                alert(error.detail || '파일 업로드에 실패했습니다.');
            }
        } catch (error) {
            console.error('파일 업로드 실패:', error);
            alert('파일 업로드 중 오류가 발생했습니다.');
        } finally {
            setUploading(false);
        }
    };

    // 회의록 수정
    const updateMeeting = async () => {
        if (!selectedMeeting) return;

        try {
            const response = await fetch(`${API_BASE}/meeting/${selectedMeeting.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.title,
                    attendees: formData.attendees,
                    summary: formData.summary
                })
            });

            if (response.ok) {
                alert('회의록이 수정되었습니다.');
                closeModal();
                fetchMeetings(pagination.currentPage);
            } else {
                alert('회의록 수정에 실패했습니다.');
            }
        } catch (error) {
            console.error('회의록 수정 실패:', error);
            alert('회의록 수정 중 오류가 발생했습니다.');
        }
    };

    // 회의록 삭제
    const deleteMeeting = async (meetingId) => {
        if (!confirm('정말 이 회의록을 삭제하시겠습니까?')) return;

        try {
            const response = await fetch(`${API_BASE}/meeting/${meetingId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('회의록이 삭제되었습니다.');
                fetchMeetings(pagination.currentPage);
            } else {
                alert('회의록 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('회의록 삭제 실패:', error);
            alert('회의록 삭제 중 오류가 발생했습니다.');
        }
    };

    // 모달 열기 (생성 - 텍스트 입력)
    const openCreateModal = () => {
        setModalMode('create');
        setSelectedMeeting(null);
        setFormData({ title: '', transcript: '', summary: '', attendees: '', duration: 0 });
        setShowModal(true);
    };

    // 업로드 모달 열기
    const openUploadModal = () => {
        setFormData({ title: '', transcript: '', summary: '', attendees: '', duration: 0 });
        setUploadFile(null);
        setShowUploadModal(true);
    };

    // 모달 열기 (보기)
    const openViewModal = async (meeting) => {
        const detail = await fetchMeetingDetail(meeting.id);
        if (detail) {
            setModalMode('view');
            setSelectedMeeting(detail);
            setFormData({
                title: detail.title,
                transcript: detail.transcript,
                summary: detail.summary,
                attendees: detail.attendees,
                duration: detail.duration
            });
            setShowModal(true);
        }
    };

    // 모달 열기 (수정)
    const openEditModal = async (meeting) => {
        const detail = await fetchMeetingDetail(meeting.id);
        if (detail) {
            setModalMode('edit');
            setSelectedMeeting(detail);
            setFormData({
                title: detail.title,
                transcript: detail.transcript,
                summary: detail.summary,
                attendees: detail.attendees,
                duration: detail.duration
            });
            setShowModal(true);
        }
    };

    // 모달 닫기
    const closeModal = () => {
        setShowModal(false);
        setSelectedMeeting(null);
        setFormData({ title: '', transcript: '', summary: '', attendees: '', duration: 0 });
    };

    // 업로드 모달 닫기
    const closeUploadModal = () => {
        setShowUploadModal(false);
        setUploadFile(null);
        setFormData({ title: '', transcript: '', summary: '', attendees: '', duration: 0 });
    };

    // 검색 실행
    const handleSearch = () => {
        setSearchText(searchInput);
    };

    // 검색 초기화
    const handleSearchReset = () => {
        setSearchInput('');
        setSearchText('');
    };

    // 페이지 변경
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchMeetings(newPage);
        }
    };

    // 파일 선택 핸들러
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFile(file);
        }
    };

    // STT localStorage 키
    const STT_TASK_KEY = `stt_task_${user?.id}`;

    // STT 폴링 시작
    const startSttPolling = useCallback((taskId) => {
        setSttTaskId(taskId);
        setSttProgress({ status: 'pending', progress: 0, message: '작업 대기 중...' });
        localStorage.setItem(STT_TASK_KEY, taskId);

        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE}/meeting/status/${taskId}`);
                if (!res.ok) throw new Error('Status fetch failed');
                const data = await res.json();
                setSttProgress(data);

                if (data.status === 'completed' || data.status === 'error') {
                    // 폴링 중지 + 정리
                    setSttTaskId(null);
                    localStorage.removeItem(STT_TASK_KEY);
                    // 목록 새로고침
                    fetchMeetings(pagination.currentPage);
                    return;
                }
                // 2초 후 재폴링
                sttTimerRef.current = setTimeout(poll, 2000);
            } catch (err) {
                console.error('STT 폴링 실패:', err);
                sttTimerRef.current = setTimeout(poll, 3000);
            }
        };
        // 첫 폴링은 1초 후 시작
        sttTimerRef.current = setTimeout(poll, 1000);
    }, [user?.id, pagination.currentPage]);

    // STT 폴링 중지
    const stopSttPolling = useCallback(() => {
        if (sttTimerRef.current) {
            clearTimeout(sttTimerRef.current);
            sttTimerRef.current = null;
        }
    }, []);

    // 페이지 마운트 시 진행 중인 STT 작업 복원
    useEffect(() => {
        if (!user?.id) return;
        const savedTaskId = localStorage.getItem(`stt_task_${user.id}`);
        if (savedTaskId) {
            startSttPolling(savedTaskId);
        }
        return () => stopSttPolling();
    }, [user?.id]);

    // 폼 제출
    const handleSubmit = () => {
        if (!formData.title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }
        if (formData.title.length > 255) {
            alert('제목은 255자 이내로 입력해주세요.');
            return;
        }

        if (modalMode === 'create') {
            if (!formData.transcript.trim()) {
                alert('회의 내용을 입력해주세요.');
                return;
            }
            createMeeting();
        } else if (modalMode === 'edit') {
            updateMeeting();
        }
    };

    // 초기 로드 및 필터 변경 시 조회
    useEffect(() => {
        fetchMeetings(1);
    }, [user?.id, searchText]);

    // 페이지 번호 생성
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, pagination.currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(pagination.totalPages, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    // 상태 뱃지 렌더링
    const renderStatusBadge = (status, statusText) => {
        const style = STATUS_STYLES[status] || STATUS_STYLES['COMPLETED'];
        const IconComponent = style.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                <IconComponent size={12} className={status === 'PROCESSING' ? 'animate-spin' : ''} />
                {statusText}
            </span>
        );
    };

    return (
        <UserLayout user={user} setUser={setUser} activeMenu="회의록 분석">
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 md:gap-8">
                {/* 헤더 */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-border-light dark:border-border-dark pb-6">
                    <div>
                        <p className="text-primary text-[10px] md:text-xs font-bold uppercase tracking-tighter mb-1">Meeting Analysis</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight dark:text-white">회의록 분석</h1>
                        <p className="text-text-muted text-sm mt-1">회의 내용을 기록하고 분석하세요</p>
                    </div>
                    <div className="flex gap-2 mt-4 md:mt-0">
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/25"
                        >
                            <Plus size={18} />
                            <span>직접 작성</span>
                        </button>
                        <button
                            onClick={openUploadModal}
                            className="flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-colors font-medium shadow-lg shadow-green-500/25"
                        >
                            <Upload size={18} />
                            <span>파일 업로드</span>
                        </button>
                    </div>
                </div>

                {/* 검색 영역 */}
                <div className="bg-white dark:bg-card-dark rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="제목으로 검색..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted"
                            />
                            <Search size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-muted" />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors font-medium"
                        >
                            검색
                        </button>
                        {searchText && (
                            <button
                                onClick={handleSearchReset}
                                className="p-3 text-text-muted hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* STT 진행률 표시 */}
                {sttTaskId && sttProgress.status !== 'idle' && (
                    <div className="bg-white dark:bg-card-dark rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                {sttProgress.status === 'completed' ? (
                                    <CheckCircle size={18} className="text-green-500" />
                                ) : sttProgress.status === 'error' ? (
                                    <AlertCircle size={18} className="text-red-500" />
                                ) : (
                                    <Loader size={18} className="text-primary animate-spin" />
                                )}
                                <span className="font-semibold text-sm dark:text-white">
                                    음성 변환 {sttProgress.status === 'completed' ? '완료' : sttProgress.status === 'error' ? '실패' : '진행 중'}
                                </span>
                            </div>
                            <span className="ml-auto text-sm font-bold text-primary">
                                {sttProgress.progress}%
                            </span>
                        </div>
                        {/* 프로그레스 바 */}
                        <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${
                                    sttProgress.status === 'error'
                                        ? 'bg-red-500'
                                        : sttProgress.status === 'completed'
                                        ? 'bg-green-500'
                                        : 'bg-primary'
                                }`}
                                style={{ width: `${sttProgress.progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-text-muted mt-2">{sttProgress.message}</p>
                    </div>
                )}

                {/* 회의록 목록 */}
                <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                    {/* 테이블 헤더 */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 bg-gray-50 dark:bg-background-dark border-b border-border-light dark:border-border-dark text-sm font-bold text-text-muted uppercase tracking-wide">
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-4">회의 제목</div>
                        <div className="col-span-2 text-center">참석자</div>
                        <div className="col-span-1 text-center">시간</div>
                        <div className="col-span-1 text-center">상태</div>
                        <div className="col-span-2 text-center">등록일</div>
                        <div className="col-span-1 text-center">관리</div>
                    </div>

                    {/* 테이블 바디 */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-primary border-t-transparent"></div>
                        </div>
                    ) : meetings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                <FileAudio size={40} className="text-gray-400" />
                            </div>
                            <p className="text-lg font-medium dark:text-gray-400">등록된 회의록이 없습니다</p>
                            <p className="text-sm mt-1">새 회의록을 작성하거나 파일을 업로드해보세요</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border-light dark:divide-border-dark">
                            {meetings.map((meeting) => (
                                <div
                                    key={meeting.id}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 md:px-8 py-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors items-center"
                                >
                                    {/* 번호 */}
                                    <div className="hidden md:block col-span-1 text-center text-text-muted font-medium">
                                        {meeting.rowNum}
                                    </div>

                                    {/* 회의 제목 */}
                                    <div
                                        className="md:col-span-4 cursor-pointer"
                                        onClick={() => openViewModal(meeting)}
                                    >
                                        <h3 className="font-semibold text-gray-800 dark:text-white hover:text-primary transition-colors">
                                            {meeting.title}
                                        </h3>
                                        <div className="md:hidden flex items-center gap-3 mt-1 text-sm text-text-muted">
                                            <span className="flex items-center gap-1">
                                                <Users size={12} />
                                                {meeting.attendees || '-'}
                                            </span>
                                            <span>{meeting.durationText}</span>
                                        </div>
                                    </div>

                                    {/* 참석자 */}
                                    <div className="hidden md:flex col-span-2 justify-center text-text-muted text-sm">
                                        <div className="flex items-center gap-1.5 max-w-[120px]">
                                            <Users size={14} className="shrink-0" />
                                            <span className="truncate">{meeting.attendees || '-'}</span>
                                        </div>
                                    </div>

                                    {/* 시간 */}
                                    <div className="hidden md:block col-span-1 text-center text-text-muted text-sm">
                                        {meeting.durationText}
                                    </div>

                                    {/* 상태 */}
                                    <div className="md:col-span-1 md:text-center">
                                        {renderStatusBadge(meeting.status, meeting.statusText)}
                                    </div>

                                    {/* 등록일시 */}
                                    <div className="hidden md:block col-span-2 text-center text-text-muted text-sm">
                                        {meeting.createdAt}
                                    </div>

                                    {/* 관리 버튼 */}
                                    <div className="md:col-span-1 flex justify-end md:justify-center gap-1">
                                        <button
                                            onClick={() => openViewModal(meeting)}
                                            className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                                            title="보기"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => openEditModal(meeting)}
                                            className="p-2 text-text-muted hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-xl transition-colors"
                                            title="수정"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteMeeting(meeting.id)}
                                            className="p-2 text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                                            title="삭제"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 페이징 */}
                    {pagination.totalPages > 0 && (
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-8 py-5 bg-gray-50 dark:bg-background-dark border-t border-border-light dark:border-border-dark">
                            <div className="text-sm text-text-muted">
                                총 <span className="font-bold text-primary">{pagination.totalCount}</span>건 중{' '}
                                {((pagination.currentPage - 1) * pagination.pageSize) + 1}-
                                {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)}건
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                                    disabled={!pagination.hasPrev}
                                    className={`p-2.5 rounded-xl transition-colors ${
                                        pagination.hasPrev
                                            ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                    }`}
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                {getPageNumbers().map((pageNum) => (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`w-10 h-10 rounded-xl font-medium transition-colors ${
                                            pageNum === pagination.currentPage
                                                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}

                                <button
                                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                                    disabled={!pagination.hasNext}
                                    className={`p-2.5 rounded-xl transition-colors ${
                                        pagination.hasNext
                                            ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                    }`}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 회의록 작성/보기/수정 모달 */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-border-light dark:border-border-dark">
                            {/* 모달 헤더 */}
                            <div className="flex items-center justify-between px-8 py-5 border-b border-border-light dark:border-border-dark">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                    <h2 className="text-xl font-bold dark:text-white">
                                        {modalMode === 'create' && '회의록 직접 작성'}
                                        {modalMode === 'edit' && '회의록 수정'}
                                        {modalMode === 'view' && '회의록 상세'}
                                    </h2>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    <X size={20} className="dark:text-white" />
                                </button>
                            </div>

                            {/* 모달 바디 */}
                            <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
                                {/* 제목 */}
                                <div className="mb-5">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        회의 제목 {modalMode !== 'view' && <span className="text-xs text-gray-400 font-normal">({formData.title.length}/255)</span>}
                                    </label>
                                    {modalMode === 'view' ? (
                                        <p className="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-xl text-gray-800 dark:text-white">
                                            {formData.title}
                                        </p>
                                    ) : (
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            placeholder="회의 제목을 입력하세요"
                                            maxLength={255}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted"
                                        />
                                    )}
                                </div>

                                {/* 참석자 */}
                                <div className="mb-5">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        참석자 (쉼표로 구분)
                                    </label>
                                    {modalMode === 'view' ? (
                                        <div className="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-xl">
                                            {selectedMeeting?.attendeeList?.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedMeeting.attendeeList.map((attendee, idx) => (
                                                        <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                                                            {attendee}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-text-muted">참석자 정보 없음</span>
                                            )}
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={formData.attendees}
                                            onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                                            placeholder="예: 홍길동, 김철수, 이영희"
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted"
                                        />
                                    )}
                                </div>

                                {/* 회의 시간 (생성 모드) */}
                                {modalMode === 'create' && (
                                    <div className="mb-5">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            회의 시간 (분)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.duration / 60}
                                            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value || 0) * 60 })}
                                            placeholder="예: 30"
                                            min="0"
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted"
                                        />
                                    </div>
                                )}

                                {/* 회의 시간 (보기 모드) */}
                                {modalMode === 'view' && selectedMeeting && (
                                    <div className="mb-5">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            회의 시간
                                        </label>
                                        <p className="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-xl text-gray-800 dark:text-white">
                                            {selectedMeeting.durationText}
                                        </p>
                                    </div>
                                )}

                                {/* 회의 내용 (전문) */}
                                <div className="mb-5">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        회의 내용 (전문)
                                    </label>
                                    {modalMode === 'view' ? (
                                        <div className="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-xl text-gray-800 dark:text-gray-200 min-h-[150px] max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                                            {formData.transcript || '내용 없음'}
                                        </div>
                                    ) : modalMode === 'create' ? (
                                        <textarea
                                            value={formData.transcript}
                                            onChange={(e) => setFormData({ ...formData, transcript: e.target.value })}
                                            placeholder="회의 내용을 입력하세요"
                                            rows={6}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted resize-none"
                                        />
                                    ) : (
                                        <div className="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-xl text-gray-800 dark:text-gray-200 min-h-[100px] max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                                            {formData.transcript || '내용 없음'}
                                        </div>
                                    )}
                                </div>

                                {/* 요약 */}
                                <div className="mb-5">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        회의 요약
                                    </label>
                                    {modalMode === 'view' ? (
                                        <div className="px-4 py-3 bg-primary/5 dark:bg-primary/10 rounded-xl text-gray-800 dark:text-gray-200 min-h-[100px] whitespace-pre-wrap border-l-4 border-primary">
                                            {formData.summary || '요약 없음'}
                                        </div>
                                    ) : (
                                        <textarea
                                            value={formData.summary}
                                            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                            placeholder="회의 요약을 입력하세요"
                                            rows={4}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted resize-none"
                                        />
                                    )}
                                </div>

                                {/* 메타 정보 (보기 모드) */}
                                {modalMode === 'view' && selectedMeeting && (
                                    <div className="mt-6 pt-5 border-t border-border-light dark:border-border-dark">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="text-text-muted">작성자:</span>
                                                <span className="font-medium dark:text-white">{selectedMeeting.authorName}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-text-muted">등록일:</span>
                                                <span className="font-medium dark:text-white">{selectedMeeting.createdAt}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-text-muted">상태:</span>
                                                {renderStatusBadge(selectedMeeting.status, selectedMeeting.statusText)}
                                            </div>
                                            {selectedMeeting.fileName && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-text-muted">파일:</span>
                                                    <span className="font-medium dark:text-white truncate">{selectedMeeting.fileName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 모달 푸터 */}
                            <div className="flex justify-end gap-3 px-8 py-5 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark">
                                {modalMode === 'view' ? (
                                    <>
                                        <button
                                            onClick={() => setModalMode('edit')}
                                            className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium"
                                        >
                                            수정하기
                                        </button>
                                        <button
                                            onClick={closeModal}
                                            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                                        >
                                            닫기
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={closeModal}
                                            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium"
                                        >
                                            {modalMode === 'create' ? '등록' : '저장'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 파일 업로드 모달 */}
                {showUploadModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border-light dark:border-border-dark">
                            {/* 모달 헤더 */}
                            <div className="flex items-center justify-between px-8 py-5 border-b border-border-light dark:border-border-dark">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-green-500 rounded-full"></div>
                                    <h2 className="text-xl font-bold dark:text-white">
                                        회의 녹음 파일 업로드
                                    </h2>
                                </div>
                                <button
                                    onClick={closeUploadModal}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    <X size={20} className="dark:text-white" />
                                </button>
                            </div>

                            {/* 모달 바디 */}
                            <div className="p-8">
                                {/* 제목 */}
                                <div className="mb-5">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        회의 제목 <span className="text-xs text-gray-400 font-normal">({formData.title.length}/255)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="회의 제목을 입력하세요"
                                        maxLength={255}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted"
                                    />
                                </div>

                                {/* 참석자 */}
                                <div className="mb-5">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        참석자 (쉼표로 구분)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.attendees}
                                        onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                                        placeholder="예: 홍길동, 김철수, 이영희"
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted"
                                    />
                                </div>

                                {/* 파일 업로드 영역 */}
                                <div className="mb-5">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        음성 파일
                                    </label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-border-light dark:border-border-dark rounded-2xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                                    >
                                        {uploadFile ? (
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-3">
                                                    <FileAudio size={32} className="text-green-500" />
                                                </div>
                                                <p className="text-gray-800 dark:text-white font-semibold">{uploadFile.name}</p>
                                                <p className="text-sm text-text-muted mt-1">
                                                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                                                    <Upload size={32} className="text-text-muted" />
                                                </div>
                                                <p className="text-gray-600 dark:text-gray-400 font-medium">클릭하여 파일을 선택하세요</p>
                                                <p className="text-sm text-text-muted mt-1">
                                                    지원 형식: MP3, WAV, M4A, OGG, WebM, MP4
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".mp3,.wav,.m4a,.ogg,.webm,.mp4"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            {/* 모달 푸터 */}
                            <div className="flex justify-end gap-3 px-8 py-5 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark rounded-b-[2rem]">
                                <button
                                    onClick={closeUploadModal}
                                    className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                                    disabled={uploading}
                                >
                                    취소
                                </button>
                                <button
                                    onClick={uploadMeeting}
                                    disabled={uploading || !uploadFile || !formData.title}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader size={16} className="animate-spin" />
                                            <span>업로드 중...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            <span>업로드</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </UserLayout>
    );
}
