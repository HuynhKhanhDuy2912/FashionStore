import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { token, user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const timerRef = useRef(null);

  const resetNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setLastCheckedAt(null);
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !token || user?.role !== "admin") {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await apiRequest("/notifications/unread-count", { token });
      setUnreadCount(Number(response.data?.unreadCount || 0));
    } catch (_error) {
      setUnreadCount(0);
    }
  }, [isAuthenticated, token, user?.role]);

  const fetchNotifications = useCallback(async (options = {}) => {
    if (!isAuthenticated || !token || user?.role !== "admin") {
      resetNotifications();
      return;
    }

    const { onlyNew = false } = options;
    setLoading(true);

    try {
      const query = new URLSearchParams();
      query.set("limit", "50");

      if (onlyNew && lastCheckedAt) {
        query.set("lastCheckedAt", lastCheckedAt);
      }

      const response = await apiRequest(`/notifications?${query.toString()}`, { token });
      const incoming = Array.isArray(response.data) ? response.data : [];

      if (onlyNew && incoming.length > 0) {
        setNotifications((current) => {
          const ids = new Set(current.map((item) => item._id));
          const merged = [...incoming.filter((item) => !ids.has(item._id)), ...current];
          return merged.slice(0, 50);
        });
      } else if (!onlyNew) {
        setNotifications(incoming);
      }

      setLastCheckedAt(new Date().toISOString());
      await fetchUnreadCount();
    } catch (_error) {
      if (!onlyNew) {
        setNotifications([]);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchUnreadCount, isAuthenticated, lastCheckedAt, resetNotifications, token, user?.role]);

  const markNotificationAsRead = useCallback(async (notificationId) => {
    if (!notificationId || !token) return;

    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: "PATCH",
        token,
      });

      setNotifications((current) =>
        current.map((item) =>
          item._id === notificationId
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        )
      );

      setUnreadCount((current) => Math.max(current - 1, 0));
    } catch (_error) {
      // ignore
    }
  }, [token]);

  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    try {
      await apiRequest("/notifications/read-all", {
        method: "PATCH",
        token,
      });

      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (_error) {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token || user?.role !== "admin") {
      resetNotifications();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    fetchNotifications({ onlyNew: false });

    timerRef.current = setInterval(() => {
      fetchNotifications({ onlyNew: true });
    }, 30000);

    const onFocus = () => fetchNotifications({ onlyNew: true });
    window.addEventListener("focus", onFocus);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchNotifications, isAuthenticated, resetNotifications, token, user?.role]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markNotificationAsRead,
    markAllAsRead,
  }), [fetchNotifications, loading, markAllAsRead, markNotificationAsRead, notifications, unreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}
