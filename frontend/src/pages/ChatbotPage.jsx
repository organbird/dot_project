import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import UserLayout from '../components/UserLayout';
import {
    Send,
    Plus,
    MessageSquare,
    Trash2,
    Edit3,
    X,
    Check,
    StopCircle,
    Bot,
    User,
    FileText,
    Loader,
    MoreVertical,
    RefreshCw
} from 'lucide-react';
import { API_BASE } from '../utils/api';

export default function ChatbotPage({ user, setUser }) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // 세션 관리 상태
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [initialSessionLoaded, setInitialSessionLoaded] = useState(false);

    // 메시지 상태
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');
    const [referenceDocs, setReferenceDocs] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);

    // 편집 상태
    const [editingSessionId, setEditingSessionId] = useState(null);
    const [editingTitle, setEditingTitle] = useState('');

    // 세션 메뉴
    const [showSessionMenu, setShowSessionMenu] = useState(null);

    // 스크롤 자동 이동
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessage]);

    // 세션 목록 조회
    const fetchSessions = async () => {
        if (!user?.id) return;

        setSessionsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/chat/sessions/${user.id}`);
            if (response.ok) {
                const data = await response.json();
                setSessions(data.sessions);
            }
        } catch (error) {
            console.error('세션 목록 조회 실패:', error);
        } finally {
            setSessionsLoading(false);
        }
    };

    // 세션 생성
    const createSession = async () => {
        try {
            const response = await fetch(`${API_BASE}/chat/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    title: '새 대화'
                })
            });

            if (response.ok) {
                const data = await response.json();
                await fetchSessions();
                setCurrentSessionId(data.session.id);
                setMessages([]);
                setReferenceDocs([]);
            }
        } catch (error) {
            console.error('세션 생성 실패:', error);
        }
    };

    // 세션 선택
    const selectSession = async (sessionId) => {
        // 이미 선택된 세션이면 무시
        if (currentSessionId === sessionId) return;

        setCurrentSessionId(sessionId);
        setShowSessionMenu(null);
        setMessagesLoading(true);

        // 기존 상태 초기화
        setMessages([]);
        setStreamingMessage('');
        setReferenceDocs([]);

        try {
            const response = await fetch(`${API_BASE}/chat/sessions/detail/${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                // 메시지 데이터 매핑 (백엔드 응답 형식에 맞춤)
                const loadedMessages = data.messages.map(msg => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    referenceDocs: msg.referenceDocs || [],
                    createdAt: msg.createdAt
                }));
                setMessages(loadedMessages);
            } else {
                console.error('세션 조회 실패:', response.status);
                alert('대화 내역을 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('세션 조회 실패:', error);
            alert('대화 내역을 불러오는데 실패했습니다.');
        } finally {
            setMessagesLoading(false);
        }
    };

    // 세션 제목 수정
    const updateSessionTitle = async (sessionId) => {
        if (!editingTitle.trim()) return;

        if (editingTitle.length > 255) {
            alert('세션 제목은 255자 이내로 입력해주세요.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editingTitle })
            });

            if (response.ok) {
                await fetchSessions();
                setEditingSessionId(null);
                setEditingTitle('');
            }
        } catch (error) {
            console.error('세션 수정 실패:', error);
        }
    };

    // 세션 삭제
    const deleteSession = async (sessionId) => {
        if (!confirm('이 대화를 삭제하시겠습니까?')) return;

        try {
            const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchSessions();
                if (currentSessionId === sessionId) {
                    setCurrentSessionId(null);
                    setMessages([]);
                }
                setShowSessionMenu(null);
            }
        } catch (error) {
            console.error('세션 삭제 실패:', error);
        }
    };

    // 메시지 전송 (스트리밍)
    const sendMessage = async () => {
        if (!inputMessage.trim() || isGenerating) return;

        // 세션 없으면 생성
        let sessionId = currentSessionId;
        if (!sessionId) {
            const response = await fetch(`${API_BASE}/chat/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    title: inputMessage.slice(0, 30) + (inputMessage.length > 30 ? '...' : '')
                })
            });

            if (response.ok) {
                const data = await response.json();
                sessionId = data.session.id;
                setCurrentSessionId(sessionId);
                await fetchSessions();
            } else {
                alert('세션 생성에 실패했습니다.');
                return;
            }
        }

        const userMessage = inputMessage;
        setInputMessage('');
        setIsGenerating(true);
        setStreamingMessage('');
        setReferenceDocs([]);

        // 사용자 메시지 추가
        const newUserMessage = {
            id: Date.now(),
            role: 'user',
            content: userMessage,
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, newUserMessage]);

        try {
            // 스트리밍 요청
            const response = await fetch(`${API_BASE}/ai/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: userMessage,
                    history: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                })
            });

            if (!response.ok) {
                throw new Error('스트리밍 요청 실패');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let docs = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('TEXT_DATA:')) {
                        const token = line.slice(10);
                        fullResponse += token;
                        setStreamingMessage(fullResponse);
                    } else if (line.startsWith('DOCS_DATA:')) {
                        try {
                            docs = JSON.parse(line.slice(10));
                            setReferenceDocs(docs);
                        } catch (e) {
                            console.error('문서 파싱 실패:', e);
                        }
                    } else if (line.startsWith('ERROR_DATA:')) {
                        console.error('에러:', line.slice(11));
                    } else if (line === 'STOPPED_DATA:') {
                        console.log('생성 중단됨');
                        break;
                    }
                }
            }

            // 스트리밍 완료 후 메시지 추가
            if (fullResponse) {
                const assistantMessage = {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: fullResponse,
                    referenceDocs: docs,
                    createdAt: new Date().toISOString()
                };
                setMessages(prev => [...prev, assistantMessage]);
            }

        } catch (error) {
            console.error('메시지 전송 실패:', error);
            alert('메시지 전송 중 오류가 발생했습니다.');
        } finally {
            setIsGenerating(false);
            setStreamingMessage('');
            await fetchSessions(); // 세션 목록 갱신
        }
    };

    // 생성 중단
    const stopGeneration = async () => {
        if (!currentSessionId) return;

        try {
            await fetch(`${API_BASE}/ai/chat/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId })
            });
        } catch (error) {
            console.error('중단 요청 실패:', error);
        }
    };

    // 초기 로드
    useEffect(() => {
        fetchSessions();
    }, [user?.id]);

    // URL 세션 파라미터 처리 (홈페이지에서 대화 클릭 시)
    useEffect(() => {
        const sessionIdParam = searchParams.get('session');
        if (sessionIdParam && sessions.length > 0 && !initialSessionLoaded) {
            const sessionId = parseInt(sessionIdParam);
            // 세션이 존재하는지 확인
            const sessionExists = sessions.some(s => s.id === sessionId);
            if (sessionExists) {
                selectSession(sessionId);
                // URL에서 session 파라미터 제거
                setSearchParams({});
            }
            setInitialSessionLoaded(true);
        }
    }, [searchParams, sessions, initialSessionLoaded]);

    // 키보드 이벤트
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <UserLayout user={user} setUser={setUser} activeMenu="에이닷 챗봇">
            <div className="flex h-[calc(100vh-64px)] lg:h-screen bg-slate-50 dark:bg-background-dark">
                {/* 사이드바 - 세션 목록 */}
                <div className="hidden md:flex w-80 bg-white dark:bg-card-dark border-r border-border-light dark:border-border-dark flex-col">
                    {/* 새 대화 버튼 */}
                    <div className="p-4 border-b border-border-light dark:border-border-dark">
                        <button
                            onClick={createSession}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/25"
                        >
                            <Plus size={20} />
                            <span>새 대화</span>
                        </button>
                    </div>

                    {/* 세션 목록 */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {sessionsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader className="animate-spin text-primary" size={24} />
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="text-center py-12 text-text-muted">
                                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                                    <MessageSquare size={32} className="text-gray-400" />
                                </div>
                                <p className="text-sm font-medium">대화 내역이 없습니다</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {sessions.map((session) => (
                                    <div
                                        key={session.id}
                                        className={`group relative rounded-2xl transition-all ${
                                            currentSessionId === session.id
                                                ? 'bg-primary/10 dark:bg-primary/20 border-2 border-primary'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent'
                                        }`}
                                    >
                                        {editingSessionId === session.id ? (
                                            <div className="flex items-center gap-1 p-3">
                                                <input
                                                    type="text"
                                                    value={editingTitle}
                                                    onChange={(e) => setEditingTitle(e.target.value)}
                                                    onKeyPress={(e) => e.key === 'Enter' && updateSessionTitle(session.id)}
                                                    maxLength={255}
                                                    className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => updateSessionTitle(session.id)}
                                                    className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-500/20 rounded-xl transition-colors"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingSessionId(null)}
                                                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => selectSession(session.id)}
                                                className="flex items-start gap-3 p-4 cursor-pointer"
                                            >
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                    currentSessionId === session.id
                                                        ? 'bg-primary text-white'
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                                }`}>
                                                    <MessageSquare size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-semibold truncate ${
                                                        currentSessionId === session.id
                                                            ? 'text-primary'
                                                            : 'text-gray-800 dark:text-white'
                                                    }`}>
                                                        {session.title}
                                                    </p>
                                                    <p className="text-xs text-text-muted truncate mt-0.5">
                                                        {session.lastMessage || '메시지 없음'}
                                                    </p>
                                                </div>

                                                {/* 세션 메뉴 버튼 */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowSessionMenu(showSessionMenu === session.id ? null : session.id);
                                                    }}
                                                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all"
                                                >
                                                    <MoreVertical size={16} className="text-text-muted" />
                                                </button>

                                                {/* 세션 메뉴 */}
                                                {showSessionMenu === session.id && (
                                                    <div className="absolute right-3 top-14 bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl shadow-lg z-10 py-1 min-w-[130px] overflow-hidden">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingSessionId(session.id);
                                                                setEditingTitle(session.title);
                                                                setShowSessionMenu(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                                        >
                                                            <Edit3 size={14} />
                                                            <span>이름 변경</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteSession(session.id);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                                        >
                                                            <Trash2 size={14} />
                                                            <span>삭제</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 메인 채팅 영역 */}
                <div className="flex-1 flex flex-col">
                    {currentSessionId ? (
                        <>
                            {/* 메시지 영역 */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                                <div className="max-w-3xl mx-auto space-y-6">
                                    {/* 메시지 로딩 중 */}
                                    {messagesLoading && (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <Loader className="animate-spin text-primary mb-4" size={32} />
                                            <p className="text-text-muted font-medium">대화 내역을 불러오는 중...</p>
                                        </div>
                                    )}

                                    {/* 메시지 없음 (로딩 완료 후) */}
                                    {!messagesLoading && messages.length === 0 && !isGenerating && (
                                        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                                            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                                <MessageSquare size={32} className="text-gray-400" />
                                            </div>
                                            <p className="font-medium">아직 대화가 없습니다</p>
                                            <p className="text-sm mt-1">메시지를 입력하여 대화를 시작하세요</p>
                                        </div>
                                    )}

                                    {/* 메시지 목록 */}
                                    {!messagesLoading && messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex gap-4 ${
                                                message.role === 'user' ? 'flex-row-reverse' : ''
                                            }`}
                                        >
                                            {/* 아바타 */}
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                                                message.role === 'user'
                                                    ? 'bg-primary shadow-primary/30'
                                                    : 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/30'
                                            }`}>
                                                {message.role === 'user' ? (
                                                    <User size={18} className="text-white" />
                                                ) : (
                                                    <Bot size={18} className="text-white" />
                                                )}
                                            </div>

                                            {/* 메시지 내용 */}
                                            <div className={`max-w-[75%] ${
                                                message.role === 'user' ? 'text-right' : ''
                                            }`}>
                                                <div className={`inline-block px-5 py-3.5 ${
                                                    message.role === 'user'
                                                        ? 'bg-primary text-white rounded-[1.5rem] rounded-tr-lg shadow-lg shadow-primary/20'
                                                        : 'bg-white dark:bg-card-dark border border-border-light dark:border-border-dark text-gray-800 dark:text-gray-200 rounded-[1.5rem] rounded-tl-lg shadow-sm'
                                                }`}>
                                                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                                </div>

                                                {/* 참고 문서 */}
                                                {message.role === 'assistant' && message.referenceDocs && message.referenceDocs.length > 0 && (
                                                    <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border-light dark:border-border-dark">
                                                        <p className="text-xs font-bold text-text-muted mb-2 flex items-center gap-1.5">
                                                            <FileText size={12} />
                                                            참고 문서
                                                        </p>
                                                        <div className="space-y-1">
                                                            {message.referenceDocs.map((doc, idx) => (
                                                                <p key={idx} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                                                    {doc.metadata?.source || doc.content?.slice(0, 50)}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* 스트리밍 중인 메시지 */}
                                    {!messagesLoading && isGenerating && (
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
                                                <Bot size={18} className="text-white" />
                                            </div>
                                            <div className="max-w-[75%]">
                                                <div className="inline-block px-5 py-3.5 rounded-[1.5rem] rounded-tl-lg bg-white dark:bg-card-dark border border-border-light dark:border-border-dark text-gray-800 dark:text-gray-200 shadow-sm">
                                                    {streamingMessage ? (
                                                        <p className="whitespace-pre-wrap leading-relaxed">{streamingMessage}</p>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex gap-1">
                                                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                                            </div>
                                                            <span className="text-sm text-text-muted font-medium">생각 중...</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 참고 문서 (스트리밍 중) */}
                                                {referenceDocs.length > 0 && (
                                                    <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border-light dark:border-border-dark">
                                                        <p className="text-xs font-bold text-text-muted mb-2 flex items-center gap-1.5">
                                                            <FileText size={12} />
                                                            참고 문서
                                                        </p>
                                                        <div className="space-y-1">
                                                            {referenceDocs.map((doc, idx) => (
                                                                <p key={idx} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                                                    {doc.metadata?.source || doc.content?.slice(0, 50)}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {/* 입력 영역 */}
                            <div className="border-t border-border-light dark:border-border-dark bg-white dark:bg-card-dark p-4 md:p-6">
                                <div className="max-w-3xl mx-auto">
                                    <div className="flex items-end gap-3">
                                        <div className="flex-1 relative">
                                            <textarea
                                                ref={inputRef}
                                                value={inputMessage}
                                                onChange={(e) => setInputMessage(e.target.value)}
                                                onKeyPress={handleKeyPress}
                                                placeholder="메시지를 입력하세요..."
                                                rows={1}
                                                disabled={isGenerating || messagesLoading}
                                                className="w-full px-5 py-4 bg-gray-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-100 dark:disabled:bg-gray-800 dark:text-white placeholder:text-text-muted"
                                                style={{ maxHeight: '120px' }}
                                            />
                                        </div>

                                        {isGenerating ? (
                                            <button
                                                onClick={stopGeneration}
                                                className="p-4 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/25"
                                                title="생성 중단"
                                            >
                                                <StopCircle size={22} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={sendMessage}
                                                disabled={!inputMessage.trim() || messagesLoading}
                                                className="p-4 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed shadow-lg shadow-primary/25 disabled:shadow-none"
                                            >
                                                <Send size={22} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-text-muted mt-3 text-center">
                                        에이닷은 부정확한 정보를 제공할 수 있습니다. 중요한 정보는 확인하세요.
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* 세션 미선택 시 안내 화면 */
                        <div className="flex-1 flex flex-col items-center justify-center p-8">
                            <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-primary via-primary to-purple-600 flex items-center justify-center mb-8 shadow-2xl shadow-primary/30">
                                <Bot size={56} className="text-white" />
                            </div>
                            <h2 className="text-3xl font-black text-gray-800 dark:text-white mb-3">에이닷 챗봇</h2>
                            <p className="text-text-muted text-center mb-8 max-w-md leading-relaxed">
                                AI 기반 대화형 어시스턴트입니다.<br />
                                업로드된 문서를 기반으로 질문에 답변해 드립니다.
                            </p>
                            <button
                                onClick={createSession}
                                className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/25"
                            >
                                <Plus size={20} />
                                <span>새 대화 시작하기</span>
                            </button>

                            {/* 안내 카드 */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16 max-w-3xl w-full">
                                <div className="bg-white dark:bg-card-dark p-6 rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                        <MessageSquare size={24} className="text-primary" />
                                    </div>
                                    <h3 className="font-bold text-gray-800 dark:text-white mb-2">자연스러운 대화</h3>
                                    <p className="text-sm text-text-muted leading-relaxed">일상 언어로 질문하면 AI가 이해하고 답변합니다.</p>
                                </div>
                                <div className="bg-white dark:bg-card-dark p-6 rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
                                        <FileText size={24} className="text-purple-600" />
                                    </div>
                                    <h3 className="font-bold text-gray-800 dark:text-white mb-2">문서 기반 답변</h3>
                                    <p className="text-sm text-text-muted leading-relaxed">업로드된 문서를 참고하여 정확한 정보를 제공합니다.</p>
                                </div>
                                <div className="bg-white dark:bg-card-dark p-6 rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                                        <RefreshCw size={24} className="text-green-600" />
                                    </div>
                                    <h3 className="font-bold text-gray-800 dark:text-white mb-2">대화 기록 저장</h3>
                                    <p className="text-sm text-text-muted leading-relaxed">모든 대화는 자동으로 저장되어 언제든 다시 볼 수 있습니다.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </UserLayout>
    );
}
