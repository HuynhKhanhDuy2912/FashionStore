import Notification from "../models/Notification.js";
import User from "../models/User.js";

export const createNotificationForAdmins = async (type, data) => {
  try {
    const admins = await User.find({ role: "admin" }).select("_id");
    if (admins.length === 0) return;

    const notifications = admins.map((admin) => {
      let title = "";
      let message = "";

      if (type === "order") {
        title = "Đơn hàng mới";
        message = `Đơn hàng #${data.orderNumber} từ ${data.customerName}`;
      } else if (type === "review") {
        title = "Bình luận mới";
        message = `${data.userName} đã bình luận về ${data.productName}`;
      }

      return {
        userId: admin._id,
        type,
        title,
        message,
        isRead: false,
        metadata: data,
      };
    });

    await Notification.insertMany(notifications);
  } catch (error) {
    console.error("Error creating notifications:", error);
  }
};

export const getNotifications = async (userId, { limit = 50, lastCheckedAt = null } = {}) => {
  try {
    const query = { userId };
    if (lastCheckedAt) {
      query.createdAt = { $gt: new Date(lastCheckedAt) };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return notifications;
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
};

export const getUnreadCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      userId,
      isRead: false,
    });
    return count;
  } catch (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }
};

export const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    return notification;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return null;
  }
};

export const markAllAsRead = async (userId) => {
  try {
    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return true;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return false;
  }
};
