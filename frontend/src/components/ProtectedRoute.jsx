// src/components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = ({ isAllowed, redirectPath = '/login', children }) => {
    // 권한이 없으면 로그인 페이지(또는 지정된 경로)로 보냄
    if (!isAllowed) {
        // replace: 뒤로가기 했을 때 다시 권한 제한 페이지로 돌아오지 않게 기록을 대체함
        return <Navigate to={redirectPath} replace />;
    }

    // 조건이 맞으면 자식 컴포넌트(Route)들을 보여줌
    // children이 있으면 children을, 없으면 중첩 라우트의 <Outlet />을 렌더링
    return children ? children : <Outlet />;
};

export default ProtectedRoute;