import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../components/UserLayout';
import {
    Wand2,
    Search,
    Image as ImageIcon,
    ChevronLeft,
    ChevronRight,
    X,
    Trash2,
    Download,
    Maximize2,
    Loader,
    Sparkles
} from 'lucide-react';
import { API_BASE } from '../utils/api';

// 스타일 옵션 (SD 3.5 Medium 최적화)
const STYLE_OPTIONS = [
    { value: 'corporate', label: '기업/비즈니스', icon: '🏢' },
    { value: 'product', label: '제품 촬영', icon: '📦' },
    { value: 'typography', label: '포스터/타이포', icon: '🔤' },
    { value: 'realistic', label: '사실적', icon: '📷' },
    { value: 'anime', label: '애니메이션', icon: '🎨' },
    { value: 'cartoon', label: '만화', icon: '🖌️' }
];

// 크기 옵션
const SIZE_OPTIONS = [
    { value: '512x512', label: '512 x 512' },
    { value: '768x768', label: '768 x 768' },
    { value: '1024x1024', label: '1024 x 1024' }
];

export default function ImagePage({ user, setUser }) {
    const navigate = useNavigate();

    // 상태 관리
    const [images, setImages] = useState([]);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        pageSize: 12
    });
    const [searchText, setSearchText] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [loading, setLoading] = useState(false);

    // 이미지 생성 상태
    const [generating, setGenerating] = useState(false);
    const [taskId, setTaskId] = useState(null);
    const [generationProgress, setGenerationProgress] = useState({
        progress: 0,
        message: '',
        status: 'idle'  // idle, processing, completed, failed
    });

    // 생성 폼 상태
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('realistic');
    const [size, setSize] = useState('1024x1024');

    // 모달 상태
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    // 이미지 목록 조회
    const fetchImages = async (page = 1) => {
        if (!user?.id) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                size: '12'
            });

            if (searchText) {
                params.append('search', searchText);
            }

            const response = await fetch(
                `${API_BASE}/image/list/${user.id}?${params.toString()}`
            );

            if (response.ok) {
                const data = await response.json();
                setImages(data.images);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('이미지 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // localStorage 키 (사용자별로 구분)
    const TASK_STORAGE_KEY = `image_task_${user?.id}`;

    // localStorage에서 taskId 저장/삭제
    const saveTaskToStorage = (taskId) => {
        if (user?.id) {
            localStorage.setItem(TASK_STORAGE_KEY, taskId);
        }
    };

    const clearTaskFromStorage = () => {
        localStorage.removeItem(TASK_STORAGE_KEY);
    };

    const getTaskFromStorage = () => {
        return localStorage.getItem(TASK_STORAGE_KEY);
    };

    // 진행률 폴링
    const pollProgress = async (taskIdToPoll) => {
        try {
            const response = await fetch(`${API_BASE}/image/status/${taskIdToPoll}`);
            if (response.ok) {
                const data = await response.json();
                setGenerationProgress({
                    progress: data.progress,
                    message: data.message,
                    status: data.status
                });

                // 완료 또는 실패 시 폴링 중지
                if (data.status === 'completed') {
                    setGenerating(false);
                    setTaskId(null);
                    clearTaskFromStorage();
                    setPrompt('');
                    fetchImages(1);
                    // 3초 후 상태 초기화
                    setTimeout(() => {
                        setGenerationProgress({
                            progress: 0,
                            message: '',
                            status: 'idle'
                        });
                    }, 3000);
                    return;
                } else if (data.status === 'failed') {
                    setGenerating(false);
                    setTaskId(null);
                    clearTaskFromStorage();
                    alert(data.message || '이미지 생성에 실패했습니다.');
                    setGenerationProgress({
                        progress: 0,
                        message: '',
                        status: 'idle'
                    });
                    return;
                }

                // 계속 폴링 (1초 간격)
                setTimeout(() => pollProgress(taskIdToPoll), 1000);
            } else if (response.status === 404) {
                // Task가 없으면 정리 (오래된 데이터)
                setGenerating(false);
                setTaskId(null);
                clearTaskFromStorage();
                setGenerationProgress({ progress: 0, message: '', status: 'idle' });
            }
        } catch (error) {
            console.error('진행률 조회 실패:', error);
            // 에러 시에도 폴링 계속 (네트워크 일시 오류 대비)
            setTimeout(() => pollProgress(taskIdToPoll), 2000);
        }
    };

    // 이미지 생성
    const generateImage = async () => {
        if (!prompt.trim()) {
            alert('프롬프트를 입력해주세요.');
            return;
        }

        setGenerating(true);
        setGenerationProgress({
            progress: 0,
            message: '요청 전송 중...',
            status: 'processing'
        });

        try {
            const response = await fetch(`${API_BASE}/image/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    prompt: prompt,
                    style: style,
                    size: size
                })
            });

            if (response.ok) {
                const data = await response.json();
                const newTaskId = data.taskId;
                setTaskId(newTaskId);
                saveTaskToStorage(newTaskId);

                // 진행률 폴링 시작
                pollProgress(newTaskId);
            } else {
                const error = await response.json();
                alert(error.detail || '이미지 생성에 실패했습니다.');
                setGenerating(false);
                setGenerationProgress({
                    progress: 0,
                    message: '',
                    status: 'idle'
                });
            }
        } catch (error) {
            console.error('이미지 생성 실패:', error);
            alert('이미지 생성 중 오류가 발생했습니다.');
            setGenerating(false);
            setGenerationProgress({
                progress: 0,
                message: '',
                status: 'idle'
            });
        }
    };

    // 이미지 삭제
    const deleteImage = async (imageId, e) => {
        e.stopPropagation();
        if (!confirm('정말 이 이미지를 삭제하시겠습니까?')) return;

        try {
            const response = await fetch(`${API_BASE}/image/${imageId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('이미지가 삭제되었습니다.');
                if (showViewModal) {
                    setShowViewModal(false);
                    setSelectedImage(null);
                }
                fetchImages(pagination.currentPage);
            } else {
                alert('이미지 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('이미지 삭제 실패:', error);
            alert('이미지 삭제 중 오류가 발생했습니다.');
        }
    };

    // 이미지 다운로드
    const downloadImage = async (image, e) => {
        e?.stopPropagation();
        try {
            const response = await fetch(`${API_BASE}${image.imageUrl}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = image.fileName || 'generated-image.png';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('다운로드 실패:', error);
            alert('이미지 다운로드에 실패했습니다.');
        }
    };

    // 이미지 상세 보기
    const openViewModal = (image) => {
        setSelectedImage(image);
        setShowViewModal(true);
    };

    // 모달 닫기
    const closeViewModal = () => {
        setShowViewModal(false);
        setSelectedImage(null);
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
            fetchImages(newPage);
        }
    };

    // 초기 로드 및 필터 변경 시 조회
    useEffect(() => {
        fetchImages(1);
    }, [user?.id, searchText]);

    // 페이지 진입 시 진행 중인 작업 복원
    useEffect(() => {
        const savedTaskId = getTaskFromStorage();
        if (savedTaskId && user?.id) {
            // 저장된 작업이 있으면 상태 확인 후 폴링 재개
            setTaskId(savedTaskId);
            setGenerating(true);
            setGenerationProgress({
                progress: 0,
                message: '작업 상태 확인 중...',
                status: 'processing'
            });
            pollProgress(savedTaskId);
        }
    }, [user?.id]);

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

    return (
        <UserLayout user={user} setUser={setUser} activeMenu="이미지 생성">
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 md:gap-8">
                {/* 헤더 */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-border-light dark:border-border-dark pb-6">
                    <div>
                        <p className="text-primary text-[10px] md:text-xs font-bold uppercase tracking-tighter mb-1">AI Image Generation</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight dark:text-white">AI 이미지 생성</h1>
                        <p className="text-text-muted text-sm mt-1">텍스트로 원하는 이미지를 만들어보세요</p>
                    </div>
                </div>

                {/* 이미지 생성 영역 */}
                <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                        <Sparkles size={20} className="text-primary" />
                        <h2 className="text-lg font-bold dark:text-white">새 이미지 생성</h2>
                    </div>

                    {/* 프롬프트 입력 */}
                    <div className="mb-5">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            프롬프트 (영어 권장)
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="예: A beautiful sunset over the ocean with vibrant orange and purple colors, photorealistic, high quality"
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted resize-none"
                        />
                    </div>

                    {/* 옵션 선택 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                        {/* 스타일 선택 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                스타일
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {STYLE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setStyle(option.value)}
                                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl transition-all font-medium ${
                                            style === option.value
                                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        <span>{option.icon}</span>
                                        <span className="text-sm">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 크기 선택 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                이미지 크기
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {SIZE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setSize(option.value)}
                                        className={`px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                                            size === option.value
                                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 생성 버튼 및 진행률 */}
                    {generating ? (
                        <div className="space-y-3">
                            {/* 진행률 바 */}
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${generationProgress.progress}%` }}
                                />
                            </div>

                            {/* 상태 메시지 */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <Loader size={16} className="animate-spin text-primary" />
                                    <span>{generationProgress.message || '이미지 생성 중...'}</span>
                                </div>
                                <span className="text-sm font-bold text-primary">
                                    {generationProgress.progress}%
                                </span>
                            </div>

                            {/* 완료 상태 표시 */}
                            {generationProgress.status === 'completed' && (
                                <div className="flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-500/10 text-green-600 rounded-xl">
                                    <Sparkles size={18} />
                                    <span className="font-medium">이미지가 생성되었습니다!</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={generateImage}
                            disabled={!prompt.trim()}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg shadow-primary/25"
                        >
                            <Wand2 size={20} />
                            <span>이미지 생성하기</span>
                        </button>
                    )}
                </div>

                {/* 갤러리 영역 */}
                <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                    {/* 갤러리 헤더 */}
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-6 md:p-8 border-b border-border-light dark:border-border-dark">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                            <h2 className="text-lg font-bold dark:text-white">
                                내 갤러리
                                <span className="ml-2 text-sm font-normal text-text-muted">
                                    ({pagination.totalCount}개)
                                </span>
                            </h2>
                        </div>

                        {/* 검색 */}
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <input
                                    type="text"
                                    placeholder="프롬프트로 검색..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-text-muted"
                                />
                                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors font-medium"
                            >
                                검색
                            </button>
                            {searchText && (
                                <button
                                    onClick={handleSearchReset}
                                    className="p-2.5 text-text-muted hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 갤러리 그리드 */}
                    <div className="p-6 md:p-8">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-primary border-t-transparent"></div>
                            </div>
                        ) : images.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                                <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                    <ImageIcon size={40} className="text-gray-400" />
                                </div>
                                <p className="text-lg font-medium dark:text-gray-400">생성된 이미지가 없습니다</p>
                                <p className="text-sm mt-1">위에서 프롬프트를 입력하고 이미지를 생성해보세요!</p>
                            </div>
                        ) : (
                            <>
                                {/* 이미지 그리드 */}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {images.map((image) => (
                                        <div
                                            key={image.id}
                                            className="group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer shadow-sm hover:shadow-lg transition-all"
                                            onClick={() => openViewModal(image)}
                                        >
                                            {/* 이미지 */}
                                            <img
                                                src={`${API_BASE}${image.imageUrl}`}
                                                alt={image.promptPreview}
                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            />

                                            {/* 오버레이 */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openViewModal(image);
                                                        }}
                                                        className="p-2.5 bg-white rounded-xl hover:bg-gray-100 transition-colors"
                                                        title="확대 보기"
                                                    >
                                                        <Maximize2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => downloadImage(image, e)}
                                                        className="p-2.5 bg-white rounded-xl hover:bg-gray-100 transition-colors"
                                                        title="다운로드"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => deleteImage(image.id, e)}
                                                        className="p-2.5 bg-white rounded-xl hover:bg-red-100 text-red-500 transition-colors"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 프롬프트 미리보기 */}
                                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                                                <p className="text-white text-xs truncate font-medium">
                                                    {image.promptPreview}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* 페이징 */}
                                {pagination.totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-1 mt-8">
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
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* 이미지 상세 보기 모달 */}
                {showViewModal && selectedImage && (
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
                        onClick={closeViewModal}
                    >
                        <div
                            className="bg-white dark:bg-card-dark rounded-[2rem] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-border-light dark:border-border-dark"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 모달 헤더 */}
                            <div className="flex items-center justify-between px-8 py-5 border-b border-border-light dark:border-border-dark">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                    <h2 className="text-xl font-bold dark:text-white">이미지 상세</h2>
                                </div>
                                <button
                                    onClick={closeViewModal}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    <X size={20} className="dark:text-white" />
                                </button>
                            </div>

                            {/* 모달 바디 */}
                            <div className="flex flex-col md:flex-row max-h-[calc(90vh-80px)]">
                                {/* 이미지 */}
                                <div className="md:w-2/3 bg-gray-100 dark:bg-background-dark flex items-center justify-center p-6">
                                    <img
                                        src={`${API_BASE}${selectedImage.imageUrl}`}
                                        alt={selectedImage.prompt}
                                        className="max-w-full max-h-[60vh] object-contain rounded-2xl"
                                    />
                                </div>

                                {/* 정보 */}
                                <div className="md:w-1/3 p-6 md:p-8 border-t md:border-t-0 md:border-l border-border-light dark:border-border-dark overflow-y-auto">
                                    <div className="mb-5">
                                        <label className="block text-sm font-bold text-text-muted mb-2">
                                            프롬프트
                                        </label>
                                        <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                                            {selectedImage.prompt}
                                        </p>
                                    </div>

                                    <div className="mb-5">
                                        <label className="block text-sm font-bold text-text-muted mb-2">
                                            파일 정보
                                        </label>
                                        <p className="text-gray-800 dark:text-gray-200 text-sm">
                                            {selectedImage.fileName}
                                        </p>
                                        <p className="text-text-muted text-xs mt-1">
                                            {selectedImage.fileSizeText}
                                        </p>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-sm font-bold text-text-muted mb-2">
                                            생성일시
                                        </label>
                                        <p className="text-gray-800 dark:text-gray-200 text-sm">
                                            {selectedImage.createdAt}
                                        </p>
                                    </div>

                                    {/* 액션 버튼 */}
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={(e) => downloadImage(selectedImage, e)}
                                            className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/25"
                                        >
                                            <Download size={18} />
                                            <span>다운로드</span>
                                        </button>
                                        <button
                                            onClick={(e) => deleteImage(selectedImage.id, e)}
                                            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors font-medium"
                                        >
                                            <Trash2 size={18} />
                                            <span>삭제</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </UserLayout>
    );
}
