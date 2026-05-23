import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../services/notification.service.js";

export const getMyNotifications = async (req, res) => {
  try {
    const { lastCheckedAt, limit } = req.query;
    const notifications = await getNotifications(req.user._id, {
      lastCheckedAt: lastCheckedAt || null,
      limit: Number(limit) || 50,
    });

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyUnreadCount = async (req, res) => {
  try {
    const unreadCount = await getUnreadCount(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Unread count fetched successfully",
      data: { unreadCount },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await markAsRead(req.params.id, req.user._id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const ok = await markAllAsRead(req.user._id);

    if (!ok) {
      return res.status(500).json({
        success: false,
        message: "Failed to mark all notifications as read",
      });
    }

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  getMyNotifications,
  getMyUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
