import React, { useState, useEffect } from 'react';
import UserLayout from '../components/UserLayout';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Calendar,
    Clock,
    Tag,
    FileText,
    X,
    Save,
    Trash2,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { API_BASE } from '../utils/api';

// API 기본 URL
const API_BASE_URL = API_BASE;

// 카테고리 색상 매핑
const categoryColors = {
    '일반': 'bg-gray-500',
    '업무': 'bg-blue-500',
    '회의': 'bg-purple-500',
    '개인': 'bg-green-500',
    '중요': 'bg-red-500',
};

const SchedulePage = ({ user, setUser }) => {
    // 현재 표시 중인 년/월
    const [currentDate, setCurrentDate] = useState(new Date());
    // 선택된 날짜
    const [selectedDate, setSelectedDate] = useState(null);
    // 월별 일정 데이터
    const [monthlyData, setMonthlyData] = useState({ schedules: [], dateCounts: {} });
    // 선택된 날짜의 일정
    const [dailySchedules, setDailySchedules] = useState([]);
    // 로딩 상태
    const [isLoading, setIsLoading] = useState(false);
    // 일정 등록/수정 모달 표시 여부
    const [showModal, setShowModal] = useState(false);
    // 수정 중인 일정 (null이면 새 일정)
    const [editingSchedule, setEditingSchedule] = useState(null);
    // 폼 데이터
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        schedule_date: '',
        start_time: '09:00',
        end_time: '10:00',
        category: '일반'
    });
    // 에러 메시지
    const [error, setError] = useState('');
    // 저장 중
    const [isSaving, setIsSaving] = useState(false);

    // 요일 이름
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    // 카테고리 목록
    const categories = ['일반', '업무', '회의', '개인', '중요'];

    // 현재 년/월 변경 시 월별 일정 로드
    useEffect(() => {
        if (user?.id) {
            fetchMonthlySchedules();
        }
    }, [currentDate, user?.id]);

    // 선택된 날짜 변경 시 해당 날짜 일정 로드
    useEffect(() => {
        if (selectedDate && user?.id) {
            fetchDailySchedules(selectedDate);
        }
    }, [selectedDate, user?.id]);

    // 월별 일정 조회
    const fetchMonthlySchedules = async () => {
        setIsLoading(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const response = await fetch(
                `${API_BASE_URL}/schedule/monthly/${user.id}?year=${year}&month=${month}`
            );
            if (response.ok) {
                const data = await response.json();
                setMonthlyData(data);
            }
        } catch (err) {
            console.error('월별 일정 조회 실패:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // 특정 날짜 일정 조회
    const fetchDailySchedules = async (dateStr) => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/schedule/daily/${user.id}?date_str=${dateStr}`
            );
            if (response.ok) {
                const data = await response.json();
                setDailySchedules(data.schedules || []);
            }
        } catch (err) {
            console.error('일별 일정 조회 실패:', err);
        }
    };

    // 이전 달로 이동
    const goToPrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        setSelectedDate(null);
        setDailySchedules([]);
    };

    // 다음 달로 이동
    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        setSelectedDate(null);
        setDailySchedules([]);
    };

    // 오늘로 이동
    const goToToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(formatDate(today));
    };

    // 날짜 포맷팅 (YYYY-MM-DD)
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 캘린더 날짜 배열 생성
    const generateCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // 해당 월의 첫 날과 마지막 날
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // 첫 주 시작 전 빈 칸 (이전 달)
        const startPadding = firstDay.getDay();
        // 마지막 주 끝 빈 칸 (다음 달)
        const endPadding = 6 - lastDay.getDay();

        const days = [];

        // 이전 달 날짜
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startPadding - 1; i >= 0; i--) {
            days.push({
                date: prevMonthLastDay - i,
                isCurrentMonth: false,
                fullDate: formatDate(new Date(year, month - 1, prevMonthLastDay - i))
            });
        }

        // 현재 달 날짜
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({
                date: i,
                isCurrentMonth: true,
                fullDate: formatDate(new Date(year, month, i))
            });
        }

        // 다음 달 날짜
        for (let i = 1; i <= endPadding; i++) {
            days.push({
                date: i,
                isCurrentMonth: false,
                fullDate: formatDate(new Date(year, month + 1, i))
            });
        }

        return days;
    };

    // 날짜 클릭 핸들러
    const handleDateClick = (day) => {
        setSelectedDate(day.fullDate);
    };

    // 새 일정 추가 모달 열기
    const openNewScheduleModal = () => {
        setEditingSchedule(null);
        setFormData({
            title: '',
            content: '',
            schedule_date: selectedDate || formatDate(new Date()),
            start_time: '09:00',
            end_time: '10:00',
            category: '일반'
        });
        setError('');
        setShowModal(true);
    };

    // 일정 수정 모달 열기
    const openEditModal = (schedule) => {
        setEditingSchedule(schedule);
        setFormData({
            title: schedule.title,
            content: schedule.content || '',
            schedule_date: selectedDate,
            start_time: schedule.startTime,
            end_time: schedule.endTime,
            category: schedule.category || '일반'
        });
        setError('');
        setShowModal(true);
    };

    // 모달 닫기
    const closeModal = () => {
        setShowModal(false);
        setEditingSchedule(null);
        setError('');
    };

    // 폼 입력 핸들러
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // 일정 저장
    const handleSave = async () => {
        // 유효성 검사
        if (!formData.title.trim()) {
            setError('일정 제목을 입력해주세요.');
            return;
        }
        if (formData.title.length > 100) {
            setError('일정 제목은 100자 이내로 입력해주세요.');
            return;
        }
        if (!formData.schedule_date) {
            setError('날짜를 선택해주세요.');
            return;
        }
        if (formData.start_time >= formData.end_time) {
            setError('종료 시간은 시작 시간보다 늦어야 합니다.');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const url = editingSchedule
                ? `${API_BASE_URL}/schedule/${editingSchedule.id}`
                : `${API_BASE_URL}/schedule/`;

            const method = editingSchedule ? 'PUT' : 'POST';

            const body = editingSchedule
                ? {
                    title: formData.title,
                    content: formData.content,
                    schedule_date: formData.schedule_date,
                    start_time: formData.start_time,
                    end_time: formData.end_time,
                    category: formData.category
                }
                : {
                    user_id: user.id,
                    title: formData.title,
                    content: formData.content,
                    schedule_date: formData.schedule_date,
                    start_time: formData.start_time,
                    end_time: formData.end_time,
                    category: formData.category
                };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                closeModal();
                // 데이터 새로고침
                await fetchMonthlySchedules();
                if (selectedDate) {
                    await fetchDailySchedules(selectedDate);
                }
            } else {
                const errData = await response.json();
                setError(errData.detail || '저장에 실패했습니다.');
            }
        } catch (err) {
            setError('서버 연결에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    // 일정 삭제
    const handleDelete = async (scheduleId) => {
        if (!confirm('이 일정을 삭제하시겠습니까?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/schedule/${scheduleId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchMonthlySchedules();
                if (selectedDate) {
                    await fetchDailySchedules(selectedDate);
                }
            }
        } catch (err) {
            console.error('일정 삭제 실패:', err);
        }
    };

    // 오늘 날짜 확인
    const isToday = (dateStr) => {
        return dateStr === formatDate(new Date());
    };

    // 캘린더 날짜 배열
    const calendarDays = generateCalendarDays();

    return (
        <UserLayout user={user} setUser={setUser}>
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 md:gap-8">

                {/* 헤더 */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-border-light dark:border-border-dark pb-6">
                    <div>
                        <p className="text-primary text-[10px] md:text-xs font-bold uppercase tracking-tighter mb-1">Schedule Management</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight dark:text-white">일정 관리</h1>
                        <p className="text-text-muted text-sm mt-1">캘린더에서 날짜를 선택하여 일정을 관리하세요</p>
                    </div>
                    <button
                        onClick={openNewScheduleModal}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white rounded-2xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all mt-4 md:mt-0"
                    >
                        <Plus size={18} />
                        새 일정 추가
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* 캘린더 */}
                    <div className="lg:col-span-2 bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">

                        {/* 캘린더 헤더 */}
                        <div className="p-5 h-[72px] border-b border-border-light dark:border-border-dark flex items-center justify-between bg-gray-50 dark:bg-background-dark">
                            <button
                                onClick={goToPrevMonth}
                                className="p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                <ChevronLeft size={24} className="dark:text-white" />
                            </button>

                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-black dark:text-white">
                                    {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                                </h2>
                                <button
                                    onClick={goToToday}
                                    className="px-3 py-1.5 text-xs font-bold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                                >
                                    오늘
                                </button>
                                {isLoading && <Loader2 size={18} className="animate-spin text-primary" />}
                            </div>

                            <button
                                onClick={goToNextMonth}
                                className="p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                <ChevronRight size={24} className="dark:text-white" />
                            </button>
                        </div>

                        {/* 요일 헤더 */}
                        <div className="grid grid-cols-7 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-background-dark/50">
                            {weekDays.map((day, index) => (
                                <div
                                    key={day}
                                    className={`py-3 text-center text-sm font-bold ${
                                        index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-text-muted'
                                    }`}
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* 캘린더 그리드 */}
                        <div className="grid grid-cols-7">
                            {calendarDays.map((day, index) => {
                                const scheduleCount = monthlyData.dateCounts?.[day.fullDate] || 0;
                                const isSelected = selectedDate === day.fullDate;
                                const isTodayDate = isToday(day.fullDate);
                                const dayOfWeek = index % 7;

                                return (
                                    <div
                                        key={index}
                                        onClick={() => handleDateClick(day)}
                                        className={`
                                            min-h-[80px] md:min-h-[100px] p-2 border-b border-r border-border-light dark:border-border-dark
                                            cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50
                                            ${!day.isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''}
                                            ${isSelected ? 'bg-primary/10 dark:bg-primary/20 ring-2 ring-primary ring-inset' : ''}
                                        `}
                                    >
                                        <div className="flex flex-col h-full">
                                            <span
                                                className={`
                                                    inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold
                                                    ${!day.isCurrentMonth ? 'text-text-muted/50' : ''}
                                                    ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'dark:text-white'}
                                                    ${isTodayDate ? 'bg-primary text-white' : ''}
                                                `}
                                            >
                                                {day.date}
                                            </span>
                                            {scheduleCount > 0 && day.isCurrentMonth && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary text-white rounded">
                                                        {scheduleCount}건
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 선택된 날짜 일정 목록 */}
                    <div className="lg:col-span-1 bg-white dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                        <div className="p-5 h-[72px] border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark flex items-center">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-5 bg-primary rounded-full"></div>
                                    <Calendar size={18} className="text-primary" />
                                    <h3 className="font-bold dark:text-white">
                                        {selectedDate
                                            ? `${selectedDate.split('-')[1]}월 ${selectedDate.split('-')[2]}일`
                                            : '날짜를 선택하세요'
                                        }
                                    </h3>
                                </div>
                                {selectedDate && (
                                    <span className="px-2.5 py-1 text-xs font-bold bg-primary/10 text-primary rounded-lg">
                                        {dailySchedules.length}건
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="p-5 max-h-[500px] overflow-y-auto">
                            {!selectedDate ? (
                                <div className="text-center py-12 text-text-muted">
                                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                                        <Calendar size={32} className="text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium">캘린더에서 날짜를 선택하세요</p>
                                </div>
                            ) : dailySchedules.length === 0 ? (
                                <div className="text-center py-12 text-text-muted">
                                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                                        <Calendar size={32} className="text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium">등록된 일정이 없습니다</p>
                                    <button
                                        onClick={openNewScheduleModal}
                                        className="mt-4 text-sm text-primary font-bold hover:underline"
                                    >
                                        + 새 일정 추가
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {dailySchedules.map((schedule) => (
                                        <div
                                            key={schedule.id}
                                            className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`w-1 h-full min-h-[40px] rounded-full ${categoryColors[schedule.category] || 'bg-gray-500'}`}></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="font-bold text-sm dark:text-white truncate">
                                                            {schedule.title}
                                                        </p>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => openEditModal(schedule)}
                                                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                            >
                                                                <FileText size={14} className="text-text-muted" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(schedule.id)}
                                                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={14} className="text-red-500" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Clock size={12} className="text-text-muted" />
                                                        <span className="text-xs text-text-muted">
                                                            {schedule.startTime} - {schedule.endTime}
                                                        </span>
                                                    </div>
                                                    {schedule.content && (
                                                        <p className="text-xs text-text-muted mt-2 line-clamp-2">
                                                            {schedule.content}
                                                        </p>
                                                    )}
                                                    <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold text-white rounded ${categoryColors[schedule.category] || 'bg-gray-500'}`}>
                                                        {schedule.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedDate && dailySchedules.length > 0 && (
                            <div className="p-5 border-t border-border-light dark:border-border-dark">
                                <button
                                    onClick={openNewScheduleModal}
                                    className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors"
                                >
                                    <Plus size={18} />
                                    일정 추가
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 일정 등록/수정 모달 */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-white dark:bg-card-dark rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-border-light dark:border-border-dark animate-in zoom-in-95 duration-200">
                            {/* 모달 헤더 */}
                            <div className="p-6 md:p-8 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                    <h2 className="text-xl font-bold dark:text-white">
                                        {editingSchedule ? '일정 수정' : '새 일정 등록'}
                                    </h2>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    <X size={24} className="dark:text-white" />
                                </button>
                            </div>

                            {/* 모달 본문 */}
                            <div className="p-6 md:p-8 space-y-5">
                                {/* 에러 메시지 */}
                                {error && (
                                    <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-sm font-medium">
                                        <AlertCircle size={18} />
                                        {error}
                                    </div>
                                )}

                                {/* 제목 */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        일정 제목 <span className="text-red-500">*</span>
                                        <span className="text-xs text-gray-400 ml-2">({formData.title.length}/100)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                        maxLength={100}
                                        placeholder="일정 제목을 입력하세요 (최대 100자)"
                                        className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-transparent outline-none transition-all placeholder:text-text-muted"
                                    />
                                </div>

                                {/* 날짜 */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        날짜 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="schedule_date"
                                        value={formData.schedule_date}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-transparent outline-none transition-all"
                                    />
                                </div>

                                {/* 시간 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            시작 시간 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            name="start_time"
                                            value={formData.start_time}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            종료 시간 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            name="end_time"
                                            value={formData.end_time}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* 카테고리 */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        카테고리
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                                    formData.category === cat
                                                        ? `${categoryColors[cat]} text-white shadow-lg`
                                                        : 'bg-gray-100 dark:bg-gray-800 text-text-muted hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 내용 */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        상세 내용
                                    </label>
                                    <textarea
                                        name="content"
                                        value={formData.content}
                                        onChange={handleInputChange}
                                        placeholder="일정에 대한 상세 내용을 입력하세요 (선택)"
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-transparent outline-none transition-all resize-none placeholder:text-text-muted"
                                    />
                                </div>
                            </div>

                            {/* 모달 푸터 */}
                            <div className="p-6 md:p-8 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark rounded-b-[2rem] flex items-center justify-end gap-3">
                                <button
                                    onClick={closeModal}
                                    className="px-6 py-2.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            저장 중...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            저장
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
};

export default SchedulePage;
