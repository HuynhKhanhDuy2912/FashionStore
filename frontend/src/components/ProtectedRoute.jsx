import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

/**
 * GuestRoute – ngược lại với ProtectedRoute.
 * Chỉ cho phép user CHƯA đăng nhập truy cập.
 * Nếu đã đăng nhập → redirect về trang chủ (hoặc trang admin nếu là admin).
 */
export function GuestRoute({ children }) {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    const redirectTo = user?.role === "admin" ? "/admin" : "/";
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
