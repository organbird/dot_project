/**
 * API 유틸리티 모듈
 *
 * JWT 토큰 관리 및 인증이 포함된 API 요청을 처리합니다.
 */

// API 기본 URL
// 프론트엔드 포트에 따라 백엔드 포트 자동 매핑 (5173->8000, 5174->8001)
const getApiBase = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    const frontendPort = window.location.port;
    const backendPort = frontendPort === '5174' ? '8001' : '8000';
    return `http://${window.location.hostname}:${backendPort}`;
};
const API_BASE = getApiBase();

/**
 * localStorage에서 액세스 토큰을 가져옵니다.
 */
export const getToken = () => {
    return localStorage.getItem('access_token');
};

/**
 * localStorage에 액세스 토큰을 저장합니다.
 */
export const setToken = (token) => {
    localStorage.setItem('access_token', token);
};

/**
 * localStorage에서 액세스 토큰을 삭제합니다.
 */
export const removeToken = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
};

/**
 * localStorage에 사용자 정보를 저장합니다.
 */
export const setUser = (user) => {
    localStorage.setItem('user', JSON.stringify(user));
};

/**
 * localStorage에서 사용자 정보를 가져옵니다.
 */
export const getStoredUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

/**
 * 인증 헤더를 포함한 fetch 요청을 수행합니다.
 *
 * @param {string} url - API 엔드포인트 URL
 * @param {object} options - fetch 옵션 (method, body 등)
 * @returns {Promise<Response>} fetch 응답
 */
export const authFetch = async (url, options = {}) => {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // 토큰이 있으면 Authorization 헤더 추가
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // 401 응답 시 토큰 삭제 (만료 또는 유효하지 않음)
    if (response.status === 401) {
        removeToken();
        // 로그인 페이지로 리다이렉트 (선택적)
        // window.location.href = '/login';
    }

    return response;
};

/**
 * 현재 토큰으로 사용자 정보를 검증하고 가져옵니다.
 *
 * @returns {Promise<object|null>} 사용자 정보 또는 null (토큰 없음/만료)
 */
export const verifyToken = async () => {
    const token = getToken();
    if (!token) {
        return null;
    }

    try {
        const response = await authFetch(`${API_BASE}/api/me`);

        if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            return userData;
        } else {
            // 토큰이 유효하지 않음
            removeToken();
            return null;
        }
    } catch (error) {
        console.error('토큰 검증 실패:', error);
        removeToken();
        return null;
    }
};

/**
 * 로그아웃 처리
 */
export const logout = () => {
    removeToken();
    window.location.href = '/login';
};

export { API_BASE };