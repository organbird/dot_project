import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../components/UserLayout';
import {
    Upload,
    Search,
    FileText,
    ChevronLeft,
    ChevronRight,
    X,
    Edit3,
    Trash2,
    Download,
    Eye,
    File,
    Loader,
    FolderOpen
} from 'lucide-react';
import { API_BASE } from '../utils/api';

// 카테고리 목록
const CATEGORIES = ['전체', '업무', '개인', '아이디어'];

// 카테고리별 색상
const CATEGORY_COLORS = {
    '업무': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    '개인': 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    '아이디어': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
};

// 파일 확장자별 아이콘 색상
const FILE_EXT_COLORS = {
    'pdf': 'text-red-500'
};

export default function DocumentPage({ user, setUser }) {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    // 상태 관리
    const [documents, setDocuments] = useState([]);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        pageSize: 10
    });
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [searchText, setSearchText] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [loading, setLoading] = useState(false);

    // 업로드 모달 상태
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        title: '',
        category: '업무',
        summary: ''
    });

    // RAG 진행률 상태: { [docId]: { taskId, progress, status, message } }
    const [ragProgressMap, setRagProgressMap] = useState({});
    const ragPollingRefs = useRef({});

    // 상세 보기 모달 상태
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);

    // 수정 모달 상태
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        title: '',
        category: '',
        summary: ''
    });

    // 문서 목록 조회
    const fetchDocuments = async (page = 1) => {
        if (!user?.id) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                size: '10'
            });

            if (selectedCategory && selectedCategory !== '전체') {
                params.append('category', selectedCategory);
            }

            if (searchText) {
                params.append('search', searchText);
            }

            const response = await fetch(
                `${API_BASE}/document/list/${user.id}?${params.toString()}`
            );

            if (response.ok) {
                const data = await response.json();
                setDocuments(data.documents);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('문서 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // 문서 상세 조회
    const fetchDocumentDetail = async (documentId) => {
        try {
            const response = await fetch(`${API_BASE}/document/${documentId}`);
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('문서 상세 조회 실패:', error);
        }
        return null;
    };

    // localStorage 키
    const RAG_TASKS_KEY = 'rag_active_tasks';

    // localStorage에서 활성 태스크 목록 읽기/쓰기
    const loadActiveTasks = () => {
        try {
            const raw = localStorage.getItem(RAG_TASKS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    };

    const saveActiveTasks = (tasks) => {
        try {
            localStorage.setItem(RAG_TASKS_KEY, JSON.stringify(tasks));
        } catch (e) { console.error('localStorage 저장 실패:', e); }
    };

    // 단일 문서에 대한 폴링 시작 (다른 문서 폴링에 영향 없음)
    const startRagPolling = useCallback((taskId, docId) => {
        // 이미 이 문서에 대한 폴링이 돌고 있으면 중복 방지
        if (ragPollingRefs.current[docId]) {
            clearInterval(ragPollingRefs.current[docId]);
        }

        // 초기 상태 설정
        setRagProgressMap(prev => ({
            ...prev,
            [docId]: { taskId, progress: 0, status: 'pending', message: '작업 대기 중...' }
        }));

        // localStorage에 기록
        const active = loadActiveTasks();
        active[docId] = taskId;
        saveActiveTasks(active);

        ragPollingRefs.current[docId] = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/document/status/${taskId}`);
                if (!res.ok) return;

                const data = await res.json();
                setRagProgressMap(prev => ({
                    ...prev,
                    [docId]: { taskId, progress: data.progress, status: data.status, message: data.message }
                }));

                if (data.status === 'completed' || data.status === 'failed') {
                    clearInterval(ragPollingRefs.current[docId]);
                    delete ragPollingRefs.current[docId];

                    // localStorage에서 제거
                    const updated = loadActiveTasks();
                    delete updated[docId];
                    saveActiveTasks(updated);

                    const delay = data.status === 'completed' ? 1500 : 3000;
                    setTimeout(() => {
                        setRagProgressMap(prev => {
                            const next = { ...prev };
                            delete next[docId];
                            return next;
                        });
                        fetchDocuments(pagination.currentPage);
                    }, delay);
                }
            } catch (err) {
                console.error('RAG 진행률 조회 실패:', err);
            }
        }, 1000);
    }, [pagination.currentPage]);

    // 컴포넌트 마운트 시 localStorage에서 진행 중인 태스크 복원
    useEffect(() => {
        const active = loadActiveTasks();
        const docIds = Object.keys(active);
        if (docIds.length > 0) {
            docIds.forEach(docId => {
                const taskId = active[docId];
                startRagPolling(taskId, Number(docId));
            });
        }
    }, []);

    // 컴포넌트 언마운트 시 모든 폴링 정리
    useEffect(() => {
        return () => {
            Object.values(ragPollingRefs.current).forEach(id => clearInterval(id));
            ragPollingRefs.current = {};
        };
    }, []);

    // 파일 업로드
    const uploadDocument = async () => {
        if (!uploadFile) {
            alert('파일을 선택해주세요.');
            return;
        }
        if (!uploadForm.title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }
        if (uploadForm.title.length > 255) {
            alert('제목은 255자 이내로 입력해주세요.');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('user_id', user.id);
            formData.append('title', uploadForm.title);
            formData.append('category', uploadForm.category);
            formData.append('summary', uploadForm.summary);
            formData.append('file', uploadFile);

            const response = await fetch(`${API_BASE}/document/upload`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                closeUploadModal();
                fetchDocuments(1);

                // PDF 업로드 시 RAG 진행률 폴링 시작
                if (result.ragTaskId) {
                    const docId = result.document?.id;
                    startRagPolling(result.ragTaskId, docId);
                }
            } else {
                const error = await response.json();
                alert(error.detail || '문서 업로드에 실패했습니다.');
            }
        } catch (error) {
            console.error('문서 업로드 실패:', error);
            alert('문서 업로드 중 오류가 발생했습니다.');
        } finally {
            setUploading(false);
        }
    };

    // 문서 수정
    const updateDocument = async () => {
        if (!selectedDocument) return;
        if (!editForm.title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }
        if (editForm.title.length > 255) {
            alert('제목은 255자 이내로 입력해주세요.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/document/${selectedDocument.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editForm.title,
                    category: editForm.category,
                    summary: editForm.summary
                })
            });

            if (response.ok) {
                alert('문서가 수정되었습니다.');
                setShowEditModal(false);
                fetchDocuments(pagination.currentPage);
            } else {
                alert('문서 수정에 실패했습니다.');
            }
        } catch (error) {
            console.error('문서 수정 실패:', error);
            alert('문서 수정 중 오류가 발생했습니다.');
        }
    };

    // 문서 삭제
    const deleteDocument = async (documentId) => {
        if (!confirm('정말 이 문서를 삭제하시겠습니까?')) return;

        try {
            const response = await fetch(`${API_BASE}/document/${documentId}?user_id=${user.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('문서가 삭제되었습니다.');
                if (showDetailModal) {
                    setShowDetailModal(false);
                    setSelectedDocument(null);
                }
                fetchDocuments(pagination.currentPage);
            } else {
                alert('문서 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('문서 삭제 실패:', error);
            alert('문서 삭제 중 오류가 발생했습니다.');
        }
    };

    // 파일 다운로드
    const downloadDocument = async (doc) => {
        try {
            const response = await fetch(`${API_BASE}/document/download/${doc.id}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = doc.fileName;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                alert('파일 다운로드에 실패했습니다.');
            }
        } catch (error) {
            console.error('다운로드 실패:', error);
            alert('파일 다운로드 중 오류가 발생했습니다.');
        }
    };

    // 업로드 모달 열기
    const openUploadModal = () => {
        setUploadFile(null);
        setUploadForm({ title: '', category: '업무', summary: '' });
        setShowUploadModal(true);
    };

    // 업로드 모달 닫기
    const closeUploadModal = () => {
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadForm({ title: '', category: '업무', summary: '' });
    };

    // 상세 보기 모달 열기
    const openDetailModal = async (doc) => {
        const detail = await fetchDocumentDetail(doc.id);
        if (detail) {
            setSelectedDocument(detail);
            setShowDetailModal(true);
        }
    };

    // 수정 모달 열기
    const openEditModal = async (doc) => {
        const detail = await fetchDocumentDetail(doc.id);
        if (detail) {
            setSelectedDocument(detail);
            setEditForm({
                title: detail.title,
                category: detail.category,
                summary: detail.summary || ''
            });
            setShowEditModal(true);
        }
    };

    // 파일 선택 핸들러
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            // PDF 파일만 허용
            if (!file.name.toLowerCase().endsWith('.pdf')) {
                alert('PDF 파일만 업로드할 수 있습니다.');
                e.target.value = '';
                return;
            }
            setUploadFile(file);
            if (!uploadForm.title) {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                setUploadForm({ ...uploadForm, title: nameWithoutExt });
            }
        }
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
            fetchDocuments(newPage);
        }
    };

    // 초기 로드 및 필터 변경 시 조회
    useEffect(() => {
        fetchDocuments(1);
    }, [user?.id, selectedCategory, searchText]);

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

    // 파일 확장자에 따른 아이콘 색상
    const getFileExtColor = (ext) => {
        return FILE_EXT_COLORS[ext?.toLowerCase()] || 'text-gray-500';
    };

    return (
        <UserLayout user={user} setUser={setUser} activeMenu="문서 보관함">
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 md:gap-8">

                {/* 헤더 */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-border-light dark:border-border-dark pb-6">
                    <div>
                        <p className="text-primary text-[10px] md:text-xs font-bold uppercase tracking-tighter mb-1">Document Storage</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight dark:text-white">문서 보관함</h1>
                    </div>
                    <button
                        onClick={openUploadModal}
                        className="mt-4 md:mt-0 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold shadow-lg shadow-primary/25"
                    >
                        <Upload size={18} />
                        <span>파일 업로드</span>
                    </button>
                </div>

                {/* 검색 및 필터 */}
                <div className="bg-white dark:bg-card-dark rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm p-5">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        {/* 검색 영역 */}
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="제목 또는 내용 검색..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full pl-10 pr-4 py-2.5 border border-border-light dark:border-border-dark rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                />
                                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors font-medium"
                            >
                                검색
                            </button>
                            {searchText && (
                                <button
                                    onClick={handleSearchReset}
                                    className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* 카테고리 필터 버튼 */}
                        <div className="flex gap-2 flex-wrap">
                            {CATEGORIES.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-4 py-2 rounded-xl transition-all font-medium ${
                                        selectedCategory === category
                                            ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                            : 'bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 문서 목록 테이블 */}
                <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {/* 테이블 헤더 */}
                    <div className="p-5 border-b border-border-light dark:border-border-dark flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/20">
                        <div className="w-1.5 h-5 bg-primary rounded-full"></div>
                        <h2 className="text-lg font-bold dark:text-white">문서 목록</h2>
                        <span className="ml-2 text-sm text-text-muted">총 {pagination.totalCount}건</span>
                    </div>

                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/80 dark:bg-slate-900/30 border-b border-border-light dark:border-border-dark text-sm font-medium text-gray-600 dark:text-gray-400">
                        <div className="col-span-1 text-center">번호</div>
                        <div className="col-span-5">문서명</div>
                        <div className="col-span-1 text-center">형식</div>
                        <div className="col-span-1 text-center">크기</div>
                        <div className="col-span-2 text-center">등록일시</div>
                        <div className="col-span-2 text-center">관리</div>
                    </div>

                    {/* 테이블 바디 */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader className="animate-spin text-primary" size={32} />
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
                            <FolderOpen size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
                            <p className="font-medium">등록된 문서가 없습니다.</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">파일 업로드 버튼을 클릭하여 문서를 추가하세요.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border-light dark:divide-border-dark">
                            {documents.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors items-center"
                                >
                                    {/* 번호 */}
                                    <div className="hidden md:block col-span-1 text-center text-gray-600 dark:text-gray-400">
                                        {doc.rowNum}
                                    </div>

                                    {/* 문서명 */}
                                    <div
                                        className="col-span-1 md:col-span-5 cursor-pointer"
                                        onClick={() => openDetailModal(doc)}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 text-xs rounded-lg font-medium ${CATEGORY_COLORS[doc.category] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                {doc.category}
                                            </span>
                                            <h3 className="font-semibold text-gray-800 dark:text-white hover:text-primary transition-colors truncate">
                                                {doc.title}
                                            </h3>
                                            {/* 원형 진행도 표시 (INDEXING 상태 문서) */}
                                            {doc.status === 'INDEXING' && ragProgressMap[doc.id] && (
                                                <div className="relative flex-shrink-0" title={ragProgressMap[doc.id].message}>
                                                    <svg width="32" height="32" viewBox="0 0 48 48" className="transform -rotate-90">
                                                        {/* 배경 원 */}
                                                        <circle
                                                            cx="24" cy="24" r="18"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                            className="text-gray-200 dark:text-gray-700"
                                                        />
                                                        {/* 진행률 원 */}
                                                        <circle
                                                            cx="24" cy="24" r="18"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                            strokeLinecap="round"
                                                            className={ragProgressMap[doc.id].status === 'failed' ? 'text-red-500' : 'text-primary'}
                                                            strokeDasharray={2 * Math.PI * 18}
                                                            strokeDashoffset={2 * Math.PI * 18 * (1 - (ragProgressMap[doc.id].progress || 0) / 100)}
                                                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                                                        />
                                                    </svg>
                                                    {/* 중앙 퍼센트 텍스트 */}
                                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-700 dark:text-gray-300">
                                                        {ragProgressMap[doc.id].status === 'failed' ? '!' : `${ragProgressMap[doc.id].progress || 0}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                            {doc.fileName}
                                        </p>
                                    </div>

                                    {/* 형식 */}
                                    <div className="hidden md:flex col-span-1 justify-center">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold uppercase ${getFileExtColor(doc.fileExt)}`}>
                                            <File size={12} />
                                            {doc.fileExt}
                                        </span>
                                    </div>

                                    {/* 크기 */}
                                    <div className="hidden md:block col-span-1 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        {doc.fileSizeText}
                                    </div>

                                    {/* 등록일시 */}
                                    <div className="hidden md:block col-span-2 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        {doc.createdAt}
                                    </div>

                                    {/* 관리 버튼 */}
                                    <div className="col-span-1 md:col-span-2 flex justify-end md:justify-center gap-1">
                                        <button
                                            onClick={() => openDetailModal(doc)}
                                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                            title="보기"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => downloadDocument(doc)}
                                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-all"
                                            title="다운로드"
                                        >
                                            <Download size={16} />
                                        </button>
                                        <button
                                            onClick={() => openEditModal(doc)}
                                            className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-all"
                                            title="수정"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteDocument(doc.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
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
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/20 border-t border-border-light dark:border-border-dark">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                총 {pagination.totalCount}건 중 {((pagination.currentPage - 1) * pagination.pageSize) + 1}-
                                {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)}건
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                                    disabled={!pagination.hasPrev}
                                    className={`p-2 rounded-xl transition-colors ${
                                        pagination.hasPrev
                                            ? 'hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                                            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                    }`}
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                {getPageNumbers().map((pageNum) => (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`w-10 h-10 rounded-xl transition-all font-medium ${
                                            pageNum === pagination.currentPage
                                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                                : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}

                                <button
                                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                                    disabled={!pagination.hasNext}
                                    className={`p-2 rounded-xl transition-colors ${
                                        pagination.hasNext
                                            ? 'hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                                            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                    }`}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 파일 업로드 모달 */}
                {showUploadModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border-light dark:border-border-dark">
                            <div className="flex items-center justify-between px-6 py-5 border-b border-border-light dark:border-border-dark">
                                <h2 className="text-xl font-bold dark:text-white">파일 업로드</h2>
                                <button
                                    onClick={closeUploadModal}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <X size={20} className="dark:text-white" />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">파일 선택</label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-border-light dark:border-border-dark rounded-2xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                                    >
                                        {uploadFile ? (
                                            <div className="flex flex-col items-center">
                                                <File size={48} className={getFileExtColor(uploadFile.name.split('.').pop())} />
                                                <p className="text-gray-800 dark:text-white font-bold mt-3">{uploadFile.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <Upload size={48} className="text-gray-300 dark:text-gray-600" />
                                                <p className="text-gray-600 dark:text-gray-400 mt-3 font-medium">클릭하여 파일을 선택하세요</p>
                                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                                    PDF 파일만 업로드 가능합니다
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        제목 <span className="text-xs text-gray-400 font-normal">({uploadForm.title.length}/255)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadForm.title}
                                        onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                        placeholder="문서 제목을 입력하세요"
                                        maxLength={255}
                                        className="w-full px-4 py-3 border border-border-light dark:border-border-dark rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">카테고리</label>
                                    <select
                                        value={uploadForm.category}
                                        onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                                        className="w-full px-4 py-3 border border-border-light dark:border-border-dark rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    >
                                        <option value="업무">업무</option>
                                        <option value="개인">개인</option>
                                        <option value="아이디어">아이디어</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">요약 (선택)</label>
                                    <textarea
                                        value={uploadForm.summary}
                                        onChange={(e) => setUploadForm({ ...uploadForm, summary: e.target.value })}
                                        placeholder="문서에 대한 간단한 설명"
                                        rows={3}
                                        className="w-full px-4 py-3 border border-border-light dark:border-border-dark rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 px-6 py-5 border-t border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-slate-900/20 rounded-b-[2rem]">
                                <button
                                    onClick={closeUploadModal}
                                    className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                                    disabled={uploading}
                                >
                                    취소
                                </button>
                                <button
                                    onClick={uploadDocument}
                                    disabled={uploading || !uploadFile || !uploadForm.title}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
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

                {/* 문서 상세 보기 모달 */}
                {showDetailModal && selectedDocument && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border-light dark:border-border-dark">
                            <div className="flex items-center justify-between px-6 py-5 border-b border-border-light dark:border-border-dark">
                                <h2 className="text-xl font-bold dark:text-white">문서 상세</h2>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <X size={20} className="dark:text-white" />
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                                    <div className={`w-16 h-16 rounded-2xl bg-white dark:bg-slate-700 border border-border-light dark:border-border-dark flex items-center justify-center ${getFileExtColor(selectedDocument.fileExt)}`}>
                                        <File size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-800 dark:text-white text-lg">{selectedDocument.title}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{selectedDocument.fileName}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark">
                                        <span className="text-gray-500 dark:text-gray-400">카테고리</span>
                                        <span className={`px-3 py-1 text-xs rounded-lg font-bold ${CATEGORY_COLORS[selectedDocument.category]}`}>
                                            {selectedDocument.category}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-3 border-b border-border-light dark:border-border-dark">
                                        <span className="text-gray-500 dark:text-gray-400">파일 형식</span>
                                        <span className="font-bold uppercase dark:text-white">{selectedDocument.fileExt}</span>
                                    </div>
                                    <div className="flex justify-between py-3 border-b border-border-light dark:border-border-dark">
                                        <span className="text-gray-500 dark:text-gray-400">파일 크기</span>
                                        <span className="font-bold dark:text-white">{selectedDocument.fileSizeText}</span>
                                    </div>
                                    <div className="flex justify-between py-3 border-b border-border-light dark:border-border-dark">
                                        <span className="text-gray-500 dark:text-gray-400">작성자</span>
                                        <span className="font-bold dark:text-white">{selectedDocument.authorName}</span>
                                    </div>
                                    <div className="flex justify-between py-3 border-b border-border-light dark:border-border-dark">
                                        <span className="text-gray-500 dark:text-gray-400">등록일</span>
                                        <span className="font-bold dark:text-white">{selectedDocument.createdAt}</span>
                                    </div>
                                    {selectedDocument.summary && (
                                        <div className="py-3">
                                            <span className="text-gray-500 dark:text-gray-400 block mb-2">요약</span>
                                            <p className="text-gray-800 dark:text-gray-200 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                                                {selectedDocument.summary}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 px-6 py-5 border-t border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-slate-900/20 rounded-b-[2rem]">
                                <button
                                    onClick={() => deleteDocument(selectedDocument.id)}
                                    className="px-5 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors font-medium"
                                >
                                    삭제
                                </button>
                                <button
                                    onClick={() => downloadDocument(selectedDocument)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold shadow-lg shadow-primary/25"
                                >
                                    <Download size={16} />
                                    <span>다운로드</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 문서 수정 모달 */}
                {showEditModal && selectedDocument && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border-light dark:border-border-dark">
                            <div className="flex items-center justify-between px-6 py-5 border-b border-border-light dark:border-border-dark">
                                <h2 className="text-xl font-bold dark:text-white">문서 수정</h2>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <X size={20} className="dark:text-white" />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        제목 <span className="text-xs text-gray-400 font-normal">({editForm.title.length}/255)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.title}
                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                        maxLength={255}
                                        className="w-full px-4 py-3 border border-border-light dark:border-border-dark rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">카테고리</label>
                                    <select
                                        value={editForm.category}
                                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                        className="w-full px-4 py-3 border border-border-light dark:border-border-dark rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                    >
                                        <option value="업무">업무</option>
                                        <option value="개인">개인</option>
                                        <option value="아이디어">아이디어</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">요약</label>
                                    <textarea
                                        value={editForm.summary}
                                        onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                                        placeholder="문서에 대한 간단한 설명"
                                        rows={3}
                                        className="w-full px-4 py-3 border border-border-light dark:border-border-dark rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none dark:text-white"
                                    />
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">파일 정보 (변경 불가)</p>
                                    <p className="font-bold text-gray-800 dark:text-white">{selectedDocument.fileName}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedDocument.fileSizeText}</p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 px-6 py-5 border-t border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-slate-900/20 rounded-b-[2rem]">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={updateDocument}
                                    className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold shadow-lg shadow-primary/25"
                                >
                                    저장
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </UserLayout>
    );
}
